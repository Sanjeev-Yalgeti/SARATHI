import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../services/db.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOADS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

function imageOnly(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('photo must be jpg or png'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: imageOnly,
});

// GET /api/reports?date=2026-08-09 → field reports, newest first.
router.get('/', async (req: Request, res: Response) => {
  const date = typeof req.query['date'] === 'string' ? req.query['date'] : undefined;
  if (date !== undefined && !DATE_RE.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const reports = await prisma.fieldReport.findMany({
    where: date ? { eventDate: date } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reports });
});

// POST /api/reports (multipart: photo + lat, lng, type, severity, note,
// eventDate). Photo optional; row always persisted. No NER bbox check yet
// (Aryan adds the 21-30N, 89-98E validation later).
router.post('/', upload.single('photo'), async (req: Request, res: Response) => {
  const { lat, lng, type, severity, note, eventDate } = req.body as Record<string, unknown>;
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
  if (typeof type !== 'string' || type === '' || typeof severity !== 'string' || severity === '') {
    res.status(400).json({ error: 'type and severity are required strings' });
    return;
  }
  if (typeof note !== 'string' || note === '') {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  if (typeof eventDate !== 'string' || !DATE_RE.test(eventDate)) {
    res.status(400).json({ error: 'eventDate must be YYYY-MM-DD' });
    return;
  }
  const report = await prisma.fieldReport.create({
    data: {
      lat: latNum,
      lng: lngNum,
      type,
      severity,
      note,
      photoUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      eventDate,
    },
  });
  res.status(201).json({ report });
});

// Multer failures (too big, wrong type) → 400 instead of the central 500.
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (
    err instanceof multer.MulterError ||
    (err instanceof Error && err.message.includes('photo must be'))
  ) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'upload failed' });
    return;
  }
  next(err);
});

export default router;
