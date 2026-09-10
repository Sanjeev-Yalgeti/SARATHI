import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../services/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All trip routes require a valid JWT. Admin sees all, driver sees own.
router.use(authenticate);

const VALID_STATUSES = new Set(['assigned', 'in_progress', 'completed']);

function tripId(req: Request): string | null {
  const raw = req.params.id;
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

// GET /api/trips -> admin: all trips, driver: own trips only
router.get('/', async (req: Request, res: Response) => {
  const trips = await prisma.trip.findMany({
    where: req.user?.role === 'ADMIN' ? undefined : { driverId: req.user?.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ trips });
});

// POST /api/trips { driverId, origin, destination, cargoType?, driverPassword? }
// Admin-only. driverPassword (min 6 chars) rotates that driver's login password.
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { driverId, origin, destination, cargoType, driverPassword } = req.body as Record<
    string,
    unknown
  >;
  if (typeof driverId !== 'string' || driverId === '') {
    res.status(400).json({ error: 'driverId is required' });
    return;
  }
  if (typeof origin !== 'string' || origin === '' || typeof destination !== 'string' || destination === '') {
    res.status(400).json({ error: 'origin and destination are required' });
    return;
  }
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== 'DRIVER') {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }
  if (driverPassword !== undefined) {
    if (typeof driverPassword !== 'string' || driverPassword.length < 6) {
      res.status(400).json({ error: 'driverPassword must be at least 6 characters' });
      return;
    }
    await prisma.user.update({
      where: { id: driverId },
      data: { password: await bcrypt.hash(driverPassword, 10) },
    });
  }
  const trip = await prisma.trip.create({
    data: {
      driverId,
      origin,
      destination,
      cargoType: typeof cargoType === 'string' ? cargoType : undefined,
    },
  });
  res.status(201).json({ trip, passwordRotated: driverPassword !== undefined });
});

// PATCH /api/trips/:id { origin?, destination?, cargoType?, status?, driverPassword? }
// Admin-only.
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = tripId(req);
  if (!id) {
    res.status(400).json({ error: 'Trip id is required' });
    return;
  }
  const { origin, destination, cargoType, status, driverPassword } = req.body as Record<
    string,
    unknown
  >;
  const existing = await prisma.trip.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  if (status !== undefined && (typeof status !== 'string' || !VALID_STATUSES.has(status))) {
    res.status(400).json({ error: 'status must be assigned | in_progress | completed' });
    return;
  }
  if (driverPassword !== undefined) {
    if (typeof driverPassword !== 'string' || driverPassword.length < 6) {
      res.status(400).json({ error: 'driverPassword must be at least 6 characters' });
      return;
    }
    await prisma.user.update({
      where: { id: existing.driverId },
      data: { password: await bcrypt.hash(driverPassword, 10) },
    });
  }
  const trip = await prisma.trip.update({
    where: { id },
    data: {
      origin: typeof origin === 'string' && origin !== '' ? origin : undefined,
      destination: typeof destination === 'string' && destination !== '' ? destination : undefined,
      cargoType: typeof cargoType === 'string' ? cargoType : undefined,
      status: typeof status === 'string' ? status : undefined,
    },
  });
  res.json({ trip, passwordRotated: driverPassword !== undefined });
});

// DELETE /api/trips/:id — Admin-only.
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = tripId(req);
  if (!id) {
    res.status(400).json({ error: 'Trip id is required' });
    return;
  }
  const existing = await prisma.trip.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  await prisma.trip.delete({ where: { id } });
  res.json({ deleted: true });
});

export default router;
