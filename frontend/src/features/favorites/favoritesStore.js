import { create } from 'zustand';
import { favoritesService } from '@/services/favoritesService';
import { getToken } from '@/services/tokenStore';

// Use tokenStore instead of importing authStore — avoids a circular dependency.
// Presence of a token is equivalent to isAuthenticated for this store's purposes.
const isAuthenticated = () => !!getToken();

const LS_KEY = 'cm_favorites_local';

const loadFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const saveToLocalStorage = (favorites) => {
  localStorage.setItem(LS_KEY, JSON.stringify(favorites));
};

export const useFavoritesStore = create((set, get) => ({
  favorites: [],
  isLoading: false,
  synced: false, // true once backend has been fetched

  isFavorite: (tmdbId) =>
    get().favorites.some(f => f.tmdbId === Number(tmdbId)),

  init: async () => {
    const authenticated = isAuthenticated();

    if (authenticated) {
      set({ isLoading: true });
      try {
        const favorites = await favoritesService.getAll();
        set({ favorites, isLoading: false, synced: true });
      } catch {
        // Fallback: merge local storage
        set({ favorites: loadFromLocalStorage(), isLoading: false });
      }
    } else {
      set({ favorites: loadFromLocalStorage(), synced: false });
    }
  },

  add: async (movie) => {
    const authenticated = isAuthenticated();
    const movieData = {
      tmdbId: Number(movie.tmdbId),
      title: movie.title,
      posterPath: movie.posterPath,
      rating: movie.rating,
    };

    // Optimistic update
    set(state => ({ favorites: [...state.favorites, { ...movieData, addedAt: new Date().toISOString() }] }));

    if (authenticated) {
      try {
        const updated = await favoritesService.add(movieData);
        set({ favorites: updated });
      } catch {
        // Rollback
        set(state => ({ favorites: state.favorites.filter(f => f.tmdbId !== movieData.tmdbId) }));
      }
    } else {
      saveToLocalStorage(get().favorites);
    }
  },

  remove: async (tmdbId) => {
    const authenticated = isAuthenticated();
    const prev = get().favorites;

    // Optimistic update
    set(state => ({ favorites: state.favorites.filter(f => f.tmdbId !== Number(tmdbId)) }));

    if (authenticated) {
      try {
        const updated = await favoritesService.remove(tmdbId);
        set({ favorites: updated });
      } catch {
        set({ favorites: prev }); // rollback
      }
    } else {
      saveToLocalStorage(get().favorites);
    }
  },

  reset: () => set({ favorites: [], synced: false }),
}));
