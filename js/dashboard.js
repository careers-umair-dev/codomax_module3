/* ==========================================================================
   dashboard.js
   Shows the signed-in user's own posts (GET /api/posts?mine=true) with
   view / edit / delete actions. Every change goes through the API first;
   the screen only updates once the server confirms.
   ========================================================================== */

function blogRowHTML(post) {
  const thumb = post.image || DEFAULT_THUMB;
  const id = encodeURIComponent(post.id);
  return `
    <div class="blog-row" data-id="${escapeHTML(post.id)}">
      <div class="thumb"><img src="${escapeHTML(thumb)}" alt=""></div>
      <div>
        <div class="title">${escapeHTML(post.title)}</div>
        <div class="meta">${escapeHTML(post.category)} \u00b7 ${formatDate(post.createdAt)}</div>
      </div>
      <span class="tag">${escapeHTML(post.category)}</span>
      <div class="row-actions">
        <a href="post.html?id=${id}" class="btn btn-ghost btn-sm">View</a>
        <a href="create-blog.html?edit=${id}" class="btn btn-outline btn-sm">Edit</a>
      </div>
      <div class="row-actions">
        <button type="button" class="btn btn-danger btn-sm" data-delete="${escapeHTML(post.id)}">Delete</button>
      </div>
    </div>
  `;
}

function renderStats(posts) {
  document.getElementById('statTotal').textContent = posts.length;
  document.getElementById('statCategories').textContent = new Set(posts.map((p) => p.category)).size;
  // The API returns newest first, so the first post is the latest one.
  document.getElementById('statLatest').textContent = posts.length ? formatDate(posts[0].createdAt) : '\u2014';
}

function renderPostList(posts) {
  const list = document.getElementById('myBlogsList');
  const emptyState = document.getElementById('dashEmptyState');

  renderStats(posts);

  if (!posts.length) {
    list.innerHTML = '';
    list.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  list.style.display = '';
  emptyState.style.display = 'none';
  list.innerHTML = posts.map(blogRowHTML).join('');

  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.delete));
  });
}

async function loadDashboard() {
  const list = document.getElementById('myBlogsList');
  document.getElementById('dashEmptyState').style.display = 'none';
  list.style.display = '';
  list.innerHTML = loadingStateHTML('Loading your posts…');

  try {
    renderPostList(await Api.listMyPosts());
  } catch (err) {
    if (err.sessionExpired) return;
    list.innerHTML = errorStateHTML('Couldn\u2019t load your posts', err.message, { retry: true });
    list.querySelector('[data-retry]').addEventListener('click', loadDashboard);
  }
}

let pendingDeleteId = null;
let deleting = false;

function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModal').classList.add('is-open');
}

function initDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (!modal) return;

  const cancelBtn = document.getElementById('cancelDelete');
  const confirmBtn = document.getElementById('confirmDelete');

  cancelBtn.addEventListener('click', () => {
    if (deleting) return;
    pendingDeleteId = null;
    modal.classList.remove('is-open');
  });

  confirmBtn.addEventListener('click', async () => {
    if (!pendingDeleteId || deleting) return;

    deleting = true;
    cancelBtn.disabled = true;
    setButtonLoading(confirmBtn, true, 'Deleting…');

    let removed = false;
    try {
      await Api.deletePost(pendingDeleteId);
      removed = true;
      showToast('Post deleted.', 'success');
    } catch (err) {
      reportError(err);
      // Already gone (404)? Refresh so the list matches the server.
      removed = err.status === 404;
    } finally {
      deleting = false;
      pendingDeleteId = null;
      cancelBtn.disabled = false;
      setButtonLoading(confirmBtn, false);
      modal.classList.remove('is-open');
    }

    if (removed) loadDashboard();
  });
}

function initDashboardPage() {
  const list = document.getElementById('myBlogsList');
  if (!list) return;

  const session = requireAuth();
  if (!session) return;
  document.getElementById('welcomeName').textContent = session.name.split(' ')[0];

  initDeleteModal();
  loadDashboard();
}

document.addEventListener('DOMContentLoaded', initDashboardPage);
