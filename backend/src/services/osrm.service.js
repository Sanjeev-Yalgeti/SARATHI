/**
 * osrm.service.js
 * Wrapper around OSRM's HTTP API for open-source routing.
 * Supports the public OSRM demo server or a self-hosted instance.
 */
import axios from 'axios';

const BASE = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

const osrm = axios.create({ baseURL: BASE, timeout: 15_000 });

/**
 * Get a driving route between two coordinates.
 * @param {number} originLng
 * @param {number} originLat
 * @param {number} destLng
 * @param {number} destLat
 * @param {object} opts  — any extra OSRM query params (steps, annotations, etc.)
 */
export async function getRoute(originLng, originLat, destLng, destLat, opts = {}) {
  const coords = `${originLng},${originLat};${destLng},${destLat}`;
  const { data } = await osrm.get(`/route/v1/driving/${coords}`, {
    params: {
      overview: 'full',
      geometries: 'geojson',
      steps: true,
      ...opts,
    },
  });
  if (data.code !== 'Ok') {
    const err = new Error(`OSRM route error: ${data.code} — ${data.message}`);
    err.status = 502;
    throw err;
  }
  return data.routes;
}

/**
 * Nearest road snap — snap a coordinate to the nearest road segment.
 */
export async function nearestRoad(lng, lat) {
  const { data } = await osrm.get(`/nearest/v1/driving/${lng},${lat}`, {
    params: { number: 1 },
  });
  if (data.code !== 'Ok') {
    const err = new Error(`OSRM nearest error: ${data.code}`);
    err.status = 502;
    throw err;
  }
  return data.waypoints[0];
}

/**
 * Table service — compute duration/distance matrix between N points.
 * @param {Array<{lng: number, lat: number}>} coordinates
 */
export async function distanceMatrix(coordinates) {
  const coords = coordinates.map((c) => `${c.lng},${c.lat}`).join(';');
  const { data } = await osrm.get(`/table/v1/driving/${coords}`, {
    params: { annotations: 'duration,distance' },
  });
  if (data.code !== 'Ok') {
    const err = new Error(`OSRM table error: ${data.code}`);
    err.status = 502;
    throw err;
  }
  return { durations: data.durations, distances: data.distances };
}
