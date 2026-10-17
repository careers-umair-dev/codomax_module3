const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/** Runs after a validator chain; replies 400 with a field-level error list. */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  return sendError(res, { statusCode: 400, message: 'Validation failed', errors });
}

module.exports = { validate };
