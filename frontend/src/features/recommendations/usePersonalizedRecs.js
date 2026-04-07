/**
 * usePersonalizedRecs
 *
 * Derives a taste profile from the user's full saved library and generates
 * scored cross-media recommendations (movies + series + games).
 *
 * Pipeline:
 *   1. buildTasteProfile   — weighted genre + tag aggregation across all items
 *   2. fetch candidates    — TMDB discover (movies + series) + GAME_CATALOG filter
 *   3. scoreMediaCandidate / scoreGameCandidates — genre/tag overlap + rating + popularity
 *   4. filter              — exclude saved items, deduplicate, cap per type
 *   5. expose              — results + profileSummary + per-row explanation builders
 *
 * Scoring formula:
 *   totalScore = genreScore×2 + ratingScore + popularityScore×0.5
 *
 *   genreScore     — weighted sum of matching TMDB genre IDs, normalized to [0, 10]
 *   ratingScore    — bayesian-smoothed TMDB rating mapped to [0, 5]
 *   popularityScore — log-normalized popularity mapped to [0, 5] (capped contribution)
 *
 * Cross-media bridge:
 *   Games use tags (e.g. "rpg", "horror"). TAG_TO_TMDB maps these tags to TMDB
 *   genre IDs so that a library of horror games will surface horror movies/series.
 *   Bridge weight is 0.5× so it supplements but does not override direct saves.
 */

import { useState, useEffect, useMemo } from 'react';
import { mediaDiscoveryService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG } from '@/data/gameMovieTags';

// ─── TMDB genre ID → human-readable name ─────────────────────────────────────

export const GENRE_NAMES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime',  18: 'Drama',     14: 'Fantasy',   27: 'Horror',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
  10752: 'War',    37: 'Western',    99: 'Documentary', 36: 'History',
  10751: 'Family',
};

// ─── Game tag → TMDB genre IDs (cross-media taste bridge) ────────────────────
// Allows game preferences to influence movie/series recommendations.

