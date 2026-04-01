/**
 * Game data service — proxied through the backend.
 *
 * All RAWG API calls go through /api/games/* so the RAWG key stays on the
 * server and browser CORS/env-variable issues are avoided entirely.
 *
 * Response shape from backend (already normalised):
 *   { results: [{ id, name, title, type, image, emoji, rating, tags, ... }] }
 */
import api from './api.js';

export const rawgService = {

  /** Search games by name. Returns normalised game objects. */
  search: async (query, count = 6) => {
    if (!query?.trim()) return [];

    const { data } = await api.get('/games/search', {
      params: { q: query.trim(), count },
    });

    const results = data.results ?? [];

    if (!results.length) {
      console.warn(`[rawgService] search("${query}") returned 0 results`);
    } else {
      console.log(`[rawgService] search("${query}") → ${results.length} games`, results);
    }

    return results;
  },

  /** Trending / recently-added games. */
  getTrending: async (count = 12) => {
    const { data } = await api.get('/games/trending', { params: { count } });
    return data.results ?? [];
  },

  /** Top-rated games. */
  getTopRated: async (count = 12) => {
    const { data } = await api.get('/games/top-rated', { params: { count } });
    return data.results ?? [];
  },
};
