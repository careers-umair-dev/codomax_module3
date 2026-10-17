const express = require('express');
const authRoutes = require('./auth.routes');
const postRoutes = require('./post.routes');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

router.get('/health', (req, res) => sendSuccess(res, { message: 'API is running' }));
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);

module.exports = router;
