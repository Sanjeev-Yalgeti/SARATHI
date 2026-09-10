// Seed: loads data/incidents.json (+ event dates) + auth users + trips into SQLite.
// Run: npx prisma migrate deploy && npm run db:seed
// Restart-safe: upserts by stable id, so re-running never duplicates.
// NOTE: user passwords are set on CREATE only — re-running seed never
// overwrites a driver password that Admin rotated via POST/PATCH /api/trips.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { trucks } from '../src/services/trucks.js';

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

// Spec defaults (PROJECT.md §10.1). Overridable via env for real deploys.
const ADMIN_ID = process.env['ADMIN_ID'] ?? 'admin';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'sarathi@123';
const DRIVER_DEFAULT_PASSWORD = process.env['DRIVER_DEFAULT_PASSWORD'] ?? 'driver123';
const BCRYPT_ROUNDS = Number(process.env['BCRYPT_ROUNDS'] ?? '10');

async function seedIncidents(dir: string): Promise<EventDateSeed[]> {
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
  return eventDates;
}

async function seedUsersAndTrips(): Promise<void> {
  // Single admin (PROJECT.md §10.2). Password hashed, never plaintext.
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    // Don't overwrite an existing admin password on re-seed.
    update: { role: 'ADMIN', name: 'SARATHI Admin' },
    create: { id: ADMIN_ID, role: 'ADMIN', password: adminHash, name: 'SARATHI Admin' },
  });

  // One DRIVER per in-memory truck; id MUST equal trucks.ts vehicleId.
  const driverHash = await bcrypt.hash(DRIVER_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  for (const [vehicleId, truck] of trucks) {
    await prisma.user.upsert({
      where: { id: vehicleId },
      // Preserve Admin-rotated passwords across re-seeds.
      update: { role: 'DRIVER', name: `Driver ${vehicleId}` },
      create: {
        id: vehicleId,
        role: 'DRIVER',
        password: driverHash,
        name: `Driver ${vehicleId}`,
      },
    });

    // Stable trip id per driver so re-seed is idempotent and never
    // clobbers Admin edits (status/route changes) — create-only.
    await prisma.trip.upsert({
      where: { id: `SEED-${vehicleId}` },
      update: {},
      create: {
        id: `SEED-${vehicleId}`,
        driverId: vehicleId,
        origin: truck.origin,
        destination: truck.destination,
        cargoType: truck.cargoType,
        status: 'assigned',
      },
    });
  }
}

async function main(): Promise<void> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const eventDates = await seedIncidents(dir);
  await seedUsersAndTrips();

  const [incidentCount, userCount, tripCount] = await Promise.all([
    prisma.incident.count(),
    prisma.user.count(),
    prisma.trip.count(),
  ]);
  console.log(`Seeded incidents (total in DB: ${incidentCount}).`);
  console.log(`Event dates: ${eventDates.map((e) => `${e.date} (${e.phase})`).join(', ')}.`);
  console.log(`Users: ${userCount} (admin=${ADMIN_ID}, drivers=${[...trucks.keys()].join(', ')}).`);
  console.log(`Trips: ${tripCount} (1 seeded per driver).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
