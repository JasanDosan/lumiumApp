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

export function buildTasteProfile(library) {
  const genreWeights = new Map();
  const tagWeights   = new Map();
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

function bayesianRating(rating, voteCount) {
  const v = voteCount ?? 0;
  return (v / (v + 500)) * (rating ?? 6.5) + (500 / (v + 500)) * 6.5;
}

function normPopularity(popularity) {
  if (!popularity || popularity <= 0) return 0;
  return Math.min((Math.log10(popularity + 1) / Math.log10(1001)) * 10, 10);
}

function scoreMediaCandidate(candidate, type, profile, savedIds) {
  const compoundId = type === 'movie'
    ? `movie_${Number(candidate.tmdbId)}`
    : `series_${Number(candidate.tmdbId)}`;

  if (savedIds.has(compoundId)) return null;

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

  genreScore = Math.min(genreScore * 1.5, 10);

  if (genreScore === 0 && profile.topGenres.length >= 2) return null;

  const adjustedRating  = bayesianRating(candidate.rating, candidate.voteCount);
  const ratingScore     = (adjustedRating / 10) * 5;
  const popularityScore = normPopularity(candidate.popularity) * 0.5;

  const totalScore = genreScore * 2 + ratingScore + popularityScore;

  const uniqueNames  = [...new Set(matchedNames)].slice(0, 3);
  const explanation  = buildMediaExplanation(uniqueNames, adjustedRating);

  return { totalScore, breakdown: { genreScore, ratingScore, popularityScore }, explanation, basedOn: uniqueNames };
}

function buildMediaExplanation(matchedGenres, adjustedRating) {
  const parts = [];
  if (matchedGenres.length >= 2)      parts.push(`Matches your ${matchedGenres.slice(0, 2).join(' & ')} taste`);
  else if (matchedGenres.length === 1) parts.push(`Matches ${matchedGenres[0]} in your library`);
  if (adjustedRating >= 7.5)           parts.push('Highly rated');
  else if (adjustedRating >= 6.5)      parts.push('Solid reviews');
  return parts;
}

function scoreGameCandidates(profile, savedIds, limit = 8) {
  const unsaved = GAME_CATALOG.filter(g => !savedIds.has(`game_${g.id}`));

  if (profile.topTags.length === 0 && profile.genreWeights.size === 0) {
    return unsaved
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, limit)
      .map(g => ({ item: g, type: 'game', score: g.rating ?? 7, explanation: ['Top-rated title'], basedOn: [] }));
  }

  const scored = unsaved.map(g => {
    const tags        = (g.tags ?? []).map(t => t.toLowerCase());
    let tagScore      = 0;
    let bridgeScore   = 0;
    const matchedTags = [];

    tags.forEach(tag => {
      const tw = profile.tagWeights.get(tag) ?? 0;
      if (tw > 0) { tagScore += tw; matchedTags.push(capitalize(tag)); }
      (TAG_TO_TMDB[tag] ?? []).forEach(gid => {
        const gw = profile.genreWeights.get(gid) ?? 0;
        if (gw > 0) bridgeScore += gw * 0.4;
      });
    });

    if (tagScore === 0 && bridgeScore === 0) return null;

    const ratingScore = ((g.rating ?? 7) / 10) * 3;
    const totalScore  = tagScore * 2 + bridgeScore + ratingScore;
    const uniqueTags  = [...new Set(matchedTags)].slice(0, 3);
    const explanation = uniqueTags.length >= 2
      ? [`Because you enjoy ${uniqueTags.slice(0, 2).join(' & ')}`]
      : uniqueTags.length === 1
      ? [`Matches your ${uniqueTags[0]} interest`]
      : ['Matches your library taste'];

    return { item: g, type: 'game', score: totalScore, explanation, basedOn: uniqueTags };
  }).filter(Boolean);

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Summary builders ─────────────────────────────────────────────────────────

export function buildProfileSummary(profile) {
  const { topGenres, topTags } = profile;
  const genreNames = topGenres.slice(0, 3).map(id => GENRE_NAMES[id]).filter(Boolean);
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

export function buildRowReason(type, profile) {
  const { topGenres, topTags } = profile;
  if (type === 'game') {
    const names = topTags.slice(0, 2).map(capitalize);
    if (names.length >= 2) return `Because you enjoy ${names.join(' & ')}`;
    if (names.length === 1) return `Matching your ${names[0]} taste`;
    const bridgeGenres = topGenres.slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean);
    if (bridgeGenres.length > 0) return `Inspired by your ${bridgeGenres.join(' & ')} library`;
    return 'Games matching your library';
  }
  const names = topGenres.slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean);
  if (names.length >= 2) return `Because you love ${names.join(' & ')}`;
  if (names.length === 1) return `Because you love ${names[0]}`;
  return type === 'movie' ? 'Movies you might enjoy' : 'Series you might enjoy';
}

// ─── Main hook (original) ─────────────────────────────────────────────────────

const MIN_LIBRARY_SIZE = 3;

