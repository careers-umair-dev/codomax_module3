const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await authService.register({ name, email, password });
  sendSuccess(res, { statusCode: 201, message: 'User registered successfully', data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.login({ email, password });
  sendSuccess(res, { message: 'Login successful', data: { token, user } });
});

/** Lets the frontend confirm that a stored token is still valid. */
const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Current user', data: { user: req.user } });
});

module.exports = { register, login, me };
