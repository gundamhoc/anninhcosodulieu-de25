const express = require('express');
const rateLimit = require('express-rate-limit');

const { pool } = require('../config/db');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { verifyPassword, hashPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  loginSchema,
  changePasswordSchema
} = require('../validation/schemas');
const { writeAudit } = require('../services/audit.service');
const { findPatientByUserId, findDoctorByUserId } = require('../utils/access');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again later.'
    }
  }
});

const loginRateLimit = env.rateLimit.enabled
  ? loginLimiter
  : (req, res, next) => next();

router.post(
  '/login',
  loginRateLimit,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const [rows] = await pool.execute(
      'SELECT user_id, email, password_hash, `role`, is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];

    if (!user || user.is_active !== 1) {
      await writeAudit({
        userId: user ? user.user_id : null,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user ? user.user_id : null,
        ip: req.ip,
        result: 'failed'
      });
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      await writeAudit({
        userId: user.user_id,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user.user_id,
        ip: req.ip,
        result: 'failed'
      });
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = signAccessToken(user);

    await writeAudit({
      userId: user.user_id,
      action: 'LOGIN_SUCCESS',
      entity: 'users',
      entityId: user.user_id,
      ip: req.ip,
      result: 'success'
    });

    res.json({
      success: true,
      data: {
        token,
        token_type: 'Bearer',
        expires_in: env.jwt.expiresIn,
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role
        }
      }
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      'SELECT user_id, email, `role`, is_active, created_at FROM users WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    const user = rows[0];

    let profile = null;
    if (user.role === 'patient') {
      const patient = await findPatientByUserId(user.user_id);
      if (patient) {
        profile = {
          patient_id: patient.patient_id,
          full_name: patient.full_name,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender,
          phone: patient.phone,
          address: patient.address
        };
      }
    } else if (user.role === 'doctor') {
      const doctor = await findDoctorByUserId(user.user_id);
      if (doctor) {
        profile = {
          doctor_id: doctor.doctor_id,
          full_name: doctor.full_name,
          specialty: doctor.specialty,
          license_number: doctor.license_number,
          phone: doctor.phone
        };
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
          is_active: user.is_active === 1,
          created_at: user.created_at
        },
        profile
      }
    });
  })
);

router.patch(
  '/me/password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;

    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    const user = rows[0];

    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const currentOk = await verifyPassword(current_password, user.password_hash);
    if (!currentOk) {
      throw new HttpError(
        400,
        'Current password is incorrect',
        'INVALID_CURRENT_PASSWORD'
      );
    }

    const newHash = await hashPassword(new_password);
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [newHash, req.user.userId]
    );

    await writeAudit({
      userId: req.user.userId,
      action: 'PASSWORD_CHANGE',
      entity: 'users',
      entityId: req.user.userId,
      ip: req.ip,
      result: 'success'
    });

    res.json({
      success: true,
      data: { message: 'Password changed successfully' }
    });
  })
);

module.exports = router;
