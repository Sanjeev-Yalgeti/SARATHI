/**
 * gtfs.service.js
 * Wrapper around GTFS / government transport data APIs.
 * Replace GTFS_API_BASE_URL and GTFS_API_KEY in .env with
 * your actual provider (e.g., OTPID, MTC Chennai API, BMTC API, etc.)
 */
import axios from 'axios';

const gtfs = axios.create({
  baseURL: process.env.GTFS_API_BASE_URL || 'https://api.example.com/gtfs',
  timeout: 15_000,
  headers: {
    'x-api-key': process.env.GTFS_API_KEY,
    Accept: 'application/json',
  },
});

/** List all agencies / transport operators */
export async function getAgencies() {
  const { data } = await gtfs.get('/agency');
  return data;
}

/** Get all routes for an agency */
export async function getRoutes(agencyId) {
  const params = agencyId ? { agency_id: agencyId } : {};
  const { data } = await gtfs.get('/routes', { params });
  return data;
}

/** Get stops for a specific route */
export async function getStopsForRoute(routeId) {
  const { data } = await gtfs.get(`/routes/${routeId}/stops`);
  return data;
}

/** Get all trips for a route */
export async function getTripsForRoute(routeId) {
  const { data } = await gtfs.get(`/routes/${routeId}/trips`);
  return data;
}

/** Get real-time vehicle positions (GTFS-Realtime) */
export async function getVehiclePositions(routeId) {
  const params = routeId ? { route_id: routeId } : {};
  const { data } = await gtfs.get('/realtime/vehiclepositions', { params });
  return data;
}

/** Get real-time trip updates */
export async function getTripUpdates(routeId) {
  const params = routeId ? { route_id: routeId } : {};
  const { data } = await gtfs.get('/realtime/tripupdates', { params });
  return data;
}

/** Get service alerts */
export async function getServiceAlerts() {
  const { data } = await gtfs.get('/realtime/alerts');
  return data;
}

/** Get stop-times for a trip */
export async function getStopTimes(tripId) {
  const { data } = await gtfs.get(`/trips/${tripId}/stoptimes`);
  return data;
}
