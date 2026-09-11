import axios from 'axios';
import { emitBlockageAlert, emitDetourAlert, emitRiskAlert, emitVehicleUpdate } from '../sockets/index.js';
import { prisma } from './db.js';
import { askMl, type MlAssessment, type ScenarioOverrides } from './ml-client.js';
import { nearestDistrict } from './ml-district.js';
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
const ROUTES: Record<string, Coordinates[]> = {  'AS-01-FOOD-04': [
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

  'AS-04-WATER-09': [
    { lng: 91.7458, lat: 26.1844 }, // Guwahati depot
    { lng: 94.2045, lat: 26.7531 }, // via Jorhat (Bhogdoi erosion ASDMA-05)
    { lng: 94.63, lat: 27.14 }, // Sivasagar relief camp (Dikhow breach ASDMA-06)
  ],

  'AS-05-SHELTER-12': [
    { lng: 91.7458, lat: 26.1844 }, // Guwahati depot
    { lng: 92.5433, lat: 26.16753 }, // via Kakatigaon (flood damage ASDMA-02)
    { lng: 93.97, lat: 26.51 }, // Golaghat relief camp
  ],
};

/** Final corridor waypoint for a truck (its trip destination). */
export function routeDestination(vehicleId: string): Coordinates | null {
  const waypoints = ROUTES[vehicleId];
  if (!waypoints || waypoints.length === 0) return null;
  return waypoints[waypoints.length - 1] as Coordinates;
}

export type RemainingPath = {
  vehicleId: string;
  diverted: boolean;
  done: boolean;
  /** Road line from the truck's current index to the destination. */
  remaining: Coordinates[];
};

/** Live road still ahead of a truck (powers the map's blue line while the
 * truck runs a backend-known detour Google can't see). Null when unknown. */
export function getRemainingPath(vehicleId: string): RemainingPath | null {
  const truck = trucks.get(vehicleId);
  const p = progress.get(vehicleId);
  if (!truck || !p || p.line.length === 0) return null;
  const idx = Math.min(Math.max(p.idx, 0), p.line.length - 1);
  return {
    vehicleId,
    diverted: p.diverted || truck.diverted === true,
    done: p.done,
    remaining: p.line.slice(idx),
  };
}

const TICK_MS = 2000;
const POINTS_PER_TRIP = 150; //Full trip = approx 5min at 1 point/2s
const SPEED_KMH = 40;
const SLOW_KMH = 20; // ML HIGH band: cautious speed instead of a full stop
const CRAWL_KMH = 10; // ML CRITICAL band: crawl, never a full stop (only real
// RED incidents stop trucks — FRONTEND_HANDOFF.md §7: "only real RED
// incidents (15 km radius) can block trucks"). The model predicts CRITICAL
// for most corridor districts on every scenario date, so a CRITICAL hard
// stop would freeze the whole fleet permanently on all dates.

// Step 5 stop rule (temporary brains until Aryan returns): on the active
// scenario date, a truck entering BLOCK_RADIUS_KM of a RED incident first
// tries the alternate road (tryDivert — once per date); only when no safe
// alternate exists does it stop. HIGH never stops (depot guard: KAM-01 sits
// ~2 km from the depot).
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

// What-if knobs for the ML engine (set via POST /api/simulation/scenario).
// They become sidecar overrides; empty = pure recorded district-date row.
let scenarioOverrides: ScenarioOverrides = {};
// ML answers cached per district+date+knobs so the 2s tick never hammers :8000.
const mlCache = new Map<string, (MlAssessment & { source: 'ml' }) | null>();
// Latest ML state per truck, surfaced in GET /api/simulation/status.
const mlState = new Map<string, { district: string; band: MlAssessment['band'] | null; confidence: number | null; source: 'ml' | 'heuristic' }>();

export function getScenarioOverrides(): ScenarioOverrides {
  return { ...scenarioOverrides };
}

/** Full scenario switch: date + what-if knobs. Clears ML cache, unblocks trucks. */
export function setScenario(date: string, overrides: ScenarioOverrides = {}): void {
  scenarioOverrides = { ...overrides };
  mlCache.clear();
  mlState.clear();
  setScenarioDate(date);
}

function mlCacheKey(district: string): string {
  return `${district}|${activeDate}|${scenarioOverrides.rainfall_mm ?? ''}|${scenarioOverrides.river_danger_level_count ?? ''}`;
}

/** Motion decision from an ML band: CRITICAL crawls, HIGH slows, else go.
 * ML never fully stops a truck — full stops come only from real RED
 * incidents (see the BLOCK_RADIUS_KM rule in tick()). */
export function mlMotionFor(band: string | null): 'slow' | 'go' {
  if (band === 'CRITICAL' || band === 'HIGH') return 'slow';
  return 'go';
}

/** ML assessment for any position (also used by the tick loop). Exported for tests/replay. */
export async function assessTruckMl(vehicleId: string, lat: number, lng: number) {
  const district = nearestDistrict(lat, lng);
  const key = mlCacheKey(district);
  let cached = mlCache.has(key) ? mlCache.get(key) : undefined;
  if (cached === undefined) {
    const assessment = await askMl(
      { lat, lng, eventDate: activeDate, ...scenarioOverrides },
      scenarioOverrides.rainfall_mm ?? 0
    );
    cached = assessment ? { ...assessment, source: 'ml' as const } : null;
    mlCache.set(key, cached);
  }
  const state = cached
    ? { district, band: cached.band, confidence: cached.confidence, source: cached.source }
    : { district, band: null, confidence: null, source: 'heuristic' as const };
  mlState.set(vehicleId, state);
  return state;
}

export function getMlState(): Record<string, { district: string; band: string | null; confidence: number | null; source: string }> {
  return Object.fromEntries(mlState);
}

// Demo date switch (19-07 onset / 28-07 peak / 09-08 relief). Unblocks trucks
// so the new date replays from current positions.
export function getScenarioDate(): string {
  return activeDate;
}

export function setScenarioDate(date: string): void {
  activeDate = date;
  cachedDate = null;
  mlCache.clear(); // assessments are per date
  for (const truck of trucks.values()) {
    if (truck.status === 'blocked' || truck.status === 'idle') {
      // New date replays from current positions (unblocks RED stops and
      // re-drives completed trips).
      truck.status = 'moving';
      truck.speed = SPEED_KMH;
    }
    truck.diverted = false;
  }
  for (const p of progress.values()) {
    p.done = false;
    p.diverted = false;
    p.divertCount = 0;
    p.lastDivertIdx = -MIN_DIVERT_GAP;
  }
}

// Replay helper for POST /api/simulation/start (driver-safe: no date change,
// RED-blocked trucks stay blocked). Re-drives trucks that already arrived so
// judges/drivers can watch a full trip again. When vehicleId is given, only
// that truck replays.
export function resetCompletedTrips(vehicleId?: string): Truck[] {
  for (const [id, p] of progress) {
    if (!p.done) continue;
    if (vehicleId !== undefined && id !== vehicleId) continue;
    p.done = false;
    p.diverted = false;
    p.divertCount = 0;
    p.lastDivertIdx = -MIN_DIVERT_GAP;
    p.idx = 0;
    const truck = trucks.get(id);
    if (truck) {
      // Snap back to the depot immediately so the map + guidance refetch
      // from the true restart point (no stale destination-position flicker).
      const start = p.line[0] as Coordinates | undefined;
      if (start) {
        truck.lat = start.lat;
        truck.lng = start.lng;
      }
      truck.diverted = false;
      if (truck.status === 'idle') {
        truck.status = 'moving';
        truck.speed = SPEED_KMH;
      }
    }
  }
  return [...trucks.values()];
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

//Per-truck progress along its road line. done=true parks the truck at its
//destination until a date switch or POST /api/simulation/start replays it.
//diverted=true means the line is the alternate road after a RED diversion;
//divertCount/lastDivertIdx bound chained diversions (see tryDivert).
const progress = new Map<string, { line: Coordinates[]; idx: number; done: boolean; diverted: boolean; divertCount: number; lastDivertIdx: number }>();

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
    progress.set(vehicleId, { line, idx: 0, done: false, diverted: false, divertCount: 0, lastDivertIdx: -MIN_DIVERT_GAP });
    truck.status = 'moving';
    truck.speed = SPEED_KMH;
    truck.diverted = false;
  }
  timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    void tick().finally(() => {
      ticking = false;
    });
  }, TICK_MS);
}

