const mongoose = require('mongoose');
const config = require('../config/config');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      maxlength: [config.limits.nameMax, `Name must be at most ${config.limits.nameMax} characters.`],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email address is too long.'],
      unique: true, // builds the unique index; duplicates surface as E11000
    },
    // bcrypt hash only. `select: false` keeps it out of queries unless explicitly requested.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
    toJSON: {
      // Belt and braces: even if a document is serialised directly, no hash leaks.
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
