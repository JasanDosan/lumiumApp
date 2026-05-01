import * as tmdb from '../services/tmdbService.js';

export const getDetails = async (req, res, next) => {
  try {
    const show = await tmdb.getTVDetails(req.params.id);
    res.json(show);
  } catch (error) {
    next(error);
  }
};

export const getSimilar = async (req, res, next) => {
  try {
    const similar = await tmdb.getSimilarTV(req.params.id);
    res.json({ results: similar });
  } catch (error) {
    next(error);
  }
};

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

export const getTopRated = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const shows = await tmdb.getTopRatedTV(Number(page));
    res.json({ results: shows });
  } catch (error) {
    next(error);
  }
};

export const getOnAir = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const shows = await tmdb.getOnAirTV(Number(page));
    res.json({ results: shows });
  } catch (error) {
    next(error);
  }
};

export const discoverTV = async (req, res, next) => {
  try {
    const { page = 1, genres, sort_by, rating_gte, year_gte, year_lte } = req.query;
    const result = await tmdb.discoverTV({
      page: Number(page),
      genres: genres ? genres.split(',').map(Number) : undefined,
      sort_by,
      rating_gte: rating_gte ? Number(rating_gte) : undefined,
      year_gte,
      year_lte,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
