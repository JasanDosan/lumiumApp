import api from './api';

export const gameService = {
  search: (query, page = 1) =>
    api.get('/games/search', { params: { q: query, page } }).then(r => r.data),

  getTrending: (count = 12) =>
    api.get('/games/trending', { params: { count } }).then(r => r.data),

  getTopRated: (count = 12) =>
    api.get('/games/top-rated', { params: { count } }).then(r => r.data),

  getByCategory: (categoryId, count = 20) =>
    api.get('/games/by-category', { params: { category: categoryId, count } }).then(r => r.data),
};
