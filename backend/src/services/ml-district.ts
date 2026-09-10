// Bridge between simulation geography (lat/lng) and the disaster-ML
// engine, which reasons in districts x dates (PROJECT.md FR-10/FR-11).
//
// Dependency-free by design: the corridor centroid table is an explicit,
// reviewable approximation for the Guwahati -> Golaghat -> Sivasagar demo
// corridor — NOT a GIS lookup. Upgrade path: replace DISTRICT_CENTROIDS
// with point-in-polygon against versioned GeoJSON (PROJECT.md FR-13/14)
// without touching callers.
import type { RiskLevel } from './risk.level.js';

export type MlBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type DistrictCentroid = { district: string; lat: number; lng: number };

// Corridor districts (seed trips: Guwahati depot, Golaghat relief camp,
// Sivasagar; Nagaon/Jorhat waypoints). Centroids are coarse on purpose.
export const DISTRICT_CENTROIDS: DistrictCentroid[] = [
  { district: 'Kamrup Metropolitan', lat: 26.18, lng: 91.75 }, // Guwahati depot
  { district: 'Nagaon', lat: 26.35, lng: 92.68 }, // AS-03 waypoint
  { district: 'Golaghat', lat: 26.51, lng: 93.97 }, // relief camp
  { district: 'Jorhat', lat: 26.75, lng: 94.21 }, // corridor midpoint
  { district: 'Sivasagar', lat: 27.14, lng: 94.63 }, // terminus
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nearest corridor district for a truck position. */
export function nearestDistrict(lat: number, lng: number): string {
  let best = DISTRICT_CENTROIDS[0]?.district ?? 'Kamrup Metropolitan';
  let bestKm = Number.POSITIVE_INFINITY;
  for (const c of DISTRICT_CENTROIDS) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c.district;
    }
  }
  return best;
}

export type BandScore = { score: number; level: RiskLevel };

const BAND_SCORES: Record<MlBand, BandScore> = {
  CRITICAL: { score: 85, level: 'RED' },
  HIGH: { score: 65, level: 'HIGH' },
  MODERATE: { score: 40, level: 'MEDIUM' },
  LOW: { score: 15, level: 'LOW' },
};

/** ML band -> backend score/level (FR-10 bands, FR-03 alert levels). */
export function mlBandToScore(band: string): BandScore {
  return BAND_SCORES[band as MlBand] ?? BAND_SCORES['LOW'];
}

export function isMlBand(value: unknown): value is MlBand {
  return value === 'LOW' || value === 'MODERATE' || value === 'HIGH' || value === 'CRITICAL';
}
