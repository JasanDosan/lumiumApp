import * as rawg from '../services/rawgService.js';

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
