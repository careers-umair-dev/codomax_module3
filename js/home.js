/* ==========================================================================
   home.js
   Renders the featured post + blog grid from GET /api/posts. Search and
   category filtering are performed by the backend (?search=&category=).
   ========================================================================== */

let activeCategory = 'All';
let searchTerm = '';
let requestSeq = 0; // lets us ignore out-of-date responses while typing fast
let searchTimer = null;
let emptyStateDefaultHTML = '';

function postCardHTML(post) {
  const thumb = post.image || DEFAULT_THUMB;
  const href = `post.html?id=${encodeURIComponent(post.id)}`;
  return `
    <article class="post-card card">
      <a href="${href}" class="thumb" tabindex="-1">
        <img src="${escapeHTML(thumb)}" alt="" loading="lazy">
      </a>
      <div class="body">
        <span class="tag">${escapeHTML(post.category)}</span>
        <h3><a href="${href}">${escapeHTML(post.title)}</a></h3>
        <p class="excerpt">${escapeHTML(post.excerpt)}</p>
        <div class="post-meta">
          <span>${escapeHTML(post.authorName)}</span>
          <span class="dot"></span>
          <span>${formatDate(post.createdAt)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryFilters(categories) {
  const wrap = document.getElementById('categoryFilters');
  wrap.innerHTML = categories
    .map((cat) => `<button type="button" data-category="${escapeHTML(cat)}" class="${cat === activeCategory ? 'is-active' : ''}">${escapeHTML(cat)}</button>`)
    .join('');

  wrap.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategoryFilters(categories);
      loadPosts();
    });
  });
}

function renderFeatured(post) {
  const el = document.getElementById('featuredPost');
  if (!post) { el.style.display = 'none'; return; }
  el.style.display = '';
  const thumb = post.image || DEFAULT_THUMB;
  el.innerHTML = `
    <div class="thumb"><img src="${escapeHTML(thumb)}" alt=""></div>
    <div>
      <span class="eyebrow">Latest ${escapeHTML(post.category)} post</span>
      <h2><a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHTML(post.title)}</a></h2>
      <p class="excerpt">${escapeHTML(post.excerpt)}</p>
      <div class="post-meta">
        <span>${escapeHTML(post.authorName)}</span>
        <span class="dot"></span>
        <span>${formatDate(post.createdAt)}</span>
      </div>
    </div>
  `;
}

function showGridMessage(html) {
  document.getElementById('blogGrid').innerHTML = '';
  document.getElementById('featuredPost').style.display = 'none';
  const emptyState = document.getElementById('gridEmptyState');
  emptyState.innerHTML = html;
  emptyState.style.display = 'block';
}

function renderPosts(posts) {
  const grid = document.getElementById('blogGrid');
  const emptyState = document.getElementById('gridEmptyState');
  const isBrowsingAll = activeCategory === 'All' && !searchTerm;

  // The featured spotlight only makes sense when browsing everything —
  // once someone searches or filters, show just their matching results.
  if (isBrowsingAll) {
    renderFeatured(posts[0]);
  } else {
    document.getElementById('featuredPost').style.display = 'none';
  }

  const toShow = isBrowsingAll ? posts.slice(1) : posts;

  if (!posts.length) {
    showGridMessage(emptyStateDefaultHTML);
  } else if (!toShow.length) {
    grid.innerHTML = '';
    emptyState.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    grid.innerHTML = toShow.map(postCardHTML).join('');
  }
}

async function loadPosts() {
  const seq = ++requestSeq;
  const isBrowsingAll = activeCategory === 'All' && !searchTerm;

  document.getElementById('gridEmptyState').style.display = 'none';
  document.getElementById('featuredPost').style.display = 'none';
  document.getElementById('blogGrid').innerHTML = loadingStateHTML('Loading posts…');

  try {
    const posts = await Api.listPosts({
      search: searchTerm,
      category: activeCategory === 'All' ? '' : activeCategory,
    });
    if (seq !== requestSeq) return; // a newer request superseded this one

    // The unfiltered feed is the source for the category buttons.
    if (isBrowsingAll) {
      const categories = ['All', ...new Set(posts.map((p) => p.category))];
      renderCategoryFilters(categories);
    }
    renderPosts(posts);
  } catch (err) {
    if (seq !== requestSeq) return;
    showGridMessage(errorStateHTML('Couldn\u2019t load posts', err.message, { retry: true }));
    const retry = document.querySelector('#gridEmptyState [data-retry]');
    if (retry) retry.addEventListener('click', loadPosts);
  }
}

function initHomePage() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  emptyStateDefaultHTML = document.getElementById('gridEmptyState').innerHTML;
  renderCategoryFilters(['All']);
  loadPosts();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPosts, 250); // don't hit the API on every keystroke
  });
}

document.addEventListener('DOMContentLoaded', initHomePage);
