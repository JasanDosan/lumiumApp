import * as rawg from '../services/rawgService.js';

export const getByCategory = async (req, res, next) => {
  try {
    const { category, count = 20 } = req.query;
    if (!category?.trim()) return res.json({ results: [] });
    const results = await rawg.getGamesByCategory(category.trim(), Number(count));
    res.json({ results });
  } catch (error) {
    next(error);
  }
};

export const getMultiCategory = async (req, res, next) => {
  try {
    const { categories, count = 40, ordering = 'relevance', platform, tags } = req.query;
    const ids       = (categories ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const extraTags = (tags       ?? '').split(',').map(s => s.trim()).filter(Boolean);

    if (!ids.length && !extraTags.length) return res.json({ results: [] });

    const results = await rawg.getGamesByMultiCategory(ids, {
      count:     Number(count),
      ordering,
      platform:  platform ? Number(platform) : null,
      extraTags,
    });
    res.json({ results });
  } catch (error) {
    next(error);
  }
};

export const search = async (req, res, next) => {
  try {
    const { q, count = 12 } = req.query;
    if (!q?.trim()) return res.json({ results: [] });
    const results = await rawg.searchGames(q.trim(), Number(count));
    res.json({ results });
  } catch (error) {
    next(error);
  }
};

export const getTrending = async (req, res, next) => {
  try {
    const { count = 12 } = req.query;
    const results = await rawg.getTrendingGames(Number(count));
    res.json({ results });
  } catch (error) {
    next(error);
  }
};

export const getTopRated = async (req, res, next) => {
  try {
    const { count = 12 } = req.query;
    const results = await rawg.getTopRatedGames(Number(count));
    res.json({ results });
  } catch (error) {
    next(error);
  }
};

// ─── Detail endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/games/:id
 * Returns full RAWG game detail — normalizeGameDetail() shape.
 */
export const getDetails = async (req, res, next) => {
  try {
    const game = await rawg.getGameDetails(req.params.id);

    // Fetch screenshots in parallel — non-fatal if it fails
    const screenshots = await rawg.getGameScreenshots(req.params.id);

    res.json({ ...game, screenshots });
  } catch (error) {
    // 404 from RAWG → surface clearly
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Game not found on RAWG.' });
    }
    next(error);
  }
};

/**
 * GET /api/games/:id/similar
 * Returns games in the same series (sequels, prequels, remakes).
 */
export const getSimilar = async (req, res, next) => {
  try {
    const results = await rawg.getGameSeries(req.params.id);
    res.json({ results });
  } catch (error) {
    next(error);
  }
};
