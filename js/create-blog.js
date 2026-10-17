/* ==========================================================================
   create-blog.js
   Handles both "create" (POST /api/posts) and "edit" (?edit=<id>, which
   loads GET /api/posts/:id and saves with PUT /api/posts/:id), including
   image upload preview and the live preview card.
   ========================================================================== */

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024; // picked file; it is shrunk before upload
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;    // what we actually send (backend limit is 2 MB)

let currentImageData = '';
let editingPostId = null;
let submitting = false;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Approximate decoded size of a base64 data URL. */
function dataURLBytes(dataURL) {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Downscales the picked image (max 1280px wide) and re-encodes it as JPEG so
 * the API request stays small. Tries progressively smaller settings until it fits.
 */
async function prepareImageForUpload(file) {
  const img = await loadImageElement(await readFileAsDataURL(file));

  for (const [maxWidth, quality] of [[1280, 0.82], [1024, 0.7], [800, 0.6]]) {
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const result = canvas.toDataURL('image/jpeg', quality);
    if (dataURLBytes(result) <= MAX_UPLOAD_BYTES) return result;
  }
  throw new Error('That image is too large. Please choose a smaller one.');
}

function updateLivePreview() {
  const title = document.getElementById('blogTitle').value.trim() || 'Your post title will appear here';
  const category = document.getElementById('blogCategory').value || 'Category';
  const content = document.getElementById('blogContent').value.trim();

  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewCategory').textContent = category;
  document.getElementById('previewExcerpt').textContent = content ? excerptOf(content) : 'A short excerpt from your content will show up here as you write.';

  const previewThumb = document.getElementById('previewThumb');
  previewThumb.src = currentImageData || DEFAULT_THUMB;
}

function initImageUpload() {
  const dropZone = document.getElementById('fileDrop');
  const fileInput = document.getElementById('blogImage');
  const preview = document.getElementById('filePreview');
  const previewImg = document.getElementById('filePreviewImg');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.toggle('is-dragover', evt === 'dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    fileInput.value = ''; // allow picking the same file again
  });

  async function handleImageFile(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast('Please choose a PNG, JPEG, GIF or WebP image.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      showToast('That image is over 10 MB. Please choose a smaller one.', 'error');
      return;
    }
    try {
      currentImageData = await prepareImageForUpload(file);
    } catch (err) {
      showToast(err.message || 'Could not read that image.', 'error');
      return;
    }
    previewImg.src = currentImageData;
    preview.classList.add('is-visible');
    updateLivePreview();
  }
}

function prefillForEdit(post) {
  editingPostId = post.id;
  document.getElementById('editorTitle').textContent = 'Edit post';
  document.getElementById('editorSubtitle').textContent = 'Update your post and save your changes.';
  document.getElementById('blogTitle').value = post.title;
  document.getElementById('blogCategory').value = post.category;
  document.getElementById('blogContent').value = post.content;
  document.getElementById('submitBtn').textContent = 'Save changes';

  if (post.image) {
    currentImageData = post.image;
    document.getElementById('filePreviewImg').src = post.image;
    document.getElementById('filePreview').classList.add('is-visible');
  }
  updateLivePreview();
}

/** Loads the post being edited. Returns true when the form is ready to use. */
async function loadPostForEdit(editId, session) {
  const submitBtn = document.getElementById('submitBtn');
  const subtitle = document.getElementById('editorSubtitle');
  submitBtn.disabled = true;
  subtitle.textContent = 'Loading your post…';

  try {
    const post = await Api.getPost(editId);
    if (post.authorId !== session.userId) {
      showToast('You can only edit your own posts.', 'error');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
      subtitle.textContent = 'You can only edit your own posts.';
      return false;
    }
    prefillForEdit(post);
    submitBtn.disabled = false;
    return true;
  } catch (err) {
    const message = err.status === 404 ? 'That post no longer exists.' : err.message;
    showToast(message, 'error');
    subtitle.textContent = message;
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    return false;
  }
}

function validateEditorFields() {
  const titleField = document.getElementById('blogTitleField');
  const categoryField = document.getElementById('blogCategoryField');
  const contentField = document.getElementById('blogContentField');

  const title = document.getElementById('blogTitle').value.trim();
  const category = document.getElementById('blogCategory').value;
  const content = document.getElementById('blogContent').value.trim();

  let valid = true;
  if (!title) {
    setFieldError(titleField, 'Give your post a title.');
    valid = false;
  } else {
    setFieldError(titleField, '');
  }

  if (!category) {
    setFieldError(categoryField, 'Choose a category.');
    valid = false;
  } else {
    setFieldError(categoryField, '');
  }

  if (!content || content.length < 20) {
    setFieldError(contentField, 'Write at least a couple of sentences (20+ characters).');
    valid = false;
  } else {
    setFieldError(contentField, '');
  }

  return { valid, values: { title, category, content } };
}

async function initEditorForm() {
  const form = document.getElementById('blogForm');
  if (!form) return;

  const session = requireAuth();
  if (!session) return;

  initImageUpload();

  ['blogTitle', 'blogCategory', 'blogContent'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateLivePreview);
  });
  document.getElementById('blogCategory').addEventListener('change', updateLivePreview);
  updateLivePreview();

  const submitBtn = document.getElementById('submitBtn');
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) await loadPostForEdit(editId, session);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    const { valid, values } = validateEditorFields();
    if (!valid) return;

    submitting = true;
    setButtonLoading(submitBtn, true, editingPostId ? 'Saving…' : 'Publishing…');

    try {
      // Author details are never sent — the backend takes them from the JWT.
      const payload = { ...values, image: currentImageData };
      if (editingPostId) {
        await Api.updatePost(editingPostId, payload);
        showToast('Post updated.', 'success');
      } else {
        await Api.createPost(payload);
        showToast('Post published.', 'success');
      }
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
      // Button stays disabled: we are navigating away.
    } catch (err) {
      const unmatched = applyServerErrors(err.errors, {
        title: document.getElementById('blogTitleField'),
        category: document.getElementById('blogCategoryField'),
        content: document.getElementById('blogContentField'),
      });
      if (!err.errors.length) reportError(err);
      else if (unmatched.length) showToast(unmatched[0].message, 'error');
      submitting = false;
      setButtonLoading(submitBtn, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initEditorForm);
