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

await import('./server.js');
