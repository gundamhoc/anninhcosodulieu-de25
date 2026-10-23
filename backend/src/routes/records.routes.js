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
  createRecordSchema,
  updateRecordSchema,
  recordsListQuerySchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const {
  findPatientByUserId,
  findDoctorByUserId,
  getAppointmentWithOwners,
  getRecordWithOwners
} = require('../utils/access');
const { getPagination } = require('../utils/pagination');

const router = express.Router();

function isRecordOwner(record, user) {
  return (
    Number(record.patient_user_id) === Number(user.userId) ||
    Number(record.doctor_user_id) === Number(user.userId)
  );
}

router.post(
  '/',
  requireRole('doctor'),
  validateBody(createRecordSchema),
  asyncHandler(async (req, res) => {
    const appointment = await getAppointmentWithOwners(req.body.appointment_id);

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (Number(appointment.doctor_user_id) !== Number(req.user.userId)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'RECORD_CREATE',
        entity: 'medical_records',
        entityId: null,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(
        403,
        'You are not the doctor assigned to this appointment',
        'FORBIDDEN'
      );
    }

    if (appointment.status !== 'completed') {
      throw new HttpError(
        409,
        'A medical record can only be created for a completed appointment',
        'APPOINTMENT_NOT_COMPLETED'
      );
    }

    const [existingRows] = await pool.execute(
      'SELECT record_id FROM medical_records WHERE appointment_id = ? LIMIT 1',
      [appointment.appointment_id]
    );
    if (existingRows[0]) {
      throw new HttpError(
        409,
        'This appointment already has a medical record',
        'RECORD_EXISTS'
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO medical_records
         (appointment_id, diagnosis, treatment, notes)
       VALUES (?, ?, ?, ?)`,
      [
        appointment.appointment_id,
        req.body.diagnosis,
        req.body.treatment ?? null,
        req.body.notes ?? null
      ]
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'RECORD_CREATE',
      entity: 'medical_records',
      entityId: result.insertId,
      ip: req.ip,
      result: 'success'
    });

    const record = await getRecordWithOwners(result.insertId);

    res.status(201).json({
      success: true,
      data: {
        record_id: record.record_id,
        appointment_id: record.appointment_id,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        has_prescription: record.has_prescription === 1,
        patient_name: record.patient_name,
        doctor_name: record.doctor_name,
        created_at: record.created_at
      }
    });
  })
);

router.get(
  '/',
  validateQuery(recordsListQuerySchema),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      throw new HttpError(
        403,
        'Admin accounts cannot read clinical records by default',
        'FORBIDDEN'
      );
    }

    const conditions = [];
    const params = [];

    if (req.user.role === 'doctor') {
      const doctor = await findDoctorByUserId(req.user.userId);
      if (!doctor) {
        throw new HttpError(403, 'Doctor profile not found', 'FORBIDDEN');
      }
      conditions.push('a.doctor_id = ?');
      params.push(doctor.doctor_id);
    } else if (req.user.role === 'patient') {
      const patient = await findPatientByUserId(req.user.userId);
      if (!patient) {
        throw new HttpError(403, 'Patient profile not found', 'FORBIDDEN');
      }
      conditions.push('a.patient_id = ?');
      params.push(patient.patient_id);
    } else {
      throw new HttpError(403, 'You cannot read clinical records', 'FORBIDDEN');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { page, limit, offset } = getPagination(req.query);

    const [rows] = await pool.query(
      `SELECT
         mr.record_id,
         mr.appointment_id,
         mr.diagnosis,
         mr.treatment,
         mr.notes,
         EXISTS(
           SELECT 1 FROM prescriptions pr WHERE pr.record_id = mr.record_id
         ) AS has_prescription,
         mr.created_at,
         mr.updated_at,
         a.scheduled_at,
         a.status AS appointment_status,
         p.full_name AS patient_name,
         d.full_name AS doctor_name
       FROM medical_records mr
       JOIN appointments a ON a.appointment_id = mr.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       ${where}
       ORDER BY mr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        has_prescription: row.has_prescription === 1
      })),
      meta: { page, limit, count: rows.length }
    });
  })
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const record = await getRecordWithOwners(req.params.id);

    if (!record) {
      throw new HttpError(404, 'Medical record not found', 'RECORD_NOT_FOUND');
    }

    if (req.user.role === 'admin') {
      await writeAudit({
        userId: req.user.userId,
        action: 'RECORD_VIEW',
        entity: 'medical_records',
        entityId: record.record_id,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(
        403,
        'Admin accounts cannot read clinical records by default',
        'FORBIDDEN'
      );
    }

    if (!isRecordOwner(record, req.user)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'RECORD_VIEW',
        entity: 'medical_records',
        entityId: record.record_id,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(403, 'You cannot access this medical record', 'FORBIDDEN');
    }

    await writeAudit({
      userId: req.user.userId,
      action: 'RECORD_VIEW',
      entity: 'medical_records',
      entityId: record.record_id,
      ip: req.ip,
      result: 'success'
    });

    res.json({
      success: true,
      data: {
        record_id: record.record_id,
        appointment_id: record.appointment_id,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        has_prescription: record.has_prescription === 1,
        scheduled_at: record.scheduled_at,
        appointment_status: record.appointment_status,
        patient_name: record.patient_name,
        doctor_name: record.doctor_name,
        created_at: record.created_at,
        updated_at: record.updated_at
      }
    });
  })
);

router.patch(
  '/:id',
  requireRole('doctor'),
  validateParams(idParamSchema),
  validateBody(updateRecordSchema),
  asyncHandler(async (req, res) => {
    const record = await getRecordWithOwners(req.params.id);

    if (!record) {
      throw new HttpError(404, 'Medical record not found', 'RECORD_NOT_FOUND');
    }

    if (Number(record.doctor_user_id) !== Number(req.user.userId)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'RECORD_UPDATE',
        entity: 'medical_records',
        entityId: record.record_id,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(
        403,
        'Only the doctor assigned to this record can update it',
        'FORBIDDEN'
      );
    }

    const fields = [];
    const values = [];
    for (const field of ['diagnosis', 'treatment', 'notes']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    values.push(record.record_id);

    await pool.execute(
      `UPDATE medical_records SET ${fields.join(', ')} WHERE record_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'RECORD_UPDATE',
      entity: 'medical_records',
      entityId: record.record_id,
      ip: req.ip,
      result: 'success'
    });

    const updated = await getRecordWithOwners(record.record_id);

    res.json({
      success: true,
      data: {
        record_id: updated.record_id,
        diagnosis: updated.diagnosis,
        treatment: updated.treatment,
        notes: updated.notes,
        updated_at: updated.updated_at
      }
    });
  })
);

module.exports = router;
