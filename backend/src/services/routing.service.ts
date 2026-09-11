import axios from 'axios';
import { fetchRoadLine, haversineKm, type Coordinates } from './simulation.service.js';

export interface RouteResult {
  primary: Coordinates[];
  alternate: Coordinates[];
  alternateLabel: string;
  distance_km: number;
  duration_min: number;
  traffic_level: 'low' | 'moderate' | 'heavy' | 'unknown';
  blocked: boolean;
  source: 'google' | 'osrm' | 'fallback';
}

type GoogleRoute = { polyline?: { encodedPolyline?: string }; distanceMeters?: number; duration?: string; staticDuration?: string };

function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 1, shift = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 64; result += byte << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 1; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 64; result += byte << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
}

function seconds(duration?: string): number { return Number(/([\d.]+)s/.exec(duration ?? '')?.[1] ?? 0); }

function metrics(line: Coordinates[]): { km: number; min: number } {
  let km = 0;
  for (let i = 1; i < line.length; i++) km += haversineKm(line[i - 1]!.lat, line[i - 1]!.lng, line[i]!.lat, line[i]!.lng);
  return { km: Math.round(km * 10) / 10, min: Math.max(1, Math.round((km / 38) * 60)) };
}

function traffic(duration: number, staticDuration: number): RouteResult['traffic_level'] {
  if (!staticDuration) return 'unknown';
  const ratio = duration / staticDuration;
  return ratio >= 1.5 ? 'heavy' : ratio >= 1.2 ? 'moderate' : 'low';
}

function hasMeaningfulDetour(primary: Coordinates[], candidate: Coordinates[]): boolean {
  return candidate.some((point) =>
    primary.every((mainRoadPoint) => haversineKm(point.lat, point.lng, mainRoadPoint.lat, mainRoadPoint.lng) > 1)
  );
}

/**
 * Checks if a polyline leaves the Assam transport corridor into the Arunachal Pradesh mountains.
 * The Assam valley along the Brahmaputra stays below ~27.15N until Sivasagar / Dibrugarh.
 * Points with lat > 27.2 and lng < 93.8 are in East Kameng, Seppa, Koloriang, or Pakke Tiger Reserve.
 */
function leavesAssamValley(coords: Coordinates[]): boolean {
  return coords.some((pt) => (pt.lat > 26.85 && pt.lng < 94.0) || pt.lat > 27.15);
}

// Official disaster bypass waypoint in Assam valley: Tezpur & NH-15 Northern bank corridor
const TEZPUR_BYPASS: Coordinates = { lat: 26.6339, lng: 92.7926 };

function contingencyWaypoint(from: Coordinates, to: Coordinates): Coordinates {
  if (Math.min(from.lng, to.lng) < 93.0 && Math.max(from.lng, to.lng) > 93.2) {
    return TEZPUR_BYPASS;
  }
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const safeLat = Math.min(26.68, Math.max(26.20, midLat + 0.05));
  return { lat: safeLat, lng: midLng };
}

async function osrmContingencyDetour(from: Coordinates, to: Coordinates, primary: Coordinates[]): Promise<Coordinates[] | null> {
  try {
    const via = contingencyWaypoint(from, to);
    const detour = await fetchRoadLine([from, via, to]);
    if (detour.length > 1 && !leavesAssamValley(detour) && hasMeaningfulDetour(primary, detour)) {
      return detour;
    }
    return null;
  } catch {
    return null;
  }
}

