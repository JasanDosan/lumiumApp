import { create } from 'zustand';

const LS_KEY = 'pm_library_v1';

function lsLoad() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return null;
}

function lsSave(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      games:  state.games,
      movies: state.movies,
      series: state.series,
    }));
  } catch { /* ignore */ }
}

function normalizeGame(g) {
  return {
    id:     String(g.id),
    name:   g.name ?? g.title ?? '',
    title:  g.name ?? g.title ?? '',
    image:  g.image ?? g.background_image ?? null,
    rating: g.rating ?? null,
    type:   'game',
    emoji:  g.emoji ?? '🎮',
    tags:   g.tags ?? [],
  };
}

function normalizeMovie(m) {
  return {
    tmdbId:     Number(m.tmdbId),
    title:      m.title ?? m.name ?? '',
    posterPath: m.posterPath ?? null,
    backdropUrl: m.backdropUrl ?? null,
    posterUrl:  m.posterUrl ?? null,
    rating:     m.rating ?? null,
    releaseDate: m.releaseDate ?? null,
    genreIds:   m.genre_ids ?? m.genreIds ?? [],
    type:       'movie',
  };
}

function normalizeSeries(s) {
  return {
    tmdbId:     Number(s.tmdbId),
    title:      s.title ?? s.name ?? '',
    posterPath: s.posterPath ?? null,
    backdropUrl: s.backdropUrl ?? null,
    posterUrl:  s.posterUrl ?? null,
    rating:     s.rating ?? null,
    releaseDate: s.releaseDate ?? null,
    genreIds:   s.genre_ids ?? s.genreIds ?? [],
    type:       'series',
  };
}

// Migrate from legacy pm_my_games (games-only format)
function loadInitial() {
  const saved = lsLoad();
  if (saved) {
    return {
      games:  (saved.games  ?? []).map(normalizeGame),
      movies: saved.movies  ?? [],
      series: saved.series  ?? [],
    };
  }

  // First run: migrate from gameStore's old key
  try {
    const old = JSON.parse(localStorage.getItem('pm_my_games') ?? '[]');
    if (Array.isArray(old) && old.length > 0) {
      const games = old
        .map(g => (typeof g === 'object' && g !== null ? normalizeGame(g) : null))
        .filter(Boolean);
      return { games, movies: [], series: [] };
    }
  } catch { /* ignore */ }

  return { games: [], movies: [], series: [] };
}

export const useLibraryStore = create((set, get) => {
  const initial = loadInitial();

  return {
    ...initial,

    // ── Games ─────────────────────────────────────────────────────────────────
    addGame(game) {
      const norm = normalizeGame(game);
      set(state => {
        if (state.games.some(g => g.id === norm.id)) return state;
        const next = { ...state, games: [norm, ...state.games] };
        lsSave(next);
        return next;
      });
    },

    removeGame(id) {
      const sid = String(id);
      set(state => {
        const next = { ...state, games: state.games.filter(g => g.id !== sid) };
        lsSave(next);
        return next;
      });
    },

    hasGame: (id) => get().games.some(g => g.id === String(id)),

    toggleGame(gameOrId) {
      if (typeof gameOrId === 'object' && gameOrId !== null) {
        const id = String(gameOrId.id);
        get().games.some(g => g.id === id)
          ? get().removeGame(id)
          : get().addGame(gameOrId);
      } else {
        // bare id — only remove; can't add without object
        const sid = String(gameOrId);
        if (get().games.some(g => g.id === sid)) get().removeGame(sid);
      }
    },

    // ── Movies ────────────────────────────────────────────────────────────────
    addMovie(movie) {
      const norm = normalizeMovie(movie);
      set(state => {
        if (state.movies.some(m => m.tmdbId === norm.tmdbId)) return state;
        const next = { ...state, movies: [norm, ...state.movies] };
        lsSave(next);
        return next;
      });
    },

    removeMovie(tmdbId) {
      const id = Number(tmdbId);
      set(state => {
        const next = { ...state, movies: state.movies.filter(m => m.tmdbId !== id) };
        lsSave(next);
        return next;
      });
    },

    hasMovie: (tmdbId) => get().movies.some(m => m.tmdbId === Number(tmdbId)),

    toggleMovie(movie) {
      get().hasMovie(movie.tmdbId)
        ? get().removeMovie(movie.tmdbId)
        : get().addMovie(movie);
    },

    // ── Series ────────────────────────────────────────────────────────────────
    addSeries(s) {
      const norm = normalizeSeries(s);
      set(state => {
        if (state.series.some(x => x.tmdbId === norm.tmdbId)) return state;
        const next = { ...state, series: [norm, ...state.series] };
        lsSave(next);
        return next;
      });
    },

    removeSeries(tmdbId) {
      const id = Number(tmdbId);
      set(state => {
        const next = { ...state, series: state.series.filter(s => s.tmdbId !== id) };
        lsSave(next);
        return next;
      });
    },

    hasSeries: (tmdbId) => get().series.some(s => s.tmdbId === Number(tmdbId)),

    toggleSeries(s) {
      get().hasSeries(s.tmdbId)
        ? get().removeSeries(s.tmdbId)
        : get().addSeries(s);
    },
  };
});
