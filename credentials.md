# Backend Credentials Guide

## Precedence (source of truth)

1. Load `.env` / Coolify env first (baseline)
2. Load AWS Secrets Manager secret from `AWS_SECRET_NAME`
3. **If the same key exists in both → AWS wins**
4. Keys missing from AWS stay on `.env`
5. Build internal `DATABASE_URL` for Prisma

This keeps client AWS values authoritative and still lets you fill gaps locally.

---

## Client decisions (original)

1. Postgres API URL(s) → environment variables *(or AWS JSON; AWS wins if both)*
2. Postgres user name(s) → environment variables *(or AWS JSON; AWS wins if both)*
3. Postgres password(s) → AWS Secrets Manager
4. Secret name → environment variables (`AWS_SECRET_NAME`)
5. Environment name (DEV / PROD) → environment variables (`NODE_ENV`)

---

## 1. Environment variables (`.env` / Coolify)

Always needed so the app can call AWS:

| Variable | Purpose |
|----------|---------|
| `AWS_SECRET_NAME` | Name/ARN of the AWS secret to load |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Only if no IAM role (Coolify / local) |
| `NODE_ENV` | `development` or `production` |

Fallback / fill-the-gaps (used when AWS does not provide the key):

| Variable | Purpose |
|----------|---------|
| `DATABASE_HOST` | Postgres host |
| `DATABASE_USER` | Postgres username |
| `DATABASE_PORT` | Default `5432` |
| `DATABASE_NAME` | Default `postgres` |
| `DATABASE_SSLMODE` | For RDS: `no-verify` |
| `DATABASE_PASSWORD` | Local-only when AWS password is unavailable |
| `JWT_*`, `STRIPE_*`, `SMTP_*`, `CLIENT_URL`, … | App config if not in AWS |

---

## 2. AWS Secrets Manager

### Secret name

Set in Coolify / `.env`:

```text
AWS_SECRET_NAME=rds!db-83222df7-0ee3-49e2-a45c-a8b0d66d9cfc
```

Or a client “config” secret that contains several keys.

### Supported secret shapes

**A) Client-style config JSON**

```json
{
  "RDS_Endpoint": "raven-dev-db.xxxxx.us-east-1.rds.amazonaws.com",
  "RDS_UN": "postgres",
  "RDS_PW_Secret": "rds!db-83222df7-0ee3-49e2-a45c-a8b0d66d9cfc",
  "JWT_ACCESS_SECRET": "...",
  "JWT_REFRESH_SECRET": "..."
}
```

Aliases mapped automatically:

| AWS / client key | App env key |
|------------------|-------------|
| `RDS_Endpoint` | `DATABASE_HOST` |
| `RDS_UN` | `DATABASE_USER` |
| `RDS_PW_Secret` | nested fetch → `DATABASE_PASSWORD` |

**B) RDS-managed secret JSON** (`username`, `password`, `host`, `port`, …)

**C) Plain text** — whole value = `DATABASE_PASSWORD`

Empty values and `-` in AWS are ignored (do not override `.env`).

---

## 3. Startup flow

`bootstrap.js` → `loadSecrets.js`:

1. `.env` baseline
2. Fetch AWS secret → apply keys (AWS wins)
3. If `RDS_PW_Secret` points at another secret, fetch password there too
4. Build `DATABASE_URL`
5. Log what came from AWS (key names only, never password values)

---

## 4. Coolify checklist

```env
NODE_ENV=production
AWS_REGION=us-east-1
AWS_SECRET_NAME=rds!db-83222df7-0ee3-49e2-a45c-a8b0d66d9cfc
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Optional fill-the-gaps if not in AWS:
DATABASE_SSLMODE=no-verify
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_URL=https://your-frontend.example.com
```

You do **not** need `DATABASE_PASSWORD` in Coolify when AWS supplies it.

Success logs look like:

```text
[secrets] Applied ... value(s) from AWS (...)
[secrets] Built DATABASE_URL from DATABASE_HOST + DATABASE_USER + password
[secrets] Precedence: AWS Secrets Manager wins over .env
```

---

## 5. Local development (no AWS)

```env
NODE_ENV=development
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your-local-password
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
# AWS_SECRET_NAME=
```

---

## 6. Do / don’t

| Do | Don’t |
|----|--------|
| Put authoritative secrets in AWS | Expect client `RDS_*` names to work without this loader |
| Keep JWT in Coolify if client did not put JWT in AWS | Put production DB password only in `.env` when AWS is available |
| Rotate any AWS keys that were shared in chat | Commit `.env` or raw AWS keys to git |
