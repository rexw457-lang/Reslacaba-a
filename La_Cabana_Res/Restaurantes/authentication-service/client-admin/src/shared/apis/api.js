import axios from 'axios';
import { useAuthStore } from '../../features/auth/store/authStore.js';

const axiosAuth = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://127.0.0.1:3000/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const axiosAdmin = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_URL || 'http://127.0.0.1:3000',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const addAuthHeaders = (clientName) => (config) => {
  config._axiosClient = clientName;
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
};

axiosAuth.interceptors.request.use(addAuthHeaders('auth'));
axiosAdmin.interceptors.request.use(addAuthHeaders('admin'));

const publicAuthEndpoints = ['/auth/login'];

const handleRefreshToken = async (error) => {
  const original = error.config;

  if (!original || original._retry) {
    return Promise.reject(error);
  }

  const requestUrl = original.url || '';
  const isPublicAuthEndpoint = publicAuthEndpoints.some((endpoint) => requestUrl.includes(endpoint));

  if (isPublicAuthEndpoint) {
    return Promise.reject(error);
  }

  const errorCode = error.response?.data?.error;
  const shouldLogout = errorCode === 'TOKEN_EXPIRED';

  if (!shouldLogout) {
    return Promise.reject(error);
  }

  original._retry = true;
  useAuthStore.getState().logout();
  return Promise.reject(error);
};

axiosAuth.interceptors.response.use((res) => res, handleRefreshToken);
axiosAdmin.interceptors.response.use((res) => res, handleRefreshToken);

export { axiosAuth, axiosAdmin };
export default { axiosAuth, axiosAdmin };
