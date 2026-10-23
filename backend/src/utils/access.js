const { pool } = require('../config/db');

async function findPatientByUserId(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM patients WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function findDoctorByUserId(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM doctors WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function getAppointmentWithOwners(appointmentId) {
  const [rows] = await pool.execute(
    `SELECT
       a.appointment_id,
       a.patient_id,
       a.doctor_id,
       a.scheduled_at,
       a.status,
       a.reason,
       a.created_at,
       a.updated_at,
       p.user_id AS patient_user_id,
       d.user_id AS doctor_user_id,
       p.full_name AS patient_name,
       d.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.patient_id = a.patient_id
     JOIN doctors d ON d.doctor_id = a.doctor_id
     WHERE a.appointment_id = ?
     LIMIT 1`,
    [appointmentId]
  );
  return rows[0] || null;
}

async function getRecordWithOwners(recordId) {
  const [rows] = await pool.execute(
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
       a.patient_id,
       a.doctor_id,
       a.scheduled_at,
       a.status AS appointment_status,
       p.user_id AS patient_user_id,
       d.user_id AS doctor_user_id,
       p.full_name AS patient_name,
       d.full_name AS doctor_name
     FROM medical_records mr
     JOIN appointments a ON a.appointment_id = mr.appointment_id
     JOIN patients p ON p.patient_id = a.patient_id
     JOIN doctors d ON d.doctor_id = a.doctor_id
     WHERE mr.record_id = ?
     LIMIT 1`,
    [recordId]
  );
  return rows[0] || null;
}

module.exports = {
  findPatientByUserId,
  findDoctorByUserId,
  getAppointmentWithOwners,
  getRecordWithOwners
};
