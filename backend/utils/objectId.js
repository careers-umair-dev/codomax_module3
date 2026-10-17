/**
 * Strict ObjectId check (24 hex chars). mongoose.isValidObjectId() also accepts
 * any 12-character string, which would let arbitrary ids through to queries.
 */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

module.exports = { isObjectId: (value) => typeof value === 'string' && OBJECT_ID_RE.test(value) };
