const postService = require('../services/post.service');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { search, category, mine } = req.query;

  // "mine" is resolved from the JWT — the client never says whose posts it wants.
  if (mine === 'true' && !req.user) {
    throw ApiError.unauthorized('Log in to view your posts.');
  }

  const posts = await postService.listPosts({
    search,
    category,
    authorId: mine === 'true' ? req.user.id : undefined,
  });

  sendSuccess(res, { message: 'Posts retrieved', data: { count: posts.length, posts } });
});

const getOne = asyncHandler(async (req, res) => {
  const post = await postService.getPost(req.params.id);
  sendSuccess(res, { message: 'Post retrieved', data: { post } });
});

const create = asyncHandler(async (req, res) => {
  // Only whitelisted fields are read; any authorId/authorName in the body is ignored.
  const { title, category, content, image } = req.body;
  const post = await postService.createPost({ title, category, content, image }, req.user);
  sendSuccess(res, { statusCode: 201, message: 'Post created successfully', data: { post } });
});

const update = asyncHandler(async (req, res) => {
  const { title, category, content, image } = req.body;
  const post = await postService.updatePost(req.params.id, { title, category, content, image }, req.user);
  sendSuccess(res, { message: 'Post updated successfully', data: { post } });
});

const remove = asyncHandler(async (req, res) => {
  await postService.deletePost(req.params.id, req.user);
  sendSuccess(res, { message: 'Post deleted successfully' });
});

module.exports = { list, getOne, create, update, remove };
