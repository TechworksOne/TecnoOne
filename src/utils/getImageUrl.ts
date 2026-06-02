import { API_BASE_URL, UPLOADS_BASE_URL } from '../services/config';

const UPLOADS_CACHE_VERSION = 'uploads-fix-20260519';

/**
 * Agrega el query param de cache busting a cualquier URL que apunte a /uploads/.
 * Es idempotente: no duplica el param si ya está presente.
 */
const addUploadsCacheVersion = (url: string): string => {
  if (!url.includes('/uploads/')) return url;
  if (url.includes(`v=${UPLOADS_CACHE_VERSION}`)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${UPLOADS_CACHE_VERSION}`;
};

/**
 * Construye la URL completa para una imagen almacenada en /uploads del backend.
 * Maneja todos los formatos posibles de ruta:
 *  - URL absoluta (http/https): se devuelve tal cual
 *  - blob: o data: URLs: se devuelven tal cual
 *  - /uploads/repuestos/foto.jpg  → API_BASE_URL + ruta
 *  - uploads/repuestos/foto.jpg   → API_BASE_URL + / + ruta
 *  - /repuestos/foto.jpg          → UPLOADS_BASE_URL + ruta
 *  - repuestos/foto.jpg           → UPLOADS_BASE_URL + / + ruta
 */
export const getImageUrl = (imagePath?: string | null): string => {
  if (!imagePath) return '';

  const cleanPath = String(imagePath).trim();

  if (!cleanPath) return '';

  // URLs absolutas y especiales: devolver tal cual (sin cache busting)
  if (
    cleanPath.startsWith('http://') ||
    cleanPath.startsWith('https://') ||
    cleanPath.startsWith('blob:') ||
    cleanPath.startsWith('data:')
  ) {
    return addUploadsCacheVersion(cleanPath);
  }

  // Ruta ya incluye /uploads/ al inicio → anteponer API_BASE_URL (servidor base)
  if (cleanPath.startsWith('/uploads/')) {
    return addUploadsCacheVersion(`${API_BASE_URL}${cleanPath}`);
  }

  // Ruta empieza con uploads/ (sin barra inicial)
  if (cleanPath.startsWith('uploads/')) {
    return addUploadsCacheVersion(`${API_BASE_URL}/${cleanPath}`);
  }

  // Ruta relativa con barra inicial pero sin /uploads/ → unir con UPLOADS_BASE_URL
  if (cleanPath.startsWith('/')) {
    return addUploadsCacheVersion(`${UPLOADS_BASE_URL}${cleanPath}`);
  }

  // Nombre de archivo o ruta relativa simple → unir con UPLOADS_BASE_URL
  return addUploadsCacheVersion(`${UPLOADS_BASE_URL}/${cleanPath}`);
};
