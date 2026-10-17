const mongoose = require('mongoose');
const config = require('../config/config');

const { titleMax, contentMin, contentMax } = config.limits;

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Give your post a title.'],
      trim: true,
      maxlength: [titleMax, `Title must be at most ${titleMax} characters.`],
    },
    category: {
      type: String,
      required: [true, 'Choose a category.'],
      enum: { values: config.categories, message: `Category must be one of: ${config.categories.join(', ')}.` },
    },
    content: {
      type: String,
      required: [true, 'Content is required.'],
      trim: true,
      minlength: [contentMin, `Write at least ${contentMin} characters.`],
      maxlength: [contentMax, `Content must be at most ${contentMax} characters.`],
    },
    excerpt: { type: String, default: '', maxlength: 200 },
    // http(s) URL or a small base64 data URL; the policy lives in services/image.service.js.
    image: { type: String, default: '' },
    // Set from the verified JWT in the service layer — never from the request body.
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalised so the feed needs no join (same shape the frontend already consumes).
    authorName: { type: String, required: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

// Home feed: newest first, optionally narrowed by category.
postSchema.index({ createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
// Dashboard ("mine=true"): one author's posts, newest first.
postSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
