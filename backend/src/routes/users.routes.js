const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { hashPassword } = require('../utils/password');
const { requireRole } = require('../middleware/auth');
const {
  validateBody,
  validateQuery,
  validateParams
} = require('../middleware/validate');
const {
  createUserSchema,
  updateUserSchema,
  usersListQuerySchema,
  idParamSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { getPagination } = require('../utils/pagination');

const router = express.Router();

router.use(requireRole('admin'));

router.get(
  '/',
  validateQuery(usersListQuerySchema),
  asyncHandler(async (req, res) => {
    const conditions = [];
    const params = [];

    if (req.query.role) {
      conditions.push('`role` = ?');
      params.push(req.query.role);
    }
    if (req.query.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(req.query.is_active === 'true' ? 1 : 0);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { page, limit, offset } = getPagination(req.query);

    const [rows] = await pool.query(
      `SELECT user_id, email, \`role\`, is_active, created_at, updated_at
       FROM users
       ${where}
       ORDER BY user_id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map((user) => ({
        ...user,
        is_active: user.is_active === 1
      })),
      meta: { page, limit, count: rows.length }
    });
  })
);

router.post(
  '/',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const {
      email,
      password,
      role,
      full_name,
      date_of_birth,
      gender,
      phone,
      address,
      specialty,
      license_number
    } = req.body;

    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();
    let userId;
    let profile = null;

    try {
      await connection.beginTransaction();

      const [userResult] = await connection.execute(
        'INSERT INTO users (email, password_hash, `role`, is_active) VALUES (?, ?, ?, 1)',
        [email, passwordHash, role]
      );
      userId = userResult.insertId;

      if (role === 'patient') {
        const [patientResult] = await connection.execute(
          `INSERT INTO patients
             (user_id, full_name, date_of_birth, gender, phone, address)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            full_name,
            date_of_birth ?? null,
            gender ?? null,
            phone ?? null,
            address ?? null
          ]
        );
        profile = {
          patient_id: patientResult.insertId,
          full_name,
          date_of_birth: date_of_birth ?? null,
          gender: gender ?? null,
          phone: phone ?? null,
          address: address ?? null
        };
      } else if (role === 'doctor') {
        const [doctorResult] = await connection.execute(
          `INSERT INTO doctors
             (user_id, full_name, specialty, license_number, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [
            userId,
            full_name,
            specialty ?? null,
            license_number ?? null,
            phone ?? null
          ]
        );
        profile = {
          doctor_id: doctorResult.insertId,
          full_name,
          specialty: specialty ?? null,
          license_number: license_number ?? null,
          phone: phone ?? null
        };
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
      action: 'USER_CREATE',
      entity: 'users',
      entityId: userId,
      ip: req.ip,
      result: 'success'
    });

    res.status(201).json({
      success: true,
      data: {
        user: { user_id: userId, email, role, is_active: true },
        profile
      }
    });
  })
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const [userRows] = await pool.execute(
      'SELECT user_id, email, `role`, is_active, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const user = userRows[0];

    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    let profile = null;
    if (user.role === 'patient') {
      const [rows] = await pool.execute(
        'SELECT * FROM patients WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (rows[0]) {
        profile = {
          patient_id: rows[0].patient_id,
          full_name: rows[0].full_name,
          date_of_birth: rows[0].date_of_birth,
          gender: rows[0].gender,
          phone: rows[0].phone,
          address: rows[0].address
        };
      }
    } else if (user.role === 'doctor') {
      const [rows] = await pool.execute(
        'SELECT * FROM doctors WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (rows[0]) {
        profile = {
          doctor_id: rows[0].doctor_id,
          full_name: rows[0].full_name,
          specialty: rows[0].specialty,
          license_number: rows[0].license_number,
          phone: rows[0].phone
        };
      }
    }

    res.json({
      success: true,
      data: {
        user: { ...user, is_active: user.is_active === 1 },
        profile
      }
    });
  })
);

router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const [rows] = await pool.execute(
      'SELECT user_id, email, `role`, is_active FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!rows[0]) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (userId === req.user.userId && req.body.is_active === false) {
      throw new HttpError(
        400,
        'You cannot deactivate your own account',
        'SELF_DEACTIVATION'
      );
    }

    const fields = [];
    const values = [];

    if (req.body.email !== undefined) {
      fields.push('email = ?');
      values.push(req.body.email);
    }
    if (req.body.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(req.body.is_active ? 1 : 0);
    }

    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'USER_UPDATE',
      entity: 'users',
      entityId: userId,
      ip: req.ip,
      result: 'success'
    });

    const [updatedRows] = await pool.execute(
      'SELECT user_id, email, `role`, is_active, updated_at FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        ...updatedRows[0],
        is_active: updatedRows[0].is_active === 1
      }
    });
  })
);

router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    if (userId === req.user.userId) {
      throw new HttpError(
        400,
        'You cannot deactivate your own account',
        'SELF_DEACTIVATION'
      );
    }

    const [rows] = await pool.execute(
      'SELECT user_id, is_active FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!rows[0]) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    await pool.execute(
      'UPDATE users SET is_active = 0 WHERE user_id = ?',
      [userId]
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'USER_DISABLE',
      entity: 'users',
      entityId: userId,
      ip: req.ip,
      result: 'success'
    });

    res.json({
      success: true,
      data: { message: 'User disabled successfully' }
    });
  })
);

module.exports = router;
