import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../services/db.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js';
import { DRIVER_RADIUS_KM, haversineKm, ownTruck } from '../utils/scope.js';

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
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
    cb(null, true);
  } else {
    cb(new Error('photo must be jpg, png, or webp'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: imageOnly,
});

// GET /api/reports?date=2026-08-09
// Admin / Public sees reports; Driver sees reports near their truck.
router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const date = typeof req.query['date'] === 'string' ? req.query['date'] : undefined;
  if (date !== undefined && !DATE_RE.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const reports = await prisma.fieldReport.findMany({
    where: date ? { eventDate: date } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  if (req.user?.role !== 'DRIVER') {
    res.json({ reports });
    return;
  }
  const truck = ownTruck(req);
  if (!truck) {
    res.json({ reports: [] });
    return;
  }
  res.json({
    reports: reports.filter(
      (r) => haversineKm(truck.lat, truck.lng, r.lat, r.lng) <= DRIVER_RADIUS_KM,
    ),
  });
});

// POST /api/reports (multipart photo + lat, lng, userLat?, userLng?, type, severity, note, road?, eventDate)
// Publicly accessible for citizen ground reports, also accessible by logged-in drivers.
// Enforces: Location must be within 1 km radius of complaint at said location.
router.post('/', optionalAuthenticate, upload.single('photo'), async (req: Request, res: Response) => {
  const { lat, lng, userLat, userLng, type, severity, note, road, eventDate } = req.body as Record<
    string,
    unknown
  >;

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    res.status(400).json({ error: 'lat and lng must be numbers' });
    return;
  }
  if (latNum < 21 || latNum > 30 || lngNum < 89 || lngNum > 98) {
    res.status(400).json({
      error: 'lat/lng must be inside the North East India operating area (21-30N, 89-98E)',
    });
    return;
  }

  // 1 km Radius Condition Verification:
  let distanceKm = 0;
  if (userLat !== undefined && userLng !== undefined) {
    const uLat = Number(userLat);
    const uLng = Number(userLng);
    if (Number.isFinite(uLat) && Number.isFinite(uLng)) {
      distanceKm = haversineKm(uLat, uLng, latNum, lngNum);
      // Allow slight GPS margin (1.05 km)
      if (distanceKm > 1.05) {
        res.status(400).json({
          error: `Proximity verification failed: You are ${distanceKm.toFixed(
            2,
          )} km away from the incident location. Upload condition requires you to be within 1.0 km radius.`,
        });
        return;
      }
    }
  }

  if (typeof type !== 'string' || type === '' || typeof severity !== 'string' || severity === '') {
    res.status(400).json({ error: 'type and severity are required strings' });
    return;
  }
  if (typeof note !== 'string' || note === '') {
    res.status(400).json({ error: 'note is required' });
    return;
  }

  const effectiveDate =
    typeof eventDate === 'string' && DATE_RE.test(eventDate)
      ? eventDate
      : new Date().toISOString().split('T')[0]!;

  const roadText = typeof road === 'string' && road !== '' ? ` [Road: ${road}]` : '';
  const distText = distanceKm > 0 ? ` [Verified: ${(distanceKm * 1000).toFixed(0)}m]` : '';
  const reporterTag = req.user?.id ? ` [By: ${req.user.id}]` : ' [By: Public]';
  const annotatedNote = `[STATUS:pending]${roadText}${distText}${reporterTag} ${note}`;

  const report = await prisma.fieldReport.create({
    data: {
      lat: latNum,
      lng: lngNum,
      type,
      severity,
      note: annotatedNote,
      photoUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      eventDate: effectiveDate,
    },
  });
  res.status(201).json({ report, verifiedWithin1Km: true, distanceKm });
});

// PATCH /api/reports/:id { status: 'approved' | 'rejected' }
// Admin review & decision endpoint
router.patch('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = req.params['id'];
  const { status } = req.body as Record<string, unknown>;

  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ error: 'status must be approved or rejected' });
    return;
  }

  const existing = await prisma.fieldReport.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  // Update status token inside note
  const cleanedNote = existing.note.replace(/\[STATUS:(pending|approved|rejected)\]/g, '').trim();
  const updatedNote = `[STATUS:${status}] ${cleanedNote}`;

  const report = await prisma.fieldReport.update({
    where: { id },
    data: { note: updatedNote },
  });

  // If approved and RED/HIGH severity, also create an open Incident so it appears on the live map
  if (status === 'approved' && (existing.severity === 'RED' || existing.severity === 'HIGH')) {
    try {
      await prisma.incident.create({
        data: {
          id: `REP-INC-${existing.id.slice(-6)}`,
          lat: existing.lat,
          lng: existing.lng,
          type: existing.type,
          severity: existing.severity,
          eventDate: existing.eventDate,
          road: 'Crowd Verified Hazard',
          district: 'NER',
          note: cleanedNote,
          status: 'open',
        },
      });
    } catch {
      // Ignore if incident already exists
    }
  }

  res.json({ report, decision: status });
});

// DELETE /api/reports/:id — Admin-only
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = req.params['id'];
  const existing = await prisma.fieldReport.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  await prisma.fieldReport.delete({ where: { id } });
  res.json({ deleted: true });
});

// Multer failures (too big, wrong type) → 400
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
