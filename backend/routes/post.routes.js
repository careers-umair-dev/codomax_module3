const express = require('express');
const controller = require('../controllers/post.controller');
const { createPostRules, updatePostRules, listPostsRules } = require('../validators/post.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', optionalAuthenticate, listPostsRules, validate, controller.list);
router.get('/:id', controller.getOne);
router.post('/', authenticate, createPostRules, validate, controller.create);
router.put('/:id', authenticate, updatePostRules, validate, controller.update);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
