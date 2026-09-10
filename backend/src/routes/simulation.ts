import { Router, type Request, type Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getMlState, getScenarioDate, getScenarioOverrides, ingestMockGps, resetCompletedTrips, setScenario, setScenarioDate, startSimulation } from '../services/simulation.service.js';
import { trucks } from '../services/trucks.js';

const router = Router();
router.use(authenticate);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function statusPayload(vehicles: unknown) {
  return {
    scenarioDate: getScenarioDate(),
    scenarioOverrides: getScenarioOverrides(),
    mlRisk: getMlState(),
    vehicles,
  };
}

// GET /api/simulation/status -> live truck positions + active scenario date.
// Any authenticated user (driver sees own truck via /api/vehicles; this is
// the simulation clock + full board for the map).
router.get('/status', (req: Request, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    res.json(statusPayload([...trucks.values()]));
    return;
  }
  const truck = trucks.get(req.user?.id ?? '');
  res.json(statusPayload(truck ? [truck] : []));
});

// POST /api/simulation/date { date: YYYY-MM-DD } -> switch scenario clock.
// Admin-only. Unblocks trucks so the new date replays from current positions.
router.post('/date', requireAdmin, (req: Request, res: Response) => {
  const { date } = req.body as Record<string, unknown>;
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  setScenarioDate(date);
  res.json({ scenarioDate: getScenarioDate(), vehicles: [...trucks.values()] });
});

// POST /api/simulation/start -> driver-safe start/replay (any authenticated
// role — this is the button on the driver dashboard). Ensures the tick loop
// runs and re-drives ARRIVED trucks from the depot. Never changes the
// scenario date and never unblocks RED-incident stops (admin-only via /date).
router.post('/start', async (req: Request, res: Response) => {
  await startSimulation();
  const scope = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  resetCompletedTrips(scope);
  if (req.user?.role === 'ADMIN') {
    res.json(statusPayload([...trucks.values()]));
    return;
  }
  const truck = trucks.get(req.user?.id ?? '');
  res.json(statusPayload(truck ? [truck] : []));
});

// POST /api/simulation/scenario { date?, rainfall_mm?, river_danger_level_count? }
// Admin-only what-if controls for the ML engine. Omitting date keeps the clock;
// knobs become sidecar overrides (cleared when omitted). Unblocks trucks.
router.post('/scenario', requireAdmin, (req: Request, res: Response) => {
  const { date, rainfall_mm, river_danger_level_count } = req.body as Record<string, unknown>;
  const nextDate = date === undefined ? getScenarioDate() : date;
  if (typeof nextDate !== 'string' || !DATE_RE.test(nextDate)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const overrides: { rainfall_mm?: number; river_danger_level_count?: number } = {};
  for (const [key, value] of Object.entries({ rainfall_mm, river_danger_level_count })) {
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      res.status(400).json({ error: `${key} must be a non-negative number` });
      return;
    }
    overrides[key as keyof typeof overrides] = value;
  }
  setScenario(nextDate, overrides);
  res.json(statusPayload([...trucks.values()]));
});

// POST /api/simulation/location { vehicleId, lat, lng, speed? }
// Admin-only mock-GPS ingest (PROJECT.md §9). Feeds one external position
// into the same in-memory truck map the tick loop and sockets use; the
// internal clock resumes from the snapped point on the next tick.
// Blocked trucks keep status blocked (unblock via date change only).
router.post('/location', requireAdmin, (req: Request, res: Response) => {
  const { vehicleId, lat, lng, speed } = req.body as Record<string, unknown>;
  if (typeof vehicleId !== 'string' || vehicleId === '') {
    res.status(400).json({ error: 'vehicleId is required' });
    return;
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    res.status(400).json({ error: 'lat and lng must be numbers' });
    return;
  }
  if (latNum < 21 || latNum > 30 || lngNum < 89 || lngNum > 98) {
    res.status(400).json({ error: 'lat/lng must be inside the North East India operating area (21-30N, 89-98E)' });
    return;
  }
  if (speed !== undefined && (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0)) {
    res.status(400).json({ error: 'speed must be a non-negative number' });
    return;
  }
  const truck = ingestMockGps(vehicleId, latNum, lngNum, speed);
  if (!truck) {
    res.status(404).json({ error: 'Vehicle not found' });
    return;
  }
  res.json({ vehicle: truck });
});

export default router;
