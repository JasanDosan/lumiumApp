/**
 * mediaMappers.js — client-side mapper utilities
 *
 * Thin semantic wrappers around the libraryStore normalizers.
 * Prefer these over calling normalizeMovie/normalizeGame directly in components
 * so the intent is explicit at the call site.
 *
 * Usage:
 *   import { mapTmdbMovieToLibraryItem } from '@/utils/mediaMappers';
 *   const item = mapTmdbMovieToLibraryItem(tmdbMovie);
 *   addItem(item);
 */

import {
  normalizeMovie,
  normalizeGame,
  normalizeSeries,
} from '@/features/library/libraryStore';

// ─── TMDB ─────────────────────────────────────────────────────────────────────

/** Convert a TMDB movie API response into a unified library item. */
export const mapTmdbMovieToLibraryItem  = (movie)  => normalizeMovie(movie);

/** Convert a TMDB series API response into a unified library item. */
export const mapTmdbSeriesToLibraryItem = (series) => normalizeSeries(series);

// ─── RAWG ─────────────────────────────────────────────────────────────────────

/** Convert a RAWG game API response into a unified library item. */
export const mapRawgGameToLibraryItem   = (game)   => normalizeGame(game);

// ─── Legacy migration ─────────────────────────────────────────────────────────

/**
 * Convert a legacy favorites item (old shape: { tmdbId, title, posterPath, rating })
 * into the current library item schema.
 *
 * Use this when reading data persisted before the library refactor, e.g., items
 * loaded from a v1 localStorage snapshot or returned by the old /users/favorites
 * endpoint.
 */
export function mapLegacyFavoriteToLibraryItem(favorite) {
  return normalizeMovie({
    tmdbId:     favorite.tmdbId ?? favorite.id,
    title:      favorite.title,
    posterPath: favorite.posterPath ?? null,
    rating:     favorite.rating ?? null,
    addedAt:    favorite.addedAt ?? null,
  });
}
