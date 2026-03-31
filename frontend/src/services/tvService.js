import api from './api';

export const tvService = {
  getTrending: (window = 'week') =>
    api.get('/tv/trending', { params: { window } }).then(r => r.data),

  getPopular: (page = 1) =>
    api.get('/tv/popular', { params: { page } }).then(r => r.data),
};
