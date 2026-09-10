import { Router, type Request, type Response } from 'express';
import { prisma } from '../services/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { DRIVER_RADIUS_KM, districtMatchesTrip, haversineKm, latestTrip, ownTruck } from '../utils/scope.js';

const router = Router();
router.use(authenticate);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/incidents?date=2026-07-28 → admin: all rows for the date;
// driver: only rows on their latest assigned trip (district match)
// or near their truck (en-route safety net).
router.get('/', async (req: Request, res: Response) => {
  const date = typeof req.query['date'] === 'string' ? req.query['date'] : undefined;
  if (date !== undefined && !DATE_RE.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const incidents = await prisma.incident.findMany({
    where: date ? { eventDate: date } : undefined,
    orderBy: { id: 'asc' },
  });
  if (req.user?.role !== 'DRIVER') {
    res.json({ incidents });
    return;
  }
  const truck = ownTruck(req);
  if (!truck || !req.user) {
    res.json({ incidents: [] });
    return;
  }
  const trip = await latestTrip(req.user.id);
  res.json({
    incidents: incidents.filter(
      (i) =>
        (trip !== null && districtMatchesTrip(i.district, trip.origin, trip.destination)) ||
        haversineKm(truck.lat, truck.lng, i.lat, i.lng) <= DRIVER_RADIUS_KM,
    ),
  });
});

// POST /api/incidents → manual blockage (judge demo button, admin-only).
// Persisted via Prisma, so it survives restart.
// Drivers file blockages via POST /api/reports (photo proof, Aryan validates
// NER bbox later); admin promotes to incidents.
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { id, lat, lng, type, severity, eventDate, road, district, note, status } =
    req.body as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'lat and lng must be numbers' });
    return;
  }
  if (typeof type !== 'string' || type === '' || typeof severity !== 'string' || severity === '') {
    res.status(400).json({ error: 'type and severity are required strings' });
    return;
  }
  if (typeof eventDate !== 'string' || !DATE_RE.test(eventDate)) {
    res.status(400).json({ error: 'eventDate must be YYYY-MM-DD' });
    return;
  }
  const incident = await prisma.incident.create({
    data: {
      id: typeof id === 'string' && id !== '' ? id : `MANUAL-${Date.now()}`,
      lat,
      lng,
      type,
      severity,
      eventDate,
      road: typeof road === 'string' ? road : undefined,
      district: typeof district === 'string' ? district : undefined,
      note: typeof note === 'string' ? note : undefined,
      status: typeof status === 'string' && status !== '' ? status : 'open',
    },
  });
  res.status(201).json({ incident });
});

export default router;
