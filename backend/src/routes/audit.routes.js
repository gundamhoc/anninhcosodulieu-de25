const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { auditListQuerySchema } = require('../validation/schemas');
const { getPagination } = require('../utils/pagination');

const router = express.Router();

router.use(requireRole('admin'));

router.get(
  '/',
  validateQuery(auditListQuerySchema),
  asyncHandler(async (req, res) => {
    const conditions = [];
    const params = [];

    if (req.query.user_id) {
      conditions.push('user_id = ?');
      params.push(req.query.user_id);
    }
    if (req.query.action) {
      conditions.push('`action` = ?');
      params.push(req.query.action);
    }
    if (req.query.result) {
      conditions.push('result = ?');
      params.push(req.query.result);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { page, limit, offset } = getPagination(req.query);

    const [rows] = await pool.query(
      `SELECT
         log_id,
         user_id,
         \`action\`,
         entity,
         entity_id,
         ip,
         result,
         created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: { page, limit, count: rows.length }
    });
  })
);

module.exports = router;
