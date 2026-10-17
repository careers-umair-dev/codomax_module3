const config = require('../config/config');
const ApiError = require('../utils/ApiError');

const DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const HTTP_URL_MAX = 2048;

/**
 * Cover-image policy for Module 2: either an http(s) URL or a small base64
 * data URL (what the existing editor produces). Everything funnels through
 * this one function, so moving to Cloudinary/S3 later means changing this
 * file — e.g. accept an upload, push it to storage, and return the hosted URL.
 *
 * Returns the cleaned value ('' means "no image"). Throws ApiError(400).
 */
function normalizeImage(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw invalid('Image must be a URL or an image data URL.');

  const image = value.trim();

  if (image.startsWith('data:')) {
    const match = DATA_URL_RE.exec(image);
    if (!match) throw invalid('Image must be a PNG, JPEG, GIF or WebP file.');
    const decodedBytes = Math.floor((match[2].length * 3) / 4);
    if (decodedBytes > config.limits.imageMaxBytes) {
      const mb = config.limits.imageMaxBytes / (1024 * 1024);
      throw invalid(`Image is too large. Maximum size is ${mb} MB.`);
    }
    return image;
  }

  if (image.length > HTTP_URL_MAX) throw invalid('Image URL is too long.');
  try {
    const url = new URL(image);
    if (url.protocol === 'http:' || url.protocol === 'https:') return image;
  } catch (_) {
    /* fall through */
  }
  throw invalid('Image must be a valid http(s) URL or an uploaded image.');
}

function invalid(message) {
  return ApiError.badRequest(message, { errors: [{ field: 'image', message }] });
}

module.exports = { normalizeImage };
