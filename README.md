# Quill — Full-Stack Blog (Frontend + Node/Express API)

Plain HTML/CSS/JS frontend talking to a Node.js + Express REST API (JWT auth) backed by **MongoDB Atlas + Mongoose**.
The browser never stores users, passwords or posts: MongoDB is the source of truth.
Only the JWT and the signed-in user's `{ id, name, email }` are kept in `localStorage`.

## Run it

**1. Backend** (terminal 1)
```bash
cd backend
npm install
cp .env.example .env      # set MONGODB_URI (Atlas) and JWT_SECRET
npm run dev               # http://localhost:5000/api/health
```

**2. Frontend** (terminal 2, from the project root)
```bash
python3 -m http.server 3000      # or: npx serve -l 3000 .
```
Open http://localhost:3000, click **Sign up**, then write a post.

The frontend finds the API through `js/config.js` (`API_BASE_URL`). The backend allows the origin in `FRONTEND_URL` (default `http://localhost:3000`). Open the site via `http://localhost:3000`, not by double-clicking the HTML files (a `file://` page has no allowed origin).

## Project layout

```
index.html  login.html  register.html  dashboard.html  create-blog.html  post.html
css/        unchanged design (plus a small loading-spinner block in style.css)
js/
  config.js      API base URL (single place)
  utils.js       formatting, escaping, toasts, form-error + loading-button helpers
  api.js         apiRequest() + Api.* endpoints + auth session (token handling)
  nav.js         navbar / auth-aware menu
  auth.js        login + register forms
  home.js        feed, search, category filters (server-side)
  dashboard.js   my posts, stats, delete
  create-blog.js create / edit post, image preview + downscale
  post.js        single post
backend/         Express API — see backend/README.md
```

See `backend/README.md` for the MongoDB Atlas setup, API reference, data model, migration and testing notes.
