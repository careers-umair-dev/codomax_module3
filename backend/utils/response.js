/** Consistent JSON envelopes for every endpoint. */

function sendSuccess(res, { statusCode = 200, message = 'Operation successful', data = {} } = {}) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendError(res, { statusCode = 500, message = 'Something went wrong', error, errors } = {}) {
  const body = { success: false, message };
  if (error) body.error = error;
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
