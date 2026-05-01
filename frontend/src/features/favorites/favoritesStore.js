/**
 * Deprecated — logic moved to libraryStore (useLibraryStore).
 * This shim keeps any remaining imports from breaking.
 */
import { create } from 'zustand';

export const useFavoritesStore = create(() => ({
  favorites:  [],
  isLoading:  false,
  synced:     false,
  isFavorite: () => false,
  init:       async () => {},
  add:        async () => {},
  remove:     async () => {},
  reset:      () => {},
}));
