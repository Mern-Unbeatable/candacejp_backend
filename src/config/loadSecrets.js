import dotenv from 'dotenv';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

/**
 * Credential precedence:
 * 1. Load .env / host environment as baseline
 * 2. Load JSON (or plain) secret from AWS Secrets Manager
 * 3. AWS wins over .env when the same key exists in both
 * 4. Values missing from AWS stay on .env
 * 5. Build DATABASE_URL for Prisma
 *
 * Supports client aliases (RDS_Endpoint, RDS_UN, RDS_PW_Secret) and
 * nested RDS-managed password secrets.
 */

function log(message) {
  console.log(`[secrets] ${message}`);
}

function warn(message) {
  console.warn(`[secrets] ${message}`);
}

function getSecretId() {
  return (
    process.env.AWS_SECRET_NAME
    || process.env.AWS_SECRETS_MANAGER_SECRET_ID
    || process.env.AWS_SECRET_ARN
    || ''
  ).trim();
}

function getAwsRegion() {
  return (
    process.env.AWS_REGION
    || process.env.AWS_DEFAULT_REGION
    || 'us-east-1'
  );
}

function isUsableSecretValue(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  return text !== '' && text !== '-';
}

/**
 * Map secret JSON keys → process.env keys the app already understands.
 * Client names (RDS_*) and standard names both work.
 */
const SECRET_KEY_MAP = {
  // Client aliases
  RDS_Endpoint: 'DATABASE_HOST',
  RDS_ENDPOINT: 'DATABASE_HOST',
  RDS_UN: 'DATABASE_USER',
  RDS_USER: 'DATABASE_USER',
  RDS_PW_Secret: 'AWS_DB_PASSWORD_SECRET',
  RDS_PW_SECRET: 'AWS_DB_PASSWORD_SECRET',

  // RDS-managed secret shape
  host: 'DATABASE_HOST',
  username: 'DATABASE_USER',
  port: 'DATABASE_PORT',
  dbname: 'DATABASE_NAME',
  engine: null, // ignore
  dbInstanceIdentifier: null,

  // Password keys → DATABASE_PASSWORD
  password: 'DATABASE_PASSWORD',
  Password: 'DATABASE_PASSWORD',
  DATABASE_PASSWORD: 'DATABASE_PASSWORD',
  DB_PASSWORD: 'DATABASE_PASSWORD',
  POSTGRES_PASSWORD: 'DATABASE_PASSWORD',

  // Pass-through app keys (same name in AWS JSON and .env)
  DATABASE_HOST: 'DATABASE_HOST',
  DATABASE_PORT: 'DATABASE_PORT',
  DATABASE_NAME: 'DATABASE_NAME',
  DATABASE_USER: 'DATABASE_USER',
  DATABASE_SSLMODE: 'DATABASE_SSLMODE',
  DATABASE_URL: 'DATABASE_URL',
  JWT_ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  JWT_ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN',
  JWT_REFRESH_SECRET: 'JWT_REFRESH_SECRET',
  JWT_REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  STRIPE_PUBLISHABLE_KEY: 'STRIPE_PUBLISHABLE_KEY',
  CLIENT_URL: 'CLIENT_URL',
  CORS_ALLOWED_ORIGINS: 'CORS_ALLOWED_ORIGINS',
  SMTP_HOST: 'SMTP_HOST',
  SMTP_PORT: 'SMTP_PORT',
  SMTP_SECURE: 'SMTP_SECURE',
  SMTP_USER: 'SMTP_USER',
  SMTP_PASS: 'SMTP_PASS',
  SMTP_FROM: 'SMTP_FROM',
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
};

async function fetchSecretRaw(secretId) {
  const region = getAwsRegion();
  const client = new SecretsManagerClient({ region });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  let raw = response.SecretString;
  if (!raw && response.SecretBinary) {
    raw = Buffer.from(response.SecretBinary).toString('utf8');
  }

  return { secretId, region, raw: raw || '' };
}

function parseSecretPayload(secretString) {
  if (!secretString) {
    throw new Error('SecretString is empty');
  }

  const trimmed = secretString.trim();

  // Plain-text secret → treat as password only
  if (!trimmed.startsWith('{')) {
    return { DATABASE_PASSWORD: trimmed };
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON secret must be an object');
  }

  return parsed;
}

/**
 * Apply AWS secret fields onto process.env.
 * AWS always wins when a usable value is present.
 * Returns list of env keys that came from AWS (for logging).
 */
function applySecretObject(secretObject, sourceLabel) {
  const applied = [];

  for (const [rawKey, rawValue] of Object.entries(secretObject)) {
    if (!isUsableSecretValue(rawValue)) continue;

    const mappedKey = Object.prototype.hasOwnProperty.call(SECRET_KEY_MAP, rawKey)
      ? SECRET_KEY_MAP[rawKey]
      : rawKey;

    // null mapping = intentionally ignored
    if (mappedKey === null) continue;

    // Unknown keys: still apply if they look like env vars (UPPER_SNAKE)
    const envKey = mappedKey || (/^[A-Z][A-Z0-9_]*$/.test(rawKey) ? rawKey : null);
    if (!envKey) continue;

    process.env[envKey] = String(rawValue);
    applied.push(envKey);
  }

  if (applied.length) {
    log(
      `Applied ${applied.length} value(s) from AWS (${sourceLabel}): `
      + `${[...new Set(applied)].join(', ')}`,
    );
  }

  return [...new Set(applied)];
}

