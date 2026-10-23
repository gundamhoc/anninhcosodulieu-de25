const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const {
  validateBody,
  validateQuery,
  validateParams
} = require('../middleware/validate');
const {
  createMedicineSchema,
  updateMedicineSchema,
  medicinesListQuerySchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { getPagination } = require('../utils/pagination');

const router = express.Router();

function serializeMedicine(row) {
  return {
    ...row,
    is_prescription_only: row.is_prescription_only === 1,
    is_active: row.is_active === 1
  };
}

async function getMedicineById(medicineId) {
  const [rows] = await pool.execute(
    `SELECT
       medicine_id,
       medicine_code,
       name,
       active_ingredient,
       unit,
       stock_quantity,
       is_prescription_only,
       is_active,
       created_at,
       updated_at
     FROM medicines
     WHERE medicine_id = ?
     LIMIT 1`,
    [medicineId]
  );
  return rows[0] ? serializeMedicine(rows[0]) : null;
}

router.get(
  '/',
  validateQuery(medicinesListQuerySchema),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
      throw new HttpError(403, 'You cannot read the medicine catalog', 'FORBIDDEN');
    }

    const { page, limit, offset } = getPagination(req.query);
    const conditions = [];
    const params = [];

    if (req.user.role === 'doctor') {
      conditions.push('is_active = 1');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT
         medicine_id,
         medicine_code,
         name,
         active_ingredient,
         unit,
         stock_quantity,
         is_prescription_only,
         is_active,
         created_at,
         updated_at
       FROM medicines
       ${where}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map(serializeMedicine),
      meta: { page, limit, count: rows.length }
    });
  })
);

router.post(
  '/',
  requireRole('admin'),
  validateBody(createMedicineSchema),
  asyncHandler(async (req, res) => {
    const {
      medicine_code,
      name,
      active_ingredient,
      unit,
      stock_quantity,
      is_prescription_only,
      is_active
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO medicines
         (medicine_code, name, active_ingredient, unit, stock_quantity, is_prescription_only, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_code,
        name,
        active_ingredient ?? null,
        unit,
        stock_quantity,
        is_prescription_only === undefined ? 1 : is_prescription_only ? 1 : 0,
        is_active === undefined ? 1 : is_active ? 1 : 0
      ]
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'MEDICINE_CREATE',
      entity: 'medicines',
      entityId: result.insertId,
      ip: req.ip,
      result: 'success'
    });

    const medicine = await getMedicineById(result.insertId);

    res.status(201).json({ success: true, data: medicine });
  })
);

router.patch(
  '/:id',
  requireRole('admin'),
  validateParams(idParamSchema),
  validateBody(updateMedicineSchema),
  asyncHandler(async (req, res) => {
    const medicine = await getMedicineById(req.params.id);

    if (!medicine) {
      throw new HttpError(404, 'Medicine not found', 'MEDICINE_NOT_FOUND');
    }

    const fields = [];
    const values = [];
    const mapping = {
      medicine_code: 'medicine_code',
      name: 'name',
      active_ingredient: 'active_ingredient',
      unit: 'unit',
      stock_quantity: 'stock_quantity',
      is_prescription_only: 'is_prescription_only',
      is_active: 'is_active'
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (req.body[key] !== undefined) {
        fields.push(`${column} = ?`);
        if (key === 'is_prescription_only' || key === 'is_active') {
          values.push(req.body[key] ? 1 : 0);
        } else {
          values.push(req.body[key]);
        }
      }
    }

    values.push(medicine.medicine_id);
    await pool.execute(`UPDATE medicines SET ${fields.join(', ')} WHERE medicine_id = ?`, values);

    await writeAudit({
      userId: req.user.userId,
      action: 'MEDICINE_UPDATE',
      entity: 'medicines',
      entityId: medicine.medicine_id,
      ip: req.ip,
      result: 'success'
    });

    const updated = await getMedicineById(medicine.medicine_id);
    res.json({ success: true, data: updated });
  })
);

module.exports = router;
