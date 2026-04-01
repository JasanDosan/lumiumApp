import { create } from 'zustand';
import { GAME_CATALOG } from '@/data/gameMovieTags';

const LS_SELECTED  = 'pm_selected_game';
const LS_RECENT    = 'pm_recent_games';
const LS_MY_GAMES  = 'pm_my_games';

function ls(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const parsed = JSON.parse(v);
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed;
  } catch (_) { return fallback; }
}

function lsSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* silent */ }
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

  /** Toggle expand; also updates selectedGameId so discover data refetches. */
  expandGame: (id) => {
    const next = get().expandedGameId === id ? null : id;
    set({ expandedGameId: next });
    if (next) {
      lsSave(LS_SELECTED, next);
      set({ selectedGameId: next });
    }
  },

  collapseGame: () => set({ expandedGameId: null }),

  // ── My Games library ──────────────────────────────────────────────────────
  myGameIds: ls(LS_MY_GAMES, []),

  addGame: (id) => {
    const prev = get().myGameIds;
    if (prev.includes(id)) return;
    const next = [id, ...prev];
    lsSave(LS_MY_GAMES, next);
    set({ myGameIds: next });
  },

  removeGame: (id) => {
    const next = get().myGameIds.filter(x => x !== id);
    lsSave(LS_MY_GAMES, next);
    set({ myGameIds: next });
  },

  toggleGame: (id) => {
    get().myGameIds.includes(id) ? get().removeGame(id) : get().addGame(id);
  },

  hasGame: (id) => get().myGameIds.includes(id),

  // ── Recently viewed ───────────────────────────────────────────────────────
  recentIds: ls(LS_RECENT, []),

  recordRecent: (id) => {
    const next = [id, ...get().recentIds.filter(x => x !== id)].slice(0, 8);
    lsSave(LS_RECENT, next);
    set({ recentIds: next });
  },
}));