function extractPasswordFromObject(secretObject) {
  const password =
    secretObject.DATABASE_PASSWORD
    ?? secretObject.DB_PASSWORD
    ?? secretObject.password
    ?? secretObject.Password
    ?? secretObject.POSTGRES_PASSWORD;

  return isUsableSecretValue(password) ? String(password) : null;
}

/**
 * Build DATABASE_URL from split env vars + password.
 */
export function buildDatabaseUrl({
  host = process.env.DATABASE_HOST,
  port = process.env.DATABASE_PORT || '5432',
  name = process.env.DATABASE_NAME || 'postgres',
  user = process.env.DATABASE_USER,
  password = process.env.DATABASE_PASSWORD,
  sslMode = process.env.DATABASE_SSLMODE,
} = {}) {
  if (!host || !user || password === undefined || password === null || password === '') {
    return null;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password).replace(/~/g, '%7E');
  const encodedHost = host.replace(/^https?:\/\//, '');

  let url = `postgresql://${encodedUser}:${encodedPassword}@${encodedHost}:${port}/${name}`;

  if (sslMode) {
    url += `?sslmode=${encodeURIComponent(sslMode)}`;
  }

  return url;
}

function applyBuiltDatabaseUrl() {
  const built = buildDatabaseUrl();

  if (built) {
    process.env.DATABASE_URL = built;
    log('Built DATABASE_URL from DATABASE_HOST + DATABASE_USER + password');
    return true;
  }

  if (process.env.DATABASE_URL) {
    log('Using existing DATABASE_URL from environment (legacy / local fallback)');
    return true;
  }

  warn(
    'Database config incomplete — need DATABASE_HOST, DATABASE_USER, '
    + 'and password (AWS or DATABASE_PASSWORD), or DATABASE_URL',
  );
  return false;
}

/**
 * Startup config loader:
 * .env baseline → AWS overrides → nested DB password secret if needed → DATABASE_URL
 */
export async function loadSecrets() {
  dotenv.config();

  const secretId = getSecretId();
  let passwordSource = process.env.DATABASE_PASSWORD ? 'env' : 'missing';
  const awsKeys = [];

  if (!secretId) {
    log(
      'AWS_SECRET_NAME not set — using .env / host environment only '
      + '(no AWS overrides)',
    );
  } else {
    try {
      const primary = await fetchSecretRaw(secretId);
      const primaryObject = parseSecretPayload(primary.raw);
      awsKeys.push(...applySecretObject(primaryObject, primary.secretId));

      // Primary secret may itself be the RDS password secret
      const primaryPassword = extractPasswordFromObject(primaryObject);
      if (primaryPassword) {
        process.env.DATABASE_PASSWORD = primaryPassword;
        passwordSource = 'aws';
      }

      // Client pattern: config secret points at nested RDS_PW_Secret
      const nestedPasswordSecretId = (
        process.env.AWS_DB_PASSWORD_SECRET
        || primaryObject.RDS_PW_Secret
        || primaryObject.RDS_PW_SECRET
        || ''
      ).toString().trim();

      if (nestedPasswordSecretId && nestedPasswordSecretId !== secretId) {
        try {
          const nested = await fetchSecretRaw(nestedPasswordSecretId);
          const nestedObject = parseSecretPayload(nested.raw);
          awsKeys.push(...applySecretObject(nestedObject, nested.secretId));

          const nestedPassword = extractPasswordFromObject(nestedObject);
          if (nestedPassword) {
            process.env.DATABASE_PASSWORD = nestedPassword;
            passwordSource = 'aws-nested';
            log(
              `Loaded Postgres password from nested AWS secret `
              + `(${nested.secretId} @ ${nested.region})`,
            );
          }
        } catch (nestedError) {
          warn(
            `Nested password secret unavailable (${nestedError.message}) — `
            + 'keeping password from primary secret or .env',
          );
        }
      } else if (passwordSource === 'aws') {
        log(
          `Loaded credentials from AWS Secrets Manager `
          + `(${primary.secretId} @ ${primary.region}); password from primary secret`,
        );
      } else {
        log(
          `Loaded credentials from AWS Secrets Manager `
          + `(${primary.secretId} @ ${primary.region}); `
          + 'password not in that secret — using .env if present',
        );
      }

      // After AWS merge, re-evaluate password presence
      if (process.env.DATABASE_PASSWORD && passwordSource === 'missing') {
        passwordSource = 'env';
      }
    } catch (error) {
      if (process.env.DATABASE_PASSWORD) {
        passwordSource = 'env-fallback';
        warn(
          `AWS Secrets Manager unavailable (${error.message}) — `
          + 'falling back to .env values',
        );
      } else {
        warn(
          `AWS Secrets Manager unavailable (${error.message}) — `
          + 'and DATABASE_PASSWORD is not set in environment',
        );
      }
    }
  }

  if (passwordSource === 'env') {
    log('DATABASE_PASSWORD source=env (.env / host; AWS did not provide password)');
  } else if (passwordSource === 'missing') {
    log('No DATABASE_PASSWORD yet — will use DATABASE_URL if provided');
  }

  const hasDatabaseUrl = applyBuiltDatabaseUrl();
  if (passwordSource === 'missing' && process.env.DATABASE_URL) {
    passwordSource = 'embedded-in-database-url';
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    secretName: secretId || null,
    hasDatabaseUrl,
    passwordSource,
    awsKeys: [...new Set(awsKeys)],
  };
}

export default loadSecrets;
