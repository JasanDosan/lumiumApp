import { useEffect, useReducer, useRef, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { rawgService } from '@/services/rawgService';
import { useUserLibraryStore, normalizeGame, normalizeMovie, normalizeSeries } from '@/features/library/libraryStore';
import MovieCard from '@/features/movies/MovieCard';

// ─── Reducer ──────────────────────────────────────────────────────────────────
// Single atomic state → no double-fetch when query resets page to 1.

const INITIAL = {
  query:        '',
  page:         1,
  results:      [],
  totalPages:   0,
  totalResults: 0,
  isLoading:    false,
  error:        null,
};

function reducer(state, action) {
  switch (action.type) {

    case 'NEW_QUERY':
      return { ...INITIAL, query: action.query, isLoading: !!action.query.trim() };

    case 'LOAD_MORE':
      if (state.isLoading || state.page >= state.totalPages) return state;
      return { ...state, page: state.page + 1, isLoading: true };

    case 'LOADED': {
      const seen = new Set(state.results.map(m => m.tmdbId));
      const fresh = action.results.filter(m => !seen.has(m.tmdbId));
      return {
        ...state,
        results:      state.page === 1 ? action.results : [...state.results, ...fresh],
        totalPages:   action.totalPages,
        totalResults: action.totalResults,
        isLoading:    false,
        error:        null,
      };
    }

    case 'ERROR':
      return { ...state, isLoading: false, error: action.message };

    default:
      return state;
  }
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }) {
  if (!query?.trim() || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/20 text-accent not-italic rounded-sm">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─── Game card for search results (with Add button) ──────────────────────────

function SearchGameCard({ game, query }) {
  const { addItem, removeItem, hasGame } = useUserLibraryStore();
  const saved = hasGame(game.id);

  const toggle = () => {
    if (saved) removeItem(`game_${game.id}`);
    else addItem(normalizeGame(game));
  };

  return (
    <div className="group flex flex-col">
      {/* Landscape image */}
      <div className="relative rounded-xl overflow-hidden bg-surface-high" style={{ aspectRatio: '16/9' }}>
        {game.image ? (
          <img
            src={game.image}
            alt={game.title ?? game.name}
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🎮</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute top-2 left-2 text-[9px] font-black tracking-[0.15em] uppercase
                         px-2 py-0.5 rounded text-white bg-accent">
          GAME
        </span>
        {game.rating != null && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold text-white/70
                           bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
            ★ {typeof game.rating === 'number' ? game.rating.toFixed(1) : game.rating}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 px-2.5 pb-2.5">
          <p className="text-[12px] font-semibold text-white leading-snug line-clamp-2">
            <Highlight text={game.title ?? game.name} query={query} />
          </p>
          {game.tags?.length > 0 && (
            <p className="text-[10px] text-white/50 mt-0.5 truncate">{game.tags.slice(0, 2).join(' · ')}</p>
          )}
        </div>
      </div>

      <button
        onClick={toggle}
        className={`mt-1.5 w-full text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-colors duration-150 ${
          saved
            ? 'bg-accent/10 border-accent/30 text-accent'
            : 'border-line text-ink-light hover:border-accent/40 hover:text-accent'
        }`}
      >
        {saved ? '✓ In Library' : '+ Add to Library'}
      </button>
    </div>
  );
}

// ─── Add button for movie/series search results ───────────────────────────────

function SearchMediaAddButton({ movie }) {
  const { addItem, removeItem, hasMovie, hasSeries } = useUserLibraryStore();
  const isTv  = movie.mediaType === 'tv';
  const saved = isTv ? hasSeries(movie.tmdbId) : hasMovie(movie.tmdbId);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) {
      removeItem(`${isTv ? 'series' : 'movie'}_${Number(movie.tmdbId)}`);
    } else {
      addItem(isTv ? normalizeSeries(movie) : normalizeMovie(movie));
    }
  };

  return (
    <button
      onClick={toggle}
      className={`mt-1.5 w-full text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-colors duration-150 ${
        saved
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'border-line text-ink-light hover:border-accent/40 hover:text-accent'
      }`}
    >
      {saved ? '✓ In Library' : '+ Add to Library'}
    </button>
  );
}

// ─── Games skeleton ───────────────────────────────────────────────────────────

function GamesSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton rounded-xl" style={{ aspectRatio: '16/9' }} />
          <div className="mt-1.5 skeleton h-6 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton strip (appended pages) ─────────────────────────────────────────

function AppendSkeleton() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 mt-4"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] skeleton rounded-md" />
          <div className="mt-2.5 space-y-1.5">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-2.5 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Full-page skeleton (first load) ─────────────────────────────────────────

function FirstLoadSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] skeleton rounded-md" />
          <div className="mt-2.5 space-y-1.5">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-2.5 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SearchPage ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL,
    query:     urlQuery,
    isLoading: !!urlQuery.trim(),

    
  });

  //console

 // console.log({
 //   page: state.page,
 //   totalPages: state.totalPages,
 //   hasMore: state.page < state.totalPages,
