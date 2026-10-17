/* ==========================================================================
   utils.js
   Small, dependency-free helpers shared by every page: formatting, HTML
   escaping, form-error display, toasts and button loading states.
   (No data lives here any more — the backend API is the source of truth.)
   ========================================================================== */

const DEFAULT_THUMB = 'assets/placeholder-thumb.svg';

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function excerptOf(content, length = 140) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > length ? clean.slice(0, length).trim() + '…' : clean;
}

/** Escapes text for safe use in HTML content AND attribute values. */
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/* ---------- form helpers ---------- */

function setFieldError(fieldEl, message) {
  fieldEl.classList.toggle('has-error', Boolean(message));
  const msg = fieldEl.querySelector('.error-msg');
  if (msg) msg.textContent = message || '';
}

/**
 * Shows server-side validation errors next to their fields.
 * `fieldEls` maps API field names to .field elements, e.g. { email: el }.
 * Returns the errors that had no matching field so the caller can toast them.
 */
function applyServerErrors(errors, fieldEls) {
  const unmatched = [];
  (errors || []).forEach((e) => {
    if (fieldEls[e.field]) setFieldError(fieldEls[e.field], e.message);
    else unmatched.push(e);
  });
  return unmatched;
}

/** Disables a button and swaps its label while a request is in flight. */
function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (isLoading) {
    button.dataset.label = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/* ---------- loading / error placeholders ---------- */

function loadingStateHTML(message) {
  return `<div class="loading-state" role="status"><span class="spinner" aria-hidden="true"></span><span>${escapeHTML(message)}</span></div>`;
}

function errorStateHTML(title, message, { retry = false } = {}) {
  return `
    <div class="empty-state">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(message)}</p>
      ${retry ? '<button type="button" class="btn btn-primary btn-sm" data-retry style="margin-top:12px;">Try again</button>' : ''}
    </div>
  `;
}

/* ---------- shared toast ---------- */

let toastTimer = null;

function showToast(message, type = 'success') {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast is-visible toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

/** Toasts an API error — unless the API layer is already redirecting to login. */
function reportError(err) {
  if (err && err.sessionExpired) return;
  showToast((err && err.message) || 'Something went wrong. Please try again.', 'error');
}
