const { ZodError } = require('zod');
const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Route not found', 'NOT_FOUND'));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      }
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON'
      }
    });
  }

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_VALUE',
        message: 'A record with this value already exists'
      }
    });
  }

  if (err && (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2')) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'RELATION_CONFLICT',
        message: 'This operation conflicts with related data'
      }
    });
  }

  if (err && err.code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALUE_TOO_LONG',
        message: 'One of the values is too long'
      }
    });
  }

  console.error('[error]', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
}

module.exports = { notFound, errorHandler };
