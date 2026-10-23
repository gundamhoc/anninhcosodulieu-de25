const { pool } = require('../config/db');

async function writeAudit({
  userId = null,
  action,
  entity = null,
  entityId = null,
  ip = null,
  result = 'success'
}) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, `action`, entity, entity_id, ip, result) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        action,
        entity,
        entityId === null || entityId === undefined ? null : String(entityId),
        ip,
        result
      ]
    );
  } catch (error) {
    // Audit không được làm hỏng nghiệp vụ chính, nhưng phải thấy lỗi trong log server.
    console.error('[audit] Failed to write audit log:', error.message);
  }
}

module.exports = { writeAudit };
