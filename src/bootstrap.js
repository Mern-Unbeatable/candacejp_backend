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
  + `databaseUrl=${config.hasDatabaseUrl ? 'ready' : 'missing'}`,
);
logDatabaseDiagnostics('startup');

const missingJwt = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
  (key) => !process.env[key],
);
if (missingJwt.length) {
  console.error(
    `[startup] MISSING JWT SECRETS: ${missingJwt.join(', ')}. `
    + 'Login will fail with "secretOrPrivateKey must have a value". '
    + 'Set these in Coolify Environment Variables.',
  );
} else {
  console.log('[startup] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set');
}

await import('./server.js');
