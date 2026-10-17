const Post = require('../models/Post');
const { isObjectId } = require('../utils/objectId');

/**
 * Data-access layer for posts (MongoDB via Mongoose).
 * Same contract rules as user.repository.js: plain objects in, plain objects
 * out, ids exposed as strings, dates as ISO strings. No Express or business
 * rules in here.
 */

function toPost(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    category: doc.category,
    content: doc.content,
    excerpt: doc.excerpt,
    image: doc.image,
    authorId: doc.authorId.toString(),
    authorName: doc.authorName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Filters: { search, category, authorId } — all optional. Newest first. */
async function findAll({ search, category, authorId } = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (authorId) {
    if (!isObjectId(String(authorId))) return [];
    filter.authorId = authorId;
  }
  if (search) {
    // Case-insensitive substring match over the same fields as before. The term is
    // escaped so user input can never act as a regex (no ReDoS / operator injection).
    const term = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: term }, { excerpt: term }, { authorName: term }];
  }

  const docs = await Post.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
  return docs.map(toPost);
}

async function findById(id) {
  if (!isObjectId(id)) return null; // malformed id = no such post
  return toPost(await Post.findById(id).lean());
}

/** `post` carries title, category, content, excerpt, image, authorId, authorName. */
async function create(post) {
  const doc = await Post.create(post);
  return toPost(doc.toObject());
}

/** Merges `changes` into the post. Returns the updated post, or null if missing. */
async function update(id, changes) {
  if (!isObjectId(id)) return null;
  const doc = await Post.findByIdAndUpdate(id, { $set: changes }, {
    new: true,
    runValidators: true, // schema rules also apply to updates
  }).lean();
  return toPost(doc);
}

/** Returns true if something was deleted. */
async function remove(id) {
  if (!isObjectId(id)) return false;
  const result = await Post.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

module.exports = { findAll, findById, create, update, remove };