export function usePersonalizedRecs(library) {
  const [movies,         setMovies]         = useState([]);
  const [series,         setSeries]         = useState([]);
  const [games,          setGames]          = useState([]);
  const [profile,        setProfile]        = useState(null);
  const [profileSummary, setProfileSummary] = useState('');
  const [isLoading,      setIsLoading]      = useState(false);

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
      ? mediaDiscoveryService.discover({ genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0, page: 1 }).catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] });

    const fetchSeries = genreParam.length > 0
      ? tvService.discover({ genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0 }).catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] });

    let cancelled = false;

    (async () => {
      try {
        const movieData = await fetchMovies;
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;
        const tvData = await fetchSeries;
        if (cancelled) return;

        const scoredMovies = (movieData?.results ?? [])
          .map(m => { const s = scoreMediaCandidate(m, 'movie', p, savedIds); return s ? { item: m, type: 'movie', ...s } : null; })
          .filter(Boolean).sort((a, b) => b.totalScore - a.totalScore).slice(0, 8);

        const scoredSeries = (tvData?.results ?? tvData?.items ?? [])
          .map(s => { const sc = scoreMediaCandidate(s, 'series', p, savedIds); return sc ? { item: s, type: 'series', ...sc } : null; })
          .filter(Boolean).sort((a, b) => b.totalScore - a.totalScore).slice(0, 8);

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

  return { movies, series, games, profile, profileSummary, isLoading, isEmpty: library.length < MIN_LIBRARY_SIZE };
}

// ─── Source-aware recommendation hook ────────────────────────────────────────

/**
 * Recommendation order per source mode.
 * Cross-media types appear first; same-media type appears last.
 *
 *   MY VIDEOGAMES → Movies, Series, Videogames
 *   MY MOVIES     → Videogames, Series, Movies
 *   MY SERIES     → Videogames, Movies, Series
 */
const RECOMMENDATION_ORDER = {
  game:   ['movie', 'series', 'game'],
  movie:  ['game',  'series', 'movie'],
  series: ['game',  'movie',  'series'],
};

const MIN_SOURCE_SIZE = 2;

/**
 * Derive available genre / tag filters from a set of source library items.
 *
 * @param {Array}  sourceItems — library items filtered to one source type
 * @param {string} sourceMode  — 'game' | 'movie' | 'series'
 * @returns {Array<{ id: string|number, name: string, count: number }>}
 */
export function deriveSourceGenres(sourceItems, sourceMode) {
  if (sourceMode === 'game') {
    const tagCounts = new Map();
    for (const item of sourceItems) {
      for (const tag of (item.tags ?? [])) {
        const t = tag.toLowerCase().trim();
        if (t) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ id: tag, name: capitalize(tag), count }));
  }

  // movies / series — TMDB genre IDs
  const genreCounts = new Map();
  for (const item of sourceItems) {
    for (const gid of extractGenreIds(item.genres ?? [])) {
      genreCounts.set(gid, (genreCounts.get(gid) ?? 0) + 1);
    }
  }
  return [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([id, count]) => ({ id, name: GENRE_NAMES[id] ?? '', count }))
    .filter(g => g.name);
}

/**
 * Build a human-readable reason string for a cross-media recommendation section.
 *
 * @param {string} sourceMode    — the user's chosen source ('game'|'movie'|'series')
 * @param {string} sectionType   — the type being recommended ('movie'|'series'|'game')
 * @param {object} profile       — taste profile from buildTasteProfile()
 * @param {Array}  seeds         — items used to build the profile (may be subset of source library)
 * @param {Set}    activeGenres  — currently active genre/tag filter IDs
 * @returns {string}
 */
export function buildCrossMediaReason(sourceMode, sectionType, profile, seeds, activeGenres) {
  const { topGenres, topTags } = profile;

  // Active filter names (genre IDs → names, or tag strings → capitalized)
  const filterNames = activeGenres.size > 0
    ? [...activeGenres]
        .map(g => typeof g === 'number' ? (GENRE_NAMES[g] ?? '') : capitalize(String(g)))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const seedTitles = seeds.slice(0, 2).map(s => s.title ?? s.name).filter(Boolean);

  if (sourceMode === 'game') {
    const tagNames = topTags.slice(0, 2).map(capitalize);
    if (filterNames.length > 0) return `Filtered by ${filterNames.join(' & ')} from your saved games`;
    if (seedTitles.length >= 2 && tagNames.length > 0) return `Because ${seedTitles[0]} and ${seedTitles[1]} share ${tagNames.join(' & ')} themes`;
    if (seedTitles.length === 1 && tagNames.length > 0) return `Inspired by the ${tagNames.join(' & ')} tone of ${seedTitles[0]}`;
    if (seedTitles.length === 1) return `Inspired by ${seedTitles[0]}`;
    if (tagNames.length >= 2) return `Because your games share ${tagNames.join(' & ')} themes`;
    if (tagNames.length === 1) return `Inspired by your ${tagNames[0]} game library`;
    return 'Inspired by your saved games';
  }

  const srcLabel = sourceMode === 'movie' ? 'movies' : 'series';
  const genreNames = topGenres.slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean);

  if (filterNames.length > 0) return `Filtered by ${filterNames.join(' & ')} from your saved ${srcLabel}`;
  if (seedTitles.length >= 2) return `Because you saved ${seedTitles[0]} and ${seedTitles[1]}`;
  if (seedTitles.length === 1) return `Inspired by ${seedTitles[0]}`;
  if (genreNames.length >= 2) return `Because your ${srcLabel} lean ${genreNames.join(' & ')}`;
  if (genreNames.length === 1) return `Based on your ${genreNames[0]} preference`;
  return `Based on your saved ${srcLabel}`;
}

