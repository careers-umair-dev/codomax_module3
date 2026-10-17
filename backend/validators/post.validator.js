const { body, query } = require('express-validator');
const config = require('../config/config');
const { normalizeImage } = require('../services/image.service');

const { titleMax, contentMin, contentMax } = config.limits;

const postFields = [
  body('title')
    .isString().withMessage('Give your post a title.').bail()
    .trim()
    .notEmpty().withMessage('Give your post a title.').bail()
    .isLength({ max: titleMax }).withMessage(`Title must be at most ${titleMax} characters.`),

  body('category')
    .isString().withMessage('Choose a category.').bail()
    .trim()
    .notEmpty().withMessage('Choose a category.').bail()
    .isIn(config.categories).withMessage(`Category must be one of: ${config.categories.join(', ')}.`),

  body('content')
    .isString().withMessage('Content is required.').bail()
    .trim()
    .notEmpty().withMessage('Content is required.').bail()
    .isLength({ min: contentMin }).withMessage(`Write at least ${contentMin} characters.`).bail()
    .isLength({ max: contentMax }).withMessage(`Content must be at most ${contentMax} characters.`),

  body('image')
    .optional({ values: 'null' })
    .custom((value) => {
      normalizeImage(value); // throws a descriptive ApiError message when invalid
      return true;
    }),
];

// Create and update share the same rules (PUT is a full replacement of the editable fields).
const createPostRules = postFields;
const updatePostRules = postFields;

const listPostsRules = [
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search term is too long.'),
  query('category').optional().isString().trim().isLength({ max: 50 }).withMessage('Invalid category.'),
  query('mine').optional().isIn(['true', 'false']).withMessage('mine must be "true" or "false".'),
];

module.exports = { createPostRules, updatePostRules, listPostsRules };
