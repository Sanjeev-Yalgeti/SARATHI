import { Router, type Request, type Response } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';
import { trucks } from '../services/trucks.js';
import { DRIVER_RADIUS_KM, districtMatchesTrip, haversineKm, latestTrip, ownTruck } from '../utils/scope.js';

// Bulletin stub (Step 8, Naman) — 1-page PDF from Prisma + truck status.
// Aryan designs the real PDF later (pdf.service.ts); this keeps the same
// endpoint + header/footer contract. Real PDF lines (Dhruv/Google data)
// stay marked pending until Aryan fills them from RiskCache.
const router = Router();
router.use(authenticate);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DATE = '2026-08-09';

// Static bulletin lines (Aug 2026 relief bulletin figures).
const DISTRICTS = 'Golaghat 70k, Sivasagar 40k, Jorhat 16k';
const TOLL = 100;
const RIVERS = 'Dhansiri, Kushiyara';

const SEV_RANK: Record<string, number> = { RED: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function toDisplay(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}-${m}-${y}`;
}

function todayDisplay(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
}

// GET /api/bulletin.pdf?date=2026-08-09 → 1-page PDF bulletin.
router.get('/', async (req: Request, res: Response) => {
  const raw = typeof req.query['date'] === 'string' ? req.query['date'] : DEFAULT_DATE;
  if (!DATE_RE.test(raw)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const date = raw;

  const [incidents, reports, riskRows] = await Promise.all([
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
  const top = [...visibleIncidents]
    .sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))
    .slice(0, 5);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bulletin-${date}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  doc.fontSize(18).text(`Flood Report as on: ${toDisplay(date)}`);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Affected districts: ${DISTRICTS}.`);
  doc.text(`Death toll: ${TOLL}. Rivers above danger level: ${RIVERS}.`);
  doc.moveDown(0.5);

  doc.fontSize(13).text('Truck status');
  doc.fontSize(10);
  for (const t of visibleTrucks) {
    doc.text(
      `${t.vehicleId} (${t.cargoType}): ${t.status}, speed ${t.speed} km/h at ${t.lat.toFixed(4)}, ${t.lng.toFixed(4)} -> ${t.destination}`
    );
  }
  doc.moveDown(0.5);

  doc.fontSize(13).text(`Top incidents (${visibleIncidents.length} total)`);
  doc.fontSize(10);
  if (top.length === 0) doc.text('None reported for this date.');
  for (const inc of top) {
    doc.text(
      `[${inc.severity}] ${inc.road ?? inc.id} (${inc.district ?? 'n/a'}): ${inc.note ?? inc.type}`
    );
  }
  doc.moveDown(0.5);

  doc.fontSize(13).text(`Field reports (${visibleReports.length})`);
  doc.fontSize(10);
  if (visibleReports.length === 0) doc.text('None reported for this date.');
  for (const r of visibleReports.slice(0, 5)) {
    doc.text(`[${r.severity}] ${r.type} at ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}: ${r.note}`);
  }
  doc.moveDown(0.5);

  const latest = riskRows[0];
  doc
    .fontSize(10)
    .text(
      latest && latest.probability != null
        ? `Landslide probability: ${latest.probability} (score ${latest.score ?? 'n/a'}, ${latest.level ?? 'n/a'}) from ${latest.source ?? 'cache'}; rainfall ${latest.rainfall ?? 'n/a'} mm.`
        : 'Landslide probability + live weather snapshot: pending — Aryan fills it from RiskCache.'
    );
  doc.moveDown(1);
  doc.fontSize(9).text(`Replayed for demo on ${todayDisplay()}.`);

  doc.end();
});

export default router;
