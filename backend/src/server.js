const app = require('./app');
const env = require('./config/env');
const { pool, healthCheck } = require('./config/db');

let server;

async function start() {
  await healthCheck();

  server = app.listen(env.port, () => {
    console.log(`Clinic API listening on http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/health`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);

  if (!server) {
    await pool.end();
    process.exit(0);
  }

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Error while closing database pool:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