// RED diversion: when a truck is about to enter a RED incident zone, try to
// move it onto the alternate road (Google → OSRM → contingency) instead of
// stopping it. The alternate must genuinely bypass the TRIGGERING incident:
// points within ESCAPE_KM of the truck are the escape segment (exempt), every
// point beyond that must stay clear of the trigger zone. Downstream REDs get
// their own divert-or-block decision when reached (chained diversions capped
// by MAX_DIVERTS with a MIN_DIVERT_GAP spacing so the truck can't ping-pong
// on one spot and hammer the routing API). When no bypass exists, the truck
// stops as before. Dynamic import dodges the static cycle (routing.service
// imports helpers from this module).
const ESCAPE_KM = 5;
const MAX_DIVERTS = 3;
const MIN_DIVERT_GAP = 25;
// North-bank diversion waypoint (Tezpur, NH-15) — the same detour the RED
// banner recommends. Used when the routing engine's own alternate still clips
// the trigger zone: a real OSRM road route far around it.
const TEZPUR_VIA: Coordinates = { lat: 26.6339, lng: 92.7926 };

/** Pure bypass test (exported for unit tests): escape segment exempt, the
 * rest of the candidate must stay outside the trigger's block radius. */
export function alternateClearsTrigger(
  candidate: Coordinates[],
  trigger: { lat: number; lng: number },
  start: Coordinates,
): boolean {
  return candidate.every((pt) => {
    if (haversineKm(pt.lat, pt.lng, start.lat, start.lng) <= ESCAPE_KM) return true;
    return haversineKm(pt.lat, pt.lng, trigger.lat, trigger.lng) > BLOCK_RADIUS_KM;
  });
}

