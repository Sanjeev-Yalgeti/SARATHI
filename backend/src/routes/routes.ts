import { Router, type Request, type Response } from 'express';
import { getRoute } from '../services/routing.service.js';
import { authenticate } from '../middleware/auth.js';
import type { Coordinates } from '../services/simulation.service.js';

const router = Router();
router.use(authenticate);

function parsePoint(raw: unknown): Coordinates | null {
  if (typeof raw !== 'string') return null;
  const [latRaw, lngRaw] = raw.split(',');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// GET /api/routes?from=26.1844,91.7458&to=26.51,93.97 → primary + stub alternate.
router.get('/', async (req: Request, res: Response) => {
  const from = parsePoint(req.query['from']);
  const to = parsePoint(req.query['to']);
  if (!from || !to) {
    res.status(400).json({ error: 'from and to must be lat,lng' });
    return;
  }
  res.json(await getRoute(from, to));
});

export default router;
