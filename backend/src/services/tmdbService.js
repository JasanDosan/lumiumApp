import axios from 'axios';

const tmdb = axios.create({
  baseURL: process.env.TMDB_BASE_URL,
  params: { api_key: process.env.TMDB_API_KEY, language: 'en-US' },
  timeout: 10000,
});

// ─── Retry interceptor (handles 429 rate-limit and transient 5xx) ─────────────
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

tmdb.interceptors.response.use(null, async (error) => {
  const config = error.config;
  if (!config) return Promise.reject(error);

  config.__retries = (config.__retries ?? 0) + 1;
  const status = error.response?.status;

  if (config.__retries <= MAX_RETRIES && RETRYABLE.has(status)) {
    // Respect Retry-After header from TMDB on 429
    const retryAfter = error.response?.headers?.['retry-after'];
    const delay = retryAfter ? Number(retryAfter) * 1000 : 2 ** config.__retries * 300;
    await new Promise(r => setTimeout(r, delay));
    return tmdb(config);
  }

  return Promise.reject(error);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildImageUrl = (path, size = 'w500') =>
  path ? `${process.env.TMDB_IMAGE_BASE_URL}/${size}${path}` : null;

const normalizeMovie = (movie) => ({
  tmdbId: movie.id,
  title: movie.title,
  overview: movie.overview,
  posterPath: movie.poster_path,
  posterUrl: buildImageUrl(movie.poster_path),
  backdropUrl: buildImageUrl(movie.backdrop_path, 'w1280'),
  rating: movie.vote_average,
  voteCount: movie.vote_count,
  popularity: movie.popularity,
  releaseDate: movie.release_date,
  genreIds: movie.genre_ids ?? [],
  genres: movie.genres ?? [],
});

// ─── API calls ────────────────────────────────────────────────────────────────

export const searchMovies = async (query, page = 1) => {
  const { data } = await tmdb.get('/search/movie', {
    params: { query, page, include_adult: false },
  });
  return {
    results: data.results.map(normalizeMovie),
    totalResults: data.total_results,
    totalPages: data.total_pages,
    page: data.page,
  };
};

export const getMovieDetails = async (tmdbId) => {
  const { data } = await tmdb.get(`/movie/${tmdbId}`, {
    params: { append_to_response: 'credits,videos,keywords' },
  });

  const crew = data.credits?.crew ?? [];
  const directorEntry = crew.find(c => c.job === 'Director');
  const writers = crew
    .filter(c => ['Screenplay', 'Story', 'Writer'].includes(c.job))
    .slice(0, 3)
    .map(w => ({ id: w.id, name: w.name, job: w.job, profileUrl: buildImageUrl(w.profile_path, 'w185') }));
  const producers = crew
    .filter(c => c.job === 'Producer')
    .slice(0, 3)
    .map(p => ({ id: p.id, name: p.name, profileUrl: buildImageUrl(p.profile_path, 'w185') }));

  return {
    ...normalizeMovie(data),
    runtime: data.runtime,
    tagline: data.tagline,
    budget: data.budget,
    revenue: data.revenue,
    status: data.status,
    originalLanguage: data.original_language,
    collectionId: data.belongs_to_collection?.id ?? null,
    collectionName: data.belongs_to_collection?.name ?? null,
    cast: data.credits?.cast?.slice(0, 20).map(c => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profileUrl: buildImageUrl(c.profile_path, 'w185'),
    })) ?? [],
    director: directorEntry?.name ?? null,
    directorId: directorEntry?.id ?? null,
    writers,
    producers,
    trailerKey: data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key ?? null,
  };
};

export const getCollection = async (collectionId) => {
  const { data } = await tmdb.get(`/collection/${collectionId}`);
  return {
    id: data.id,
    name: data.name,
    overview: data.overview,
    posterUrl: buildImageUrl(data.poster_path),
    backdropUrl: buildImageUrl(data.backdrop_path, 'w1280'),
    parts: (data.parts || [])
      .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
      .map(normalizeMovie),
  };
};

export const getSimilarMovies = async (tmdbId, page = 1) => {
  const { data } = await tmdb.get(`/movie/${tmdbId}/similar`, { params: { page } });
  return data.results.map(normalizeMovie);
};

export const getMovieRecommendations = async (tmdbId) => {
  const { data } = await tmdb.get(`/movie/${tmdbId}/recommendations`);
  return data.results.map(normalizeMovie);
};

