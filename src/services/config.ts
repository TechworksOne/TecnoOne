// Configuración de la API
import axios from 'axios';

const ACTIVE_BRANCH_STORAGE_KEY = 'tecnoone.sucursalActivaId';
const axiosWithBranchContext = axios as typeof axios & { __branchContextInstalled?: boolean };

// Agrega el contexto a todas las instancias Axios sin modificar los servicios
// operativos. El backend aun no consume este header en esas rutas.
if (!axiosWithBranchContext.__branchContextInstalled) {
  const attachBranchContext = (config: Parameters<Parameters<typeof axios.interceptors.request.use>[0]>[0]) => {
    const sucursalId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
    if (sucursalId) config.headers['X-Sucursal-Id'] = sucursalId;
    return config;
  };
  axios.interceptors.request.use(attachBranchContext);
  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<typeof axios.create>) => {
    const instance = originalCreate(...args);
    instance.interceptors.request.use(attachBranchContext);
    return instance;
  }) as typeof axios.create;
  axiosWithBranchContext.__branchContextInstalled = true;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Base URL del servidor (sin el sufijo /api)
// En dev local con VITE_API_URL=http://localhost:3000/api → API_BASE_URL='http://localhost:3000'
// En prod Docker con VITE_API_URL=/api → API_BASE_URL=''
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');

// URL base para archivos estáticos en /uploads
export const UPLOADS_BASE_URL = `${API_BASE_URL}/uploads`;

export default API_URL;
