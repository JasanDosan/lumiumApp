import { AppError } from '../middleware/errorHandler.js';
import { findUserById, pushLibraryItem, pullLibraryItem, setLibraryItemField } from '../repositories/userRepository.js';

const ALLOWED_UPDATE_FIELDS = ['rating', 'emoji'];

export const getLibrary = async (req, res, next) => {
  try {
    const user = await findUserById(req.user._id);
    console.log('GET LIBRARY:', user.library.length, 'items for user', req.user._id);
    res.json(user.library);
  } catch (error) {
    next(error);
  }
};

export const addToLibrary = async (req, res, next) => {
  try {
    console.log('ADD:', req.body);

    const { id, type, title, image, rating, genres, tags, rawId,
            tmdbId, posterPath, backdropUrl, posterUrl, releaseDate, emoji } = req.body;

    if (!type || !title) {
      throw new AppError('type and title are required.', 400);
    }
    if (!['game', 'movie', 'series'].includes(type)) {
      throw new AppError('type must be game, movie, or series.', 400);
    }

    // Normalize ID to prevent collisions across sources
    const normalizedId = `${type}_${rawId || tmdbId || id}`;

    // Fetch fresh user — req.user is stale after previous writes
    const user = await findUserById(req.user._id);
    console.log('USER LIBRARY:', user.library.map(i => i.id));

    const alreadyAdded = user.library.some(item => item.id === normalizedId);
    if (alreadyAdded) return res.json(user.library);

    const newItem = {
      id:          normalizedId,
      type,
      title,
      image:       image       ?? null,
      rating:      rating      ?? null,
      genres:      genres      ?? [],
      tags:        tags        ?? [],
      rawId:       rawId       ?? undefined,
      tmdbId:      tmdbId      ?? undefined,
      posterPath:  posterPath  ?? undefined,
      backdropUrl: backdropUrl ?? undefined,
      posterUrl:   posterUrl   ?? undefined,
      releaseDate: releaseDate ?? undefined,
      emoji:       emoji       ?? undefined,
      addedAt:     new Date(),
    };

    const updated = await pushLibraryItem(req.user._id, newItem);
    res.status(201).json(updated.library);
  } catch (error) {
    next(error);
  }
};

export const removeFromLibrary = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('REMOVE:', id, 'for user', req.user._id);

    const updated = await pullLibraryItem(req.user._id, id);
    res.json(updated.library);
  } catch (error) {
    next(error);
  }
};

export const updateLibraryItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Restrict to allowed fields only
    const updates = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(`Only ${ALLOWED_UPDATE_FIELDS.join(', ')} can be updated.`, 400);
    }

    const updated = await setLibraryItemField(req.user._id, id, updates);
    if (!updated) return next(new AppError('Library item not found.', 404));

    res.json(updated.library);
  } catch (error) {
    next(error);
  }
};
