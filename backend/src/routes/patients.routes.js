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
  updatePatientProfileSchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { findPatientByUserId, findDoctorByUserId } = require('../utils/access');
const { getPagination } = require('../utils/pagination');
const { z } = require('zod');

const router = express.Router();

const patientsListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .strict();

router.get(
  '/me',
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const patient = await findPatientByUserId(req.user.userId);
    if (!patient) {
      throw new HttpError(404, 'Patient profile not found', 'PATIENT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        address: patient.address,
        created_at: patient.created_at,
        updated_at: patient.updated_at
      }
    });
  })
);

router.patch(
  '/me',
  requireRole('patient'),
  validateBody(updatePatientProfileSchema),
  asyncHandler(async (req, res) => {
    const patient = await findPatientByUserId(req.user.userId);
    if (!patient) {
      throw new HttpError(404, 'Patient profile not found', 'PATIENT_NOT_FOUND');
    }

    const fields = [];
    const values = [];

    for (const field of ['full_name', 'date_of_birth', 'gender', 'phone', 'address']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    values.push(patient.patient_id);
    await pool.execute(
      `UPDATE patients SET ${fields.join(', ')} WHERE patient_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'PATIENT_PROFILE_UPDATE',
      entity: 'patients',
      entityId: patient.patient_id,
      ip: req.ip,
      result: 'success'
    });

    const updated = await findPatientByUserId(req.user.userId);
    res.json({
      success: true,
      data: {
        patient_id: updated.patient_id,
        full_name: updated.full_name,
        date_of_birth: updated.date_of_birth,
        gender: updated.gender,
        phone: updated.phone,
        address: updated.address,
        updated_at: updated.updated_at
      }
    });
  })
);

router.get(
  '/',
  requireRole('admin'),
  validateQuery(patientsListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);

    const [rows] = await pool.query(
      `SELECT
         p.patient_id,
         p.full_name,
         p.date_of_birth,
         p.gender,
         p.phone,
         p.address,
         u.email,
         u.is_active,
         p.created_at
       FROM patients p
       JOIN users u ON u.user_id = p.user_id
       ORDER BY p.patient_id ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({ ...row, is_active: row.is_active === 1 })),
      meta: { page, limit, count: rows.length }
    });
  })
);

router.patch(
  '/:id',
  requireRole('admin'),
  validateParams(idParamSchema),
  validateBody(updatePatientProfileSchema),
  asyncHandler(async (req, res) => {
    const patientId = req.params.id;

    const [rows] = await pool.execute(
      'SELECT patient_id FROM patients WHERE patient_id = ? LIMIT 1',
      [patientId]
    );
    if (!rows[0]) {
      throw new HttpError(404, 'Patient not found', 'PATIENT_NOT_FOUND');
    }

    const fields = [];
    const values = [];
    for (const field of ['full_name', 'date_of_birth', 'gender', 'phone', 'address']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    values.push(patientId);

    await pool.execute(
      `UPDATE patients SET ${fields.join(', ')} WHERE patient_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'PATIENT_UPDATE',
      entity: 'patients',
      entityId: patientId,
      ip: req.ip,
      result: 'success'
    });

    const [updatedRows] = await pool.execute(
      'SELECT * FROM patients WHERE patient_id = ? LIMIT 1',
      [patientId]
    );

    res.json({ success: true, data: updatedRows[0] });
  })
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const patientId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT
         p.patient_id,
         p.user_id,
         p.full_name,
         p.date_of_birth,
         p.gender,
         p.phone,
         p.address,
         p.created_at,
         u.email,
         u.is_active
       FROM patients p
       JOIN users u ON u.user_id = p.user_id
       WHERE p.patient_id = ?
       LIMIT 1`,
      [patientId]
    );
    const patient = rows[0];

    if (!patient) {
      throw new HttpError(404, 'Patient not found', 'PATIENT_NOT_FOUND');
    }

    let allowed = false;
    if (req.user.role === 'admin') {
      allowed = true;
    } else if (req.user.role === 'patient') {
      allowed = patient.user_id === req.user.userId;
    } else if (req.user.role === 'doctor') {
      const doctor = await findDoctorByUserId(req.user.userId);
      if (doctor) {
        const [appointmentRows] = await pool.execute(
          'SELECT 1 FROM appointments WHERE patient_id = ? AND doctor_id = ? LIMIT 1',
          [patientId, doctor.doctor_id]
        );
        allowed = appointmentRows.length > 0;
      }
    }

    if (!allowed) {
      await writeAudit({
        userId: req.user.userId,
        action: 'PATIENT_VIEW',
        entity: 'patients',
        entityId: patientId,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(403, 'You cannot access this patient', 'FORBIDDEN');
    }

    if (req.user.role !== 'patient') {
      await writeAudit({
        userId: req.user.userId,
        action: 'PATIENT_VIEW',
        entity: 'patients',
        entityId: patientId,
        ip: req.ip,
        result: 'success'
      });
    }

    res.json({
      success: true,
      data: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        address: patient.address,
        email: patient.email,
        is_active: patient.is_active === 1,
        created_at: patient.created_at
      }
    });
  })
);

module.exports = router;
