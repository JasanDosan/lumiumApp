import { updateUserFavorites } from '../repositories/userRepository.js';
import { AppError } from '../middleware/errorHandler.js';

export const getFavorites = (req, res) => {
  res.json({ favorites: req.user.favorites });
};

export const addFavorite = async (req, res, next) => {
  try {
    const { tmdbId, title, posterPath, rating } = req.body;
    if (!tmdbId || !title) throw new AppError('tmdbId and title are required.', 400);

    const parsedId = Number(tmdbId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new AppError('tmdbId must be a positive integer.', 400);
    }

    const alreadyAdded = req.user.favorites.some(f => f.tmdbId === parsedId);
    if (alreadyAdded) return res.json({ favorites: req.user.favorites });

    const newFavorite = { tmdbId: parsedId, title, posterPath, rating, addedAt: new Date() };
    const updatedFavorites = [...req.user.favorites, newFavorite];

    const user = await updateUserFavorites(req.user._id, updatedFavorites);
    res.json({ favorites: user.favorites });
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const parsedId = Number(tmdbId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return next(new AppError('Invalid tmdbId.', 400));
    }
    const updatedFavorites = req.user.favorites.filter(f => f.tmdbId !== parsedId);

    const user = await updateUserFavorites(req.user._id, updatedFavorites);
    res.json({ favorites: user.favorites });
  } catch (error) {
    next(error);
  }
};

export const getRecommendationHistory = (req, res) => {
  res.json({ history: req.user.recommendationHistory });
};
