const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

// A missing secret is only tolerated outside production so local setup is painless.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

// The database is the source of truth; without a connection string the API cannot work.
// (Tests supply their own MONGODB_URI, so only guard real runtime environments.)
if (nodeEnv !== 'test' && !process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI must be set. Copy .env.example to .env and add your MongoDB Atlas connection string.');
}

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT) || 5000,

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_insecure_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Comma-separated origins, trailing slashes ignored.
  frontendOrigins: (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  mongo: {
    uri: process.env.MONGODB_URI,
    // Fail fast instead of hanging for 30s when Atlas is unreachable (bad URI, IP not allow-listed…).
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 10000,
  },

  // Legacy Module 2 JSON files — read ONLY by `npm run migrate`, never by the API.
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data'),

  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 50,

  // Mirrors the options in create-blog.html.
  categories: ['Development', 'Design', 'Lifestyle', 'Business', 'News'],

  limits: {
    nameMax: 60,
    passwordMin: 8,
    passwordMax: 72, // bcrypt only uses the first 72 bytes
    titleMax: 150,
    contentMin: 20,
    contentMax: 20000,
    imageMaxBytes: 2 * 1024 * 1024, // decoded size of an uploaded cover image
    jsonBodyLimit: '3mb', // base64 inflates ~33%, so leave headroom over imageMaxBytes
  },
};
