import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { getAllowedOrigins } from '../config/cors.js';
import prisma from './prisma.js';

const sevenDays = 60 * 60 * 24 * 7;
const authSecret =
  process.env.BETTER_AUTH_SECRET
  || (process.env.NODE_ENV !== 'production'
    ? process.env.JWT_ACCESS_SECRET
    : undefined);

export const auth = betterAuth({
  appName: 'Raven',
  baseURL:
    process.env.BETTER_AUTH_URL
    || process.env.API_URL
    || `http://localhost:${process.env.PORT || 3000}`,
  basePath: '/api/better-auth',
  secret: authSecret,
  trustedOrigins: getAllowedOrigins(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    // Raven registration includes a Stripe payment workflow and remains on
    // /api/auth/register; prevent bypass through Better Auth's generic route.
    disableSignUp: true,
    minPasswordLength: 8,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false },
      lastName: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      address: { type: 'string', required: false },
      city: { type: 'string', required: false },
      state: { type: 'string', required: false },
      zipCode: { type: 'string', required: false },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'MEMBER',
        input: false,
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'PENDING_PAYMENT',
        input: false,
      },
    },
  },
  session: {
    expiresIn: sevenDays,
    updateAge: 60 * 60 * 24,
  },
  plugins: [bearer()],
});

export const betterAuthSessionExpiresIn = sevenDays;

