import { Router, type Request, type Response } from 'express';
import { prisma } from '../services/db.js';
import { renderFloodBulletin } from '../services/pdf.service.js';
import { trucks } from '../services/trucks.js';

const router = Router();
const DEFAULT_DATE = '2026-08-09';

router.get('/', async (req: Request, res: Response) => {
  const date = typeof req.query['date'] === 'string' ? req.query['date'] : DEFAULT_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return void res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const [incidents, reports, risks] = await Promise.all([
    prisma.incident.findMany({ where: { eventDate: date } }),
    prisma.fieldReport.findMany({ where: { eventDate: date }, orderBy: { createdAt: 'desc' } }),
    prisma.riskCache.findMany({ where: { eventDate: date }, orderBy: { updatedAt: 'desc' } }),
  ]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sarathi-flood-bulletin-${date}.pdf"`);
  renderFloodBulletin(res, { date, incidents, reports, risks, trucks: trucks.values() });
});
export default router;
