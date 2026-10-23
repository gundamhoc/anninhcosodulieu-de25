const HttpError = require('../utils/httpError');

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}

function validateBody(schema) {
  return function bodyValidator(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new HttpError(
          400,
          'Invalid request body',
          'VALIDATION_ERROR',
          formatIssues(result.error)
        )
      );
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return function queryValidator(req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new HttpError(
          400,
          'Invalid query parameters',
          'VALIDATION_ERROR',
          formatIssues(result.error)
        )
      );
    }
    req.query = result.data;
    next();
  };
}

function validateParams(schema) {
  return function paramsValidator(req, res, next) {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(
        new HttpError(
          400,
          'Invalid path parameters',
          'VALIDATION_ERROR',
          formatIssues(result.error)
        )
      );
    }
    req.params = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