/**
 * useSourceRecs — source-aware, seed-driven cross-media recommendations.
 *
 * @param {{ sourceMode, seedIds, activeGenres, library }}
 *   sourceMode   — 'game' | 'movie' | 'series'
 *   seedIds      — Set<string> of compound library IDs to use as profile seeds
 *   activeGenres — Set<number|string> genre/tag filters (numbers for movie/series, strings for game)
 *   library      — full library array from libraryStore
 *
 * @returns {{
 *   sections:      Array<{ type, items, reason }>,
 *   isLoading:     boolean,
 *   isEmpty:       boolean,   // true when no source items exist
 *   hasEnoughData: boolean,   // true when source has ≥ MIN_SOURCE_SIZE items
 * }}
 */
export function useSourceRecs({ sourceMode, seedIds, activeGenres, library }) {
  const [sections,      setSections]      = useState([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isEmpty,       setIsEmpty]       = useState(false);
  const [hasEnoughData, setHasEnoughData] = useState(true);

  const seedKey   = useMemo(() => [...seedIds].sort().join(','),    [seedIds]);
  const genreKey  = useMemo(() => [...activeGenres].sort().join(','), [activeGenres]);
  const libKey    = useMemo(() => library.map(i => i.id).sort().join(','), [library]);

  useEffect(() => {
    // 1. Filter library to source type
    const sourceItems = library.filter(i => i.type === sourceMode);

    if (sourceItems.length === 0) {
      setIsEmpty(true);
      setHasEnoughData(false);
      setSections([]);
      setIsLoading(false);
      return;
    }

    setIsEmpty(false);
    setHasEnoughData(sourceItems.length >= MIN_SOURCE_SIZE);

    // 2. Profile base: seeds if provided, else all source items
    const profileBase = seedIds.size > 0
      ? sourceItems.filter(i => seedIds.has(i.id))
      : sourceItems;

    // If somehow all seeds were removed from library, fall back
    const safeBase = profileBase.length > 0 ? profileBase : sourceItems;

    // 3. Apply genre/tag filter
    let filteredBase = safeBase;
    if (activeGenres.size > 0) {
      const filtered = sourceMode === 'game'
        ? safeBase.filter(i => (i.tags ?? []).some(t => activeGenres.has(t.toLowerCase().trim())))
        : safeBase.filter(i => extractGenreIds(i.genres ?? []).some(id => activeGenres.has(id)));
      // Never filter down to zero — fall back to unfiltered
      if (filtered.length > 0) filteredBase = filtered;
    }

    // 4. Build taste profile from filtered items
    const profile   = buildTasteProfile(filteredBase);
    const savedIds  = new Set(library.map(i => i.id));
    const order     = RECOMMENDATION_ORDER[sourceMode];
    const genreParam = profile.topGenres.slice(0, 3);

    setIsLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const results = { movie: [], series: [], game: [] };

        // Fetch movies if needed
        if (order.includes('movie') && genreParam.length > 0) {
          try {
            const data = await mediaDiscoveryService.discover({
              genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0, page: 1,
            });
            if (!cancelled) {
              results.movie = (data?.results ?? [])
                .map(m => { const s = scoreMediaCandidate(m, 'movie', profile, savedIds); return s ? { item: m, type: 'movie', ...s } : null; })
                .filter(Boolean)
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 10);
            }
          } catch { /* non-fatal */ }
        }

        if (cancelled) return;
        // Stagger to respect TMDB rate limits
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;

        // Fetch series if needed
        if (order.includes('series') && genreParam.length > 0) {
          try {
            const data = await tvService.discover({
              genres: genreParam, sort_by: 'vote_average.desc', rating_gte: 6.0,
            });
            if (!cancelled) {
              results.series = (data?.results ?? data?.items ?? [])
                .map(s => { const sc = scoreMediaCandidate(s, 'series', profile, savedIds); return sc ? { item: s, type: 'series', ...sc } : null; })
                .filter(Boolean)
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 10);
            }
          } catch { /* non-fatal */ }
        }

        if (cancelled) return;

        // Score game candidates (in-memory, no fetch needed)
        if (order.includes('game')) {
          results.game = scoreGameCandidates(profile, savedIds, 10);
        }

        if (cancelled) return;

        const builtSections = order.map(type => ({
          type,
          items:  results[type] ?? [],
          reason: buildCrossMediaReason(sourceMode, type, profile, filteredBase, activeGenres),
        }));

        setSections(builtSections);
      } catch (err) {
        console.error('[useSourceRecs]', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sourceMode, seedKey, genreKey, libKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { sections, isLoading, isEmpty, hasEnoughData };
}
