// Seed: loads data/incidents.json (+ event dates) into SQLite via Prisma.
// Run: npx prisma migrate deploy && npm run db:seed
// Restart-safe: upserts by stable id, so re-running never duplicates.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env['DATABASE_URL'] ?? 'file:./prisma/dev.db';
const adapter = new PrismaBetterSqlite3({ url: connectionString });
const prisma = new PrismaClient({ adapter });

type IncidentSeed = {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  eventDate: string;
  road?: string;
  district?: string;
  note?: string;
  status?: string;
};

type EventDateSeed = { date: string; phase: string };

async function main(): Promise<void> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const incidentsRaw = await readFile(join(dir, '..', 'data', 'incidents.json'), 'utf8');
  const eventDatesRaw = await readFile(join(dir, '..', 'data', 'event_dates.json'), 'utf8');
  const incidents = JSON.parse(incidentsRaw) as IncidentSeed[];
  const eventDates = JSON.parse(eventDatesRaw) as EventDateSeed[];

  for (const inc of incidents) {
    await prisma.incident.upsert({
      where: { id: inc.id },
      update: {
        lat: inc.lat,
        lng: inc.lng,
        type: inc.type,
        severity: inc.severity,
        eventDate: inc.eventDate,
        road: inc.road,
        district: inc.district,
        note: inc.note,
        status: inc.status ?? 'open',
      },
      create: {
        id: inc.id,
        lat: inc.lat,
        lng: inc.lng,
        type: inc.type,
        severity: inc.severity,
        eventDate: inc.eventDate,
        road: inc.road,
        district: inc.district,
        note: inc.note,
        status: inc.status ?? 'open',
      },
    });
  }

  const count = await prisma.incident.count();
  console.log(`Seeded ${incidents.length} incidents (total in DB: ${count}).`);
  console.log(`Event dates: ${eventDates.map((e) => `${e.date} (${e.phase})`).join(', ')}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
