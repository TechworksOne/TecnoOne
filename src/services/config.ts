// Configuración de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Base URL del servidor (sin el sufijo /api)
// En dev local con VITE_API_URL=http://localhost:3000/api → API_BASE_URL='http://localhost:3000'
// En prod Docker con VITE_API_URL=/api → API_BASE_URL=''
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');

// URL base para archivos estáticos en /uploads
export const UPLOADS_BASE_URL = `${API_BASE_URL}/uploads`;

export default API_URL;
