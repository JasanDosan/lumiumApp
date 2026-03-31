import * as tmdb from '../services/tmdbService.js';
import { generateForUser } from '../services/recommendationService.js';

export const search = async (req, res, next) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q?.trim()) return res.json({ results: [], totalResults: 0, totalPages: 0, page: 1 });
    const data = await tmdb.searchMovies(q.trim(), Number(page));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getTrending = async (req, res, next) => {
  try {
    const { window = 'week' } = req.query;
    const movies = await tmdb.getTrending(window);
    res.json({ results: movies });
  } catch (error) {
    next(error);
  }
};

export const getPopular = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const movies = await tmdb.getPopularMovies(Number(page));
    res.json({ results: movies });
  } catch (error) {
    next(error);
  }
};

export const getDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movie = await tmdb.getMovieDetails(Number(id));
    res.json(movie);
  } catch (error) {
    next(error);
  }
};

export const getSimilar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movies = await tmdb.getSimilarMovies(Number(id));
    res.json({ results: movies });
  } catch (error) {
    next(error);
  }
};

export const getRecommendations = async (req, res, next) => {
  try {
    const recommendations = await generateForUser(req.user);
    res.json({ results: recommendations, count: recommendations.length });
  } catch (error) {
    next(error);
  }
};

export const getGenres = async (req, res, next) => {
  try {
    const genres = await tmdb.getGenres();
    res.json({ genres });
  } catch (error) {
    next(error);
  }
};

export const discover = async (req, res, next) => {
  try {
    const {
      page = 1, genres, year_gte, year_lte, rating_gte, sort_by,
      with_person, with_watch_providers, watch_region,
    } = req.query;
    const data = await tmdb.discoverMovies({
      page: Number(page),
      genres: genres ? genres.split(',').map(Number) : undefined,
      year_gte: year_gte ? Number(year_gte) : undefined,
      year_lte: year_lte ? Number(year_lte) : undefined,
      rating_gte: rating_gte ? Number(rating_gte) : undefined,
      sort_by,
      with_person: with_person ? Number(with_person) : undefined,
      with_watch_providers: with_watch_providers || undefined,
      watch_region: watch_region || undefined,
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getProviders = async (req, res, next) => {
  try {
    const { region = 'US' } = req.query;
    const providers = await tmdb.getWatchProviders(region.toUpperCase());
    res.json({ providers });
  } catch (error) {
    next(error);
  }
};

export const searchMulti = async (req, res, next) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q?.trim()) return res.json({ movies: [], people: [] });
    const data = await tmdb.searchMulti(q.trim(), Number(page));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getMovieTmdbRecs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movies = await tmdb.getMovieRecommendations(Number(id));
    res.json({ results: movies });
  } catch (error) {
    next(error);
  }
};

export const getMovieCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await tmdb.getCollection(Number(id));
    res.json(data);
  } catch (error) {
    next(error);
  }
};
