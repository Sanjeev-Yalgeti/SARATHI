import { Router, type Request, type Response } from 'express';
import { getRoute, getRouteVia } from '../services/routing.service.js';
import { authenticate } from '../middleware/auth.js';
import { predictRisk } from '../services/risk.service.js';
import { prisma } from '../services/db.js';
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
// Optional &via=lat,lng|lat,lng chains legs (story corridors per truck).
router.get('/', async (req: Request, res: Response) => {
  const from = parsePoint(req.query['from']);
  const to = parsePoint(req.query['to']);
  if (!from || !to) {
    res.status(400).json({ error: 'from and to must be lat,lng' });
    return;
  }
  const viaRaw = req.query['via'];
  const via =
    typeof viaRaw === 'string' && viaRaw.length > 0
      ? viaRaw.split('|').map(parsePoint)
      : [];
  if (via.some((p) => p === null)) {
    res.status(400).json({ error: 'via must be lat,lng|lat,lng' });
    return;
  }
  res.json(await getRouteVia(from, (via as { lat: number; lng: number }[]), to));
});

function bodyPoint(raw: unknown): Coordinates | null {
  if (typeof raw === 'string') return parsePoint(raw);
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as { lat?: unknown; lng?: unknown };
  const lat = Number(item.lat), lng = Number(item.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// POST /api/route/analyze — demo-safe trip recommendation for a truck and cargo.
router.post('/analyze', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const origin = bodyPoint(body['origin'] ?? body['from']);
  const destination = bodyPoint(body['destination'] ?? body['to']);
  const eventDate = typeof body['eventDate'] === 'string' ? body['eventDate'] : '';
  if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return void res.status(400).json({ error: 'origin, destination and eventDate (YYYY-MM-DD) are required' });
  const [route, risk, incidents] = await Promise.all([getRoute(origin, destination), predictRisk({ lat: destination.lat, lng: destination.lng, eventDate }), prisma.incident.findMany({ where: { eventDate } })]);
  const blocked = risk.landslide_prob >= 0.7 || risk.score >= 75 || incidents.length > 0 || route.traffic_level === 'heavy';
  const useAlternate = blocked && route.alternate.length > 1;
  res.json({
    truck: typeof body['truck'] === 'string' ? body['truck'] : undefined,
    cargoType: typeof body['cargoType'] === 'string' ? body['cargoType'] : undefined,
    eventDate, risk, blocked, recommendedRoad: useAlternate ? route.alternateLabel : 'Primary route',
    route: { ...route, blocked },
    delayMessage: blocked ? 'RED alert: primary corridor has active flood/landslide exposure. Use the backup road and expect delays.' : 'Route is passable for the selected date; continue with normal monitoring.',
  });
});

export default router;
