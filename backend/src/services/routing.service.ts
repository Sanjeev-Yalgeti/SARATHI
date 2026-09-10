// Routing stub (Step 6, Naman interim) — Aryan replaces this file's insides
// with Google Routes API (TRAFFIC_AWARE + departureTime) + OSRM fallback.
// Contract: same road twice — primary + alternate labelled "via Bongaigaon
// village roads". Shape matches BACKEND_TASKS §2.2 so the swap is drop-in;
// Dhruv's model later decides which of the two is safer.
import { fetchRoadLine, haversineKm, type Coordinates } from './simulation.service.js';

export interface RouteResult {
  primary: Coordinates[];
  alternate: Coordinates[];
  alternateLabel: string;
  distance_km: number;
  duration_min: number;
  traffic_level: string;
  blocked: boolean;
  stub: boolean;
}

const ALT_LABEL = 'via Bongaigaon village roads';
// Nudge so the map draws two visible lines instead of one on top of the other.
const ALT_NUDGE = 0.008;
const SPEED_KMH = 40;

function pathLengthKm(line: Coordinates[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const p1 = line[i] as Coordinates;
    const p2 = line[i + 1] as Coordinates;
    total += haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
  }
  return total;
}

export async function getRoute(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  let primary: Coordinates[];
  try {
    primary = await fetchRoadLine([from, to]);
  } catch (err) {
    console.warn('[routes] OSRM failed, using straight line:', (err as Error).message);
    primary = [from, to];
  }
  // Stub alternate: same road, nudged north so both lines are visible.
  const alternate = primary.map((p) => ({ lng: p.lng, lat: p.lat + ALT_NUDGE }));
  const distance_km = Math.round(pathLengthKm(primary) * 10) / 10;
  return {
    primary,
    alternate,
    alternateLabel: ALT_LABEL,
    distance_km,
    duration_min: Math.round((distance_km / SPEED_KMH) * 60),
    traffic_level: 'unknown',
    blocked: false,
    stub: true,
  };
}
