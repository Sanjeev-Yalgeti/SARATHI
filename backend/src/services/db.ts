// Prisma singleton — everyone imports this, nobody news up a client.
// Prisma 7 requires a driver adapter; SQLite uses better-sqlite3.
// See BACKEND_TASKS.md "Prisma contract" + naman_alone.md step 0.
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env['DATABASE_URL'] ?? 'file:./prisma/dev.db';
const adapter = new PrismaBetterSqlite3({ url: connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
