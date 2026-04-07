/**
 * Lightweight user preference profile.
 * Tracks genre and tag weights from game interactions (adds, clicks).
 * Persisted to localStorage so it survives page reloads.
 */
import { create } from 'zustand';

const LS_KEY = 'pm_user_profile';

function load() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? JSON.parse(v) : { genres: {}, tags: {} };
  } catch { return { genres: {}, tags: {} }; }
}

function save(profile) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(profile)); } catch (_) { /* storage unavailable */ }
}

export const useUserProfileStore = create((set, get) => ({
  profile: load(),

  /**
   * Record an interaction with a game.
   * @param {object} game   — normalised game object (must have genreSlugs, tagSlugs)
   * @param {number} weight — 1 for click/expand, 2 for explicit library add
   */
  recordInteraction: (game, weight = 1) => {
    if (!game) return;
    const profile = JSON.parse(JSON.stringify(get().profile)); // deep clone

    for (const slug of (game.genreSlugs ?? [])) {
      profile.genres[slug] = (profile.genres[slug] ?? 0) + weight;
    }
    // Only first 6 tags to avoid noisy low-signal ones
    for (const slug of (game.tagSlugs ?? []).slice(0, 6)) {
      profile.tags[slug] = (profile.tags[slug] ?? 0) + weight;
    }

    save(profile);
    set({ profile });
  },

  /** Returns { type: 'genre'|'tag', slug, score } for the strongest preference, or null. */
  getTopPreference: () => {
    const { genres, tags } = get().profile;

    const topGenreEntry = Object.entries(genres).sort(([, a], [, b]) => b - a)[0];
    const topTagEntry   = Object.entries(tags).sort(([, a], [, b]) => b - a)[0];

    const topGenre = topGenreEntry ? { type: 'genre', slug: topGenreEntry[0], score: topGenreEntry[1] } : null;
    const topTag   = topTagEntry   ? { type: 'tag',   slug: topTagEntry[0],   score: topTagEntry[1]   } : null;

    if (!topGenre && !topTag) return null;
    if (!topGenre) return topTag;
    if (!topTag)   return topGenre;
    return topGenre.score >= topTag.score ? topGenre : topTag;
  },

  /** Total number of interactions recorded. */
  totalInteractions: () => {
    const { genres, tags } = get().profile;
    const sumObj = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    return sumObj(genres) + sumObj(tags);
  },
}));

/** Imperative version — usable outside React components (e.g. in gameStore). */
export const recordGameInteraction = (game, weight = 1) => {
  useUserProfileStore.getState().recordInteraction(game, weight);
};
