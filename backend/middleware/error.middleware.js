const ApiError = require('../utils/ApiError');
const { sendError } = require('../utils/response');

/** Any /api request that matched no route. */
function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: 'NOT_FOUND',
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      error: err.code,
      errors: err.errors,
    });
  }

  // body-parser failures
  if (err.type === 'entity.parse.failed') {
    return sendError(res, { statusCode: 400, message: 'Malformed JSON in request body.', error: 'BAD_REQUEST' });
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, { statusCode: 413, message: 'Request body is too large.', error: 'PAYLOAD_TOO_LARGE' });
  }

  // --- MongoDB / Mongoose errors: translated, never forwarded raw ---

  // Unique index violated (e.g. two simultaneous registrations with the same email).
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const message = field === 'email' ? 'An account with this email already exists.' : `Duplicate value for ${field}.`;
    return sendError(res, { statusCode: 409, message, error: 'CONFLICT', errors: [{ field, message }] });
  }

  // Schema validation (second line of defence behind express-validator).
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return sendError(res, { statusCode: 400, message: 'Validation failed', error: 'BAD_REQUEST', errors });
  }

  // Malformed ObjectId or wrongly-typed value that reached a query.
  if (err.name === 'CastError') {
    return sendError(res, { statusCode: 400, message: 'Invalid identifier or value.', error: 'BAD_REQUEST' });
  }

  // Database unreachable / timed out: tell the client to retry, keep details in the server log.
  const dbDown = ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongoNotConnectedError']
    .includes(err.name) || /buffering timed out/i.test(err.message || '');
  if (dbDown) {
    console.error('Database unavailable:', err.message);
    return sendError(res, {
      statusCode: 503,
      message: 'The database is temporarily unavailable. Please try again shortly.',
      error: 'SERVICE_UNAVAILABLE',
    });
  }

  // Unexpected: log the details server-side, send nothing sensitive to the client.
  console.error(err);
  return sendError(res, {
    statusCode: 500,
    message: 'Something went wrong on our side. Please try again later.',
    error: 'INTERNAL_SERVER_ERROR',
  });
}

module.exports = { notFoundHandler, errorHandler };
