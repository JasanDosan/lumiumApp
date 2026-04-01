/**
 * RAWG Video Games Database API
 * https://rawg.io/apidocs
 *
 * Requires VITE_RAWG_API_KEY in frontend/.env
 * Get a free key at https://rawg.io/apidocs
 */

const RAWG_BASE = 'https://api.rawg.io/api';
const KEY = import.meta.env.VITE_RAWG_API_KEY;

function normalizeRawgGame(g) {
  return {
    // shape compatible with UnifiedCard type="game"
    id:     String(g.id),
    name:   g.name,
    image:  g.background_image ?? null,
    emoji:  '🎮',
    rating: g.rating ? parseFloat(g.rating.toFixed(1)) : null,
    tags:   (g.genres ?? []).slice(0, 3).map(gen => gen.name),
    price:  null,          // RAWG doesn't provide price
    tagline: g.genres?.map(gen => gen.name).join(' · ') ?? '',
    // No meta — RAWG games can't drive TMDB discovery
    _rawg: true,
  };
}

async function rawgGet(endpoint, params = {}) {
  if (!KEY) throw new Error('VITE_RAWG_API_KEY not set');
  const url = new URL(`${RAWG_BASE}${endpoint}`);
  url.searchParams.set('key', KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return res.json();
}

export const rawgService = {
  /** Trending/recently-added games */
  getTrending: async (count = 12) => {
    const data = await rawgGet('/games', {
      ordering:  '-added',
      page_size: count,
    });
    return (data.results ?? []).map(normalizeRawgGame);
  },

  /** Top-rated games */
  getTopRated: async (count = 12) => {
    const data = await rawgGet('/games', {
      ordering:  '-rating',
      page_size: count,
    });
    return (data.results ?? []).map(normalizeRawgGame);
  },
};
