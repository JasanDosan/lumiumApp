import axios from 'axios';
import { getToken, clearToken } from './tokenStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request — reads from tokenStore, no circular import
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize errors + auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    if (error.response?.status === 401) {
      clearToken();
      // Lazy import to avoid circular dependency — only triggered on 401
      import('@/features/auth/authStore').then(m => {
        m.useAuthStore.getState().logout();
      });
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
