import { Router, type Request, type Response } from 'express';
import { prisma } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';
import { renderFloodBulletin } from '../services/pdf.service.js';
import { trucks } from '../services/trucks.js';
import { DRIVER_RADIUS_KM, districtMatchesTrip, haversineKm, latestTrip, ownTruck } from '../utils/scope.js';

// Bulletin (Naman stub data + Aryan pdf.service.ts renderer).
// Auth + driver scoping preserved: drivers see only their latest assigned
// trip (district match) + nearby radius fallback, and their own truck line.
const router = Router();
router.use(authenticate);

const DEFAULT_DATE = '2026-08-09';

router.get('/', async (req: Request, res: Response) => {
  const date = typeof req.query['date'] === 'string' ? req.query['date'] : DEFAULT_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return void res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const [incidents, reports, risks] = await Promise.all([
    prisma.incident.findMany({ where: { eventDate: date } }),
    prisma.fieldReport.findMany({ where: { eventDate: date }, orderBy: { createdAt: 'desc' } }),
    prisma.riskCache.findMany({ where: { eventDate: date }, orderBy: { updatedAt: 'desc' } }),
  ]);
  // Driver scoping: latest assigned trip (district match) + radius fallback;
  // own truck line only. Admin sees everything. History is never deleted.
  const isDriver = req.user?.role === 'DRIVER';
  const truck = isDriver ? ownTruck(req) : undefined;
  const trip = isDriver && req.user ? await latestTrip(req.user.id) : null;
  const visibleIncidents =
    !isDriver || !truck
      ? isDriver
        ? []
        : incidents
      : incidents.filter(
          (i) =>
            (trip !== null && districtMatchesTrip(i.district, trip.origin, trip.destination)) ||
            haversineKm(truck.lat, truck.lng, i.lat, i.lng) <= DRIVER_RADIUS_KM,
        );
  const visibleReports =
    !isDriver || !truck
      ? isDriver
        ? []
        : reports
      : reports.filter(
          (r) => haversineKm(truck.lat, truck.lng, r.lat, r.lng) <= DRIVER_RADIUS_KM,
        );
  const visibleTrucks = !isDriver ? [...trucks.values()] : truck ? [truck] : [];
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sarathi-flood-bulletin-${date}.pdf"`);
  renderFloodBulletin(res, { date, incidents: visibleIncidents, reports: visibleReports, risks, trucks: visibleTrucks });
});
export default router;