async function tryDivert(
  vehicleId: string,
  from: Coordinates,
  trigger: { id: string; lat: number; lng: number },
): Promise<{ line: Coordinates[]; label: string } | null> {
  const dest = routeDestination(vehicleId);
  if (!dest) return null;
  const options: Array<{ line: Coordinates[]; label: string }> = [];
  try {
    const { getRoute } = await import('./routing.service.js');
    const route = await getRoute(from, dest);
    if (route.alternate.length > 1) {
      options.push({ line: route.alternate, label: route.alternateLabel });
    }
  } catch {
    // Routing engine unreachable — fall through to the Tezpur road below.
  }
  try {
    const tezpurLine = await fetchRoadLine([from, TEZPUR_VIA, dest]);
    if (tezpurLine.length > 1) {
      options.push({ line: tezpurLine, label: 'Tezpur & NH-15 north-bank diversion' });
    }
  } catch {
    // OSRM unreachable — nothing to divert onto.
  }
  for (const option of options) {
    if (alternateClearsTrigger(option.line, trigger, from)) {
      return { line: resample(option.line, POINTS_PER_TRIP), label: option.label };
    }
  }
  return null;
}

async function tick(): Promise<void> {
  const blocks = await getBlocks();
  for (const [vehicleId, truck] of trucks) {
    if (truck.status === 'blocked') continue; // stays stopped until date change/restart
    const p = progress.get(vehicleId);
    if (!p || p.done) continue;
    if (p.idx >= p.line.length - 1) {
      // Arrived: park at the destination with status idle (no wrap-around —
      // at least one truck must visibly reach its destination per trip).
      // A date switch or POST /api/simulation/start replays the trip.
      const end = p.line[p.line.length - 1] as Coordinates;
      truck.lat = end.lat;
      truck.lng = end.lng;
      truck.status = 'idle';
      truck.speed = 0;
      p.done = true;
      console.warn(`[sim] ${vehicleId} ARRIVED at destination on ${activeDate}`);
      emitVehicleUpdate(truck);
      continue;
    }
    p.idx = p.idx + 1; // no wrap: demo runs until arrival, then replays on demand
    const { lng, lat } = p.line[p.idx] as Coordinates;
    const hit = blocks.find((b) => haversineKm(lat, lng, b.lat, b.lng) <= BLOCK_RADIUS_KM);
    if (hit) {
      // First RED encounter (or a fresh one far down the road): try the
      // alternate road before stopping. Chained diversions are capped and
      // spaced so one spot can't trigger an API-hammering ping-pong loop.
      if (p.divertCount < MAX_DIVERTS && p.idx - p.lastDivertIdx > MIN_DIVERT_GAP) {
        const detour = await tryDivert(vehicleId, { lat, lng }, hit);
        if (detour) {
          p.line = detour.line;
          p.idx = 0;
          p.diverted = true;
          p.divertCount += 1;
          p.lastDivertIdx = 0;
          truck.lat = lat;
          truck.lng = lng;
          truck.status = 'moving';
          truck.speed = SLOW_KMH;
          truck.diverted = true;
          console.warn(`[sim] ${vehicleId} DIVERTED onto alternate road near ${hit.id} on ${activeDate}`);
          emitVehicleUpdate(truck);
          emitDetourAlert({
            vehicleId,
            lat,
            lng,
            reason: `RED incident ${hit.id} on primary corridor — diverted: ${detour.label}`,
            incidentId: hit.id,
            alternateLabel: detour.label,
            scenarioDate: activeDate,
          });
          continue;
        }
      }
      truck.lat = lat;
      truck.lng = lng;
      truck.status = 'blocked';
      truck.speed = 0;
      console.warn(`[sim] ${vehicleId} BLOCKED near ${hit.id} on ${activeDate}`);
      emitVehicleUpdate(truck);
      emitBlockageAlert({
        vehicleId,
        lat,
        lng,
        reason: `RED incident ${hit.id} within ${BLOCK_RADIUS_KM} km`,
        incidentId: hit.id,
        scenarioDate: activeDate,
      });
      continue;
    }
    // ML engine assessment for the truck's current district (cached per
    // district+date+knobs; silent heuristic degradation when sidecar is down).
    // ML only modulates speed (CRITICAL crawls, HIGH slows) — it never stops
    // trucks; only real RED incidents above can do that.
    const prevBand = mlState.get(vehicleId)?.band ?? null;
    const ml = await assessTruckMl(vehicleId, lat, lng);
    updateTruck(truck, lat, lng);
    if (ml.band === 'CRITICAL') {
      truck.speed = CRAWL_KMH; // crawl through CRITICAL-band district
    } else if (ml.band === 'HIGH') {
      truck.speed = SLOW_KMH; // cautious speed through HIGH-band district
    }
    emitVehicleUpdate(truck);
    // Risk alerts only on band transitions (not every 2s tick) to avoid spam.
    if ((ml.band === 'HIGH' || ml.band === 'CRITICAL') && ml.band !== prevBand) {
      emitRiskAlert({
        vehicleId,
        district: ml.district,
        band: ml.band,
        confidence: ml.confidence,
        source: ml.source,
        scenarioDate: activeDate,
      });
    }
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

// Mock-GPS ingest for POST /api/simulation/location (PROJECT.md §9).
// Moves the truck on the live map and snaps the internal clock's progress
// index to the nearest line point so the next tick continues smoothly.
// Never unblocks: a blocked truck keeps status blocked (RED/ML rules own
// unblocking via date change). Returns null for unknown vehicleIds.
export function ingestMockGps(
  vehicleId: string,
  lat: number,
  lng: number,
  speed?: number,
): Truck | null {
  const truck = trucks.get(vehicleId);
  if (!truck) return null;
  truck.lat = lat;
  truck.lng = lng;
  if (truck.status !== 'blocked') {
    truck.status = 'moving';
    truck.speed = speed ?? SPEED_KMH;
  } else {
    truck.speed = 0;
  }
  const p = progress.get(vehicleId);
  if (p && p.line.length > 0) {
    let best = 0;
    let bestKm = Number.POSITIVE_INFINITY;
    for (let i = 0; i < p.line.length; i++) {
      const pt = p.line[i] as Coordinates;
      const km = haversineKm(lat, lng, pt.lat, pt.lng);
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    }
    p.idx = best;
    p.done = false;
  }
  return truck;
}

export function stopSimulation(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
