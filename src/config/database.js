/**
 * Build pg Pool options from env after loadSecrets() has run.
 * RDS typically requires SSL; `sslmode=no-verify` is Prisma-style and is
 * mapped to pg's `ssl: { rejectUnauthorized: false }`.
 */
export function getPgPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Did loadSecrets() run before importing Prisma?');
  }

  const sslMode = (process.env.DATABASE_SSLMODE || '').toLowerCase();
  const needsInsecureSsl =
    sslMode === 'no-verify'
    || sslMode === 'require'
    || connectionString.includes('sslmode=no-verify')
    || connectionString.includes('rds.amazonaws.com');

  if (!needsInsecureSsl || sslMode === 'disable') {
    return { connectionString };
  }

  // Strip sslmode from URL; pg Pool ssl option takes precedence
  const cleanUrl = connectionString
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/\?$/, '')
    .replace(/\?&/, '?');

  return {
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  };
}
