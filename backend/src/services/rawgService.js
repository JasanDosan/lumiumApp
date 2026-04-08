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

// ─── Normalisation — list cards ───────────────────────────────────────────────

/**
 * Lean normalizer for list/search results.
 * Keeps only what cards need: id, name, image, rating, slugs.
 */
function normalizeGame(g) {
  const tags       = (g.genres ?? []).slice(0, 3).map(gen => gen.name);
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

// ─── Normalisation — full detail ──────────────────────────────────────────────

/**
 * Rich normalizer for the game detail page.
 * Preserves every RAWG field that the frontend can surface in a section.
 */
export function normalizeGameDetail(g) {
  const genres = (g.genres ?? []).map(gen => ({ id: gen.id, name: gen.name, slug: gen.slug }));
  const tags   = (g.tags   ?? [])
    .filter(t => t.language === 'eng')
    .sort((a, b) => b.games_count - a.games_count)
    .slice(0, 20)
    .map(t => ({ id: t.id, name: t.name, slug: t.slug }));

  const platforms = (g.platforms ?? []).map(p => ({
    id:           p.platform.id,
    name:         p.platform.slug === 'pc' ? 'PC' : p.platform.name,
    slug:         p.platform.slug,
    releasedAt:   p.released_at ?? null,
  }));

  const developers  = (g.developers  ?? []).map(d => ({ id: d.id, name: d.name, slug: d.slug }));
  const publishers  = (g.publishers  ?? []).map(p => ({ id: p.id, name: p.name, slug: p.slug }));

  const stores = (g.stores ?? []).map(s => ({
    id:     s.id,
    name:   s.store?.name ?? '',
    slug:   s.store?.slug ?? '',
    domain: s.store?.domain ?? '',
    url:    s.url ?? null,
  }));

  const esrb = g.esrb_rating
    ? { id: g.esrb_rating.id, name: g.esrb_rating.name, slug: g.esrb_rating.slug }
    : null;

  // Ratings breakdown (Exceptional / Recommended / Meh / Skip)
  const ratings = (g.ratings ?? []).map(r => ({
    id:      r.id,
    title:   r.title,
    count:   r.count,
    percent: r.percent,
  }));

  return {
    // ── Identity ───────────────────────────────────────────────────────────────
    id:                   String(g.id),
    rawgId:               String(g.id),
    name:                 g.name,
    title:                g.name,
    type:                 'game',

    // ── Images ────────────────────────────────────────────────────────────────
    backgroundImage:      g.background_image          ?? null,
    backgroundImageAlt:   g.background_image_additional ?? null,
    image:                g.background_image          ?? null,

    // ── Editorial ─────────────────────────────────────────────────────────────
    description:          g.description_raw           ?? null,   // plain text
    descriptionHtml:      g.description               ?? null,   // HTML (unused but preserved)
    released:             g.released                  ?? null,
    website:              g.website                   ?? null,
    metacritic:           g.metacritic                ?? null,
    metacriticUrl:        g.metacritic_url            ?? null,

    // ── Ratings ───────────────────────────────────────────────────────────────
    rating:               g.rating      ? parseFloat(g.rating.toFixed(2)) : null,
    ratingTop:            g.rating_top  ?? 5,
    ratingsCount:         g.ratings_count ?? 0,
    ratings,

    // ── Classification ─────────────────────────────────────────────────────────
    genres,
    tags,
    platforms,
    esrbRating:           esrb,

    // ── Credits ───────────────────────────────────────────────────────────────
    developers,
    publishers,
    stores,

    // ── Community ─────────────────────────────────────────────────────────────
    redditUrl:            g.reddit_url   ?? null,
    redditName:           g.reddit_name  ?? null,
    redditCount:          g.reddit_count ?? null,

    // ── Stats ─────────────────────────────────────────────────────────────────
    achievementsCount:    g.achievements_count ?? null,
    playtimeAvg:          g.playtime           ?? null,   // avg hours from RAWG community
    screenshotsCount:     g.screenshots_count  ?? 0,
    addedByStatus:        g.added_by_status    ?? null,

    // ── Flags ─────────────────────────────────────────────────────────────────
    emoji:                '🎮',
    _rawg:                true,
  };
}

// ─── Category → RAWG param mapping ───────────────────────────────────────────

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

// ─── Public API — list endpoints ──────────────────────────────────────────────

export const searchGames = async (query, count = 12) => {
  const { data } = await rawg.get('/games', {
    params: { search: query, page_size: count },
  });
  return (data.results ?? []).map(normalizeGame);
};

export const getTrendingGames = async (count = 12) => {
  const { data } = await rawg.get('/games', {
    params: { ordering: '-added', page_size: count },
  });
  return (data.results ?? []).map(normalizeGame);
};

export const getTopRatedGames = async (count = 12) => {
  const { data } = await rawg.get('/games', {
    params: { ordering: '-rating', page_size: count },
  });
  return (data.results ?? []).map(normalizeGame);
};

const ORDER_MAP = {
  relevance:  '-rating',
  rating:     '-rating',
  popularity: '-added',
  released:   '-released',
  metacritic: '-metacritic',
};

export const getGamesByMultiCategory = async (categoryIds, {
  count     = 40,
  ordering  = 'relevance',
  platform  = null,
  extraTags = [],
} = {}) => {
  const genreValues = [];
  const tagValues   = [...extraTags];

  for (const id of categoryIds) {
    const p = CATEGORY_PARAMS[id];
    if (!p) continue;
    if (p.genres) genreValues.push(p.genres);
    if (p.tags)   tagValues.push(p.tags);
  }

  const params = { ordering: ORDER_MAP[ordering] ?? '-rating', page_size: count };
  if (genreValues.length) params.genres    = genreValues.join(',');
  if (tagValues.length)   params.tags      = tagValues.join(',');
  if (platform)           params.platforms = platform;

  const { data } = await rawg.get('/games', { params });
  return (data.results ?? []).map(normalizeGame);
};

export const getGamesByCategory = async (categoryId, count = 20) => {
  const extra = CATEGORY_PARAMS[categoryId];
  if (!extra) return getTopRatedGames(count);

  const { data } = await rawg.get('/games', {
    params: { ...extra, ordering: '-rating', page_size: count },
  });
  return (data.results ?? []).map(normalizeGame);
};

// ─── Public API — detail endpoints ───────────────────────────────────────────

/**
 * Full game detail by RAWG numeric ID.
 * GET /games/{id}
 */
export const getGameDetails = async (rawgId) => {
  const { data } = await rawg.get(`/games/${rawgId}`);
  return normalizeGameDetail(data);
};

/**
 * Screenshots for a game.
 * GET /games/{id}/screenshots
 * Returns array of { id, image, width, height }
 */
export const getGameScreenshots = async (rawgId) => {
  try {
    const { data } = await rawg.get(`/games/${rawgId}/screenshots`);
    return (data.results ?? []).map(s => ({
      id:     s.id,
      image:  s.image,
      width:  s.width,
      height: s.height,
    }));
  } catch {
    return [];
  }
};

/**
 * Games in the same series (sequels, prequels, remakes).
 * GET /games/{id}/game-series
 */
export const getGameSeries = async (rawgId, count = 10) => {
  try {
    const { data } = await rawg.get(`/games/${rawgId}/game-series`, {
      params: { page_size: count },
    });
    return (data.results ?? []).map(normalizeGame);
  } catch {
    return [];
  }
};
