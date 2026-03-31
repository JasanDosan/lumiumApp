/**
 * recommendationService.js
 *
 * Scoring formula:
 *   score = (crossHits * 3) + (adjustedRating * 2) + normalizedPopularity
 *
 * - crossHits: how many of the user's favorites recommended this movie
 * - adjustedRating: Bayesian-adjusted rating (penalizes low vote counts)
 * - normalizedPopularity: log-scaled TMDB popularity to reduce dominance of
 *   blockbusters over genuinely relevant matches
 *
 * Design: pure business logic, no Express/DOM dependencies → reusable in RN.
 */

import { getMovieRecommendations } from './tmdbService.js';
import { pushRecommendationHistory } from '../repositories/userRepository.js';

const MAX_RECOMMENDATIONS = 50;
const TMDB_CONCURRENCY_LIMIT = 5; // max parallel TMDB requests (rate limit: 40/10s)
const MIN_VOTE_COUNT = 20;        // ignore movies with too few votes
const BAYESIAN_PRIOR_VOTES = 500; // assumed vote count for prior
const BAYESIAN_PRIOR_MEAN = 6.5;  // global TMDB average rating

// ─── Concurrency limiter ──────────────────────────────────────────────────────

const chunked = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const fetchWithConcurrencyLimit = async (ids, fetcher, limit) => {
  const results = [];
  for (const chunk of chunked(ids, limit)) {
    const chunkResults = await Promise.allSettled(chunk.map(fetcher));
    results.push(...chunkResults);
  }
  return results;
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Bayesian average: smooths out ratings on movies with few votes.
 * A movie with 5 votes and rating 10 gets pulled toward the global mean.
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

export const computeScore = (crossHits, rating, voteCount, popularity) => {
  const adjusted = bayesianRating(rating ?? 0, voteCount ?? 0);
  const pop = normalizePopularity(popularity);
  return crossHits * 3 + adjusted * 2 + pop;
};

// ─── Core engine ──────────────────────────────────────────────────────────────

/**
 * Build a scored, deduplicated recommendation list from favorite movie IDs.
 * @param {number[]} favoriteTmdbIds
 * @returns {Promise<ScoredMovie[]>}
 */
export const buildRecommendations = async (favoriteTmdbIds) => {
  if (!favoriteTmdbIds.length) return [];

  // Use a Set for O(1) membership checks instead of Array.includes() O(n)
  const favSet = new Set(favoriteTmdbIds);

  const results = await fetchWithConcurrencyLimit(
    favoriteTmdbIds,
    getMovieRecommendations,
    TMDB_CONCURRENCY_LIMIT
  );

  const movieMap = new Map();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const movie of result.value) {
      if (favSet.has(movie.tmdbId)) continue;
      // Filter out movies with too few votes — their ratings are unreliable
      if ((movie.voteCount ?? 0) < MIN_VOTE_COUNT) continue;

      if (movieMap.has(movie.tmdbId)) {
        movieMap.get(movie.tmdbId).crossHits += 1;
      } else {
        movieMap.set(movie.tmdbId, { ...movie, crossHits: 1 });
      }
    }
  }

  const scored = [...movieMap.values()]
    .map(movie => ({
      ...movie,
      score: computeScore(movie.crossHits, movie.rating, movie.voteCount, movie.popularity),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS);

  return scored;
};

/**
 * Generate and persist recommendations for an authenticated user.
 */
export const generateForUser = async (user) => {
  const favIds = user.favorites.map(f => f.tmdbId);
  const recommendations = await buildRecommendations(favIds);

  if (recommendations.length) {
    pushRecommendationHistory(user._id, {
      basedOn: favIds,
      movieIds: recommendations.map(r => r.tmdbId),
    }).catch(err => console.error('Failed to save recommendation history:', err));
  }

  return recommendations;
};
