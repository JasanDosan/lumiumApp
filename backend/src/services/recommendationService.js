/**
 * recommendationService.js
 *
 * Scoring formula (current):
 *   totalScore = crossHitScore + ratingScore + popularityScore
 *
 *   crossHitScore   = crossHits * WEIGHT_CROSS_HIT
 *   ratingScore     = bayesianRating(rating, voteCount) * WEIGHT_RATING
 *   popularityScore = logNormPopularity(popularity)         [0–10]
 *
 * Future factors (stubbed at 0, weights defined for when they are activated):
 *   genreMatch, tagMatch, playtimeWeight, sourceAffinity
 *
 * Design: pure business logic, no Express/DOM dependencies → reusable in RN.
 */

import { getMovieRecommendations } from './tmdbService.js';
import { pushRecommendationHistory } from '../repositories/userRepository.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────

const MAX_RECOMMENDATIONS    = 50;
const TMDB_CONCURRENCY_LIMIT = 5;    // max parallel TMDB requests (rate limit: 40/10s)
const MIN_VOTE_COUNT         = 20;   // ignore movies with too few votes

const BAYESIAN_PRIOR_VOTES = 500;    // assumed vote count for prior
const BAYESIAN_PRIOR_MEAN  = 6.5;    // global TMDB average rating

// Factor weights — change here to re-tune, never hard-code in formulas
const WEIGHT_CROSS_HIT    = 3;
const WEIGHT_RATING       = 2;
// Future weights (will activate once factor functions return non-zero values)
const WEIGHT_GENRE_MATCH   = 2;   // eslint-disable-line no-unused-vars
const WEIGHT_TAG_MATCH     = 1.5; // eslint-disable-line no-unused-vars
const WEIGHT_PLAYTIME      = 1;   // eslint-disable-line no-unused-vars
const WEIGHT_SOURCE        = 0.5; // eslint-disable-line no-unused-vars

// ─── Explanation thresholds ───────────────────────────────────────────────────

const RATING_HIGH_THRESHOLD   = 7.5;
const RATING_SOLID_THRESHOLD  = 6.5;
const POP_HIGH_THRESHOLD      = 7.0;

// ─── Concurrency limiter ──────────────────────────────────────────────────────

const chunked = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

/**
 * Processes `ids` in serial batches of `limit`, each batch fully parallel.
 * Returns results in the same order as `ids` — result[i] corresponds to ids[i].
 */
const fetchWithConcurrencyLimit = async (ids, fetcher, limit) => {
  const results = [];
  for (const chunk of chunked(ids, limit)) {
    const chunkResults = await Promise.allSettled(chunk.map(fetcher));
    results.push(...chunkResults);
  }
  return results; // length === ids.length, order preserved
};

// ─── Scoring primitives ───────────────────────────────────────────────────────

/**
 * Bayesian average: smooths out ratings on movies with few votes.
 * Formula: (v / (v + m)) * R + (m / (v + m)) * C
 *   v = vote count, m = prior votes, R = raw rating, C = global mean
 */
export const bayesianRating = (rating, voteCount) => {
  const v = voteCount ?? 0;
  const m = BAYESIAN_PRIOR_VOTES;
  const C = BAYESIAN_PRIOR_MEAN;
  return (v / (v + m)) * rating + (m / (v + m)) * C;
};

/**
 * Log-scale popularity to prevent blockbusters (pop=5000) from dominating.
 * Output range: 0–10
 */
const normalizePopularity = (popularity) => {
  if (!popularity || popularity <= 0) return 0;
  return Math.min((Math.log10(popularity + 1) / Math.log10(1001)) * 10, 10);
};

// ─── Future factor stubs ──────────────────────────────────────────────────────
// Each returns a raw score in [0, 10]. Swap the stub body for real logic.

/** Genre overlap between candidate and user's library genres. */
const scoreGenreMatch = (_movie, _userGenres) => 0;        // TODO

/** Tag overlap between candidate and user's library tags. */
const scoreTagMatch = (_movie, _userTags) => 0;            // TODO

/** Boost based on user's average playtime signal (games → movies bridge). */
const scorePlaytimeWeight = (_movie, _userHistory) => 0;   // TODO

/** Affinity toward the item's source (e.g., user mostly saves TMDB items). */
const scoreSourceAffinity = (_movie, _userSources) => 0;   // TODO

// ─── Explanation builder ──────────────────────────────────────────────────────

/**
 * Builds a human-readable array of reasons that explain why this item was
 * recommended. Ordered from most to least impactful.
 */
const buildExplanation = ({ crossHits, adjustedRating, popularityScore }) => {
  const parts = [];

  if (crossHits > 1) {
    parts.push(`Overlaps with ${crossHits} of your saved films`);
  } else if (crossHits === 1) {
    parts.push('Recommended based on a film you saved');
  }

  if (adjustedRating >= RATING_HIGH_THRESHOLD) {
    parts.push('Strong rating confidence');
  } else if (adjustedRating >= RATING_SOLID_THRESHOLD) {
    parts.push('Solid rating');
  }

  if (popularityScore >= POP_HIGH_THRESHOLD) {
    parts.push('Popular among similar titles');
  }

  return parts;
};

