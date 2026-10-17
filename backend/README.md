# Quill API (Module 3 — MongoDB)

Node.js + Express REST API for the Quill blog. Data lives in **MongoDB Atlas**, accessed through **Mongoose** models behind the repository layer. The JSON files in `data/` are no longer used by the API (they are only the source for the one-off `npm run migrate`).

## MongoDB Atlas setup (once)

1. Create a free account/cluster at https://cloud.mongodb.com (M0 Free tier is enough).
2. **Database Access → Add New Database User** → username + password, role *Read and write to any database* (or restrict to the `quill` database). Use a password without special characters, or URL-encode it.
3. **Network Access → Add IP Address** → *Add Current IP Address* (for deployment, add your host's IP, or `0.0.0.0/0` only if you accept the risk).
4. **Database → Connect → Drivers** → copy the `mongodb+srv://…` string and **insert the database name** before the `?` (e.g. `…mongodb.net/quill?retryWrites=true&w=majority`).
5. Put it in `backend/.env` as `MONGODB_URI=…`. Never commit `.env` (it is git-ignored).

Collections (`users`, `posts`) and their indexes are created automatically on first start.

## Setup

```bash
cd backend
npm install
cp .env.example .env     # then set MONGODB_URI and JWT_SECRET
npm run dev              # nodemon, auto-reload   (or: npm start)
npm run migrate -- --dry-run   # optional: preview importing the old JSON data
npm run migrate                # optional: import it (safe to re-run)
npm test                 # automated API tests against a throw-away MongoDB
```

The server connects to MongoDB **before** it starts listening; if the connection fails it prints a credential-free reason and exits with code 1.

API base URL: `http://localhost:5000/api` — check it with `GET /api/health`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Port to listen on (`process.env.PORT` is honoured by Render/Railway) |
| `MONGODB_URI` | *(required)* | MongoDB Atlas connection string, including the database name |
| `NODE_ENV` | `development` | `production` requires `JWT_SECRET` and enables proxy trust |
| `JWT_SECRET` | dev-only fallback | Secret used to sign tokens. **Set a long random value.** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `FRONTEND_URL` | `http://localhost:3000` | Comma-separated list of origins allowed by CORS |
| `AUTH_RATE_LIMIT_MAX` | `50` | Login/register attempts per 15 min per IP |
| `MONGODB_TIMEOUT_MS` | `10000` | How long to wait for MongoDB before failing |
| `DATA_DIR` | `./data` | Legacy JSON files, read only by `npm run migrate` |
| `MONGODB_URI_TEST` | *(unset)* | Optional throw-away MongoDB for `npm test` (see Testing) |

## Architecture

```
Route -> Validator -> Controller -> Service -> Repository -> Mongoose model -> MongoDB Atlas
```

```
backend/
├── server.js / app.js        listen / build the Express app
├── config/config.js          env + limits + allowed categories
├── config/database.js        Mongoose connection (connect / index sync / disconnect)
├── models/                   User.js, Post.js — Mongoose schemas, validation, indexes
├── routes/                   URL -> middleware -> controller wiring
├── validators/               express-validator rules
├── controllers/              thin HTTP layer (no business rules)
├── services/                 business rules: hashing, JWT, ownership, image policy
├── repositories/             ONLY place that queries the database (returns plain objects)
├── middleware/               auth (JWT), validation, rate limit, errors
├── utils/                    ApiError, response helpers, token, ObjectId check
├── scripts/                  migrate-json-to-mongo.js (one-off, safe, idempotent)
├── data/                     legacy users.json / posts.json — migration source only
└── tests/api.test.js
```

## Authentication

1. `POST /api/auth/register` creates the account (password stored as a bcrypt hash).
2. `POST /api/auth/login` returns a JWT.
3. Send it on protected calls: `Authorization: Bearer <token>`.
4. The middleware verifies the token, loads the user and sets `req.user`. Missing/invalid/expired token → **401**. Valid token but not the owner → **403**. Unknown resource → **404**.

Author details of a post always come from `req.user`, never from the request body.

## Endpoints

| METHOD | ENDPOINT | AUTH | PURPOSE |
|---|---|---|---|
| GET | /api/health | No | Health check |
| POST | /api/auth/register | No | Register user |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/posts | No* | List posts (`?search=`, `?category=`, `?mine=true`) |
| GET | /api/posts/:id | No | Get single post |
| POST | /api/posts | Yes | Create post |
| PUT | /api/posts/:id | Yes | Update own post |
| DELETE | /api/posts/:id | Yes | Delete own post |

\* `?mine=true` requires a token; the user is taken from the JWT.

### Register
```http
POST /api/auth/register
{ "name": "John Doe", "email": "john@example.com", "password": "password123" }
```
`201`
```json
{ "success": true, "message": "User registered successfully",
  "data": { "user": { "id": "…", "name": "John Doe", "email": "john@example.com" } } }
```
Rules: name required (≤60), valid email, password 8–72 chars with at least one letter and one number. Duplicate email → `409`.

### Login
```http
POST /api/auth/login
{ "email": "john@example.com", "password": "password123" }
```
`200`
```json
{ "success": true, "message": "Login successful",
  "data": { "token": "<jwt>", "user": { "id": "…", "name": "John Doe", "email": "john@example.com" } } }
```
Wrong email or password → `401` `"Invalid email or password."` (same message for both).

### Create post
```http
POST /api/posts
Authorization: Bearer <token>
{ "title": "My First Blog", "category": "Development",
  "content": "At least 20 characters of content…", "image": "optional" }
```
`201`
```json
{ "success": true, "message": "Post created successfully",
  "data": { "post": { "id": "…", "title": "My First Blog", "category": "Development",
    "excerpt": "…", "content": "…", "image": "", "authorId": "…", "authorName": "John Doe",
    "createdAt": "2026-…", "updatedAt": "2026-…" } } }
```
Validation: title ≤150, category one of `Development, Design, Lifestyle, Business, News`, content 20–20000 chars. `image` is optional: an `http(s)` URL or a PNG/JPEG/GIF/WebP data URL up to 2 MB decoded. In `PUT`, omitting `image` keeps the current one and `""` removes it.

### List / get / update / delete
- `GET /api/posts` → `{ data: { count, posts: [...] } }`, newest first.
- `GET /api/posts/:id` → `{ data: { post } }`, `404` if missing.
- `PUT /api/posts/:id` → same body as create, owner only, bumps `updatedAt`.
- `DELETE /api/posts/:id` → `{ success: true, message: "Post deleted successfully" }`, owner only.

### Error format
```json
{ "success": false, "message": "Validation failed",
  "errors": [ { "field": "email", "message": "Please provide a valid email address." } ] }
```
```json
{ "success": false, "message": "Post not found.", "error": "NOT_FOUND" }
```
| Status | Meaning |
|---|---|
| 400 | Validation failed / malformed JSON |
| 401 | Missing, invalid or expired token; bad login |
| 403 | Authenticated but not the owner |
| 404 | Post or route not found |
| 409 | Email already registered (also when two requests race — enforced by the unique index) |
| 413 | Request body too large |
| 429 | Too many login/register attempts |
| 500 | Unexpected error (details logged server-side only) |
| 503 | MongoDB unreachable / timed out |

## Security

bcrypt hashing · JWT auth · ownership checks · server-side validation · CORS allow-list from `FRONTEND_URL` · helmet · rate-limited auth routes · no password in any response · secrets via env vars · no stack traces to clients.

## Data model

**users** — `_id`, `name`, `email` (unique, lower-cased), `passwordHash` (bcrypt, `select:false`, never serialised), `createdAt`, `updatedAt`.
Indexes: unique `email`.

**posts** — `_id`, `title`, `category` (enum), `content`, `excerpt`, `image`, `authorId` (ObjectId → `users`), `authorName`, `createdAt`, `updatedAt`.
Indexes: `{createdAt:-1}` (home feed), `{category:1,createdAt:-1}` (category filter), `{authorId:1,createdAt:-1}` (dashboard / `mine=true`).

Repositories map documents to the same plain objects the services always used (`id` as a string, ISO date strings), so **controllers, validators, routes and the frontend API contract did not change**. Services only stopped generating ids/timestamps — MongoDB does that now.

Notes:
- `authorId` / `authorName` come from the verified JWT, never from the request body.
- Search stays a case-insensitive *substring* match over title, excerpt and author name (same behaviour as before). The user's text is regex-escaped. A MongoDB `$text` index was deliberately **not** added because it matches whole words only and would change results.
- A malformed or unknown post id returns `404 Post not found.` (no 500, no CastError details).
- `services/image.service.js` is still the single place to swap base64 images for Cloudinary/S3. Images are stored inline in the post document (≤ 2 MB each, well under MongoDB's 16 MB document limit).

## Migrating the old JSON data

`npm run migrate -- --dry-run` shows what would be imported; `npm run migrate` imports it. It is **additive and idempotent**: it never updates or deletes anything, skips records that already exist (users by email; posts by title + author + createdAt), and never modifies the JSON files. Original timestamps are kept. Legacy UUID ids can't become ObjectIds, so MongoDB assigns new ids (old `post.html?id=<uuid>` links stop working). The 6 sample posts (`authorId: "seed"`) are attached to a **Quill Team** user (`quill-team@quill.local`) that has a random, unrecoverable password, so nobody can log in as it. Run it only against the database you intend — it uses `MONGODB_URI` from `.env`.

## Testing

`npm test` boots the real app against a **throw-away database** and drops it afterwards. It uses `MONGODB_URI_TEST` if set (the database name is always replaced with a unique `quill_test_…`, so your real data is never touched), otherwise an in-memory MongoDB from `mongodb-memory-server` (downloads a `mongod` binary on first run). Covered: register/duplicate/concurrent duplicate, login (incl. case-insensitive email), `/auth/me`, expired/forged/orphaned tokens, post CRUD, search/category/mine, ownership (403), invalid ObjectIds (404), data really present in/removed from MongoDB, data surviving a connection restart, and index existence.

## Known limitations

- Cover images are stored inline (base64) in each post document; use a file/object store for heavy traffic.
- Tokens are stateless: "logout" just discards the token client-side; there is no refresh-token or server-side revocation.
- No pagination; the feed returns every post.
