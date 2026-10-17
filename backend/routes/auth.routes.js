const express = require('express');
const controller = require('../controllers/auth.controller');
const { registerRules, loginRules } = require('../validators/auth.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/register', authLimiter, registerRules, validate, controller.register);
router.post('/login', authLimiter, loginRules, validate, controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
