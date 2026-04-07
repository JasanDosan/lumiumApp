/**
 * libraryStore.js — single source of truth for saved media (games, movies, series).
 *
 * Responsibilities:
 *   - Library items state + typed derived slices (games, movies, series)
 *   - localStorage persistence (guest fallback + migration from legacy keys)
 *   - Optimistic mutations with snapshot rollback on backend error
 *   - Backend sync (fetchLibrary, addItem, removeItem, updateItem)
 *   - Auth coordination hooks (onAuthLogin, onAuthLogout — called by authStore)
 *
 * What it does NOT own:
 *   - Session / token state → authStore
 *   - API request logic → libraryService
 *
 * Sync lifecycle:
 *   Guest  → localStorage only                     syncStatus: 'idle'
 *   Login  → authStore calls onAuthLogin()          syncStatus: 'syncing' → 'synced'
 *   Logout → authStore calls onAuthLogout()         syncStatus: 'idle'
 *   Error  → backend call fails, state rolled back  syncStatus: 'error'
 *
 * Exports:
 *   useUserLibraryStore  — canonical store hook
 *   useLibraryStore      — backward-compat alias (all existing imports still work)
 *   normalizeGame / normalizeMovie / normalizeSeries / normalizeItem — item builders
 *   selectIsSaved(id)            — selector factory for subscription use
 *   selectSavedCountByType(type) — selector factory for subscription use
 */

import { create } from 'zustand';
import { libraryService } from '@/services/libraryService';
import { getToken } from '@/services/tokenStore';

const LS_KEY = 'pm_library_v2';

// ─── Normalizers ──────────────────────────────────────────────────────────────
// Exported so components can build correctly-shaped items before calling addItem.

export function normalizeGame(g) {
  const rawId    = String(g.id ?? g.rawId ?? '');
  const imageUrl = g.background_image ?? g.image ?? g.imageUrl ?? null;
  return {
    id:         `game_${rawId}`,
    externalId: rawId,
    source:     'rawg',
    type:       'game',
    title:      g.name ?? g.title ?? '',
    imageUrl,
    image:      imageUrl,       // legacy alias
    rating:     g.rating  ?? null,
    genres:     [],
    tags:       g.tags    ?? [],
    rawId,
    emoji:      g.emoji   ?? null,
    metadata:   g.metadata ?? {},
    addedAt:    g.addedAt ?? new Date().toISOString(),
  };
}

export function normalizeMovie(m) {
  const tmdbId     = Number(m.tmdbId ?? m.id);
  const posterPath = m.posterPath ?? null;
  const imageUrl   = posterPath
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : (m.posterUrl ?? m.imageUrl ?? m.image ?? null);
  return {
    id:          `movie_${tmdbId}`,
    externalId:  String(tmdbId),
    source:      'tmdb',
    type:        'movie',
    title:       m.title ?? m.name ?? '',
    imageUrl,
    image:       imageUrl,      // legacy alias
    rating:      m.rating      ?? null,
    genres:      m.genre_ids   ?? m.genreIds ?? m.genres ?? [],
    tags:        [],
    tmdbId,
    posterPath,
    backdropUrl: m.backdropUrl ?? null,
    posterUrl:   m.posterUrl   ?? null,
    releaseDate: m.releaseDate ?? null,
    metadata:    m.metadata    ?? {},
    addedAt:     m.addedAt     ?? new Date().toISOString(),
  };
}

export function normalizeSeries(s) {
  const tmdbId     = Number(s.tmdbId ?? s.id);
  const posterPath = s.posterPath ?? null;
  const imageUrl   = posterPath
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : (s.posterUrl ?? s.imageUrl ?? s.image ?? null);
  return {
    id:          `series_${tmdbId}`,
    externalId:  String(tmdbId),
    source:      'tmdb',
    type:        'series',
    title:       s.title ?? s.name ?? '',
    imageUrl,
    image:       imageUrl,      // legacy alias
    rating:      s.rating      ?? null,
    genres:      s.genre_ids   ?? s.genreIds ?? s.genres ?? [],
    tags:        [],
    tmdbId,
    posterPath,
    backdropUrl: s.backdropUrl ?? null,
    posterUrl:   s.posterUrl   ?? null,
    releaseDate: s.releaseDate ?? s.firstAirDate ?? null,
    metadata:    s.metadata    ?? {},
    addedAt:     s.addedAt     ?? new Date().toISOString(),
  };
}

/** Generic normalizer: `addItem(normalizeItem(data, 'movie'))` */
export function normalizeItem(item, type) {
  if (type === 'game')   return normalizeGame(item);
  if (type === 'movie')  return normalizeMovie(item);
  if (type === 'series') return normalizeSeries(item);
  throw new Error(`Unknown library item type: ${type}`);
}

// ─── Selector factories ───────────────────────────────────────────────────────
// Use these with useShallow for stable subscriptions that only re-render on change.
//
//   const isSaved = useUserLibraryStore(selectIsSaved(`movie_${tmdbId}`));
//   const movieCount = useUserLibraryStore(selectSavedCountByType('movie'));

export const selectIsSaved = (id) =>
  (state) => state.library.some(i => i.id === id);

export const selectSavedCountByType = (type) => (state) => {
  if (type === 'game')   return state.games.length;
  if (type === 'movie')  return state.movies.length;
  if (type === 'series') return state.series.length;
  return 0;
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable */ }
  return null;
}

function lsSave(library) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(library)); } catch { /* storage unavailable */ }
}

