/**
 * useUserLibraryStore — single source of truth for games, movies, and series.
 *
 * Data flow for mutations:
 *   1. Optimistic update → state changes immediately, UI reacts
 *   2. Await backend → state is replaced with authoritative server response
 *   3. On error → rollback to pre-mutation snapshot
 *
 * Exported as both `useUserLibraryStore` (canonical) and `useLibraryStore`
 * (backward-compat alias so no import changes are needed in existing components).
 */

import { create } from 'zustand';
import { libraryService } from '@/services/libraryService';
import { getToken } from '@/services/tokenStore';

const LS_KEY = 'pm_library_v2';

// ─── Normalizers (exported so components can build items before calling addItem) ──

export function normalizeGame(g) {
  const rawId = String(g.id ?? g.rawId ?? '');
  return {
    id:         `game_${rawId}`,
    type:       'game',
    title:      g.name ?? g.title ?? '',
    image:      g.image ?? g.background_image ?? null,
    rating:     g.rating ?? null,
    genres:     [],
    tags:       g.tags ?? [],
    rawId,
    emoji:      g.emoji ?? null,
    addedAt:    g.addedAt ?? new Date().toISOString(),
  };
}

export function normalizeMovie(m) {
  const tmdbId = Number(m.tmdbId ?? m.id);
  return {
    id:         `movie_${tmdbId}`,
    type:       'movie',
    title:      m.title ?? m.name ?? '',
    image:      m.posterPath
                  ? `https://image.tmdb.org/t/p/w500${m.posterPath}`
                  : (m.posterUrl ?? m.image ?? null),
    rating:     m.rating      ?? null,
    genres:     m.genre_ids   ?? m.genreIds ?? m.genres ?? [],
    tags:       [],
    tmdbId,
    posterPath:  m.posterPath  ?? null,
    backdropUrl: m.backdropUrl ?? null,
    posterUrl:   m.posterUrl   ?? null,
    releaseDate: m.releaseDate ?? null,
    addedAt:     m.addedAt     ?? new Date().toISOString(),
  };
}

export function normalizeSeries(s) {
  const tmdbId = Number(s.tmdbId ?? s.id);
  return {
    id:         `series_${tmdbId}`,
    type:       'series',
    title:      s.title ?? s.name ?? '',
    image:      s.posterPath
                  ? `https://image.tmdb.org/t/p/w500${s.posterPath}`
                  : (s.posterUrl ?? s.image ?? null),
    rating:     s.rating      ?? null,
    genres:     s.genre_ids   ?? s.genreIds ?? s.genres ?? [],
    tags:       [],
    tmdbId,
    posterPath:  s.posterPath  ?? null,
    backdropUrl: s.backdropUrl ?? null,
    posterUrl:   s.posterUrl   ?? null,
    releaseDate: s.releaseDate ?? s.firstAirDate ?? null,
    addedAt:     s.addedAt     ?? new Date().toISOString(),
  };
}

/** Generic normalizer for use in components: `addItem(normalizeItem(data, 'movie'))` */
export function normalizeItem(item, type) {
  if (type === 'game')   return normalizeGame(item);
  if (type === 'movie')  return normalizeMovie(item);
  if (type === 'series') return normalizeSeries(item);
  throw new Error(`Unknown library item type: ${type}`);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function lsSave(library) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(library)); } catch { /* ignore */ }
}

function loadInitial() {
  const saved = lsLoad();
  if (saved && Array.isArray(saved)) return saved;

  // Migrate from split v1 format { games, movies, series }
  try {
    const v1 = JSON.parse(localStorage.getItem('pm_library_v1') ?? 'null');
    if (v1 && (v1.games || v1.movies || v1.series)) {
      const migrated = [
        ...(v1.games  ?? []).map(normalizeGame),
        ...(v1.movies ?? []).map(normalizeMovie),
        ...(v1.series ?? []).map(normalizeSeries),
      ];
      lsSave(migrated);
      return migrated;
    }
  } catch { /* ignore */ }

  // Migrate from original games-only key
  try {
    const oldGames = JSON.parse(localStorage.getItem('pm_my_games') ?? '[]');
    if (Array.isArray(oldGames) && oldGames.length > 0) {
      const migrated = oldGames.map(normalizeGame);
      lsSave(migrated);
      return migrated;
    }
  } catch { /* ignore */ }

  return [];
}

