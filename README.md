# Raven Backend

Express + Prisma API for the Raven private aviation membership platform. Handles auth, payments, travel opportunities, reservations, messaging, and admin/concierge workflows.

## Stack

- **Node.js** `>=22.12.0` (ESM)
- **Express 5**
- **Prisma 7** + PostgreSQL (`pg` adapter)
- **Better Auth** (session + bearer tokens)
- **Stripe** (member registration fee)
- **Socket.IO** (live messaging)
- **AWS Secrets Manager** (optional DB / app secrets)
- **Nodemailer** (password-reset OTP)

## Project structure

```text
backend/
├── src/
│   ├── bootstrap.js          # Entrypoint: load secrets, then start server
│   ├── server.js             # HTTP + Socket.IO
│   ├── app.js                # Express app, routes, CORS
│   ├── config/               # CORS, DB pool, AWS secrets loader
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── middlewares/          # Auth (Better Auth session), Joi validation
│   ├── validations/
│   ├── lib/                  # Prisma client, Better Auth instance
│   ├── socket/               # Socket.IO handlers + auth
│   └── utils/
├── prisma/
│   ├── schema/               # Prisma schema (multi-file folder)
│   ├── migrations/
│   └── seed.js
├── credentials.md            # Credential / AWS Secrets Manager guide
├── .env.example
└── package.json
```

## Getting started

### Prerequisites

- Node.js `>=22.12.0`
- PostgreSQL
- Stripe keys (for registration payment)
- SMTP credentials (for forgot-password OTP)

### Install

```bash
npm install
cp .env.example .env
```

Edit `.env` (see [Environment variables](#environment-variables) below).

### Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Local / create migration
npm run prisma:migrate

# Deploy existing migrations (staging / production / Coolify)
npm run prisma:migrate:deploy

# Optional seed (admin / concierge / member)
npx prisma db seed
```

Seeded accounts (password: `password123`):

| Email | Role |
|-------|------|
| `admin@raven.com` | ADMIN |
| `concierge@raven.com` | CONCIERGE |
| `member@raven.com` | MEMBER |

### Run

```bash
# Development (nodemon)
npm run dev

# Production
npm start
```

Server: `http://localhost:3000` (or `PORT` from `.env`)  
Health: `GET /health`

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start via `bootstrap.js` |
| `npm run dev` | Dev with nodemon |
| `npm run build` | `prisma generate` |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:migrate:deploy` | Apply migrations (prod) |
| `npm run prisma:studio` | Prisma Studio |

## Architecture

MVC-style layers:

1. **Routes** — endpoints + middleware (`auth`, Joi)
2. **Controllers** — HTTP in/out, status codes
3. **Services** — business logic + Prisma
4. **Prisma** — PostgreSQL models

Startup order matters:

1. `bootstrap.js` loads `.env` + AWS Secrets Manager
2. Builds `DATABASE_URL`
3. Dynamically imports `server.js` (Prisma reads `DATABASE_URL` at import time)

## Authentication

Sessions are managed by **Better Auth** (opaque bearer token). Raven keeps custom routes for app policy (roles, payment status, Stripe, OTP reset).

| Concern | Endpoint / behavior |
|---------|---------------------|
| Register + Stripe checkout | `POST /api/auth/register` |
| Login (active users only) | `POST /api/auth/login` |
| Resume unpaid registration | `POST /api/auth/resume-payment` |
| Verify Stripe payment | `POST /api/auth/verify-payment` |
| Refresh session token | `POST /api/auth/refresh` |
| Forgot / OTP / reset password | `POST /api/auth/forgot-password`, `/verify-otp`, `/reset-password` |
| Logout (revokes session + sockets) | `POST /api/better-auth/sign-out` |

Protected REST routes expect:

```http
Authorization: Bearer <session-token>
```

Roles: `MEMBER` | `CONCIERGE` | `ADMIN`  
Account status: `PENDING_PAYMENT` | `ACTIVE` | `INACTIVE`  
Only `ACTIVE` users get a session. Pending members receive HTTP `402` and must complete Stripe payment.

Generate a Better Auth secret (min 32 characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## API overview

All JSON responses use:

```json
{ "success": true|false, "message": "...", "data": {} }
```

| Prefix | Access | Purpose |
|--------|--------|---------|
| `GET /health` | Public | Health check |
| `/api/auth/*` | Public | Register, login, payment, password reset |
| `POST /api/better-auth/sign-out` | Authenticated | Logout |
| `/api/users/*` | Any active role | Profile, change password |
| `/api/member/*` | MEMBER | Opportunities, reservations, preferences, custom travel |
| `/api/staff/*` | CONCIERGE | Opportunities CRUD, member interests, confirmations |
| `/api/admin/*` | ADMIN | Dashboard, concierge/members, support tickets |
| `/api/notifications/*` | MEMBER | Notifications |
| `/api/messages/*` | MEMBER / CONCIERGE | Messaging REST |
| `POST /api/support` | Public | Contact form → support inbox |

Live messaging uses **Socket.IO** on the same HTTP server; handshake sends `auth: { token }` with the Better Auth session token.

## Environment variables

Copy from `.env.example`. Full credential / AWS notes: [`credentials.md`](./credentials.md).

### Required locally

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `3000`) |
| `NODE_ENV` | `development` \| `production` |
| `DATABASE_HOST` / `PORT` / `NAME` / `USER` | Postgres connection |
| `DATABASE_PASSWORD` | Local password (if not using AWS) |
| `BETTER_AUTH_SECRET` | ≥32 random chars |
| `BETTER_AUTH_URL` | Backend **origin** only (no `/api`), e.g. `http://localhost:3000` |
| `CLIENT_URL` | Frontend URL (CORS + Stripe redirects) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `SMTP_*` | Email for OTP reset |

### Production (Coolify)

| Variable | Example |
|----------|---------|
| `BETTER_AUTH_URL` | `https://api-candacejp.maktechgroup.tech` |
| `CLIENT_URL` | `https://candacejp.maktechgroup.tech` |
| `DATABASE_SSLMODE` | `no-verify` (RDS) |
| `AWS_SECRET_NAME` | Secrets Manager secret name |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | If no IAM role |

Credential precedence:

1. Load `.env` / Coolify env  
2. Load AWS Secrets Manager (`AWS_SECRET_NAME`)  
3. **Same key in both → AWS wins**  
4. Missing AWS keys stay on `.env`  
5. Build internal `DATABASE_URL`

Client AWS aliases (`RDS_Endpoint`, `RDS_UN`, `RDS_PW_Secret`) are mapped automatically.

## Deploy notes

1. Set env vars in Coolify (including `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`).
2. Ensure migrations run (`prisma migrate deploy`) against the target DB.
3. Redeploy **backend and frontend** together after auth changes; old JWT cookies are invalid — users must log in again.
4. Do not commit `.env` or raw AWS keys.

## License

ISC
