import { prisma } from './src/services/db.js';

async function main() {
  const users = await prisma.user.findMany();
  console.log('PRISMA SUCCESS, users count:', users.length);
  const incidents = await prisma.incident.findMany();
  console.log('PRISMA SUCCESS, incidents count:', incidents.length);
}

main().catch(console.error);