// ─── Derived slices ───────────────────────────────────────────────────────────

const derive = (library) => ({
  games:  library.filter(i => i.type === 'game'),
  movies: library.filter(i => i.type === 'movie'),
  series: library.filter(i => i.type === 'series'),
});

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserLibraryStore = create((set, get) => {
  const initial = loadInitial();

  /** Apply a new library array to both state and localStorage. */
  const apply = (library) => {
    lsSave(library);
    set({ library, ...derive(library) });
  };

  return {
    library:   initial,
    ...derive(initial),
    loading:   false,
    error:     null,

    // ── Fetch (called on auth / app init) ─────────────────────────────────────
    async fetchLibrary() {
      if (!getToken()) return;
      set({ loading: true, error: null });
      try {
        const library = await libraryService.getLibrary();
        apply(library);
      } catch (err) {
        set({ error: err.message ?? 'Failed to load library' });
      } finally {
        set({ loading: false });
      }
    },

    // ── addItem ───────────────────────────────────────────────────────────────
    async addItem(item) {
      const snapshot = get().library;

      // Optimistic: add immediately so UI reflects the change without waiting
      if (!snapshot.some(i => i.id === item.id)) {
        apply([item, ...snapshot]);
      }

      if (!getToken()) return; // guest: keep local state only

      try {
        const updated = await libraryService.addItem(item);
        apply(updated); // authoritative response from backend
      } catch (err) {
        apply(snapshot); // rollback
        set({ error: err.message ?? 'Failed to add item' });
      }
    },

    // ── removeItem ────────────────────────────────────────────────────────────
    async removeItem(id) {
      const snapshot = get().library;

      // Optimistic: remove immediately
      apply(snapshot.filter(i => i.id !== id));

      if (!getToken()) return;

      try {
        const updated = await libraryService.removeItem(id);
        apply(updated);
      } catch (err) {
        apply(snapshot); // rollback
        set({ error: err.message ?? 'Failed to remove item' });
      }
    },

    // ── updateItem ────────────────────────────────────────────────────────────
    async updateItem(id, data) {
      if (!getToken()) return;
      try {
        const updated = await libraryService.updateItem(id, data);
        apply(updated);
      } catch (err) {
        set({ error: err.message ?? 'Failed to update item' });
      }
    },

    // ── Membership checks ─────────────────────────────────────────────────────
    hasItem:   (id)     => get().library.some(i => i.id === id),
    hasGame:   (id)     => get().library.some(i => i.id === `game_${id}`),
    hasMovie:  (tmdbId) => get().library.some(i => i.id === `movie_${Number(tmdbId)}`),
    hasSeries: (tmdbId) => get().library.some(i => i.id === `series_${Number(tmdbId)}`),

    // ── Typed convenience wrappers (backward compat) ──────────────────────────
    addGame:     (game)   => get().addItem(normalizeGame(game)),
    removeGame:  (id)     => get().removeItem(`game_${id}`),
    toggleGame(gameOrId) {
      if (typeof gameOrId === 'object' && gameOrId !== null) {
        const id = String(gameOrId.id ?? gameOrId.rawId);
        get().hasGame(id) ? get().removeGame(id) : get().addGame(gameOrId);
      } else {
        const id = String(gameOrId);
        if (get().hasGame(id)) get().removeGame(id);
      }
    },

    addMovie:    (movie)  => get().addItem(normalizeMovie(movie)),
    removeMovie: (tmdbId) => get().removeItem(`movie_${Number(tmdbId)}`),
    toggleMovie(movie) {
      const tmdbId = Number(movie.tmdbId ?? movie.id);
      get().hasMovie(tmdbId) ? get().removeMovie(tmdbId) : get().addMovie(movie);
    },

    addSeries:    (s)      => get().addItem(normalizeSeries(s)),
    removeSeries: (tmdbId) => get().removeItem(`series_${Number(tmdbId)}`),
    toggleSeries(s) {
      const tmdbId = Number(s.tmdbId ?? s.id);
      get().hasSeries(tmdbId) ? get().removeSeries(tmdbId) : get().addSeries(s);
    },

    // init is an alias kept for Layout.jsx backward compat
    init() { return get().fetchLibrary(); },
  };
});

// Backward-compat alias — all existing `useLibraryStore` imports continue to work
export const useLibraryStore = useUserLibraryStore;