//  });


  
  // ── Games state (RAWG — first page only, no pagination) ───────────────────
  const [games, setGames]             = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  const sentinelRef = useRef(null);
  const inputRef    = useRef(null);

  const hasMore     = state.page < state.totalPages;
  const isFirstLoad = state.isLoading && state.page === 1;
  const isAppending = state.isLoading && state.page > 1;

  // ── Sync URL → state ───────────────────────────────────────────────────────
  useEffect(() => {
    if (urlQuery !== state.query) {
      dispatch({ type: 'NEW_QUERY', query: urlQuery });
    }
  }, [urlQuery]); // eslint-disable-line

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.query.trim()) return;

    let cancelled = false;

    movieService.search(state.query.trim(), state.page)
      .then(data => {
        if (cancelled) return;
        dispatch({
          type:         'LOADED',
          results:      data.results      || [],
          totalPages:   Math.min(data.totalPages   || 1, 500), // TMDB caps at 500
          totalResults: data.totalResults || 0,
        });
      })
      .catch(err => {
        if (!cancelled) dispatch({ type: 'ERROR', message: err.message });
      });

    return () => { cancelled = true; };
  }, [state.query, state.page]);

  // ── RAWG game search (query only — no pagination) ─────────────────────────
  useEffect(() => {
    if (!state.query.trim()) { setGames([]); setGamesLoading(false); return; }

    setGamesLoading(true);
    rawgService.search(state.query.trim(), 6)
      .then(results => {
        console.log('RAWG RAW:', results);
        console.log('RAWG RESULTS:', results);
        console.log('MAPPED GAMES:', results);
        setGames(results);
      })
      .catch(err => {
        console.warn('[SearchPage] RAWG search failed:', err.message);
        setGames([]);
      })
      .finally(() => setGamesLoading(false));
  }, [state.query]);

  // ── IntersectionObserver ───────────────────────────────────────────────────
  // Re-created whenever loading finishes. Because IntersectionObserver fires
  // synchronously on .observe() if the element is already intersecting, this
  // handles short result lists where the sentinel is always in view.
  useEffect(() => {
    if (state.isLoading || !hasMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dispatch({ type: 'LOAD_MORE' });
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [state.isLoading, hasMore]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (!q) return;
    setSearchParams({ q });
  }, [setSearchParams]);

  const handleInputChange = useCallback((e) => {
    // Keep controlled-ish without extra state — just read on submit
    // but also allow Enter key via form onSubmit
    e.target.value = e.target.value; // noop, value tracked by DOM
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pt-8 pb-20">

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="mb-8 max-w-xl">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              key={urlQuery}           // reset DOM value when URL query changes
              defaultValue={urlQuery}  // uncontrolled — avoids extra state
              onChange={handleInputChange}
              placeholder="Search films…"
              autoFocus
              className="w-full pl-11 pr-20 py-3 rounded-full text-sm bg-surface border border-line
                         text-ink placeholder:text-ink-light
                         focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-white text-xs font-medium
                         px-4 py-1.5 rounded-full hover:bg-accent-hover transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Result header */}
        {state.query && (
          <div className="mb-7">
            <p className="section-label mb-1">
              {isFirstLoad
                ? 'Searching…'
                : state.totalResults > 0
                  ? `${state.totalResults.toLocaleString()} result${state.totalResults !== 1 ? 's' : ''}`
                  : 'No results'}
            </p>
            {!isFirstLoad && (
              <h1 className="text-2xl font-bold text-ink">"{state.query}"</h1>
            )}
            {!isFirstLoad && state.results.length > 0 && (
              <p className="text-xs text-ink-light mt-1">
                Showing {state.results.length.toLocaleString()} of {state.totalResults.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Empty prompt (no query) */}
        {!state.query && (
          <p className="py-20 text-center text-sm text-ink-light">
            Enter a search term above.
          </p>
        )}

        {/* Error */}
        {state.error && !isFirstLoad && (
          <p className="py-10 text-center text-sm text-ink-mid">{state.error}</p>
        )}

        {/* First-load skeleton */}
        {isFirstLoad && <FirstLoadSkeleton />}

        {/* Games section (RAWG) */}
        {!isFirstLoad && (gamesLoading || games.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Games</p>
            </div>
            {gamesLoading ? (
              <GamesSkeleton />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {games.map(game => (
                  <SearchGameCard key={game.id} game={game} query={state.query} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results grid */}
        {!isFirstLoad && state.results.length > 0 && (
          <div>
            {(games.length > 0 || gamesLoading) && (
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">Movies &amp; Series</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {state.results.map(movie => (
                <div key={movie.tmdbId} className="flex flex-col">
                  <MovieCard movie={movie} />
                  <SearchMediaAddButton movie={movie} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No results (query exists, loaded, nothing found) */}
        {!isFirstLoad && !state.isLoading && state.query && state.results.length === 0 && !state.error && (
          <div className="py-20 text-center">
            <p className="text-sm text-ink-light">No films found for "{state.query}"</p>
          </div>
        )}

        {/* Appending skeleton */}
        {isAppending && <AppendSkeleton />}

        {/* End-of-results message */}
        {!hasMore && !state.isLoading && state.results.length > 0 && (
          <p className="text-center text-xs text-ink-light mt-10 pb-2">
            {state.results.length === state.totalResults
              ? `All ${state.totalResults.toLocaleString()} results loaded`
              : `Showing ${state.results.length.toLocaleString()} results`}
          </p>
        )}

        {/* Sentinel — IntersectionObserver target */}
        <div ref={sentinelRef} className="h-px mt-4" aria-hidden="true" />
      </div>
    </div>
  );
}
