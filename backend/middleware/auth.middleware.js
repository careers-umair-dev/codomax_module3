const { verifyToken } = require('../utils/token');
const authService = require('../services/auth.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme && scheme.toLowerCase() === 'bearer' && token ? token : null;
}

/** Verifies the JWT and loads the user. Throws ApiError(401) on any problem. */
async function resolveUser(req) {
  const token = readBearerToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required. Please log in.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Your session has expired. Please log in again.'
      : 'Invalid authentication token.';
    throw ApiError.unauthorized(message);
  }

  const user = await authService.getCurrentUser(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists. Please log in again.');
  return user;
}

/** Protects a route. Attaches { id, name, email } to req.user. */
const authenticate = asyncHandler(async (req, res, next) => {
  req.user = await resolveUser(req);
  next();
});

/** For public routes that behave differently when a valid token is present. */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  if (readBearerToken(req)) {
    try {
      req.user = await resolveUser(req);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // Bad token on a public route: carry on as an anonymous visitor.
    }
  }
  next();
});

module.exports = { authenticate, optionalAuthenticate };
