const devOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const productionOrigins = [
  'https://6a410b86277413620dd2056b--shimmering-daffodil-fd30f2.netlify.app',
];

function parseExtraOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigins() {
  return [...new Set([
    process.env.CLIENT_URL,
    ...parseExtraOrigins(),
    ...productionOrigins,
    ...devOrigins,
  ].filter(Boolean))];
}

function matchesNetlifyOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.netlify.app');
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  if (process.env.CORS_ALLOW_NETLIFY === 'true' && matchesNetlifyOrigin(origin)) {
    return true;
  }

  return false;
}

export const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

export const socketCorsOptions = {
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true,
};