async function googleRoutes(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key || key.includes('your_')) throw new Error('Google Routes key is not configured');

  const { data } = await axios.post<{ routes?: GoogleRoute[] }>(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      departureTime: new Date(Date.now() + 60_000).toISOString(),
      computeAlternativeRoutes: true,
    },
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      timeout: 8000,
    }
  );

  const routes = data.routes ?? [];
  const first = routes[0];
  if (!first?.polyline?.encodedPolyline) throw new Error('Google Routes returned no route');

  const primary = decodePolyline(first.polyline.encodedPolyline);

  // If Google Maps suggests a route heading through East Kameng - Koloriang (Arunachal mountains),
  // reject it in favor of the Assam national highway corridor via OSRM.
  if (leavesAssamValley(primary)) {
    throw new Error('Google route strays into Arunachal mountains (East Kameng / Koloriang); using OSRM Assam corridor');
  }

  const second = routes[1];
  const googleAlternate = second?.polyline?.encodedPolyline ? decodePolyline(second.polyline.encodedPolyline) : null;
  const validGoogleAlternate = googleAlternate && !leavesAssamValley(googleAlternate) ? googleAlternate : null;
  const alternate = validGoogleAlternate ?? await osrmContingencyDetour(from, to, primary).catch(() => null) ?? primary;
  const durationSeconds = seconds(first.duration);

  return {
    primary,
    alternate,
    alternateLabel: validGoogleAlternate ? 'Google alternate route' : alternate !== primary ? 'Tezpur & NH-15 northern bypass' : 'Main route (no safe alternate returned)',
    distance_km: Math.round((first.distanceMeters ?? metrics(primary).km * 1000) / 100) / 10,
    duration_min: Math.max(1, Math.round(durationSeconds / 60) || metrics(primary).min),
    traffic_level: traffic(durationSeconds, seconds(first.staticDuration)),
    blocked: false,
    source: 'google',
  };
}

async function osrmRoutes(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  const base = process.env['OSRM_BASE_URL'] ?? 'https://router.project-osrm.org';
  const { data } = await axios.get(
    `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
    { params: { alternatives: 'true', overview: 'full', geometries: 'geojson' }, timeout: 8000 }
  );

  const routes = data?.routes as Array<{ geometry?: { coordinates?: Array<[number, number]> }; distance?: number; duration?: number }> | undefined;
  if (!routes?.[0]?.geometry?.coordinates) throw new Error('OSRM returned no route');

  const toLine = (route: (typeof routes)[number]): Coordinates[] =>
    route.geometry!.coordinates!.map(([lng, lat]) => ({ lat, lng }));

  const primary = toLine(routes[0]);
  if (leavesAssamValley(primary)) throw new Error('OSRM primary strays into mountains');
  const osrmAlternate = routes[1]?.geometry?.coordinates ? toLine(routes[1]) : null;
  const validOsrmAlternate = osrmAlternate && !leavesAssamValley(osrmAlternate) && hasMeaningfulDetour(primary, osrmAlternate) ? osrmAlternate : null;
  const alternate = validOsrmAlternate ?? await osrmContingencyDetour(from, to, primary).catch(() => null) ?? primary;

  return {
    primary,
    alternate,
    alternateLabel: validOsrmAlternate ? 'OSRM alternate road' : alternate !== primary ? 'Tezpur & NH-15 northern bypass' : 'Main route (no safe alternate returned)',
    distance_km: Math.round((routes[0].distance ?? metrics(primary).km * 1000) / 100) / 10,
    duration_min: Math.max(1, Math.round((routes[0].duration ?? metrics(primary).min * 60) / 60)),
    traffic_level: 'unknown',
    blocked: false,
    source: 'osrm',
  };
}

export async function getRoute(from: Coordinates, to: Coordinates): Promise<RouteResult> {
  try {
    return await googleRoutes(from, to);
  } catch {
    /* Fallback to OSRM if Google key missing, quota exceeded, or route strayed into Arunachal */
  }

  try {
    return await osrmRoutes(from, to);
  } catch {
    try {
      const primary = await fetchRoadLine([from, to]);
      const m = metrics(primary);
      return { primary, alternate: primary, alternateLabel: 'Fallback road estimate', distance_km: m.km, duration_min: m.min, traffic_level: 'unknown', blocked: false, source: 'fallback' };
    } catch {
      const primary = [from, to];
      const m = metrics(primary);
      return { primary, alternate: primary, alternateLabel: 'Direct-line fallback', distance_km: m.km, duration_min: m.min, traffic_level: 'unknown', blocked: false, source: 'fallback' };
    }
  }
}