export const getTrending = async (timeWindow = 'week') => {
  const { data } = await tmdb.get(`/trending/movie/${timeWindow}`);
  return data.results.map(normalizeMovie);
};

export const getPopularMovies = async (page = 1) => {
  const { data } = await tmdb.get('/movie/popular', { params: { page } });
  return data.results.map(normalizeMovie);
};

export const getGenres = async () => {
  const { data } = await tmdb.get('/genre/movie/list');
  return data.genres;
};

export const discoverMovies = async ({
  page = 1,
  genres,
  year_gte,
  year_lte,
  rating_gte,
  sort_by = 'popularity.desc',
  with_person,
  with_watch_providers,
  watch_region,
} = {}) => {
  const params = {
    page,
    sort_by,
    'vote_count.gte': 50,
    include_adult: false,
    ...(genres?.length && { with_genres: Array.isArray(genres) ? genres.join(',') : genres }),
    ...(year_gte && { 'primary_release_date.gte': `${year_gte}-01-01` }),
    ...(year_lte && { 'primary_release_date.lte': `${year_lte}-12-31` }),
    ...(rating_gte && { 'vote_average.gte': rating_gte }),
    ...(with_person && { with_people: with_person }),
    ...(with_watch_providers && { with_watch_providers, watch_monetization_types: 'flatrate' }),
    ...(watch_region && { watch_region }),
  };
  const { data } = await tmdb.get('/discover/movie', { params });
  return {
    results: data.results.map(normalizeMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
    page: data.page,
  };
};

export const getWatchProviders = async (region = 'US') => {
  const { data } = await tmdb.get('/watch/providers/movie', {
    params: { watch_region: region },
  });
  return (data.results || [])
    .map(p => ({
      id: p.provider_id,
      name: p.provider_name,
      logoUrl: buildImageUrl(p.logo_path, 'original'),
      priority: p.display_priorities?.[region] ?? p.display_priority ?? 999,
    }))
    .sort((a, b) => a.priority - b.priority);
};

// ─── TV ───────────────────────────────────────────────────────────────────────

const normalizeTV = (show) => ({
  tmdbId:      show.id,
  title:       show.name,
  overview:    show.overview,
  posterPath:  show.poster_path,
  posterUrl:   buildImageUrl(show.poster_path),
  backdropUrl: buildImageUrl(show.backdrop_path, 'w1280'),
  rating:      show.vote_average,
  voteCount:   show.vote_count,
  popularity:  show.popularity,
  releaseDate: show.first_air_date,
  genreIds:    show.genre_ids ?? [],
  mediaType:   'tv',
});

export const getTrendingTV = async (timeWindow = 'week') => {
  const { data } = await tmdb.get(`/trending/tv/${timeWindow}`);
  return data.results.map(normalizeTV);
};

export const getPopularTV = async (page = 1) => {
  const { data } = await tmdb.get('/tv/popular', { params: { page } });
  return data.results.map(normalizeTV);
};

export const searchMulti = async (query, page = 1) => {
  const { data } = await tmdb.get('/search/multi', {
    params: { query, page, include_adult: false },
  });

  const movies = [];
  const people = [];

  for (const item of data.results) {
    if (item.media_type === 'movie') {
      movies.push(normalizeMovie(item));
    } else if (item.media_type === 'person') {
      people.push({
        id: item.id,
        name: item.name,
        department: item.known_for_department,
        profileUrl: buildImageUrl(item.profile_path, 'w185'),
        knownFor: (item.known_for || [])
          .filter(k => k.media_type === 'movie')
          .slice(0, 3)
          .map(k => k.title),
      });
    }
  }

  return { movies, people };
};

export const getPersonDetails = async (personId) => {
  const { data } = await tmdb.get(`/person/${personId}`, {
    params: { append_to_response: 'movie_credits' },
  });

  const castMovies = (data.movie_credits?.cast || [])
    .filter(m => m.poster_path)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20)
    .map(normalizeMovie);

  const crewMovies = (data.movie_credits?.crew || [])
    .filter(m => m.poster_path && m.job === 'Director')
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20)
    .map(normalizeMovie);

  return {
    id: data.id,
    name: data.name,
    biography: data.biography,
    birthday: data.birthday,
    deathday: data.deathday,
    placeOfBirth: data.place_of_birth,
    department: data.known_for_department,
    profileUrl: buildImageUrl(data.profile_path, 'h632'),
    cast: castMovies,
    directed: crewMovies,
  };
};
