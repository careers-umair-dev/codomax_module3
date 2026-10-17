/* ==========================================================================
   nav.js
   Mobile menu toggle + swapping the navbar's right-hand side between
   "Log in / Register" and the signed-in user chip. Runs on every page.
   ========================================================================== */

function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('is-open');
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close the mobile menu after a link is chosen.
  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initAuthSlot() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;

  const session = getSession();

  if (!session) {
    slot.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Log in</a>
      <a href="register.html" class="btn btn-primary btn-sm">Sign up</a>
    `;
    return;
  }

  const initial = session.name.trim().charAt(0).toUpperCase() || '?';
  slot.innerHTML = `
    <a href="dashboard.html" class="user-chip" aria-label="Go to your dashboard">
      <span class="avatar">${escapeHTML(initial)}</span>
      <span>${escapeHTML(session.name)}</span>
    </a>
    <button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">Log out</button>
  `;

  // JWTs are stateless: logging out just means forgetting the token.
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

function markActiveNavLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current) link.classList.add('is-active');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initAuthSlot();
  markActiveNavLink();
});
