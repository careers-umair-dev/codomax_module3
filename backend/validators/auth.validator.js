const { body } = require('express-validator');
const config = require('../config/config');

const { nameMax, passwordMin, passwordMax } = config.limits;

const registerRules = [
  body('name')
    .isString().withMessage('Full name is required.').bail()
    .trim()
    .notEmpty().withMessage('Full name is required.').bail()
    .isLength({ max: nameMax }).withMessage(`Name must be at most ${nameMax} characters.`),

  body('email')
    .isString().withMessage('Email is required.').bail()
    .trim()
    .notEmpty().withMessage('Email is required.').bail()
    .isEmail().withMessage('Please provide a valid email address.').bail()
    .isLength({ max: 254 }).withMessage('Email address is too long.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body('password')
    .isString().withMessage('Password is required.').bail()
    .notEmpty().withMessage('Password is required.').bail()
    .isLength({ min: passwordMin }).withMessage(`Use at least ${passwordMin} characters.`).bail()
    .isLength({ max: passwordMax }).withMessage(`Password must be at most ${passwordMax} characters.`).bail()
    .matches(/[A-Za-z]/).withMessage('Password must include at least one letter.').bail()
    .matches(/\d/).withMessage('Password must include at least one number.'),
];

const loginRules = [
  body('email')
    .isString().withMessage('Email is required.').bail()
    .trim()
    .notEmpty().withMessage('Email is required.').bail()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body('password')
    .isString().withMessage('Password is required.').bail()
    .notEmpty().withMessage('Password is required.'),
];

module.exports = { registerRules, loginRules };
