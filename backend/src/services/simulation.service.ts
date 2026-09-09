import axios from 'axios';
import { trucks, type Truck } from './trucks.js';

// Corridor: Guwahati → Golaghat → Sivasagar via NH27/NH37 (naman_alone.md step 3).
// OSRM wants lng,lat pairs joined by ';'.
const ROUTES: Record<string, Array<[number, number]>> = {
  'AS-01-FOOD-04': [
    [91.7458, 26.1844], // Guwahati depot
    [93.97, 26.51], // Golaghat relief camp
  ],

  'AS-02-MED-11': [
    [91.7458, 26.1844], // Guwahati depot
    [93.97, 26.51], // via Golaghat
    [94.63, 27.14], // Sivasagar
  ],

  'AS-03-FUEL-07': [
    [91.7458, 26.1844], // Guwahati depot
    [92.68, 26.35], // via Nagaon (waypoint, not a depot)
    [94.63, 27.14], // Sivasagar
  ],
};

const TICK_MS = 2000;
const POINTS_PER_TRIP = 150; //Full trip = approx 5min at 1 point/2s
const SPEED_KMH = 40;

let timer: NodeJS.Timeout | null = null;
//Array<[number,number]> means array of exactly 2 numbers which is longitutde & latitude for coordinates
function straightLine(
  a: [number, number],
  b: [number, number],
  n: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

function resample(coords: Array<[number, number]>, n: number): Array<[number, number]> {
  if (coords.length === 0) return [];
  if (n <= 1) return [coords[0] as [number, number]];
  if (coords.length >= n) {
    // Evenly pick n points along the OSRM line.
    const out: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      out.push(coords[Math.floor((i * (coords.length - 1)) / (n - 1))] as [number, number]);
    }
    return out;
  }
  // Fewer points than wanted: walk the polyline by segment length and
  // interpolate n evenly spaced points in a single pass (no recursion).
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i] as [number, number];
    const [x2, y2] = coords[i + 1] as [number, number];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segLens.push(len);
    total += len;
  }
  if (total === 0) return Array.from({ length: n }, () => coords[0] as [number, number]);
  const out: Array<[number, number]> = [];
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
    const [x1, y1] = coords[seg] as [number, number];
    const [x2, y2] = coords[seg + 1] as [number, number];
    out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return out;
}

async function fetchRoadLine(waypoints: Array<[number, number]>): Promise<Array<[number, number]>> {
  const base = process.env['OSRM_BASE_URL'] ?? 'https://router.project-osrm.org';
  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const res = await axios.get(
    `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    { timeout: 8000 }
  );
  const line = res.data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
  if (!line || line.length < 2) throw new Error('OSRM returned no gemometry');
  return line;
}

//Per-truck progress along its road line.
const progress = new Map<string, { line: Array<[number, number]>; idx: number }>();

export async function startSimulation(): Promise<void> {
  if (timer) return;
  for (const [vehicleId, truck] of trucks) {
    const waypoints = ROUTES[vehicleId];
    if (!waypoints) continue;
    let line: Array<[number, number]>;
    try {
      line = resample(await fetchRoadLine(waypoints), POINTS_PER_TRIP);
    } catch (err) {
      console.warn(
        `[sim] OSRM failed for ${vehicleId}, using straight line:`,
        (err as Error).message
      );
      line = resample(
        waypoints.flatMap((w, i) =>
          i === 0 ? [] : straightLine(waypoints[i - 1] as [number, number], w, 20)
        ),
        POINTS_PER_TRIP
      );
    }
    progress.set(vehicleId, { line, idx: 0 });
    truck.status = 'moving';
    truck.speed = SPEED_KMH;
  }
  timer = setInterval(tick, TICK_MS);
}

function tick(): void {
  for (const [vehicleId, truck] of trucks) {
    const p = progress.get(vehicleId);
    if (!p) continue;
    p.idx = (p.idx + 1) % p.line.length; //wrap:demo runs forever
    const [lng, lat] = p.line[p.idx] as [number, number];
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
