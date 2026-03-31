import api from './api';

export const favoritesService = {
  getAll: () =>
    api.get('/users/favorites').then(r => r.data.favorites),

  add: (movie) =>
    api.post('/users/favorites', movie).then(r => r.data.favorites),

  remove: (tmdbId) =>
    api.delete(`/users/favorites/${tmdbId}`).then(r => r.data.favorites),
};
