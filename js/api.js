/* ==========================================================================
   api.js
   Centralised API client + auth session.

   - apiRequest(): the only function that calls fetch(). It builds the URL
     from QUILL_CONFIG.API_BASE_URL, adds "Authorization: Bearer <token>"
     when asked, and turns every failure into an ApiError with a message
     that is safe to show the user.
   - Session: only the JWT and the safe user object ({ id, name, email })
     are kept in localStorage. No passwords, no posts, no user list.
   ========================================================================== */

const AUTH_STORAGE = { token: 'quill_token', user: 'quill_user' };
const NETWORK_ERROR_MESSAGE = 'Unable to connect to server. Please try again.';

/* ---------- session ---------- */

function getToken() {
  try { return localStorage.getItem(AUTH_STORAGE.token); } catch (_) { return null; }
}

/** { userId, name, email } for the signed-in user, or null. */
function getSession() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_STORAGE.user));
    if (!user || !getToken()) return null;
    return { userId: user.id, name: user.name, email: user.email };
  } catch (_) {
    return null;
  }
}

function setSession(token, user) {
  const safeUser = { id: user.id, name: user.name, email: user.email };
  localStorage.setItem(AUTH_STORAGE.token, token);
  localStorage.setItem(AUTH_STORAGE.user, JSON.stringify(safeUser));
}

function clearSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE.token);
    localStorage.removeItem(AUTH_STORAGE.user);
  } catch (_) { /* storage unavailable — nothing to clear */ }
}

function requireAuth() {
  const session = getSession();
  if (!session) window.location.href = 'login.html';
  return session;
}

/* ---------- request helper ---------- */

class ApiError extends Error {
  constructor(message, { status = 0, errors = [], isNetworkError = false, sessionExpired = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.isNetworkError = isNetworkError;
    this.sessionExpired = sessionExpired;
  }
}

function buildUrl(path, query) {
  const url = new URL(window.QUILL_CONFIG.API_BASE_URL.replace(/\/+$/, '') + path);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
}

async function apiRequest(path, { method = 'GET', body, query, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), window.QUILL_CONFIG.REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (_) {
    throw new ApiError(NETWORK_ERROR_MESSAGE, { isNetworkError: true });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try { payload = await res.json(); } catch (_) { /* non-JSON body, e.g. a proxy error page */ }

  if (res.ok && payload && payload.success) return payload.data;

  // A rejected token on a protected call means the session is over.
  if (res.status === 401 && auth) {
    clearSession();
    window.location.href = 'login.html?expired=1';
    throw new ApiError('Your session has expired. Please log in again.', { status: 401, sessionExpired: true });
  }

  const message = (payload && payload.message) ||
    (res.status >= 500 ? 'The server ran into a problem. Please try again later.' : 'Request failed. Please try again.');
  throw new ApiError(message, { status: res.status, errors: (payload && payload.errors) || [] });
}

/* ---------- endpoints ---------- */

const Api = {
  register: ({ name, email, password }) =>
    apiRequest('/auth/register', { method: 'POST', body: { name, email, password } }),

  login: ({ email, password }) =>
    apiRequest('/auth/login', { method: 'POST', body: { email, password } }),

  // Public feed. `search` / `category` are filtered by the backend.
  listPosts: ({ search, category } = {}) =>
    apiRequest('/posts', { query: { search, category } }).then((d) => d.posts),

  // The signed-in user's posts — the backend reads the user from the JWT.
  listMyPosts: () =>
    apiRequest('/posts', { query: { mine: 'true' }, auth: true }).then((d) => d.posts),

  getPost: (id) =>
    apiRequest(`/posts/${encodeURIComponent(id)}`).then((d) => d.post),

  createPost: ({ title, category, content, image }) =>
    apiRequest('/posts', { method: 'POST', auth: true, body: { title, category, content, image } }).then((d) => d.post),

  updatePost: (id, { title, category, content, image }) =>
    apiRequest(`/posts/${encodeURIComponent(id)}`, { method: 'PUT', auth: true, body: { title, category, content, image } }).then((d) => d.post),

  deletePost: (id) =>
    apiRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
};
