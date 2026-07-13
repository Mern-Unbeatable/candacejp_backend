import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getPgPoolConfig } from '../config/database.js';

const pool = new Pool(getPgPoolConfig());
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
