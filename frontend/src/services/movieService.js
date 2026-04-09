/**
 * movieService.js
 *
 * Wraps all /api/movies/* endpoints. The export is being progressively renamed
 * to `mediaDiscoveryService` to reflect that the service is media-agnostic at
 * the API layer. Both names are exported; new code should import
 * `mediaDiscoveryService`, existing call sites can migrate incrementally.
 *
 * @see mediaDiscoveryService (canonical name going forward)
 * @deprecated movieService — use mediaDiscoveryService in new code
 */
import api from './api';

export const mediaDiscoveryService = {
  search: (query, page = 1) =>
    api.get('/movies/search', { params: { q: query, page } }).then(r => r.data),

  getTrending: (window = 'week') =>
    api.get('/movies/trending', { params: { window } }).then(r => r.data),

  getPopular: (page = 1) =>
    api.get('/movies/popular', { params: { page } }).then(r => r.data),

  getTopRated: (page = 1) =>
    api.get('/movies/top-rated', { params: { page } }).then(r => r.data),

  getUpcoming: (page = 1) =>
    api.get('/movies/upcoming', { params: { page } }).then(r => r.data),

  getDetails: (id) =>
    api.get(`/movies/${id}`).then(r => r.data),

  getSimilar: (id) =>
    api.get(`/movies/${id}/similar`).then(r => r.data),

  getRecommendations: () =>
    api.get('/movies/recommendations/me').then(r => r.data),

  getGenres: () =>
    api.get('/movies/genres').then(r => r.data),

  discover: ({ page = 1, genres, year_gte, year_lte, rating_gte, sort_by, with_person, with_watch_providers, watch_region } = {}) =>
    api.get('/movies/discover', {
      params: {
        page,
        ...(genres?.length && { genres: genres.join(',') }),
        ...(year_gte && { year_gte }),
        ...(year_lte && { year_lte }),
        ...(rating_gte && { rating_gte }),
        ...(sort_by && { sort_by }),
        ...(with_person && { with_person }),
        ...(with_watch_providers && { with_watch_providers }),
        ...(watch_region && { watch_region }),
      },
    }).then(r => r.data),

  getProviders: (region) =>
    api.get('/movies/providers', { params: { region } }).then(r => r.data),

  searchMulti: (query, page = 1) =>
    api.get('/movies/search/multi', { params: { q: query, page } }).then(r => r.data),

  getMovieRecs: (id) =>
    api.get(`/movies/${id}/recommendations`).then(r => r.data),

  getCollection: (id) =>
    api.get(`/movies/collection/${id}`).then(r => r.data),
};

/** @deprecated Use mediaDiscoveryService in new code. */
export const movieService = mediaDiscoveryService;
