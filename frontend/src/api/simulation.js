import apiClient from './client';
import { isNetworkError } from './auth';

/**
 * Small simulation client — wraps the backend clock + board.
 * Backend: backend/src/routes/simulation.ts
 *   GET  /api/simulation/status -> { scenarioDate, vehicles[] }
 *   POST /api/simulation/date { date } (admin) -> { scenarioDate, vehicles[] }
 */

export async function getSimulationStatus() {
  const res = await apiClient.get('/api/simulation/status');
  return res.data;
}

export async function setSimulationDate(date) {
  const res = await apiClient.post('/api/simulation/date', { date });
  return res.data;
}

/**
 * Driver-safe start/replay (any role). Ensures the tick loop runs and
 * re-drives arrived trucks. Never changes the date, never unblocks RED stops.
 */
export async function startSimulation() {
  const res = await apiClient.post('/api/simulation/start');
  return res.data;
}

/**
 * Depot restart on the SAME date (any role, scoped). Every in-scope truck
 * goes back to Guwahati depot and re-drives from the start — the judge
 * button. RED stops included: they re-hit honestly. Never changes the date.
 */
export async function resetSimulation() {
  const res = await apiClient.post('/api/simulation/reset');
  return res.data;
}

export function isOfflineSimulationError(err) {
  return isNetworkError(err);
}
