import api from './api';

export const tvService = {
  getTrending: (window = 'week') =>
    api.get('/tv/trending', { params: { window } }).then(r => r.data),

  getPopular: (page = 1) =>
    api.get('/tv/popular', { params: { page } }).then(r => r.data),

  getDetails: (id) =>
    api.get(`/tv/${id}`).then(r => r.data),

  getSimilar: (id) =>
    api.get(`/tv/${id}/similar`).then(r => r.data),

  /**
   * Discover TV series by genre/mood — mirrors movieService.discover.
   * Used by GameDetailPage to find series that match a game's themes.
   */
  discover: ({ genres, sort_by = 'popularity.desc', rating_gte, page = 1 } = {}) =>
    api.get('/tv/discover', {
      params: {
        page,
        sort_by,
        ...(genres?.length && { genres: genres.join(',') }),
        ...(rating_gte && { rating_gte }),
      },
    }).then(r => r.data),
};
