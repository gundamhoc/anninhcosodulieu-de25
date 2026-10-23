const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const {
  validateBody,
  validateParams
} = require('../middleware/validate');
const {
  updateDoctorProfileSchema,
  adminUpdateDoctorProfileSchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { findDoctorByUserId } = require('../utils/access');

const router = express.Router();

router.get(
  '/me',
  requireRole('doctor'),
  asyncHandler(async (req, res) => {
    const doctor = await findDoctorByUserId(req.user.userId);
    if (!doctor) {
      throw new HttpError(404, 'Doctor profile not found', 'DOCTOR_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        doctor_id: doctor.doctor_id,
        full_name: doctor.full_name,
        specialty: doctor.specialty,
        license_number: doctor.license_number,
        phone: doctor.phone,
        created_at: doctor.created_at,
        updated_at: doctor.updated_at
      }
    });
  })
);

router.patch(
  '/me',
  requireRole('doctor'),
  validateBody(updateDoctorProfileSchema),
  asyncHandler(async (req, res) => {
    const doctor = await findDoctorByUserId(req.user.userId);
    if (!doctor) {
      throw new HttpError(404, 'Doctor profile not found', 'DOCTOR_NOT_FOUND');
    }

    const fields = [];
    const values = [];
    for (const field of ['full_name', 'specialty', 'phone']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    values.push(doctor.doctor_id);

    await pool.execute(
      `UPDATE doctors SET ${fields.join(', ')} WHERE doctor_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'DOCTOR_PROFILE_UPDATE',
      entity: 'doctors',
      entityId: doctor.doctor_id,
      ip: req.ip,
      result: 'success'
    });

    const updated = await findDoctorByUserId(req.user.userId);
    res.json({
      success: true,
      data: {
        doctor_id: updated.doctor_id,
        full_name: updated.full_name,
        specialty: updated.specialty,
        license_number: updated.license_number,
        phone: updated.phone,
        updated_at: updated.updated_at
      }
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT
         d.doctor_id,
         d.full_name,
         d.specialty,
         d.license_number,
         d.phone
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE u.is_active = 1
       ORDER BY d.full_name ASC
       LIMIT 100`
    );

    res.json({ success: true, data: rows });
  })
);

router.patch(
  '/:id',
  requireRole('admin'),
  validateParams(idParamSchema),
  validateBody(adminUpdateDoctorProfileSchema),
  asyncHandler(async (req, res) => {
    const doctorId = req.params.id;

    const [rows] = await pool.execute(
      'SELECT doctor_id FROM doctors WHERE doctor_id = ? LIMIT 1',
      [doctorId]
    );
    if (!rows[0]) {
      throw new HttpError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');
    }

    const fields = [];
    const values = [];
    for (const field of ['full_name', 'specialty', 'phone', 'license_number']) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    values.push(doctorId);

    await pool.execute(
      `UPDATE doctors SET ${fields.join(', ')} WHERE doctor_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'DOCTOR_UPDATE',
      entity: 'doctors',
      entityId: doctorId,
      ip: req.ip,
      result: 'success'
    });

    const [updatedRows] = await pool.execute(
      'SELECT * FROM doctors WHERE doctor_id = ? LIMIT 1',
      [doctorId]
    );

    res.json({ success: true, data: updatedRows[0] });
  })
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const doctorId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT
         d.doctor_id,
         d.full_name,
         d.specialty,
         d.license_number,
         d.phone,
         u.email
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.doctor_id = ? AND u.is_active = 1
       LIMIT 1`,
      [doctorId]
    );
    const doctor = rows[0];

    if (!doctor) {
      throw new HttpError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');
    }

    res.json({ success: true, data: doctor });
  })
);

module.exports = router;
