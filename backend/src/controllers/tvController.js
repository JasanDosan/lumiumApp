import * as tmdb from '../services/tmdbService.js';

export const getTrending = async (req, res, next) => {
  try {
    const { window = 'week' } = req.query;
    const shows = await tmdb.getTrendingTV(window);
    res.json({ results: shows });
  } catch (error) {
    next(error);
  }
};

export const getPopular = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const shows = await tmdb.getPopularTV(Number(page));
    res.json({ results: shows });
  } catch (error) {
    next(error);
  }
};

export const discoverTV = async (req, res, next) => {
  try {
    const { page = 1, genres, sort_by, rating_gte } = req.query;
    const result = await tmdb.discoverTV({
      page: Number(page),
      genres: genres ? genres.split(',').map(Number) : undefined,
      sort_by,
      rating_gte: rating_gte ? Number(rating_gte) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
