import type { Request } from 'express';
import { prisma } from '../services/db.js';
import { trucks, type Truck } from '../services/trucks.js';

// Driver visibility radius (km) around their own truck's live position.
// Safety net for en-route breaks + field reports (which carry no district).
// Distinct from simulation BLOCK_RADIUS_KM (15) which decides stop/move.
export const DRIVER_RADIUS_KM = 25;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Own live truck for a DRIVER JWT; undefined for ADMIN or unknown id.
export function ownTruck(req: Request): Truck | undefined {
  if (req.user?.role !== 'DRIVER') return undefined;
  return trucks.get(req.user.id);
}

// Latest trip = the driver's current "assigned route".
// Old trips stay in DB (history), but scoping uses the newest by createdAt.
export async function latestTrip(driverId: string) {
  const trips = await prisma.trip.findMany({
    where: { driverId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return trips[0] ?? null;
}

// Lowercase word tokens from a trip endpoint, e.g.
// "Golaghat relief camp" -> {"golaghat", "relief", "camp"}.
export function placeTokens(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3),
  );
}

// District match: incident.district shares a token with the trip's
// origin/destination (e.g. district "Golaghat" vs destination
// "Golaghat relief camp"). Case-insensitive, no geo needed.
export function districtMatchesTrip(
  district: string | null | undefined,
  origin: string,
  destination: string,
): boolean {
  if (!district) return false;
  const tripWords = new Set([...placeTokens(origin), ...placeTokens(destination)]);
  const districtWords = district
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);
  return districtWords.some((w) => tripWords.has(w));
}
