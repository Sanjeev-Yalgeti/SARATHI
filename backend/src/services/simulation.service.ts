import axios from 'axios';
import { prisma } from './db.js';
import { trucks, type Truck } from './trucks.js';

// One GPS point: named fields instead of an anonymous [lng, lat] pair.
// Exported for the routing stub (Step 6) until Aryan's service lands.
export type Coordinates = {
  //made the type coordinates for better readability
  lng: number;
  lat: number;
};

// Corridor: Guwahati → Golaghat → Sivasagar via NH27/NH37 (naman_alone.md step 3).
// OSRM wants lng,lat pairs joined by ';'.
const ROUTES: Record<string, Coordinates[]> = {
  'AS-01-FOOD-04': [
    { lng: 91.7458, lat: 26.1844 }, // Guwahati depot
    { lng: 93.97, lat: 26.51 }, // Golaghat relief camp
  ],

  'AS-02-MED-11': [
    { lng: 91.7458, lat: 26.1844 }, // Guwahati depot
    { lng: 93.97, lat: 26.51 }, // via Golaghat
    { lng: 94.63, lat: 27.14 }, // Sivasagar
  ],

  'AS-03-FUEL-07': [
    { lng: 91.7458, lat: 26.1844 }, // Guwahati depot
    { lng: 92.68, lat: 26.35 }, // via Nagaon (waypoint, not a depot)
    { lng: 94.63, lat: 27.14 }, // Sivasagar
  ],
};

const TICK_MS = 2000;
const POINTS_PER_TRIP = 150; //Full trip = approx 5min at 1 point/2s
const SPEED_KMH = 40;

// Step 5 stop rule (temporary brains until Aryan returns): on the active
// scenario date, a truck entering BLOCK_RADIUS_KM of a RED incident stops.
// HIGH never stops (depot guard: KAM-01 sits ~2 km from the depot).
const BLOCK_RADIUS_KM = 15;
let activeDate = process.env['SCENARIO_DATE'] ?? '2026-07-28';
let cachedDate: string | null = null;
let cachedBlocks: Array<{ id: string; lat: number; lng: number }> = [];

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function getBlocks(): Promise<Array<{ id: string; lat: number; lng: number }>> {
  if (cachedDate === activeDate) return cachedBlocks;
  try {
    cachedBlocks = await prisma.incident.findMany({
      where: { eventDate: activeDate, severity: 'RED' },
      select: { id: true, lat: true, lng: true },
    });
    cachedDate = activeDate;
  } catch (err) {
    console.warn('[sim] incident lookup failed, keep moving:', (err as Error).message);
  }
  return cachedBlocks;
}

// Demo date switch (19-07 onset / 28-07 peak / 09-08 relief). Unblocks trucks
// so the new date replays from current positions.
export function setScenarioDate(date: string): void {
  activeDate = date;
  cachedDate = null;
  for (const truck of trucks.values()) {
    if (truck.status === 'blocked') {
      truck.status = 'moving';
      truck.speed = SPEED_KMH;
    }
  }
}

let timer: NodeJS.Timeout | null = null;
let ticking = false;

// Evenly spaced fake GPS dots on the straight line from a to b.
// t = 0 gives a, t = 1 gives b, t = 0.5 the midpoint.
function straightLine(a: Coordinates, b: Coordinates, n: number): Coordinates[] {
  const pts: Coordinates[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    pts.push({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t });
  }
  return pts;
}

