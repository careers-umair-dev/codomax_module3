/**
 * One-off, SAFE migration of the legacy Module 2 JSON files into MongoDB.
 *
 *   npm run migrate -- --dry-run     show what would happen, write nothing
 *   npm run migrate                  import
 *
 * Safety rules:
 *   - Additive only: never updates or deletes existing documents.
 *   - Idempotent: running it twice does not create duplicates
 *     (users match on email; posts on title + author + createdAt).
 *   - JSON files are only read, never modified.
 *   - Legacy UUID ids cannot be ObjectIds, so MongoDB assigns new ids
 *     (old post URLs like post.html?id=<uuid> stop working; names, content and
 *     original timestamps are preserved).
 *   - Posts with authorId "seed" (the sample posts) are attached to a
 *     "Quill Team" user that has no usable password, so nobody can log in as it.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const User = require('../models/User');
const Post = require('../models/Post');

const DRY_RUN = process.argv.includes('--dry-run');
const SEED_AUTHOR = { legacyId: 'seed', name: 'Quill Team', email: 'quill-team@quill.local' };

async function readJson(file) {
  try {
    const raw = await fs.readFile(path.join(config.dataDir, file), 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// timestamps:false → keep the ORIGINAL createdAt/updatedAt instead of "now".
const insert = (Model, data) => new Model(data).save({ timestamps: false });

async function main() {
  const legacyUsers = await readJson('users.json');
  const legacyPosts = await readJson('posts.json');
  console.log(`${DRY_RUN ? '[dry run] ' : ''}Found ${legacyUsers.length} user(s) and ${legacyPosts.length} post(s) in ${config.dataDir}`);
  if (!legacyUsers.length && !legacyPosts.length) return console.log('Nothing to migrate.');

  if (!DRY_RUN) await connectDatabase();

  const idMap = new Map(); // legacy id -> { _id, name }
  const stats = { usersCreated: 0, usersSkipped: 0, postsCreated: 0, postsSkipped: 0, postsOrphaned: 0 };

  const needsSeedAuthor = legacyPosts.some((p) => p.authorId === SEED_AUTHOR.legacyId);
  const usersToMap = [...legacyUsers];
  if (needsSeedAuthor) usersToMap.push({ id: SEED_AUTHOR.legacyId, name: SEED_AUTHOR.name, email: SEED_AUTHOR.email, isSeedAuthor: true });

  for (const u of usersToMap) {
    const email = String(u.email).trim().toLowerCase();
    const existing = DRY_RUN ? null : await User.findOne({ email }).lean();
    if (existing) {
      idMap.set(u.id, { _id: existing._id, name: existing.name });
      stats.usersSkipped += 1;
      continue;
    }
    stats.usersCreated += 1;
    if (DRY_RUN) { idMap.set(u.id, { _id: null, name: u.name }); continue; }

    // The seed author gets a random, never-revealed password → effectively unloginable.
    const passwordHash = u.isSeedAuthor
      ? await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
      : u.passwordHash;
    const created = await insert(User, {
      name: u.name, email, passwordHash,
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
      updatedAt: u.createdAt ? new Date(u.createdAt) : new Date(),
    });
    idMap.set(u.id, { _id: created._id, name: created.name });
  }

  for (const p of legacyPosts) {
    const author = idMap.get(p.authorId);
    if (!author) {
      console.warn(`Skipping post "${p.title}": its author (${p.authorId}) is not in users.json.`);
      stats.postsOrphaned += 1;
      continue;
    }
    const createdAt = new Date(p.createdAt);
    const exists = DRY_RUN ? null : await Post.exists({ title: p.title, authorId: author._id, createdAt });
    if (exists) { stats.postsSkipped += 1; continue; }
    stats.postsCreated += 1;
    if (DRY_RUN) continue;

    await insert(Post, {
      title: p.title, category: p.category, content: p.content,
      excerpt: p.excerpt, image: p.image || '',
      authorId: author._id, authorName: p.authorName || author.name,
      createdAt, updatedAt: new Date(p.updatedAt || p.createdAt),
    });
  }

  console.log(`${DRY_RUN ? '[dry run] would create' : 'Created'}: ${stats.usersCreated} user(s), ${stats.postsCreated} post(s).`);
  console.log(`Already present (skipped): ${stats.usersSkipped} user(s), ${stats.postsSkipped} post(s). Orphaned posts skipped: ${stats.postsOrphaned}.`);
}

main()
  .catch((err) => { console.error('Migration failed:', err.message); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
