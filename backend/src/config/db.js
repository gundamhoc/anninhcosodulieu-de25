const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,
  multipleStatements: false
});

async function healthCheck() {
  const [rows] = await pool.query('SELECT 1 AS ok');
  return rows[0] && rows[0].ok === 1;
}

module.exports = { pool, healthCheck };
