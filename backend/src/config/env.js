const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = Number(process.env.PORT || 3000);
const dbPort = Number(process.env.DB_PORT);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer');
}
if (!Number.isInteger(dbPort) || dbPort <= 0) {
  throw new Error('DB_PORT must be a positive integer');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  db: {
    host: process.env.DB_HOST,
    port: dbPort,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'clinic-api'
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 20)
  }
};
