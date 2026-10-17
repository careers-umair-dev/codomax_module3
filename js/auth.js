/* ==========================================================================
   auth.js
   Client-side validation (for instant feedback) + API calls for the login
   and register forms. The backend re-validates everything and has the final say.
   ========================================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function togglePasswordVisibility(button) {
  const wrapper = button.closest('.password-field');
  const input = wrapper.querySelector('input');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  button.textContent = isHidden ? 'Hide' : 'Show';
}

function showBanner(banner, message, type = 'error') {
  banner.textContent = message;
  banner.className = `banner banner-${type} is-visible`;
}

function hideBanner(banner) {
  banner.className = 'banner';
}

/* ---------- Login ---------- */

function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Already signed in? Skip straight to the dashboard.
  if (getSession()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const banner = document.getElementById('loginBanner');
  const submitBtn = form.querySelector('button[type="submit"]');
  let submitting = false;

  if (new URLSearchParams(window.location.search).get('expired')) {
    showBanner(banner, 'Your session has expired. Please log in again.');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    const emailField = document.getElementById('loginEmailField');
    const passField = document.getElementById('loginPasswordField');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    let valid = true;
    if (!email) {
      setFieldError(emailField, 'Email is required.');
      valid = false;
    } else if (!EMAIL_RE.test(email)) {
      setFieldError(emailField, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(emailField, '');
    }

    if (!password) {
      setFieldError(passField, 'Password is required.');
      valid = false;
    } else {
      setFieldError(passField, '');
    }

    if (!valid) return;

    hideBanner(banner);
    submitting = true;
    setButtonLoading(submitBtn, true, 'Logging in…');

    try {
      const { token, user } = await Api.login({ email, password });
      setSession(token, user);
      showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
      // Button stays disabled: we are navigating away.
    } catch (err) {
      const unmatched = applyServerErrors(err.errors, { email: emailField, password: passField });
      if (err.status === 401) {
        showBanner(banner, 'That email and password combination doesn\u2019t match an account.');
      } else if (!err.errors.length || unmatched.length) {
        showBanner(banner, err.message);
      }
      submitting = false;
      setButtonLoading(submitBtn, false);
    }
  });

  document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => togglePasswordVisibility(btn));
  });
}

/* ---------- Register ---------- */

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score; // 0-3
}

function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  if (getSession()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const passwordInput = document.getElementById('registerPassword');
  const strengthBar = document.getElementById('passwordStrength');
  const banner = document.getElementById('registerBanner');
  const submitBtn = form.querySelector('button[type="submit"]');
  let submitting = false;

  passwordInput.addEventListener('input', () => {
    const score = passwordStrength(passwordInput.value);
    strengthBar.className = 'password-strength';
    if (!passwordInput.value) return;
    if (score <= 1) strengthBar.classList.add('weak');
    else if (score === 2) strengthBar.classList.add('fair');
    else strengthBar.classList.add('strong');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    const fields = {
      name: { el: document.getElementById('registerNameField'), input: document.getElementById('registerName') },
      email: { el: document.getElementById('registerEmailField'), input: document.getElementById('registerEmail') },
      password: { el: document.getElementById('registerPasswordField'), input: passwordInput },
      confirm: { el: document.getElementById('registerConfirmField'), input: document.getElementById('registerConfirm') },
    };

    let valid = true;

    const name = fields.name.input.value.trim();
    if (!name) {
      setFieldError(fields.name.el, 'Full name is required.');
      valid = false;
    } else {
      setFieldError(fields.name.el, '');
    }

    const email = fields.email.input.value.trim();
    if (!email) {
      setFieldError(fields.email.el, 'Email is required.');
      valid = false;
    } else if (!EMAIL_RE.test(email)) {
      setFieldError(fields.email.el, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(fields.email.el, '');
    }

    const password = fields.password.input.value;
    if (!password) {
      setFieldError(fields.password.el, 'Password is required.');
      valid = false;
    } else if (password.length < 8) {
      setFieldError(fields.password.el, 'Use at least 8 characters.');
      valid = false;
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setFieldError(fields.password.el, 'Include at least one letter and one number.');
      valid = false;
    } else {
      setFieldError(fields.password.el, '');
    }

    const confirm = fields.confirm.input.value;
    if (!confirm) {
      setFieldError(fields.confirm.el, 'Please confirm your password.');
      valid = false;
    } else if (confirm !== password) {
      setFieldError(fields.confirm.el, 'Passwords do not match.');
      valid = false;
    } else {
      setFieldError(fields.confirm.el, '');
    }

    if (!valid) return;

    hideBanner(banner);
    submitting = true;
    setButtonLoading(submitBtn, true, 'Creating account…');

    try {
      await Api.register({ name, email, password });
    } catch (err) {
      const unmatched = applyServerErrors(err.errors, {
        name: fields.name.el,
        email: fields.email.el,
        password: fields.password.el,
      });
      if (!err.errors.length || unmatched.length) showBanner(banner, err.message);
      submitting = false;
      setButtonLoading(submitBtn, false);
      return;
    }

    // The account exists now. Sign in with the same credentials (a real login request).
    try {
      const { token, user } = await Api.login({ email, password });
      setSession(token, user);
      showToast('Account created — welcome to Quill!', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
    } catch (_) {
      showToast('Account created. Please log in.', 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 900);
    }
  });

  document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => togglePasswordVisibility(btn));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initRegisterForm();
});
