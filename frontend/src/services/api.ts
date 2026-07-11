import axios from 'axios';
import { isDemoMode, mockApi } from './mockApi';
import { isJwtExpired, notifySessionExpired } from './session';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cafam_token');
  if (token && !isDemoMode() && isJwtExpired(token)) {
    notifySessionExpired();
    return Promise.reject(new axios.CanceledError('La sesión expiró.'));
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isDemoMode() && error.config) return mockApi(error.config);
    if (error.response?.status === 401) {
      notifySessionExpired();
    }
    return Promise.reject(error);
  }
);

export default api;
