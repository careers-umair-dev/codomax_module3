const jwt = require('jsonwebtoken');
const config = require('../config/config');

/** Only the user id is signed; name/email are re-read from storage when needed. */
function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/** Returns the decoded payload or throws (JsonWebTokenError / TokenExpiredError). */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signToken, verifyToken };
