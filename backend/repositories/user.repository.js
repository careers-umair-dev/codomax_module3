const User = require('../models/User');
const { isObjectId } = require('../utils/objectId');

/**
 * Data-access layer for users (MongoDB via Mongoose).
 * Same contract as the Module 2 JSON version: plain objects in, plain objects
 * out ({ id, name, email, passwordHash, createdAt, updatedAt }), no Express or
 * business rules in here — so the service layer did not have to change shape.
 */

const normalizeEmail = (email) => String(email).trim().toLowerCase();

function toUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function findByEmail(email) {
  // passwordHash is `select: false` on the schema, so login must ask for it explicitly.
  const doc = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash').lean();
  return toUser(doc);
}

async function findById(id) {
  if (!isObjectId(id)) return null; // malformed id = no such user, not a 500
  const doc = await User.findById(id).select('+passwordHash').lean();
  return toUser(doc);
}

/** `user` must contain name, email, passwordHash. A duplicate email rejects with E11000. */
async function create({ name, email, passwordHash }) {
  const doc = await User.create({ name, email: normalizeEmail(email), passwordHash });
  return toUser(doc.toObject());
}

module.exports = { findByEmail, findById, create };
