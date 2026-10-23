const { pool } = require('../config/db');
const { verifyAccessToken } = require('../utils/jwt');
const HttpError = require('../utils/httpError');

async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (!token || String(scheme).toLowerCase() !== 'bearer') {
      throw new HttpError(
        401,
        'Missing or invalid Authorization header',
        'UNAUTHENTICATED'
      );
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new HttpError(401, 'Invalid token subject', 'INVALID_TOKEN');
    }

    const [rows] = await pool.execute(
      'SELECT user_id, email, `role`, is_active FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const user = rows[0];

    if (!user || user.is_active !== 1) {
      throw new HttpError(401, 'Account is inactive or not found', 'ACCOUNT_INACTIVE');
    }

    req.user = {
      userId: user.user_id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new HttpError(401, 'Authentication required', 'UNAUTHENTICATED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          'You do not have permission to access this resource',
          'FORBIDDEN'
        )
      );
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
