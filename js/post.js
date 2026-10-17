/* ==========================================================================
   post.js
   Reads ?id= from the URL and renders that post from GET /api/posts/:id.
   ========================================================================== */

function renderPost(container, post) {
  document.title = `${post.title} — Quill`;

  const thumbHTML = post.image
    ? `<div class="thumb"><img src="${escapeHTML(post.image)}" alt=""></div>`
    : '';

  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHTML(para)}</p>`)
    .join('');

  container.innerHTML = `
    <span class="tag">${escapeHTML(post.category)}</span>
    <h1>${escapeHTML(post.title)}</h1>
    <div class="post-meta">
      <span>${escapeHTML(post.authorName)}</span>
      <span class="dot"></span>
      <span>${formatDate(post.createdAt)}</span>
    </div>
    ${thumbHTML}
    <div class="post-body">${paragraphs}</div>
  `;
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>Post not found</h3>
      <p>This post may have been deleted. <a href="index.html" class="btn btn-primary btn-sm" style="margin-top:12px;">Back to all posts</a></p>
    </div>
  `;
  document.title = 'Post not found — Quill';
}

async function loadPost(container, id) {
  container.innerHTML = loadingStateHTML('Loading post…');

  try {
    renderPost(container, await Api.getPost(id));
  } catch (err) {
    if (err.status === 404) {
      renderNotFound(container);
      return;
    }
    container.innerHTML = errorStateHTML('Couldn\u2019t load this post', err.message, { retry: true });
    container.querySelector('[data-retry]').addEventListener('click', () => loadPost(container, id));
    document.title = 'Something went wrong — Quill';
  }
}

function initPostPage() {
  const container = document.getElementById('postContent');
  if (!container) return;

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    renderNotFound(container);
    return;
  }
  loadPost(container, id);
}

document.addEventListener('DOMContentLoaded', initPostPage);
