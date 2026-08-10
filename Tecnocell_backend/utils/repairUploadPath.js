const path = require('path');

const REPAIR_ID_PATTERN = /^(?:[1-9]\d*|REP\d{6,})$/;
const ALLOWED_IMAGE_TYPES = new Set(['recepcion', 'ingreso', 'historial', 'final']);

function invalidUploadPath(message = 'Ruta de carga no valida') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_UPLOAD_PATH';
  return error;
}

function validateRepairUploadId(value) {
  const segment = String(value ?? '').trim();
  if (!REPAIR_ID_PATTERN.test(segment) || path.isAbsolute(segment) || /[\\/]/.test(segment)) {
    throw invalidUploadPath('Identificador de reparacion no valido');
  }
  return segment;
}

function validateRepairImageType(value, fallback = 'historial') {
  const segment = String(value || fallback).trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(segment) || path.isAbsolute(segment) || /[\\/]/.test(segment)) {
    throw invalidUploadPath('Tipo de imagen no valido');
  }
  return segment;
}

function resolveContainedPath(baseDirectory, ...segments) {
  const base = path.resolve(baseDirectory);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw invalidUploadPath();
  }
  return target;
}

function resolveRepairUploadDirectory(uploadsBase, repairId, imageType) {
  return resolveContainedPath(
    uploadsBase,
    'reparaciones',
    validateRepairUploadId(repairId),
    validateRepairImageType(imageType)
  );
}

module.exports = {
  ALLOWED_IMAGE_TYPES,
  resolveContainedPath,
  resolveRepairUploadDirectory,
  validateRepairImageType,
  validateRepairUploadId,
};
