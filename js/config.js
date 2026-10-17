/* ==========================================================================
   config.js
   The ONE place the frontend learns where the backend lives.
   Change API_BASE_URL when you deploy the API (e.g. https://quill-api.onrender.com/api).
   ========================================================================== */

// Paste your deployed backend URL here (Vercel backend project), ending in /api
const PRODUCTION_API_URL = 'https://YOUR-BACKEND-PROJECT.vercel.app/api';

const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

window.QUILL_CONFIG = Object.freeze({
  API_BASE_URL: IS_LOCAL ? 'http://localhost:5000/api' : PRODUCTION_API_URL,
  REQUEST_TIMEOUT_MS: 20000,
});