function resample(coords: Coordinates[], n: number): Coordinates[] {
  if (coords.length === 0) return [];
  if (n <= 1) return [coords[0] as Coordinates];
  if (coords.length >= n) {
    // Evenly pick n points along the OSRM line.
    const out: Coordinates[] = [];
    for (let i = 0; i < n; i++) {
      out.push(coords[Math.floor((i * (coords.length - 1)) / (n - 1))] as Coordinates);
    }
    return out;
  }
  // Fewer points than wanted: walk the polyline by segment length and
  // interpolate n evenly spaced points in a single pass (no recursion).
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i] as Coordinates;
    const p2 = coords[i + 1] as Coordinates;
    const len = Math.hypot(p2.lng - p1.lng, p2.lat - p1.lat);
    segLens.push(len);
    total += len;
  }
  if (total === 0) return Array.from({ length: n }, () => coords[0] as Coordinates);
  const out: Coordinates[] = [];
  let seg = 0;
  let segStart = 0; // distance covered before the current segment
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (seg < segLens.length - 1 && target > segStart + (segLens[seg] ?? 0)) {
      segStart += segLens[seg] ?? 0;
      seg += 1;
    }
    const segLen = segLens[seg] ?? 0;
    const t = segLen === 0 ? 0 : (target - segStart) / segLen;
    const p1 = coords[seg] as Coordinates;
    const p2 = coords[seg + 1] as Coordinates;
    out.push({ lng: p1.lng + (p2.lng - p1.lng) * t, lat: p1.lat + (p2.lat - p1.lat) * t });
  }
  return out;
}

export async function fetchRoadLine(waypoints: Coordinates[]): Promise<Coordinates[]> {
  const base = process.env['OSRM_BASE_URL'] ?? 'https://router.project-osrm.org';
  const coords = waypoints.map(({ lng, lat }) => `${lng},${lat}`).join(';');
  const res = await axios.get(
    `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    { timeout: 8000 }
  );
  // OSRM returns raw [lng, lat] pairs — convert to Coordinates at the boundary.
  const raw = res.data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
  if (!raw || raw.length < 2) throw new Error('OSRM returned no geometry');
  return raw.map(([lng, lat]) => ({ lng, lat }));
}

//Per-truck progress along its road line.
const progress = new Map<string, { line: Coordinates[]; idx: number }>();

export async function startSimulation(): Promise<void> {
  if (timer) return;
  for (const [vehicleId, truck] of trucks) {
    const waypoints = ROUTES[vehicleId];
    if (!waypoints) continue;
    let line: Coordinates[];
    try {
      line = resample(await fetchRoadLine(waypoints), POINTS_PER_TRIP);
    } catch (err) {
      console.warn(
        `[sim] OSRM failed for ${vehicleId}, using straight line:`,
        (err as Error).message
      );
      line = resample(
        waypoints.flatMap((w, i) =>
          i === 0 ? [] : straightLine(waypoints[i - 1] as Coordinates, w, 20)
        ),
        POINTS_PER_TRIP
      );
    }
    progress.set(vehicleId, { line, idx: 0 });
    truck.status = 'moving';
    truck.speed = SPEED_KMH;
  }
  timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    void tick().finally(() => {
      ticking = false;
    });
  }, TICK_MS);
}

async function tick(): Promise<void> {
  const blocks = await getBlocks();
  for (const [vehicleId, truck] of trucks) {
    if (truck.status === 'blocked') continue; // stays stopped until date change/restart
    const p = progress.get(vehicleId);
    if (!p) continue;
    p.idx = (p.idx + 1) % p.line.length; //wrap:demo runs forever
    const { lng, lat } = p.line[p.idx] as Coordinates;
    const hit = blocks.find((b) => haversineKm(lat, lng, b.lat, b.lng) <= BLOCK_RADIUS_KM);
    if (hit) {
      truck.lat = lat;
      truck.lng = lng;
      truck.status = 'blocked';
      truck.speed = 0;
      console.warn(`[sim] ${vehicleId} BLOCKED near ${hit.id} on ${activeDate}`);
      continue;
    }
    updateTruck(truck, lat, lng);
  }
}

function updateTruck(truck: Truck, lat: number, lng: number): void {
  truck.lat = lat;
  truck.lng = lng;
  if (truck.status !== 'blocked') {
    truck.status = 'moving';
    truck.speed = SPEED_KMH;
  }
}

export function stopSimulation(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
