import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Truck } from './trucks.js';

type BulletinInput = {
  date: string;
  incidents: Array<{ severity: string; road: string | null; district: string | null; note: string | null; type: string }>;
  reports: Array<{ severity: string; type: string; note: string; lat: number; lng: number }>;
  risks: Array<{ probability: number | null; level: string | null; rainfall: number | null; source: string | null }>;
  trucks: Iterable<Truck>;
};
const severityRank: Record<string, number> = { RED: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const display = (date: string): string => { const [y, m, d] = date.split('-'); return `${d}-${m}-${y}`; };

/** Renders the one-page operational bulletin directly to the HTTP response. */
export function renderFloodBulletin(res: Response, input: BulletinInput): void {
  const doc = new PDFDocument({ size: 'A4', margin: 44 });
  doc.pipe(res);
  doc.fillColor('#123c5a').fontSize(20).text('SARATHI · FLOOD BULLETIN', { align: 'center' });
  doc.fillColor('#111827').fontSize(13).text(`Flood Report as on: ${display(input.date)}`, { align: 'center' });
  doc.moveDown(0.7).fontSize(10).text('Affected districts: Golaghat 70,000 · Sivasagar 40,000 · Jorhat 16,000');
  doc.text('Reported toll: 100   |   Rivers above danger level: Dhansiri, Kushiyara');
  doc.moveDown(0.7).fillColor('#123c5a').fontSize(12).text('TRUCK STATUS'); doc.fillColor('#111827').fontSize(9);
  for (const truck of input.trucks) doc.text(`${truck.vehicleId} · ${truck.cargoType} · ${truck.status.toUpperCase()} · ${truck.speed} km/h · → ${truck.destination}`);
  doc.moveDown(0.6).fillColor('#123c5a').fontSize(12).text('TOP ROAD BREAKS'); doc.fillColor('#111827').fontSize(9);
  const top = [...input.incidents].sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)).slice(0, 5);
  if (!top.length) doc.text('No incidents reported for this scenario date.');
  top.forEach((item, index) => doc.text(`${index + 1}. [${item.severity}] ${item.road ?? item.type} — ${item.district ?? 'district not recorded'}${item.note ? `: ${item.note}` : ''}`));
  const risk = input.risks[0];
  doc.moveDown(0.6).fillColor('#123c5a').fontSize(12).text('LANDSLIDE OUTLOOK'); doc.fillColor('#111827').fontSize(9);
  doc.text(risk?.probability != null ? `Landslide probability: ${(risk.probability * 100).toFixed(0)}% · ${risk.level ?? 'unclassified'} · rainfall ${risk.rainfall ?? 0} mm · source ${risk.source ?? 'cache'}` : 'No cached landslide assessment yet; field teams should continue monitoring slopes.');
  if (input.reports.length) doc.text(`Field inbox: ${input.reports.length} report(s); latest: [${input.reports[0]!.severity}] ${input.reports[0]!.type} — ${input.reports[0]!.note}`);
  doc.moveDown(1).fontSize(8).fillColor('#4b5563').text(`Replayed for demo on ${display(new Date().toISOString().slice(0, 10))}.`, { align: 'center' });
  doc.end();
}
