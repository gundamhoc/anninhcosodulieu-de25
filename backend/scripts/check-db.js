const { pool, healthCheck } = require('../src/config/db');

(async () => {
  try {
    const ok = await healthCheck();
    console.log(ok ? 'Database connection: OK' : 'Database connection: FAILED');
    await pool.end();
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
})();
