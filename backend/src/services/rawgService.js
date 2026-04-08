import axios from 'axios';

const rawg = axios.create({
  baseURL: process.env.RAWG_BASE_URL || 'https://api.rawg.io/api',
  params:  { key: process.env.RAWG_API_KEY },
  timeout: 10000,
});

// ─── Retry interceptor (mirrors tmdbService.js) ───────────────────────────────

const RETRYABLE  = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

rawg.interceptors.response.use(null, async (error) => {
  const config = error.config;
  if (!config) return Promise.reject(error);

  const status = error.response?.status;

  // Explicit API-key error — log and bail immediately, no retry
  if (status === 401 || status === 403) {
    console.error('❌ RAWG API key inválida o no configurada');
    return Promise.reject(error);
  }

  config.__retries = (config.__retries ?? 0) + 1;

  if (config.__retries <= MAX_RETRIES && RETRYABLE.has(status)) {
    const retryAfter = error.response?.headers?.['retry-after'];
    const delay = retryAfter
      ? Number(retryAfter) * 1000
      : 2 ** config.__retries * 300;
    await new Promise(r => setTimeout(r, delay));
    return rawg(config);
  }

  return Promise.reject(error);
});

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Convert a raw RAWG game object into the unified shape expected by the frontend.
 * Shape mirrors the GAME_CATALOG entries: { id, name, title, type, image, emoji, rating, tags }
 */
function normalizeGame(g) {
  const tags       = (g.genres ?? []).slice(0, 3).map(gen => gen.name);
  // Preserve slugs so the frontend can do precise intersection filtering
  const genreSlugs = (g.genres ?? []).map(gen => gen.slug);
  const tagSlugs   = (g.tags   ?? []).map(t   => t.slug);
  return {
    id:         String(g.id),
    name:       g.name,
    title:      g.name,
    type:       'game',
    image:      g.background_image ?? null,
    emoji:      '🎮',
    rating:     g.rating ? parseFloat(g.rating.toFixed(1)) : null,
    tags,
    genreSlugs,
    tagSlugs,
    price:      null,
    tagline:    tags.join(' · '),
    _rawg:      true,
  };
}

// ─── Category → RAWG param mapping ───────────────────────────────────────────

/**
 * Map app category IDs to RAWG genres/tags.
 * RAWG genres: action, adventure, role-playing-games-rpg, strategy, ...
 * RAWG tags:   horror, open-world, sci-fi, story-rich, stealth, survival, ...
 */
const CATEGORY_PARAMS = {
  'horror':     { tags: 'horror' },
  'rpg':        { genres: 'role-playing-games-rpg' },
  'survival':   { tags: 'survival' },
  'sci-fi':     { tags: 'sci-fi' },
  'action':     { genres: 'action' },
  'story':      { tags: 'story-rich' },
  'open-world': { tags: 'open-world' },
  'adventure':  { genres: 'adventure' },
  'mystery':    { tags: 'mystery' },
  'fantasy':    { tags: 'fantasy' },
  'strategy':   { genres: 'strategy' },
  'stealth':    { tags: 'stealth' },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search games by name.
 * GET /games?search=QUERY&page_size=N
 */
export const searchGames = async (query, count = 12) => {
  const { data } = await rawg.get('/games', {
    params: {
      search:    query,
      page_size: count,
    },
  });
  return (data.results ?? []).map(normalizeGame);
};

/**
 * Recently-added / trending games.
 * GET /games?ordering=-added&page_size=N
 */
export const getTrendingGames = async (count = 12) => {
  const { data } = await rawg.get('/games', {
    params: {
      ordering:  '-added',
      page_size: count,
    },
  });
  return (data.results ?? []).map(normalizeGame);
};

/**
 * Top-rated games.
 * GET /games?ordering=-rating&page_size=N
 */
export const getTopRatedGames = async (count = 12) => {
  const { data } = await rawg.get('/games', {
    params: {
      ordering:  '-rating',
      page_size: count,
    },
  });
  return (data.results ?? []).map(normalizeGame);
};

// ─── Ordering map ─────────────────────────────────────────────────────────────

const ORDER_MAP = {
  relevance:  '-rating',   // best proxy for relevance when no text query
  rating:     '-rating',
  popularity: '-added',
  released:   '-released',
  metacritic: '-metacritic',
};

/**
 * Games matching ALL of the given category IDs (intersection / AND logic).
 * Accepts optional ordering and platform to pass straight to RAWG.
 * GET /games?genres=...&tags=...&ordering=...&platforms=...&page_size=40
 */
export const getGamesByMultiCategory = async (categoryIds, {
  count     = 40,
  ordering  = 'relevance',
  platform  = null,
  extraTags = [],
} = {}) => {
  const genreValues = [];
  const tagValues   = [...extraTags]; // seed with any directly-requested tag slugs

  for (const id of categoryIds) {
    const p = CATEGORY_PARAMS[id];
    if (!p) continue;
    if (p.genres) genreValues.push(p.genres);
    if (p.tags)   tagValues.push(p.tags);
  }

  const params = {
    ordering:  ORDER_MAP[ordering] ?? '-rating',
    page_size: count,
  };
  if (genreValues.length) params.genres    = genreValues.join(',');
  if (tagValues.length)   params.tags      = tagValues.join(',');
  if (platform)           params.platforms = platform;

  const { data } = await rawg.get('/games', { params });
  return (data.results ?? []).map(normalizeGame);
};

/**
 * Games by category (genre or tag).
 * GET /games?genres=...&ordering=-rating&page_size=20
 */
export const getGamesByCategory = async (categoryId, count = 20) => {
  const extra = CATEGORY_PARAMS[categoryId];
  if (!extra) {
    // Unknown category — fall back to top-rated
    return getTopRatedGames(count);
  }

  const { data } = await rawg.get('/games', {
    params: {
      ...extra,
      ordering:  '-rating',
      page_size: count,
    },
  });

  return (data.results ?? []).map(normalizeGame);
};