const TAG_TO_TMDB = {
  'action':           [28],
  'adventure':        [12],
  'fantasy':          [14],
  'sci-fi':           [878],
  'horror':           [27],
  'thriller':         [53],
  'mystery':          [9648],
  'crime':            [80],
  'story-rich':       [18],
  'strategy':         [36],
  'survival':         [53, 27],
  'zombies':          [27, 53],
  'stealth':          [53, 28],
  'rpg':              [14, 12],
  'post-apocalyptic': [878, 53],
  'open world':       [12],
  'narrative':        [18],
  'war':              [10752, 28],
  'cyberpunk':        [878, 80],
  'noir':             [80, 18],
  'psychological':    [27, 53],
  'sandbox':          [12],
  'comedy':           [35],
  'drama':            [18],
  'western':          [37],
  'historical':       [36],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Genres in the library can be stored as:
 *   - Array of number IDs: [28, 12]          (from TMDB search/discover)
 *   - Array of objects:    [{id:28, name:"…"}] (from TMDB movie detail page)
 * This normalizes both forms into an array of numeric IDs.
 */
function extractGenreIds(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return [];
  if (typeof genres[0] === 'number') return genres;
  if (typeof genres[0] === 'object' && genres[0] !== null) {
    return genres.map(g => (typeof g.id === 'number' ? g.id : null)).filter(Boolean);
  }
  return [];
}

// ─── Profile builder ──────────────────────────────────────────────────────────

/**
 * Derives a weighted taste profile from the user's full library.
 *
 * Weight formula per item:
 *   rating ≥ 8  → 1.5×  (user explicitly appreciated this)
 *   rating ≥ 6  → 1.2×
 *   no rating   → 1.0×  (saved = soft preference)
 *
 * Movies + series contribute TMDB genre IDs directly.
 * Games contribute via tag → TMDB bridge at 0.5× to supplement, not override.
 */
export function buildTasteProfile(library) {
  const genreWeights = new Map(); // TMDB genre ID (number) → cumulative weight
  const tagWeights   = new Map(); // lowercase tag string   → cumulative weight
  const typeCounts   = { game: 0, movie: 0, series: 0 };

  for (const item of library) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
    const r      = item.rating ?? null;
    const weight = r === null ? 1 : r >= 8 ? 1.5 : r >= 6 ? 1.2 : 1;

    if (item.type === 'movie' || item.type === 'series') {
      extractGenreIds(item.genres).forEach(id => {
        genreWeights.set(id, (genreWeights.get(id) ?? 0) + weight);
      });
    }

    if (item.type === 'game') {
      (item.tags ?? []).forEach(rawTag => {
        const tag = rawTag.toLowerCase();
        tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + weight);
        // Bridge game tags → TMDB genres at half-weight
        (TAG_TO_TMDB[tag] ?? []).forEach(gid => {
          genreWeights.set(gid, (genreWeights.get(gid) ?? 0) + weight * 0.5);
        });
      });
    }
  }

  const topGenres = [...genreWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const topTags = [...tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return { genreWeights, tagWeights, topGenres, topTags, typeCounts };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Bayesian rating smoothing.
 * Prevents movies/series with few votes from scoring too high or too low.
 * Formula: (v / (v + 500)) * R + (500 / (v + 500)) * 6.5
 */
function bayesianRating(rating, voteCount) {
  const v = voteCount ?? 0;
  return (v / (v + 500)) * (rating ?? 6.5) + (500 / (v + 500)) * 6.5;
}

/** Log-normalized popularity → [0, 10] prevents blockbusters from dominating. */
function normPopularity(popularity) {
  if (!popularity || popularity <= 0) return 0;
  return Math.min((Math.log10(popularity + 1) / Math.log10(1001)) * 10, 10);
}

/**
 * Score a TMDB candidate (movie or series) against the user taste profile.
 * Returns null if already saved or if there's no genre overlap with a rich profile.
 */
function scoreMediaCandidate(candidate, type, profile, savedIds) {
  const compoundId = type === 'movie'
    ? `movie_${Number(candidate.tmdbId)}`
    : `series_${Number(candidate.tmdbId)}`;

  if (savedIds.has(compoundId)) return null;

  // Candidates from /discover return genreIds; from /details return genres
  const candidateGenreIds = extractGenreIds(
    candidate.genreIds ?? candidate.genre_ids ?? candidate.genres ?? []
  );

  let genreScore    = 0;
  const matchedNames = [];

  candidateGenreIds.forEach(gid => {
    const w = profile.genreWeights.get(gid) ?? 0;
    if (w > 0) {
      genreScore += w;
      const name = GENRE_NAMES[gid];
      if (name) matchedNames.push(name);
    }
  });

  // Normalize to [0, 10]; multiply by 1.5 so even 1 strong genre hit scores well
  genreScore = Math.min(genreScore * 1.5, 10);

  // Skip candidates with zero genre overlap when we have a meaningful profile
  if (genreScore === 0 && profile.topGenres.length >= 2) return null;

  const adjustedRating  = bayesianRating(candidate.rating, candidate.voteCount);
  const ratingScore     = (adjustedRating / 10) * 5;       // 0–5
  const popularityScore = normPopularity(candidate.popularity) * 0.5; // 0–5

  const totalScore = genreScore * 2 + ratingScore + popularityScore;

  const uniqueNames = [...new Set(matchedNames)].slice(0, 3);
  const explanation = buildMediaExplanation(uniqueNames, adjustedRating);

  return {
    totalScore,
    breakdown: { genreScore, ratingScore, popularityScore },
    explanation,
    basedOn: uniqueNames,
  };
}

function buildMediaExplanation(matchedGenres, adjustedRating) {
  const parts = [];
  if (matchedGenres.length >= 2) {
    parts.push(`Matches your ${matchedGenres.slice(0, 2).join(' & ')} taste`);
  } else if (matchedGenres.length === 1) {
    parts.push(`Matches ${matchedGenres[0]} in your library`);
  }
  if (adjustedRating >= 7.5)      parts.push('Highly rated');
  else if (adjustedRating >= 6.5) parts.push('Solid reviews');
  return parts;
}

/**
 * Score and rank GAME_CATALOG entries against the user taste profile.
 * Uses tag overlap + TMDB genre bridge as signal.
 */
function scoreGameCandidates(profile, savedIds, limit = 8) {
  const unsaved = GAME_CATALOG.filter(g => !savedIds.has(`game_${g.id}`));

  // No signal → return top-rated catalog games as fallback
  if (profile.topTags.length === 0 && profile.genreWeights.size === 0) {
    return unsaved
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, limit)
      .map(g => ({
        item: g, type: 'game', score: g.rating ?? 7,
        explanation: ['Top-rated title'], basedOn: [],
      }));
  }

  const scored = unsaved.map(g => {
    const tags        = (g.tags ?? []).map(t => t.toLowerCase());
    let tagScore      = 0;
    let bridgeScore   = 0;
    const matchedTags = [];

    tags.forEach(tag => {
      const tw = profile.tagWeights.get(tag) ?? 0;
      if (tw > 0) { tagScore += tw; matchedTags.push(capitalize(tag)); }

      // Bridge through TMDB genres (user saved sci-fi movies → suggest sci-fi games)
      (TAG_TO_TMDB[tag] ?? []).forEach(gid => {
        const gw = profile.genreWeights.get(gid) ?? 0;
        if (gw > 0) bridgeScore += gw * 0.4;
      });
    });

    if (tagScore === 0 && bridgeScore === 0) return null;

    const ratingScore = ((g.rating ?? 7) / 10) * 3; // 0–3
    const totalScore  = tagScore * 2 + bridgeScore + ratingScore;

    const uniqueTags  = [...new Set(matchedTags)].slice(0, 3);
    const explanation = uniqueTags.length >= 2
      ? [`Because you enjoy ${uniqueTags.slice(0, 2).join(' & ')}`]
      : uniqueTags.length === 1
      ? [`Matches your ${uniqueTags[0]} interest`]
      : ['Matches your library taste'];

    return {
      item: g, type: 'game', score: totalScore,
      explanation, basedOn: uniqueTags,
    };
  }).filter(Boolean);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Summary builders (exported for BecauseYouPlayed) ────────────────────────

/**
 * One-line profile summary for the section header.
 * Examples:
 *   "Based on your taste for Sci-Fi & Action"
 *   "Inspired by your RPG & Horror titles"
 *   "Based on your saved library"
 */
export function buildProfileSummary(profile) {
  const { topGenres, topTags } = profile;

  const genreNames = topGenres.slice(0, 3)
    .map(id => GENRE_NAMES[id])
    .filter(Boolean);

  if (genreNames.length >= 2) {
    const last  = genreNames[genreNames.length - 1];
    const front = genreNames.slice(0, -1).join(', ');
    return `Based on your taste for ${front} & ${last}`;
  }
  if (genreNames.length === 1) return `Based on your ${genreNames[0]} preference`;
  if (topTags.length >= 2) {
    const names = topTags.slice(0, 2).map(capitalize);
    return `Inspired by your ${names.join(' & ')} titles`;
  }
  if (topTags.length === 1) return `Inspired by your ${capitalize(topTags[0])} library`;
  return 'Based on your saved library';
}

/**
 * Per-row reason string shown below the row label.
 * Examples:
 *   movies: "Because you love Sci-Fi & Thriller"
 *   games:  "Because you enjoy RPG & Survival"
 */
export function buildRowReason(type, profile) {
  const { topGenres, topTags } = profile;

  if (type === 'game') {
    const names = topTags.slice(0, 2).map(capitalize);
    if (names.length >= 2) return `Because you enjoy ${names.join(' & ')}`;
    if (names.length === 1) return `Matching your ${names[0]} taste`;
    // Fall through to genre-based reason if no tags
    const bridgeGenres = topGenres.slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean);
    if (bridgeGenres.length > 0) return `Inspired by your ${bridgeGenres.join(' & ')} library`;
    return 'Games matching your library';
  }

  const names = topGenres.slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean);
  if (names.length >= 2) return `Because you love ${names.join(' & ')}`;
  if (names.length === 1) return `Because you love ${names[0]}`;
  return type === 'movie' ? 'Movies you might enjoy' : 'Series you might enjoy';
}

