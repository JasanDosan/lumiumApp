import { useEffect, useReducer, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { movieService } from '@/services/movieService';
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
              className="w-full pl-11 pr-20 py-3 rounded-full text-sm bg-white border border-line
                         text-ink placeholder:text-ink-light
                         focus:outline-none focus:border-ink/30 focus:ring-1 focus:ring-ink/10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-ink text-white text-xs font-medium
                         px-4 py-1.5 rounded-full hover:bg-ink/80 transition-colors"
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

        {/* Results grid */}
        {!isFirstLoad && state.results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {state.results.map(movie => (
              <MovieCard key={movie.tmdbId} movie={movie} />
            ))}
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
