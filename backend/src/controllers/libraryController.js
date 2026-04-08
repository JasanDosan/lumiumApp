import { AppError } from '../middleware/errorHandler.js';
import {
  findUserById,
  pushLibraryItem,
  pullLibraryItem,
  setLibraryItemField,
} from '../repositories/userRepository.js';

const VALID_TYPES   = ['game', 'movie', 'series'];
const VALID_SOURCES = ['tmdb', 'rawg', 'steam', 'manual'];

// Fields a PATCH can mutate (everything else is immutable after insert)
const ALLOWED_UPDATE_FIELDS = ['rating', 'emoji', 'metadata'];

/**
 * Derive the compound `id` from whatever identifying fields the client sends.
 * Priority: explicit `id` field → type + externalId → type + rawId/tmdbId.
 * Returns null if no usable ID can be derived.
 */
function deriveId(type, body) {
  if (body.id && String(body.id).includes('_')) return body.id; // already compound
  const raw = body.externalId ?? body.rawId ?? body.tmdbId ?? body.id;
  if (!raw) return null;
  return `${type}_${raw}`;
}

// ─── GET /library ─────────────────────────────────────────────────────────────

export const getLibrary = async (req, res, next) => {
  try {
    const user = await findUserById(req.user._id);
    res.json(user.library);
  } catch (error) {
    next(error);
  }
};

// ─── POST /library ────────────────────────────────────────────────────────────

export const addToLibrary = async (req, res, next) => {
  try {
    const {
      // Identity
      type, externalId, source,
      // Display
      title, imageUrl, image,
      // Classification
      rating, genres, tags,
      // TMDB-specific
      rawId, tmdbId, posterPath, backdropUrl, posterUrl, releaseDate,
      // UI
      emoji,
      // Extensible payload
      metadata,
    } = req.body;

    if (!type || !title) throw new AppError('type and title are required.', 400);
    if (!VALID_TYPES.includes(type)) {
      throw new AppError(`type must be one of: ${VALID_TYPES.join(', ')}.`, 400);
    }

    const normalizedId = deriveId(type, req.body);
    if (!normalizedId) throw new AppError('A unique item ID could not be derived. Provide id, externalId, tmdbId, or rawId.', 400);

    const user = await findUserById(req.user._id);
    if (user.library.some(item => item.id === normalizedId)) {
      return res.json(user.library); // idempotent — already in library
    }

    // Resolve imageUrl: prefer explicit imageUrl, fall back to legacy image field
    const resolvedImageUrl = imageUrl ?? image ?? null;

    // Resolve source: explicit > infer from type
    const resolvedSource = source && VALID_SOURCES.includes(source)
      ? source
      : type === 'game' ? 'rawg' : 'tmdb';

    const newItem = {
      id:          normalizedId,
      externalId:  externalId ?? String(rawId ?? tmdbId ?? ''),
      source:      resolvedSource,
      type,
      title,
      imageUrl:    resolvedImageUrl,
      image:       resolvedImageUrl,      // keep in sync for backward compat
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
      metadata:    metadata    ?? {},
      addedAt:     new Date(),
    };

    const updated = await pushLibraryItem(req.user._id, newItem);
    res.status(201).json(updated.library);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /library/:id ──────────────────────────────────────────────────────

export const removeFromLibrary = async (req, res, next) => {
  try {
    const updated = await pullLibraryItem(req.user._id, req.params.id);
    res.json(updated.library);
  } catch (error) {
    next(error);
  }
};

// ─── PUT /library/:id ─────────────────────────────────────────────────────────

export const updateLibraryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
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
