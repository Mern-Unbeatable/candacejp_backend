import dotenv from 'dotenv';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

/**
 * Configuration split (aligned with deployment decisions):
 * - Env vars: Postgres host/URL, username, secret name, NODE_ENV (DEV/PROD)
 * - AWS Secrets Manager: Postgres password only
 * - App still uses DATABASE_URL internally after it is built at startup
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

function extractPasswordFromSecretPayload(secretString) {
  if (!secretString) {
    throw new Error('SecretString is empty');
  }

  const trimmed = secretString.trim();

  // Plain-text secret: the whole value is the password
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON secret must be an object');
  }

  const password =
    parsed.DATABASE_PASSWORD
    ?? parsed.DB_PASSWORD
    ?? parsed.password
    ?? parsed.Password
    ?? parsed.POSTGRES_PASSWORD;

  if (!password) {
    throw new Error(
      'AWS secret JSON must include DATABASE_PASSWORD (or password / DB_PASSWORD)',
    );
  }

  return String(password);
}

async function fetchDatabasePasswordFromAws() {
  const secretId = getSecretId();
  if (!secretId) {
    return null;
  }

  const region = getAwsRegion();
  const client = new SecretsManagerClient({ region });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  let raw = response.SecretString;
  if (!raw && response.SecretBinary) {
    raw = Buffer.from(response.SecretBinary).toString('utf8');
  }

  return {
    secretId,
    region,
    password: extractPasswordFromSecretPayload(raw),
  };
}

/**
 * Build DATABASE_URL from split env vars + password.
 * Env: DATABASE_HOST (or DATABASE_URL as host-only fallback name is NOT used),
 *      DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD,
 *      DATABASE_SSLMODE (optional)
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
  const encodedPassword = encodeURIComponent(password);
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
    'Database config incomplete — set DATABASE_HOST, DATABASE_USER, '
    + 'and password (AWS or DATABASE_PASSWORD), or provide DATABASE_URL',
  );
  return false;
}

/**
 * Startup config loader for DEV and PROD:
 * 1. Load non-secret values from .env / host environment
 * 2. Load Postgres password from AWS Secrets Manager (secret name from env)
 * 3. Fall back to DATABASE_PASSWORD in .env if AWS is unset or unavailable
 * 4. Build DATABASE_URL for Prisma
 */
export async function loadSecrets() {
  dotenv.config();

  const secretId = getSecretId();
  let passwordSource = 'missing';

  if (secretId) {
    try {
      const awsResult = await fetchDatabasePasswordFromAws();
      process.env.DATABASE_PASSWORD = awsResult.password;
      passwordSource = 'aws';
      log(
        `Loaded Postgres password from AWS Secrets Manager `
        + `(${awsResult.secretId} @ ${awsResult.region})`,
      );
    } catch (error) {
      if (process.env.DATABASE_PASSWORD) {
        passwordSource = 'env-fallback';
        warn(
          `AWS Secrets Manager unavailable (${error.message}) — `
          + 'falling back to DATABASE_PASSWORD from environment',
        );
      } else {
        warn(
          `AWS Secrets Manager unavailable (${error.message}) — `
          + 'and DATABASE_PASSWORD is not set in environment',
        );
      }
    }
  } else if (process.env.DATABASE_PASSWORD) {
    passwordSource = 'env';
    log('AWS_SECRET_NAME not set — using DATABASE_PASSWORD from environment');
  } else {
    log(
      'AWS_SECRET_NAME not set and no DATABASE_PASSWORD — '
      + 'will use DATABASE_URL if provided',
    );
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
  };
}

export default loadSecrets;
