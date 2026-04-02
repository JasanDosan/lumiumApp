import { create } from 'zustand';
import { GAME_CATALOG } from '@/data/gameMovieTags';

const LS_SELECTED = 'pm_selected_game';
const LS_RECENT   = 'pm_recent_games';

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

const initSelectedId = () => {
  const saved = ls(LS_SELECTED, null);
  return typeof saved === 'string' && GAME_CATALOG.some(g => g.id === saved)
    ? saved
    : GAME_CATALOG[0].id;
};

export const useGameStore = create((set, get) => ({
  // ── Game selection (drives BecauseYouPlayed) ─────────────────────────────
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

  // ── Recently viewed ───────────────────────────────────────────────────────
  recentIds: ls(LS_RECENT, []),

  recordRecent: (id) => {
    const next = [id, ...get().recentIds.filter(x => x !== id)].slice(0, 8);
    lsSave(LS_RECENT, next);
    set({ recentIds: next });
  },
}));