// ─── Main hook ────────────────────────────────────────────────────────────────

const MIN_LIBRARY_SIZE = 3; // minimum items before generating recommendations

/**
 * usePersonalizedRecs(library)
 *
 * @param {Array} library — flat array of all saved library items from libraryStore
 * @returns {{
 *   movies:         Array<{ item, type, score, explanation, basedOn }>,
 *   series:         Array<{ item, type, score, explanation, basedOn }>,
 *   games:          Array<{ item, type, score, explanation, basedOn }>,
 *   profile:        object | null,
 *   profileSummary: string,
 *   isLoading:      boolean,
 *   isEmpty:        boolean,   // true when library is too small
 * }}
 */
export function usePersonalizedRecs(library) {
  const [movies,         setMovies]         = useState([]);
  const [series,         setSeries]         = useState([]);
  const [games,          setGames]          = useState([]);
  const [profile,        setProfile]        = useState(null);
  const [profileSummary, setProfileSummary] = useState('');
  const [isLoading,      setIsLoading]      = useState(false);

  // Stable key: only changes when items are added or removed
  const libraryKey = useMemo(
    () => library.map(i => i.id).sort().join(','),
    [library],
  );

  useEffect(() => {
    if (library.length < MIN_LIBRARY_SIZE) {
      setMovies([]); setSeries([]); setGames([]);
      setProfile(null); setProfileSummary('');
      return;
    }

    const p        = buildTasteProfile(library);
    const savedIds = new Set(library.map(i => i.id));

    setProfile(p);
    setProfileSummary(buildProfileSummary(p));
    setIsLoading(true);

    const genreParam = p.topGenres.slice(0, 3);

    const fetchMovies = genreParam.length > 0
      ? mediaDiscoveryService.discover({ genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0, page: 1 })
          .catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] });

    const fetchSeries = genreParam.length > 0
      ? tvService.discover({ genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0 })
          .catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] });

    let cancelled = false;

    // Sequential fetch with 300ms gap to respect TMDB rate limits
    (async () => {
      try {
        const movieData = await fetchMovies;
        if (cancelled) return;

        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;

        const tvData = await fetchSeries;
        if (cancelled) return;

        const scoredMovies = (movieData?.results ?? [])
          .map(m => {
            const s = scoreMediaCandidate(m, 'movie', p, savedIds);
            return s ? { item: m, type: 'movie', ...s } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 8);

        const scoredSeries = (tvData?.results ?? tvData?.items ?? [])
          .map(s => {
            const sc = scoreMediaCandidate(s, 'series', p, savedIds);
            return sc ? { item: s, type: 'series', ...sc } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 8);

        const scoredGames = scoreGameCandidates(p, savedIds, 8);

        setMovies(scoredMovies);
        setSeries(scoredSeries);
        setGames(scoredGames);
      } catch (err) {
        console.error('[usePersonalizedRecs]', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [libraryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    movies,
    series,
    games,
    profile,
    profileSummary,
    isLoading,
    isEmpty: library.length < MIN_LIBRARY_SIZE,
  };
}
