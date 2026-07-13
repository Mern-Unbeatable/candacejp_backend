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

/**
 * Safe DB diagnostics for Coolify / server logs (never prints the password).
 */
export function logDatabaseDiagnostics(label = 'db') {
  const password = process.env.DATABASE_PASSWORD || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  const redactedUrl = databaseUrl.replace(/:([^:@/]+)@/, ':***@');

  const lines = [
    `[${label}] NODE_ENV=${process.env.NODE_ENV || 'undefined'}`,
    `[${label}] DATABASE_HOST=${process.env.DATABASE_HOST || '(not set)'}`,
    `[${label}] DATABASE_PORT=${process.env.DATABASE_PORT || '(not set)'}`,
    `[${label}] DATABASE_NAME=${process.env.DATABASE_NAME || '(not set)'}`,
    `[${label}] DATABASE_USER=${process.env.DATABASE_USER || '(not set)'}`,
    `[${label}] DATABASE_SSLMODE=${process.env.DATABASE_SSLMODE || '(not set)'}`,
    `[${label}] DATABASE_PASSWORD set=${Boolean(password)} length=${password.length}`,
    `[${label}] DATABASE_PASSWORD specialChars: tilde=${password.includes('~')} bracket=${password.includes('[')} colon=${password.includes(':')}`,
    `[${label}] AWS_SECRET_NAME=${process.env.AWS_SECRET_NAME || '(not set)'}`,
    `[${label}] DATABASE_URL (redacted)=${redactedUrl || '(not set)'}`,
  ];

  for (const line of lines) {
    console.log(line);
  }
}

/**
 * Classify common Prisma / Postgres connection failures for clearer logs.
 */
export function explainDatabaseError(error) {
  const message = error?.message || String(error);
  const code = error?.code || error?.meta?.code;

  if (
    message.includes('Authentication failed')
    || message.includes('credentials')
    || code === 'P1000'
  ) {
    return {
      type: 'DB_AUTH_FAILED',
      hint:
        'Postgres rejected DATABASE_USER / DATABASE_PASSWORD. '
        + 'Check Coolify env values (password special characters), '
        + 'and confirm the live RDS password with your client.',
    };
  }

  if (
    message.includes('Can\'t reach database server')
    || message.includes('ECONNREFUSED')
    || message.includes('ETIMEDOUT')
    || code === 'P1001'
  ) {
    return {
      type: 'DB_UNREACHABLE',
      hint:
        'Cannot reach DATABASE_HOST. Check host/port, RDS security group, '
        + 'and that Coolify can access the database network.',
    };
  }

  if (message.includes('SSL') || message.includes('ssl')) {
    return {
      type: 'DB_SSL',
      hint: 'SSL problem. For RDS set DATABASE_SSLMODE=no-verify.',
    };
  }

  return {
    type: 'DB_UNKNOWN',
    hint: message,
  };
}
