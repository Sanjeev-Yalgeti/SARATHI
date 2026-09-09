import { Router, type Request, type Response } from 'express';
import { prisma } from '../services/db.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/incidents?date=2026-07-28 → seed rows + manual blocks for that date.
// Peak day returns blocks; other dates return [] (passable). No date → all rows.
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
  res.json({ incidents });
});

// POST /api/incidents → manual blockage (judge demo button). Persisted via
// Prisma, so it survives restart. No NER bbox check yet (Aryan adds it later).
router.post('/', async (req: Request, res: Response) => {
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