function lsClear() {
  try { localStorage.removeItem(LS_KEY); } catch { /* storage unavailable */ }
}

function loadInitial() {
  const saved = lsLoad();
  if (saved && Array.isArray(saved)) return saved;

  // ── Migration: v1 split format { games, movies, series } ──────────────────
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

  // ── Migration: original games-only key ────────────────────────────────────
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

// ─── Derived typed slices ─────────────────────────────────────────────────────

const derive = (library) => ({
  games:  library.filter(i => i.type === 'game'),
  movies: library.filter(i => i.type === 'movie'),
  series: library.filter(i => i.type === 'series'),
});

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserLibraryStore = create((set, get) => {
  const initial = loadInitial();

  /**
   * Canonical state writer — always use this instead of set() for library changes.
   * Keeps localStorage, derived slices, and Zustand state in sync atomically.
   */
  const apply = (library) => {
    lsSave(library);
    set({ library, ...derive(library) });
  };

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    library:  initial,
    ...derive(initial),
    loading:  false,
    error:    null,

    /**
     * 'idle'    — local data only, never synced with backend (guest mode)
     * 'syncing' — fetchLibrary() is in flight
     * 'synced'  — last backend sync succeeded
     * 'error'   — last backend sync failed; state rolled back to snapshot
     */
    syncStatus: 'idle',

    /**
     * Always true — loadInitial() is synchronous so local data is available
     * immediately. Use authStore.hasHydrated to gate on session resolution.
     */
    hasHydrated: true,

    // ── Auth coordination ─────────────────────────────────────────────────────
    /**
     * Called by authStore after successful login / register / initAuth.
     * Triggers a backend sync to replace local data with authoritative state.
     */
    onAuthLogin() {
      return get().fetchLibrary();
    },

    /**
     * Called by authStore on logout.
     * Clears all library state and localStorage so a subsequent login (possibly
     * a different account) starts from a clean slate.
     */
    onAuthLogout() {
      lsClear();
      set({ library: [], ...derive([]), syncStatus: 'idle', error: null });
    },

    // ── Backend sync ──────────────────────────────────────────────────────────
    async fetchLibrary() {
      if (!getToken()) return; // safety guard — should be called only when authenticated

      set({ loading: true, syncStatus: 'syncing', error: null });
      try {
        const library = await libraryService.getLibrary();
        apply(library);
        set({ syncStatus: 'synced' });
      } catch (err) {
        set({ error: err.message ?? 'Failed to load library', syncStatus: 'error' });
      } finally {
        set({ loading: false });
      }
    },

    // ── addItem ───────────────────────────────────────────────────────────────
    async addItem(item) {
      const snapshot = get().library;

      // Optimistic: update immediately so the UI reacts without waiting for the backend
      if (!snapshot.some(i => i.id === item.id)) {
        apply([item, ...snapshot]);
      }

      if (!getToken()) return; // guest — keep local state only, no backend call

      try {
        const updated = await libraryService.addItem(item);
        apply(updated); // replace with authoritative backend response
      } catch (err) {
        apply(snapshot); // rollback to pre-mutation snapshot
        set({ error: err.message ?? 'Failed to add item', syncStatus: 'error' });
      }
    },

    // ── removeItem ────────────────────────────────────────────────────────────
    async removeItem(id) {
      const snapshot = get().library;

      apply(snapshot.filter(i => i.id !== id)); // optimistic remove

      if (!getToken()) return;

      try {
        const updated = await libraryService.removeItem(id);
        apply(updated);
      } catch (err) {
        apply(snapshot); // rollback
        set({ error: err.message ?? 'Failed to remove item', syncStatus: 'error' });
      }
    },

    // ── updateItem ────────────────────────────────────────────────────────────
    async updateItem(id, data) {
      if (!getToken()) return;
      try {
        const updated = await libraryService.updateItem(id, data);
        apply(updated);
      } catch (err) {
        set({ error: err.message ?? 'Failed to update item', syncStatus: 'error' });
      }
    },

    // ── Selectors (imperative — for use in event handlers / store actions) ────
    /**
     * Returns true if an item with the given compound id is in the library.
     * For subscription-based usage prefer the selectIsSaved() factory.
     */
    isSaved: (id) => get().library.some(i => i.id === id),

    /**
     * Returns the count of saved items for a given type.
     * For subscription-based usage prefer the selectSavedCountByType() factory.
     */
    savedCountByType: (type) => {
      if (type === 'game')   return get().games.length;
      if (type === 'movie')  return get().movies.length;
      if (type === 'series') return get().series.length;
      return 0;
    },

    // ── Typed membership checks ───────────────────────────────────────────────
    hasItem:   (id)     => get().library.some(i => i.id === id),
    hasGame:   (id)     => get().library.some(i => i.id === `game_${id}`),
    hasMovie:  (tmdbId) => get().library.some(i => i.id === `movie_${Number(tmdbId)}`),
    hasSeries: (tmdbId) => get().library.some(i => i.id === `series_${Number(tmdbId)}`),

    // ── Typed add/remove/toggle helpers (backward compat) ────────────────────
    addGame:    (game)   => get().addItem(normalizeGame(game)),
    removeGame: (id)     => get().removeItem(`game_${id}`),
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

    // ── Aliases ───────────────────────────────────────────────────────────────
    /** @deprecated use fetchLibrary() */
    init() { return get().fetchLibrary(); },
  };
});

// Backward-compat alias — all existing `useLibraryStore` imports continue to work
export const useLibraryStore = useUserLibraryStore;
