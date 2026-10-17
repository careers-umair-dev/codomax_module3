const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const { sendError } = require('../utils/response');

/** Slows brute-force attempts against login/register. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    sendError(res, {
      statusCode: 429,
      message: 'Too many attempts. Please try again in a few minutes.',
      error: 'TOO_MANY_REQUESTS',
    }),
});

module.exports = { authLimiter };
