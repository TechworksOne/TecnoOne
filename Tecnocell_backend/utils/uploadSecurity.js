const path = require('path');

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function getSafeImageExtension(file, fallback = '.jpg') {
  const originalExt = path.extname(file?.originalname || '').toLowerCase();

  if (ALLOWED_IMAGE_EXTENSIONS.has(originalExt)) {
    return originalExt;
  }

  return MIME_TO_EXTENSION[file?.mimetype] || fallback;
}

function sanitizeBaseName(filename, fallback = 'archivo') {
  const raw = String(filename || '');
  const ext = path.extname(raw);
  const base = path.basename(raw, ext);

  const sanitized = base
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);

  return sanitized || fallback;
}

function isAllowedImageFile(file) {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  const mime = file?.mimetype;

  return ALLOWED_IMAGE_MIME_TYPES.has(mime) && ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

function imageFileFilter(_req, file, cb) {
  if (!isAllowedImageFile(file)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'), false);
  }

  return cb(null, true);
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  getSafeImageExtension,
  sanitizeBaseName,
  isAllowedImageFile,
  imageFileFilter,
};
