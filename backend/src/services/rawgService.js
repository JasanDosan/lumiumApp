import axios from 'axios';

const rawg = axios.create({
  baseURL: process.env.RAWG_BASE_URL || 'https://api.rawg.io/api',
  params:  { key: process.env.RAWG_API_KEY },
  timeout: 10000,
});

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Convert a raw RAWG game object into the unified shape expected by the frontend.
 * Shape mirrors the GAME_CATALOG entries: { id, name, title, type, image, emoji, rating, tags }
 */
function normalizeGame(g) {
  const tags = (g.genres ?? []).slice(0, 3).map(gen => gen.name);
  return {
    id:      String(g.id),
    name:    g.name,
    title:   g.name,          // UnifiedCard uses item.title ?? item.name
    type:    'game',
    image:   g.background_image ?? null,
    emoji:   '🎮',
    rating:  g.rating ? parseFloat(g.rating.toFixed(1)) : null,
    tags,
    price:   null,
    tagline: tags.join(' · '),
    _rawg:   true,
  };
}

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
  // data.results — axios puts the parsed JSON body in data
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