// ─── Core scorer ─────────────────────────────────────────────────────────────

/**
 * Compute the full scored result for a candidate item.
 *
 * @param {number}   crossHits      — how many seed items recommended this candidate
 * @param {number}   rating         — raw TMDB rating
 * @param {number}   voteCount      — TMDB vote count
 * @param {number}   popularity     — TMDB popularity score
 * @param {number[]} matchedSources — tmdbIds of the seed items that contributed
 * @returns {{
 *   totalScore:     number,
 *   breakdown:      object,
 *   explanation:    string[],
 *   matchedSources: number[],
 * }}
 */
export const computeScore = (
  crossHits,
  rating,
  voteCount,
  popularity,
  matchedSources = [],
) => {
  const adjustedRating  = bayesianRating(rating ?? 0, voteCount ?? 0);
  const popularityScore = normalizePopularity(popularity);

  // Active factors
  const crossHitScore = crossHits * WEIGHT_CROSS_HIT;
  const ratingScore   = adjustedRating * WEIGHT_RATING;

  // Future factors — all zero until implemented
  const genreMatchScore      = scoreGenreMatch(null, null);
  const tagMatchScore        = scoreTagMatch(null, null);
  const playtimeWeightScore  = scorePlaytimeWeight(null, null);
  const sourceAffinityScore  = scoreSourceAffinity(null, null);

  const totalScore =
    crossHitScore +
    ratingScore +
    popularityScore +
    genreMatchScore +
    tagMatchScore +
    playtimeWeightScore +
    sourceAffinityScore;

  return {
    totalScore,
    breakdown: {
      crossHitScore,
      ratingScore,
      popularityScore,
      // Future factors — present in the shape now so clients can handle them
      genreMatchScore,
      tagMatchScore,
      playtimeWeightScore,
      sourceAffinityScore,
    },
    explanation:    buildExplanation({ crossHits, adjustedRating, popularityScore }),
    matchedSources,
  };
};

// ─── Core engine ──────────────────────────────────────────────────────────────

/**
 * Build a scored, deduplicated recommendation list from seed TMDB IDs.
 *
 * Each returned item includes all legacy fields (score, crossHits) for
 * backward compat PLUS new fields (scoreBreakdown, explanation, matchedSources).
 *
 * @param {number[]} favoriteTmdbIds
 * @returns {Promise<ScoredMovie[]>}
 */
export const buildRecommendations = async (favoriteTmdbIds) => {
  if (!favoriteTmdbIds.length) return [];

  const favSet = new Set(favoriteTmdbIds);

  // fetchWithConcurrencyLimit preserves order: results[i] ↔ favoriteTmdbIds[i]
  const results = await fetchWithConcurrencyLimit(
    favoriteTmdbIds,
    getMovieRecommendations,
    TMDB_CONCURRENCY_LIMIT,
  );

  // Accumulate candidates, tracking which seed IDs contributed to each
  const movieMap = new Map(); // tmdbId → { ...movie, crossHits, matchedSources[] }

  for (let i = 0; i < results.length; i++) {
    const result  = results[i];
    const seedId  = favoriteTmdbIds[i];

    if (result.status !== 'fulfilled') continue;

    for (const movie of result.value) {
      if (favSet.has(movie.tmdbId)) continue;
      if ((movie.voteCount ?? 0) < MIN_VOTE_COUNT) continue;

      if (movieMap.has(movie.tmdbId)) {
        const entry = movieMap.get(movie.tmdbId);
        entry.crossHits += 1;
        entry.matchedSources.push(seedId);
      } else {
        movieMap.set(movie.tmdbId, {
          ...movie,
          crossHits:      1,
          matchedSources: [seedId],
        });
      }
    }
  }

  // Score and annotate every candidate
  const scored = [...movieMap.values()]
    .map(movie => {
      const { totalScore, breakdown, explanation, matchedSources } = computeScore(
        movie.crossHits,
        movie.rating,
        movie.voteCount,
        movie.popularity,
        movie.matchedSources,
      );

      return {
        ...movie,
        // ── Backward-compat field ─────────────────────────────────────────
        score: totalScore,
        // ── New explainability fields ─────────────────────────────────────
        scoreBreakdown:  breakdown,
        explanation,
        matchedSources,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS);

  return scored;
};

/**
 * Generate and persist recommendations for an authenticated user.
 */
export const generateForUser = async (user) => {
  const favIds = user.library
    .filter(i => i.type === 'movie' && i.tmdbId)
    .map(i => i.tmdbId);

  const recommendations = await buildRecommendations(favIds);

  if (recommendations.length) {
    pushRecommendationHistory(user._id, {
      basedOnIds: favIds.map(id => `movie_${id}`),
      itemIds:    recommendations.map(r => `movie_${r.tmdbId}`),
      // Legacy fields kept for existing history rows
      basedOn:  favIds,
      movieIds: recommendations.map(r => r.tmdbId),
    }).catch(err => console.error('Failed to save recommendation history:', err));
  }

  return recommendations;
};
