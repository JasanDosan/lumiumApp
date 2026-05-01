/**
 * mediaMappers.js — server-side mapper utilities
 *
 * Converts raw API objects from external sources into the unified
 * libraryItemSchema shape. These run in the backend when ingesting data
 * (e.g., during batch imports or migration scripts).
 *
 * Each mapper guarantees:
 *   - Compound `id` (e.g., "movie_12345")
 *   - Explicit `externalId` and `source`
 *   - Canonical `imageUrl` field
 *   - Non-null `metadata` object for source-specific extras
 *   - All legacy fields preserved for backward compat
 */

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// ─── TMDB ─────────────────────────────────────────────────────────────────────

/**
 * Map a normalised TMDB movie object (as returned by tmdbService.normalizeMovie)
 * into a library item ready for persistence.
 */
export function mapTmdbMovieToLibraryItem(movie) {
  const tmdbId     = Number(movie.tmdbId ?? movie.id);
  const posterPath = movie.posterPath ?? null;
  const imageUrl   = posterPath
    ? `${TMDB_IMAGE_BASE}${posterPath}`
    : (movie.posterUrl ?? null);

  return {
    id:          `movie_${tmdbId}`,
    externalId:  String(tmdbId),
    source:      'tmdb',
    type:        'movie',
    title:       movie.title ?? movie.name ?? '',
    imageUrl,
    image:       imageUrl,           // legacy alias — keep in sync
    rating:      movie.rating      ?? null,
    genres:      movie.genre_ids   ?? movie.genreIds ?? movie.genres ?? [],
    tags:        [],
    tmdbId,
    posterPath,
    backdropUrl: movie.backdropUrl ?? null,
    posterUrl:   movie.posterUrl   ?? null,
    releaseDate: movie.releaseDate ?? null,
    metadata: {
      voteCount:  movie.voteCount  ?? null,
      popularity: movie.popularity ?? null,
      overview:   movie.overview   ?? null,
    },
    addedAt: new Date(),
  };
}

/**
 * Map a normalised TMDB series object into a library item.
 */
export function mapTmdbSeriesToLibraryItem(series) {
  const tmdbId     = Number(series.tmdbId ?? series.id);
  const posterPath = series.posterPath ?? null;
  const imageUrl   = posterPath
    ? `${TMDB_IMAGE_BASE}${posterPath}`
    : (series.posterUrl ?? null);

  return {
    id:          `series_${tmdbId}`,
    externalId:  String(tmdbId),
    source:      'tmdb',
    type:        'series',
    title:       series.title ?? series.name ?? '',
    imageUrl,
    image:       imageUrl,
    rating:      series.rating      ?? null,
    genres:      series.genre_ids   ?? series.genreIds ?? series.genres ?? [],
    tags:        [],
    tmdbId,
    posterPath,
    backdropUrl: series.backdropUrl ?? null,
    posterUrl:   series.posterUrl   ?? null,
    releaseDate: series.releaseDate ?? series.firstAirDate ?? null,
    metadata: {
      voteCount:    series.voteCount    ?? null,
      popularity:   series.popularity   ?? null,
      overview:     series.overview     ?? null,
      firstAirDate: series.firstAirDate ?? null,
    },
    addedAt: new Date(),
  };
}

// ─── RAWG ─────────────────────────────────────────────────────────────────────

/**
 * Map a RAWG game object into a library item.
 */
export function mapRawgGameToLibraryItem(game) {
  const rawId    = String(game.id ?? game.rawId ?? '');
  const imageUrl = game.background_image ?? game.image ?? null;

  return {
    id:         `game_${rawId}`,
    externalId: rawId,
    source:     'rawg',
    type:       'game',
    title:      game.name ?? game.title ?? '',
    imageUrl,
    image:      imageUrl,
    rating:     game.rating ?? null,
    genres:     [],
    tags:       game.tags ?? [],
    rawId,
    metadata: {
      platforms: game.platforms ?? [],
      released:  game.released  ?? null,
      playtime:  game.playtime  ?? null,
    },
    addedAt: new Date(),
  };
}

// ─── Legacy migration ─────────────────────────────────────────────────────────

/**
 * Maps a legacy favorites item (old `favorites[]` shape: tmdbId, title,
 * posterPath, rating) into the current library item schema.
 *
 * Use this in migration scripts or when processing data from users who
 * registered before the library refactor.
 */
export function mapLegacyFavoriteToLibraryItem(favorite) {
  const tmdbId     = Number(favorite.tmdbId ?? favorite.id);
  const posterPath = favorite.posterPath ?? null;
  const imageUrl   = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;

  return {
    id:          `movie_${tmdbId}`,
    externalId:  String(tmdbId),
    source:      'tmdb',
    type:        'movie',
    title:       favorite.title ?? '',
    imageUrl,
    image:       imageUrl,
    rating:      favorite.rating ?? null,
    genres:      [],
    tags:        [],
    tmdbId,
    posterPath,
    metadata:    {},
    addedAt:     favorite.addedAt ? new Date(favorite.addedAt) : new Date(),
  };
}
