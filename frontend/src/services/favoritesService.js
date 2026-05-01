/**
 * favoritesService.js
 * @deprecated Use libraryService (and libraryStore) for all new code.
 *
 * This shim re-routes legacy favorites calls through the current /library
 * endpoint so nothing breaks while old call sites are migrated.
 * It filters results to movie-type items so the returned shape matches
 * what callers of the old /users/favorites endpoint expected.
 */

import { libraryService } from './libraryService.js';
import { mapLegacyFavoriteToLibraryItem } from '@/utils/mediaMappers';

export const favoritesService = {
  /** Returns only movie items, matching the old favorites array shape. */
  getAll: () =>
    libraryService.getLibrary()
      .then(items => items.filter(i => i.type === 'movie')),

  /** Accepts a legacy favorite shape and upserts it via the library endpoint. */
  add: (movie) =>
    libraryService.addItem(mapLegacyFavoriteToLibraryItem(movie))
      .then(items => items.filter(i => i.type === 'movie')),

  /** Removes by compound movie ID derived from a raw tmdbId. */
  remove: (tmdbId) =>
    libraryService.removeItem(`movie_${Number(tmdbId)}`)
      .then(items => items.filter(i => i.type === 'movie')),
};
