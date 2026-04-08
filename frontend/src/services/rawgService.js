/**
 * Game data service — proxied through the backend.
 *
 * All RAWG API calls go through /api/games/* so the RAWG key stays on the
 * server and browser CORS/env-variable issues are avoided entirely.
 */
import api from './api.js';

// ─── In-memory result cache (5-minute TTL) ────────────────────────────────────

const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheKey(endpoint, params) {
  const sorted = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return `${endpoint}::${JSON.stringify(sorted)}`;
}

function fromCache(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return hit.data;
}

function toCache(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const rawgService = {

  /** Search games by name. Returns normalised game objects. */
  search: async (query, count = 6) => {
    if (!query?.trim()) return [];
    const { data } = await api.get('/games/search', {
      params: { q: query.trim(), count },
    });
    return data.results ?? [];
  },

  /** Trending / recently-added games. */
  getTrending: async (count = 12) => {
    const key = cacheKey('trending', { count });
    const cached = fromCache(key);
    if (cached) return cached;
    const { data } = await api.get('/games/trending', { params: { count } });
    const results = data.results ?? [];
    toCache(key, results);
    return results;
  },

  /** Top-rated games. */
  getTopRated: async (count = 12) => {
    const key = cacheKey('top-rated', { count });
    const cached = fromCache(key);
    if (cached) return cached;
    const { data } = await api.get('/games/top-rated', { params: { count } });
    const results = data.results ?? [];
    toCache(key, results);
    return results;
  },

  /** Games by category ID (mapped to RAWG genre/tag on the backend). */
  getByCategory: async (categoryId, count = 20) => {
    const key = cacheKey('by-category', { categoryId, count });
    const cached = fromCache(key);
    if (cached) return cached;
    const { data } = await api.get('/games/by-category', {
      params: { category: categoryId, count },
    });
    const results = data.results ?? [];
    toCache(key, results);
    return results;
  },

  /**
   * Games matching a combination of category IDs plus optional extra tags.
   */
  getMultiCategory: async (categoryIds, {
    count     = 40,
    ordering  = 'relevance',
    platform  = null,
    extraTags = [],
  } = {}) => {
    const params = { categories: categoryIds.join(','), count, ordering };
    if (platform)         params.platform = platform;
    if (extraTags.length) params.tags     = extraTags.join(',');

    const key = cacheKey('multi-category', params);
    const cached = fromCache(key);
    if (cached) return cached;

    const { data } = await api.get('/games/multi-category', { params });
    const results = data.results ?? [];
    toCache(key, results);
    return results;
  },

  /**
   * Full game detail by RAWG numeric ID.
   * Returns the normalizeGameDetail() shape including screenshots.
   */
  getDetails: async (rawgId) => {
    const key = cacheKey('detail', { rawgId });
    const cached = fromCache(key);
    if (cached) return cached;
    const { data } = await api.get(`/games/${rawgId}`);
    toCache(key, data);
    return data;
  },

  /**
   * Games in the same series (sequels, prequels, remakes).
   */
  getSimilar: async (rawgId) => {
    const key = cacheKey('similar', { rawgId });
    const cached = fromCache(key);
    if (cached) return cached;
    const { data } = await api.get(`/games/${rawgId}/similar`);
    const results = data.results ?? [];
    toCache(key, results);
    return results;
  },

  /** Manually clear the entire cache (e.g. after a hard refresh). */
  clearCache: () => _cache.clear(),
};
