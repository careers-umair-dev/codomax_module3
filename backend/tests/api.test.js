/**
 * End-to-end API tests: boots the real Express app on a random port against a
 * throw-away MongoDB database and talks to it with fetch().
 *
 * Database used (first match):
 *   1. MONGODB_URI_TEST  — any MongoDB you own (local mongod, a scratch Atlas cluster…).
 *                          A uniquely named database is created and dropped afterwards.
 *   2. otherwise         — an in-memory MongoDB via mongodb-memory-server
 *                          (downloads a mongod binary on first run).
 * Run with:  npm test
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let memoryServer;
let testUri;

async function resolveTestUri() {
  if (process.env.MONGODB_URI_TEST) {
    const url = new URL(process.env.MONGODB_URI_TEST);
    url.pathname = `/quill_test_${crypto.randomBytes(4).toString('hex')}`; // never touch a real database
    return url.toString();
  }
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri('quill_test');
}

// Must be set before the app (and its config) is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

let server;
let base;
let mongoose;
let connectDatabase;
let disconnectDatabase;
let User;
let Post;

before(async () => {
  testUri = await resolveTestUri();
  process.env.MONGODB_URI = testUri;

  const createApp = require('../app');
  ({ connectDatabase, disconnectDatabase } = require('../config/database'));
  mongoose = require('mongoose');
  User = require('../models/User');
  Post = require('../models/Post');

  await connectDatabase(testUri);
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase(); // remove everything the tests created
  await disconnectDatabase();
  if (memoryServer) await memoryServer.stop();
});

async function call(method, url, { body, token } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const userA = { name: 'Alice Author', email: 'alice@example.com', password: 'password123' };
const userB = { name: 'Bob Other', email: 'bob@example.com', password: 'password456' };
const validPost = {
  title: 'My First Blog',
  category: 'Development',
  content: 'This is my blog content, long enough to pass validation.',
};

let tokenA;
let tokenB;
let postId;

test('1. health check', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, message: 'API is running', data: {} });
});

test('2. registration works and never returns the password', async () => {
  const res = await call('POST', '/auth/register', { body: userA });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, userA.email);
  assert.ok(res.body.data.user.id);
  assert.equal(JSON.stringify(res.body).includes('password'), false);
  await call('POST', '/auth/register', { body: userB });
});

test('2b. user is really saved in MongoDB, with a bcrypt hash and no plain-text password', async () => {
  const raw = await mongoose.connection.collection('users').findOne({ email: userA.email });
  assert.ok(raw, 'user document exists in the users collection');
  assert.equal(raw.name, userA.name);
  assert.match(raw.passwordHash, /^\$2[aby]\$/);
  assert.equal(JSON.stringify(raw).includes(userA.password), false);
  assert.ok(raw.createdAt instanceof Date && raw.updatedAt instanceof Date);
});

test('3. duplicate registration is rejected (409), case-insensitively', async () => {
  const res = await call('POST', '/auth/register', { body: { ...userA, email: 'ALICE@example.com' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

test('3b. simultaneous registrations with one email: exactly one wins (unique index)', async () => {
  const body = { name: 'Race Runner', email: 'race@example.com', password: 'password789' };
  const results = await Promise.all([1, 2, 3, 4].map(() => call('POST', '/auth/register', { body })));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409]);
  assert.equal(await User.countDocuments({ email: 'race@example.com' }), 1);
});

test('16a. invalid registration input returns validation errors', async () => {
  const res = await call('POST', '/auth/register', { body: { name: '', email: 'nope', password: 'short' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Validation failed');
  const fields = res.body.errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['email', 'name', 'password']);
});

test('4+6. login works and returns a JWT', async () => {
  const a = await call('POST', '/auth/login', { body: { email: userA.email, password: userA.password } });
  assert.equal(a.status, 200);
  assert.equal(a.body.data.token.split('.').length, 3);
  assert.equal(a.body.data.user.name, userA.name);
  assert.equal(JSON.stringify(a.body).includes('passwordHash'), false);
  tokenA = a.body.data.token;

  const b = await call('POST', '/auth/login', { body: { email: userB.email, password: userB.password } });
  tokenB = b.body.data.token;
});

test('4b. login is case-insensitive on email (normalised to lowercase)', async () => {
  const res = await call('POST', '/auth/login', { body: { email: 'ALICE@Example.com', password: userA.password } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, userA.email);
});

test('4c. GET /auth/me returns the safe user loaded from MongoDB', async () => {
  const res = await call('GET', '/auth/me', { token: tokenA });
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.data.user).sort(), ['email', 'id', 'name']);
  assert.equal(res.body.data.user.email, userA.email);
});

test('4d. expired, forged and orphaned tokens are rejected with 401', async () => {
  const userId = (await call('GET', '/auth/me', { token: tokenA })).body.data.user.id;

  const expired = jwt.sign({ sub: userId }, 'test-secret', { expiresIn: -10 });
  const resExpired = await call('GET', '/auth/me', { token: expired });
  assert.equal(resExpired.status, 401);
  assert.match(resExpired.body.message, /expired/i);

  const forged = jwt.sign({ sub: userId }, 'some-other-secret');
  assert.equal((await call('GET', '/auth/me', { token: forged })).status, 401);

  // Valid signature, but the user no longer exists in the database.
  const orphan = jwt.sign({ sub: new mongoose.Types.ObjectId().toString() }, 'test-secret');
  assert.equal((await call('GET', '/auth/me', { token: orphan })).status, 401);
  // Valid signature, but "sub" is not even an ObjectId.
  const junk = jwt.sign({ sub: 'not-an-object-id' }, 'test-secret');
  assert.equal((await call('GET', '/auth/me', { token: junk })).status, 401);
});

test('5. invalid login is rejected with 401 (wrong password and unknown email)', async () => {
  const wrong = await call('POST', '/auth/login', { body: { email: userA.email, password: 'wrongpass1' } });
  assert.equal(wrong.status, 401);
  const unknown = await call('POST', '/auth/login', { body: { email: 'ghost@example.com', password: 'whatever1' } });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.message, unknown.body.message);
});

test('16b. login with missing fields returns validation errors', async () => {
  const res = await call('POST', '/auth/login', { body: {} });
  assert.equal(res.status, 400);
  assert.equal(res.body.errors.length, 2);
});

test('7. protected routes reject missing / invalid tokens (401)', async () => {
  assert.equal((await call('POST', '/posts', { body: validPost })).status, 401);
  assert.equal((await call('POST', '/posts', { body: validPost, token: 'garbage' })).status, 401);
  assert.equal((await call('PUT', '/posts/x', { body: validPost })).status, 401);
  assert.equal((await call('DELETE', '/posts/x')).status, 401);
  assert.equal((await call('GET', '/posts?mine=true')).status, 401);
  assert.equal((await call('GET', '/auth/me')).status, 401);
});

test('8. authenticated user can create a post; author comes from the JWT, not the body', async () => {
  const res = await call('POST', '/posts', {
    token: tokenA,
    body: { ...validPost, authorId: 'hacker', authorName: 'Mallory' },
  });
  assert.equal(res.status, 201);
  const { post } = res.body.data;
  assert.equal(post.authorName, userA.name);
  assert.notEqual(post.authorId, 'hacker');
  assert.ok(post.id && post.createdAt && post.updatedAt && post.excerpt);
  postId = post.id;

  // It really is in MongoDB, and authorId is the user's ObjectId taken from the JWT.
  const raw = await mongoose.connection.collection('posts').findOne({ _id: new mongoose.Types.ObjectId(postId) });
  assert.ok(raw);
  assert.ok(raw.authorId instanceof mongoose.Types.ObjectId);
  const author = await User.findOne({ email: userA.email }).lean();
  assert.equal(raw.authorId.toString(), author._id.toString());
});

test('16c. invalid post input returns validation errors', async () => {
  const res = await call('POST', '/posts', {
    token: tokenA,
    body: { title: '', category: 'Nonsense', content: 'too short' },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.errors.map((e) => e.field).sort(), ['category', 'content', 'title']);

  const badImage = await call('POST', '/posts', { token: tokenA, body: { ...validPost, image: 'javascript:alert(1)' } });
  assert.equal(badImage.status, 400);
  assert.equal(badImage.body.errors[0].field, 'image');
});

test('image: small data URL accepted, oversized rejected', async () => {
  const tiny = 'data:image/png;base64,iVBORw0KGgo=';
  const ok = await call('POST', '/posts', { token: tokenA, body: { ...validPost, title: 'With image', image: tiny } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.post.image, tiny);
  await call('DELETE', `/posts/${ok.body.data.post.id}`, { token: tokenA });

  const huge = `data:image/png;base64,${'A'.repeat(2900000)}`;
  const tooBig = await call('POST', '/posts', { token: tokenA, body: { ...validPost, image: huge } });
  assert.equal(tooBig.status, 400);
});

let secondId;

test('9. posts can be listed newest-first, with search, category and mine filters', async () => {
  await new Promise((r) => setTimeout(r, 15));
  const second = await call('POST', '/posts', {
    token: tokenA,
    body: { ...validPost, title: 'A practical guide to REST API design', category: 'Design' },
  });
  secondId = second.body.data.post.id;

  const all = await call('GET', '/posts');
  assert.equal(all.status, 200);
  assert.equal(all.body.data.count, 2);
  assert.equal(all.body.data.posts[0].id, secondId);

  const dates = all.body.data.posts.map((p) => +new Date(p.createdAt));
  assert.deepEqual(dates, [...dates].sort((x, y) => y - x));

  const search = await call('GET', '/posts?search=rest%20api');
  assert.deepEqual(search.body.data.posts.map((p) => p.id), [secondId]);
  assert.ok(search.body.data.posts.every((p) => /rest api/i.test(`${p.title} ${p.excerpt} ${p.authorName}`)));
  // Searching by author name works too, case-insensitively.
  assert.equal((await call('GET', '/posts?search=ALICE')).body.data.count, 2);

  const cat = await call('GET', '/posts?category=Design');
  assert.ok(cat.body.data.posts.every((p) => p.category === 'Design'));
  assert.equal(cat.body.data.count, 1);

  const mine = await call('GET', '/posts?mine=true', { token: tokenA });
  assert.deepEqual(mine.body.data.posts.map((p) => p.id), [secondId, postId]);
  const mineB = await call('GET', '/posts?mine=true', { token: tokenB });
  assert.equal(mineB.body.data.count, 0);
});

test('9b. search text is treated literally, never as a regular expression', async () => {
  const res = await call('GET', '/posts?search=' + encodeURIComponent('(.*)+$['));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.count, 0);
  // As a regex "T.i" would match "This"; as literal text it matches nothing.
  const wildcard = await call('GET', '/posts?search=' + encodeURIComponent('T.i'));
  assert.equal(wildcard.body.data.count, 0);
});

test('10. a single post can be retrieved', async () => {
  const res = await call('GET', `/posts/${postId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.post.title, validPost.title);
});

test('15. unknown post id returns a clean 404', async () => {
  const res = await call('GET', '/posts/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'NOT_FOUND');
  assert.equal((await call('GET', '/nope')).status, 404);
});

test('15b. invalid or unknown ObjectIds give clean 404s (no CastError, no 500)', async () => {
  const validButMissing = new mongoose.Types.ObjectId().toString();
  for (const id of ['123', 'does-not-exist', 'twelve chars', '%7B%24ne%3Anull%7D', validButMissing]) {
    const get = await call('GET', `/posts/${id}`);
    assert.equal(get.status, 404, `GET ${id}`);
    assert.equal(get.body.message, 'Post not found.');
    assert.equal((await call('PUT', `/posts/${id}`, { token: tokenA, body: validPost })).status, 404, `PUT ${id}`);
    assert.equal((await call('DELETE', `/posts/${id}`, { token: tokenA })).status, 404, `DELETE ${id}`);
  }
});

test('13. another user cannot edit someone else\'s post (403) and nothing changes', async () => {
  const res = await call('PUT', `/posts/${postId}`, { token: tokenB, body: { ...validPost, title: 'Hijacked' } });
  assert.equal(res.status, 403);
  assert.equal((await call('GET', `/posts/${postId}`)).body.data.post.title, validPost.title);
});

test('14. another user cannot delete someone else\'s post (403) and it still exists', async () => {
  const res = await call('DELETE', `/posts/${postId}`, { token: tokenB });
  assert.equal(res.status, 403);
  assert.equal((await call('GET', `/posts/${postId}`)).status, 200);
});

test('11. owner can edit their post; updatedAt moves, createdAt does not', async () => {
  const before = (await call('GET', `/posts/${postId}`)).body.data.post;
  await new Promise((r) => setTimeout(r, 15));
  const res = await call('PUT', `/posts/${postId}`, {
    token: tokenA,
    body: { ...validPost, title: 'Edited title', category: 'Design' },
  });
  assert.equal(res.status, 200);
  const { post } = res.body.data;
  assert.equal(post.title, 'Edited title');
  assert.equal(post.category, 'Design');
  assert.equal(post.createdAt, before.createdAt);
  assert.ok(new Date(post.updatedAt) > new Date(before.updatedAt));
  assert.equal(post.authorId, before.authorId);

  // The MongoDB document itself was modified.
  const raw = await Post.findById(postId).lean();
  assert.equal(raw.title, 'Edited title');
  assert.ok(raw.updatedAt > raw.createdAt);
});

test('11c. restarting the database connection does not lose data', async () => {
  await disconnectDatabase();
  await connectDatabase(testUri);
  const res = await call('GET', `/posts/${postId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.post.title, 'Edited title');
  assert.equal((await call('POST', '/auth/login', { body: { email: userA.email, password: userA.password } })).status, 200);
});

test('11b. editing a missing post returns 404', async () => {
  const res = await call('PUT', '/posts/does-not-exist', { token: tokenA, body: validPost });
  assert.equal(res.status, 404);
});

test('12. owner can delete their post, and it is gone', async () => {
  const res = await call('DELETE', `/posts/${postId}`, { token: tokenA });
  assert.equal(res.status, 200);
  assert.equal((await call('GET', `/posts/${postId}`)).status, 404);
  assert.equal((await call('DELETE', `/posts/${postId}`, { token: tokenA })).status, 404);
  assert.equal(await Post.countDocuments({ _id: postId }), 0); // physically gone from MongoDB
});

test('12b. indexes exist: unique user email, plus the post query indexes', async () => {
  const userIdx = await User.collection.indexes();
  assert.ok(userIdx.some((i) => i.key.email === 1 && i.unique));
  const postIdx = (await Post.collection.indexes()).map((i) => Object.keys(i.key).join(','));
  for (const key of ['createdAt', 'category,createdAt', 'authorId,createdAt']) {
    assert.ok(postIdx.includes(key), `missing index ${key}`);
  }
});

test('malformed JSON body returns 400, not a stack trace', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ bad json',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(JSON.stringify(body).includes('SyntaxError'), false);
});
