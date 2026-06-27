const devOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function getAllowedOrigins() {
  return [...new Set([process.env.CLIENT_URL, ...devOrigins].filter(Boolean))];
}

export function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return getAllowedOrigins().includes(origin);
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
  origin: process.env.NODE_ENV === 'production' ? getAllowedOrigins() : true,
  methods: ['GET', 'POST'],
  credentials: true,
};
