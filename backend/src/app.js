const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const { healthCheck } = require('./config/db');
const asyncHandler = require('./utils/asyncHandler');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const patientsRoutes = require('./routes/patients.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const medicinesRoutes = require('./routes/medicines.routes');
const recordsRoutes = require('./routes/records.routes');
const prescriptionsRoutes = require('./routes/prescriptions.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Clinic Security API',
      version: '1.0.0',
      health: '/health'
    }
  });
});

app.get(
  '/health',
  asyncHandler(async (req, res) => {
    const dbOk = await healthCheck();
    res.status(dbOk ? 200 : 503).json({
      success: dbOk,
      data: {
        status: dbOk ? 'ok' : 'degraded',
        database: dbOk ? 'up' : 'down',
        timestamp: new Date().toISOString()
      }
    });
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/patients', requireAuth, patientsRoutes);
app.use('/api/doctors', requireAuth, doctorsRoutes);
app.use('/api/appointments', requireAuth, appointmentsRoutes);
app.use('/api/medicines', requireAuth, medicinesRoutes);
app.use('/api/records', requireAuth, recordsRoutes);
app.use('/api/records', requireAuth, prescriptionsRoutes);
app.use('/api/audit-logs', requireAuth, auditRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
