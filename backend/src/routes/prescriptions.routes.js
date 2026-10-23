const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const {
  validateBody,
  validateParams
} = require('../middleware/validate');
const { createPrescriptionSchema, idParamSchema } = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { getRecordWithOwners } = require('../utils/access');

const router = express.Router();

function isRecordOwner(record, user) {
  return (
    Number(record.patient_user_id) === Number(user.userId) ||
    Number(record.doctor_user_id) === Number(user.userId)
  );
}

async function getPrescriptionByRecordId(recordId) {
  const [rows] = await pool.execute(
    `SELECT prescription_id, record_id, note, issued_at
     FROM prescriptions
     WHERE record_id = ?
     LIMIT 1`,
    [recordId]
  );
  const prescription = rows[0];

  if (!prescription) {
    return null;
  }

  const [items] = await pool.execute(
    `SELECT
       item_id,
       medicine_id,
       medicine_name,
       unit,
       dosage,
       frequency,
       duration_days,
       quantity,
       instruction
     FROM prescription_items
     WHERE prescription_id = ?
     ORDER BY item_id ASC`,
    [prescription.prescription_id]
  );

  return { ...prescription, items };
}

function deniedResponse(message = 'You cannot access this prescription') {
  return new HttpError(403, message, 'FORBIDDEN');
}

router.get(
  '/:id/prescription',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const record = await getRecordWithOwners(req.params.id);

    if (!record) {
      throw new HttpError(404, 'Medical record not found', 'RECORD_NOT_FOUND');
    }

    if (req.user.role === 'admin' || !isRecordOwner(record, req.user)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'PRESCRIPTION_ACCESS_DENIED',
        entity: 'prescriptions',
        entityId: record.record_id,
        ip: req.ip,
        result: 'denied'
      });
      throw deniedResponse();
    }

    const prescription = await getPrescriptionByRecordId(record.record_id);

    if (!prescription) {
      throw new HttpError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    }

    await writeAudit({
      userId: req.user.userId,
      action: 'PRESCRIPTION_VIEW',
      entity: 'prescriptions',
      entityId: prescription.prescription_id,
      ip: req.ip,
      result: 'success'
    });

    res.json({
      success: true,
      data: {
        ...prescription,
        appointment_id: record.appointment_id,
        scheduled_at: record.scheduled_at,
        appointment_status: record.appointment_status,
        patient_name: record.patient_name,
        doctor_name: record.doctor_name
      }
    });
  })
);

router.post(
  '/:id/prescription',
  requireRole('doctor'),
  validateParams(idParamSchema),
  validateBody(createPrescriptionSchema),
  asyncHandler(async (req, res) => {
    const record = await getRecordWithOwners(req.params.id);

    if (!record) {
      throw new HttpError(404, 'Medical record not found', 'RECORD_NOT_FOUND');
    }

    if (Number(record.doctor_user_id) !== Number(req.user.userId)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'PRESCRIPTION_CREATE',
        entity: 'prescriptions',
        entityId: record.record_id,
        ip: req.ip,
        result: 'denied'
      });
      throw deniedResponse('Only the doctor assigned to this record can prescribe medicine');
    }

    if (record.appointment_status !== 'completed') {
      throw new HttpError(
        409,
        'A prescription can only be created for a completed appointment',
        'APPOINTMENT_NOT_COMPLETED'
      );
    }

    const existing = await getPrescriptionByRecordId(record.record_id);
    if (existing) {
      throw new HttpError(
        409,
        'This medical record already has a prescription',
        'PRESCRIPTION_EXISTS'
      );
    }

    const connection = await pool.getConnection();
    let prescriptionId;

    try {
      await connection.beginTransaction();

      const medicineIds = req.body.items.map((item) => item.medicine_id);
      const placeholders = medicineIds.map(() => '?').join(', ');
      const [medicineRows] = await connection.query(
        `SELECT
           medicine_id,
           name,
           unit,
           stock_quantity
         FROM medicines
         WHERE medicine_id IN (${placeholders}) AND is_active = 1
         FOR UPDATE`,
        medicineIds
      );

      if (medicineRows.length !== medicineIds.length) {
        throw new HttpError(
          400,
          'One or more medicines do not exist or are no longer active',
          'MEDICINE_UNAVAILABLE'
        );
      }

      const medicineById = new Map(
        medicineRows.map((medicine) => [Number(medicine.medicine_id), medicine])
      );

      for (const item of req.body.items) {
        const medicine = medicineById.get(Number(item.medicine_id));
        if (Number(medicine.stock_quantity) < Number(item.quantity)) {
          throw new HttpError(
            409,
            `Not enough stock for ${medicine.name}`,
            'INSUFFICIENT_STOCK',
            [
              {
                path: 'items',
                message: `${medicine.name} chỉ còn ${medicine.stock_quantity} ${medicine.unit}`
              }
            ]
          );
        }
      }

      const [prescriptionResult] = await connection.execute(
        'INSERT INTO prescriptions (record_id, note) VALUES (?, ?)',
        [record.record_id, req.body.note || null]
      );
      prescriptionId = prescriptionResult.insertId;

      for (const item of req.body.items) {
        const medicine = medicineById.get(Number(item.medicine_id));

        await connection.execute(
          `INSERT INTO prescription_items
             (prescription_id, medicine_id, medicine_name, unit, dosage, frequency, duration_days, quantity, instruction)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prescriptionId,
            medicine.medicine_id,
            medicine.name,
            medicine.unit,
            item.dosage,
            item.frequency,
            item.duration_days,
            item.quantity,
            item.instruction || null
          ]
        );

        await connection.execute(
          'UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE medicine_id = ?',
          [item.quantity, medicine.medicine_id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAudit({
      userId: req.user.userId,
      action: 'PRESCRIPTION_CREATE',
      entity: 'prescriptions',
      entityId: prescriptionId,
      ip: req.ip,
      result: 'success'
    });

    const prescription = await getPrescriptionByRecordId(record.record_id);

    res.status(201).json({
      success: true,
      data: {
        ...prescription,
        appointment_id: record.appointment_id,
        scheduled_at: record.scheduled_at,
        appointment_status: record.appointment_status,
        patient_name: record.patient_name,
        doctor_name: record.doctor_name
      }
    });
  })
);

module.exports = router;
