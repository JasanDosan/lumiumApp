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

    // Require at least one of: category IDs or extra tags
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
