import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Generate a hashed version of 'password123' for all seed users
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Create an Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@raven.com' },
    update: {}, // Do nothing if they already exist
    create: {
      email: 'admin@raven.com',
      password: defaultPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE', // Bypass the PENDING_PAYMENT block
    },
  });

  // 2. Create a Concierge User
  const concierge = await prisma.user.upsert({
    where: { email: 'concierge@raven.com' },
    update: {},
    create: {
      email: 'concierge@raven.com',
      password: defaultPasswordHash,
      firstName: 'Elena',
      lastName: 'Rossi',
      role: 'CONCIERGE',
      status: 'ACTIVE',
    },
  });

  // 3. Create a Member User
  const member = await prisma.user.upsert({
    where: { email: 'member@raven.com' },
    update: {},
    create: {
      email: 'member@raven.com',
      password: defaultPasswordHash,
      firstName: 'John',
      lastName: 'Davis',
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  console.log('Database seeded successfully!');
  console.log('--- Initial Accounts ---');
  console.log(`Admin:     ${admin.email} / password123`);
  console.log(`Concierge: ${concierge.email} / password123`);
  console.log(`Member:    ${member.email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Safely disconnect the Prisma client
    await prisma.$disconnect();
  });