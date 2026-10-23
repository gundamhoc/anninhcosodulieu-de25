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
  createAppointmentSchema,
  appointmentStatusSchema,
  appointmentsListQuerySchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const {
  findPatientByUserId,
  findDoctorByUserId,
  getAppointmentWithOwners
} = require('../utils/access');
const { getPagination } = require('../utils/pagination');
const { toMysqlDateTime, isFuture } = require('../utils/datetime');

const router = express.Router();

const statusTransitions = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

function canAccessAppointment(appointment, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'doctor') {
    return Number(appointment.doctor_user_id) === Number(user.userId);
  }
  if (user.role === 'patient') {
    return Number(appointment.patient_user_id) === Number(user.userId);
  }
  return false;
}

router.post(
  '/',
  requireRole('patient'),
  validateBody(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const patient = await findPatientByUserId(req.user.userId);
    if (!patient) {
      throw new HttpError(404, 'Patient profile not found', 'PATIENT_NOT_FOUND');
    }

    if (!isFuture(req.body.scheduled_at)) {
      throw new HttpError(
        400,
        'Appointment time must be in the future',
        'INVALID_SCHEDULE'
      );
    }

    const scheduledAt = toMysqlDateTime(req.body.scheduled_at);
    if (!scheduledAt) {
      throw new HttpError(400, 'Invalid appointment time', 'INVALID_SCHEDULE');
    }

    const connection = await pool.getConnection();
    let appointmentId;

    try {
      await connection.beginTransaction();

      const [doctorRows] = await connection.execute(
        `SELECT d.doctor_id
         FROM doctors d
         JOIN users u ON u.user_id = d.user_id
         WHERE d.doctor_id = ? AND u.is_active = 1
         FOR UPDATE`,
        [req.body.doctor_id]
      );

      if (!doctorRows[0]) {
        throw new HttpError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');
      }

      const [conflictRows] = await connection.execute(
        `SELECT appointment_id
         FROM appointments
         WHERE doctor_id = ?
           AND scheduled_at = ?
           AND status IN ('pending', 'confirmed')
         LIMIT 1`,
        [req.body.doctor_id, scheduledAt]
      );

      if (conflictRows[0]) {
        throw new HttpError(
          409,
          'This doctor already has an appointment at that time',
          'APPOINTMENT_CONFLICT'
        );
      }

      const [result] = await connection.execute(
        `INSERT INTO appointments
           (patient_id, doctor_id, scheduled_at, status, reason)
         VALUES (?, ?, ?, 'pending', ?)`,
        [patient.patient_id, req.body.doctor_id, scheduledAt, req.body.reason ?? null]
      );

      appointmentId = result.insertId;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await writeAudit({
      userId: req.user.userId,
      action: 'APPOINTMENT_CREATE',
      entity: 'appointments',
      entityId: appointmentId,
      ip: req.ip,
      result: 'success'
    });

    const appointment = await getAppointmentWithOwners(appointmentId);

    res.status(201).json({
      success: true,
      data: {
        appointment_id: appointment.appointment_id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        scheduled_at: appointment.scheduled_at,
        status: appointment.status,
        reason: appointment.reason,
        patient_name: appointment.patient_name,
        doctor_name: appointment.doctor_name,
        created_at: appointment.created_at
      }
    });
  })
);

router.get(
  '/',
  validateQuery(appointmentsListQuerySchema),
  asyncHandler(async (req, res) => {
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
    }

    if (req.query.status) {
      conditions.push('a.status = ?');
      params.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { page, limit, offset } = getPagination(req.query);

    const [rows] = await pool.query(
      `SELECT
         a.appointment_id,
         a.patient_id,
         a.doctor_id,
         a.scheduled_at,
         a.status,
         a.reason,
         a.created_at,
         a.updated_at,
         p.full_name AS patient_name,
         d.full_name AS doctor_name
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       ${where}
       ORDER BY a.scheduled_at DESC
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

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const appointment = await getAppointmentWithOwners(req.params.id);

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (!canAccessAppointment(appointment, req.user)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'APPOINTMENT_VIEW',
        entity: 'appointments',
        entityId: appointment.appointment_id,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(403, 'You cannot access this appointment', 'FORBIDDEN');
    }

    res.json({
      success: true,
      data: {
        appointment_id: appointment.appointment_id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        patient_name: appointment.patient_name,
        doctor_name: appointment.doctor_name,
        scheduled_at: appointment.scheduled_at,
        status: appointment.status,
        reason: appointment.reason,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at
      }
    });
  })
);

router.patch(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(appointmentStatusSchema),
  asyncHandler(async (req, res) => {
    const appointment = await getAppointmentWithOwners(req.params.id);

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (!canAccessAppointment(appointment, req.user)) {
      await writeAudit({
        userId: req.user.userId,
        action: 'APPOINTMENT_STATUS_UPDATE',
        entity: 'appointments',
        entityId: appointment.appointment_id,
        ip: req.ip,
        result: 'denied'
      });
      throw new HttpError(403, 'You cannot access this appointment', 'FORBIDDEN');
    }

    const nextStatus = req.body.status;

    if (req.user.role === 'patient' && nextStatus !== 'cancelled') {
      throw new HttpError(
        403,
        'Patients can only cancel their own appointments',
        'FORBIDDEN'
      );
    }

    const allowedNextStatuses = statusTransitions[appointment.status] || [];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new HttpError(
        409,
        `Cannot change status from ${appointment.status} to ${nextStatus}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const [result] = await pool.execute(
      'UPDATE appointments SET status = ? WHERE appointment_id = ? AND status = ?',
      [nextStatus, appointment.appointment_id, appointment.status]
    );

    if (result.affectedRows === 0) {
      throw new HttpError(
        409,
        'Appointment status changed by another request',
        'STATUS_CONFLICT'
      );
    }

    await writeAudit({
      userId: req.user.userId,
      action: 'APPOINTMENT_STATUS_UPDATE',
      entity: 'appointments',
      entityId: appointment.appointment_id,
      ip: req.ip,
      result: 'success'
    });

    const updated = await getAppointmentWithOwners(appointment.appointment_id);

    res.json({
      success: true,
      data: {
        appointment_id: updated.appointment_id,
        status: updated.status,
        scheduled_at: updated.scheduled_at,
        patient_id: updated.patient_id,
        doctor_id: updated.doctor_id
      }
    });
  })
);

module.exports = router;
