# Backend Credentials Guide

This document follows the credentials decisions from the client.

## Client decisions

1. **Postgres API URL(s)** will be stored in **environment variables**
2. **Postgres user name(s)** will be stored in **environment variables**
3. **Postgres password(s)** will be stored in **AWS Secrets Manager**
4. **The secret name** will be stored in **environment variables**
5. **The environment name (DEV / PROD)** will be stored in **environment variables**

---

## Summary: where each item goes

| # | Item | Store in |
|---|------|----------|
| 1 | Postgres API URL / host | Environment variables (`.env` / container env) |
| 2 | Postgres username | Environment variables |
| 3 | Postgres password | AWS Secrets Manager |
| 4 | AWS secret name | Environment variables (`AWS_SECRET_NAME`) |
| 5 | Environment name (DEV/PROD) | Environment variables (`NODE_ENV`) |

---

## 1. Environment variables (`.env` / host / container)

### Required by client decisions

| Variable | Maps to client decision | Example |
|----------|-------------------------|---------|
| `DATABASE_HOST` | (1) Postgres API URL / host | `raven-dev-db.xxxxx.rds.amazonaws.com` |
| `DATABASE_USER` | (2) Postgres username | `postgres` |
| `AWS_SECRET_NAME` | (4) Secret name | `raven/backend/database-password` |
| `NODE_ENV` | (5) DEV / PROD | `development` or `production` |

### Supporting DB settings (also in environment)

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_PORT` | Postgres port | `5432` |
| `DATABASE_NAME` | Database name | `postgres` |
| `DATABASE_SSLMODE` | SSL mode for RDS, if needed | `no-verify` |
| `AWS_REGION` | AWS region for Secrets Manager | `us-east-1` |

### Other app config (environment — not in AWS per current setup)

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3000`) |
| `JWT_ACCESS_SECRET` | Access token signing key |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `CLIENT_URL` | Frontend URL |
| `CORS_ALLOWED_ORIGINS` | Extra CORS origins |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Email server |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email auth + from address |

### Local-only fallback (optional)

| Variable | Purpose |
|----------|---------|
| `DATABASE_PASSWORD` | Use **only** when AWS Secrets Manager is not enabled yet (local/dev). Remove in production once AWS is connected. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Local AWS credentials only. Not needed on ECS if the task role has permission. |

---

## 2. AWS Secrets Manager

Per client decision **#3**, only the **Postgres password** belongs here.

### Secret name

Stored in environment as `AWS_SECRET_NAME` (client decision **#4**).

Example:

```text
raven/backend/database-password
```

### Secret value

**Option A — plain text**

```text
your-database-password
```

**Option B — JSON**

```json
{
  "DATABASE_PASSWORD": "your-database-password"
}
```

Also accepted JSON keys: `password`, `DB_PASSWORD`, `POSTGRES_PASSWORD`.

### Access

- Production container: IAM task role with `secretsmanager:GetSecretValue`
- Local: AWS keys or profile, if testing against Secrets Manager

---

## 3. How the backend uses this

At startup (`bootstrap.js` → `loadSecrets.js`):

1. Load environment variables (`NODE_ENV`, host, username, secret name, etc.)
2. Read Postgres password from AWS Secrets Manager using `AWS_SECRET_NAME`
3. Build internal `DATABASE_URL` from host + user + password
4. If AWS is not configured, fall back to `DATABASE_PASSWORD` from `.env` (local only)

---

## 4. Do / don’t

| Do | Don’t |
|----|--------|
| Put host/URL and username in env | Put Postgres password in production env |
| Put password in AWS Secrets Manager | Put full `postgresql://user:password@host/...` in AWS as the main pattern |
| Put secret **name** in env | Put the secret name only inside the secret value and nowhere in env |
| Set `NODE_ENV` to `development` or `production` | Mix DEV host with PROD password (or the reverse) |

---

## 5. Example: production environment (no password in env)

```env
NODE_ENV=production

DATABASE_HOST=raven-dev-db.xxxxx.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_SSLMODE=no-verify

AWS_REGION=us-east-1
AWS_SECRET_NAME=raven/backend/database-password

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
STRIPE_SECRET_KEY=...
CLIENT_URL=https://your-frontend.example.com
```

AWS secret value:

```json
{
  "DATABASE_PASSWORD": "..."
}
```

---

## 6. Example: local development (AWS commented for now)

```env
NODE_ENV=development

DATABASE_HOST=187.x.x.x
DATABASE_PORT=5469
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your-local-password

# AWS_SECRET_NAME=raven/backend/database-password
```

When AWS is ready locally or in deploy: set `AWS_SECRET_NAME`, then remove `DATABASE_PASSWORD` from `.env`.
