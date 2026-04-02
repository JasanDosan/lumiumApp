import { create } from 'zustand';
import { GAME_CATALOG } from '@/data/gameMovieTags';

const LS_SELECTED = 'pm_selected_game';
const LS_RECENT   = 'pm_recent_games';
const LS_MY_GAMES = 'pm_my_games';

function ls(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v);
  } catch (_) { return fallback; }
}

function lsSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* silent */ }
}

// ─── Normalise a game to the canonical stored shape ───────────────────────────
// Keeps IDs as strings (catalog uses slugs, RAWG uses numeric strings).
function normalizeForStore(game) {
  return {
    id:     String(game.id),
    name:   game.name ?? game.title ?? '',
    title:  game.name ?? game.title ?? '',
    image:  game.image ?? game.background_image ?? null,
    rating: game.rating ?? null,
    type:   'game',
    emoji:  game.emoji ?? '🎮',
    tags:   game.tags ?? [],
  };
}

// ─── Migrate old localStorage format (array of id strings → array of objects) ─
function loadMyGames() {
  const raw = ls(LS_MY_GAMES, []);
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Already objects — return as-is (re-normalize to ensure shape consistency)
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    return raw.map(normalizeForStore);
  }

  // Legacy format: array of id strings → look up in catalog, drop unknowns
  return raw
    .map(id => GAME_CATALOG.find(g => g.id === id))
    .filter(Boolean)
    .map(normalizeForStore);
}

const initSelectedId = () => {
  const saved = ls(LS_SELECTED, null);
  return typeof saved === 'string' && GAME_CATALOG.some(g => g.id === saved)
    ? saved
    : GAME_CATALOG[0].id;
};

export const useGameStore = create((set, get) => ({
  // ── Game selection + inline expansion ─────────────────────────────────────
  selectedGameId: initSelectedId(),
  expandedGameId: null,

  selectGame: (id) => {
    lsSave(LS_SELECTED, id);
    set({ selectedGameId: id });
  },

  expandGame: (id) => {
    const next = get().expandedGameId === id ? null : id;
    set({ expandedGameId: next });
    if (next) {
      lsSave(LS_SELECTED, next);
      set({ selectedGameId: next });
    }
  },

  collapseGame: () => set({ expandedGameId: null }),

  // ── My Games library (stores full game objects) ───────────────────────────
  myGames: loadMyGames(),

  // Derived: set of IDs — used by legacy callers that only need to check presence
  get myGameIds() {
    return get().myGames.map(g => g.id);
  },

  addGame: (game) => {
    const normalized = normalizeForStore(game);
    console.log('ADDING GAME:', normalized);

    set(state => {
      const exists = state.myGames.some(g => g.id === normalized.id);
      if (exists) {
        console.log('LIBRARY STATE (no change — already exists):', state.myGames);
        return state;
      }
      const next = [normalized, ...state.myGames];
      lsSave(LS_MY_GAMES, next);
      console.log('LIBRARY STATE:', next);
      return { myGames: next };
    });
  },

  removeGame: (id) => {
    const sid = String(id);
    set(state => {
      const next = state.myGames.filter(g => g.id !== sid);
      lsSave(LS_MY_GAMES, next);
      return { myGames: next };
    });
  },

  // Accepts a full game object OR a bare id string (backward compat)
  toggleGame: (gameOrId) => {
    if (typeof gameOrId === 'object' && gameOrId !== null) {
      const id = String(gameOrId.id);
      get().myGames.some(g => g.id === id)
        ? get().removeGame(id)
        : get().addGame(gameOrId);
    } else {
      // Legacy call with just an id — look up in catalog first
      const sid = String(gameOrId);
      if (get().myGames.some(g => g.id === sid)) {
        get().removeGame(sid);
      } else {
        const catalogGame = GAME_CATALOG.find(g => g.id === sid);
        if (catalogGame) get().addGame(catalogGame);
      }
    }
  },

  hasGame: (id) => {
    const sid = String(id);
    return get().myGames.some(g => g.id === sid);
  },

  // ── Recently viewed ───────────────────────────────────────────────────────
  recentIds: ls(LS_RECENT, []),

  recordRecent: (id) => {
    const next = [id, ...get().recentIds.filter(x => x !== id)].slice(0, 8);
    lsSave(LS_RECENT, next);
    set({ recentIds: next });
  },
}));
