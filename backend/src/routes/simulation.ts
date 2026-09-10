import { Router, type Request, type Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getScenarioDate, setScenarioDate } from '../services/simulation.service.js';
import { trucks } from '../services/trucks.js';

const router = Router();
router.use(authenticate);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/simulation/status -> live truck positions + active scenario date.
// Any authenticated user (driver sees own truck via /api/vehicles; this is
// the simulation clock + full board for the map).
router.get('/status', (req: Request, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    res.json({ scenarioDate: getScenarioDate(), vehicles: [...trucks.values()] });
    return;
  }
  const truck = trucks.get(req.user?.id ?? '');
  res.json({ scenarioDate: getScenarioDate(), vehicles: truck ? [truck] : [] });
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

export default router;
