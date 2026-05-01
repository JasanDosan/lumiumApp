import api from './api';

export const authService = {
  register: (data) =>
    api.post('/auth/register', data).then(r => r.data),

  login: (credentials) =>
    api.post('/auth/login', credentials).then(r => r.data),

  getMe: () =>
    api.get('/auth/me').then(r => r.data),
};
