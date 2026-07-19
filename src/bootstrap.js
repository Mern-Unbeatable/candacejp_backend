/**
 * Bootstrap entrypoint.
 *
 * Secrets must be loaded before any other app modules are imported,
 * because Prisma reads DATABASE_URL at module load time.
 */
import { loadSecrets } from './config/loadSecrets.js';
import { logDatabaseDiagnostics } from './config/database.js';

const config = await loadSecrets();
console.log(
  `[secrets] env=${config.nodeEnv}; `
  + `secret=${config.secretName || 'none'}; `
  + `passwordSource=${config.passwordSource}; `
  + `awsKeys=${config.awsKeys?.length || 0}; `
  + `databaseUrl=${config.hasDatabaseUrl ? 'ready' : 'missing'}`,
);
console.log(
  '[secrets] Precedence: AWS Secrets Manager wins over .env; '
  + '.env fills anything AWS does not provide',
);
logDatabaseDiagnostics('startup');

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const betterAuthSecret = process.env.BETTER_AUTH_SECRET || '';
const betterAuthUrl = process.env.BETTER_AUTH_URL || '';

if (isProduction) {
  if (betterAuthSecret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to at least 32 random characters in production',
    );
  }

  let parsedAuthUrl;
  try {
    parsedAuthUrl = new URL(betterAuthUrl);
  } catch {
    throw new Error(
      'BETTER_AUTH_URL must be the public backend origin, '
      + 'for example https://api.example.com',
    );
  }

  if (
    parsedAuthUrl.protocol !== 'https:'
    || (parsedAuthUrl.pathname !== '/' && parsedAuthUrl.pathname !== '')
    || parsedAuthUrl.username
    || parsedAuthUrl.password
    || parsedAuthUrl.search
    || parsedAuthUrl.hash
  ) {
    throw new Error(
      'BETTER_AUTH_URL must be an HTTPS origin without /api or another path',
    );
  }
}

if (betterAuthSecret) {
  console.log('[startup] Better Auth secret source=BETTER_AUTH_SECRET');
} else if (!isProduction && process.env.JWT_ACCESS_SECRET) {
  console.log(
    '[startup] Better Auth secret source=legacy JWT_ACCESS_SECRET '
    + '(development fallback only)',
  );
} else {
  throw new Error('BETTER_AUTH_SECRET is missing');
}

await import('./server.js');
