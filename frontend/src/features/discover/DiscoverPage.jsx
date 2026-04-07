/**
 * DiscoverPage — cross-media exploration hub.
 *
 * Two modes:
 *   Browse  (empty query)  → trending rows per media type, filterable by genre/sort
 *   Search  (active query) → grouped result sections per type with save buttons
 *
 * Tabs: All | Games | Movies | Series
 *   Browse: tab controls which trending rows and filter chips are shown
 *   Search: tab filters which result sections are visible
 *
 * Search logic is fully contained in useDiscoverSearch.
 * Trending logic is fully contained in useDiscoverTrending.
 * Rendering components (ResultGrid, SectionHead, etc.) are media-aware and type-agnostic.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { rawgService }         from '@/services/rawgService';
import { movieService }        from '@/services/movieService';
import { tvService }           from '@/services/tvService';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import ExpandableRow           from '@/components/ui/ExpandableRow';
import UnifiedCard             from '@/components/ui/UnifiedCard';
import DragRow                 from '@/components/ui/DragRow';
import { toast }               from '@/stores/toastStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',    label: 'All'    },
  { id: 'games',  label: 'Games'  },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
];

// TMDB genre quick chips — used for Movies / Series / All browse mode
const TMDB_GENRES = [
  { id: 28,    label: 'Action'    },
  { id: 35,    label: 'Comedy'    },
  { id: 18,    label: 'Drama'     },
  { id: 27,    label: 'Horror'    },
  { id: 878,   label: 'Sci-Fi'   },
  { id: 10749, label: 'Romance'   },
  { id: 12,    label: 'Adventure' },
  { id: 9648,  label: 'Mystery'   },
  { id: 16,    label: 'Animation' },
  { id: 80,    label: 'Crime'     },
];

const GAME_SORTS = [
  { id: 'trending',  label: 'Trending'  },
  { id: 'top-rated', label: 'Top Rated' },
];

// ─── useDiscoverSearch — search logic, separated from rendering ───────────────

function useDiscoverSearch(query, tab) {
  const [state, setState] = useState({
    games: [], movies: [], series: [], loading: false, error: null,
  });

  useEffect(() => {
    if (!query.trim()) {
      setState({ games: [], movies: [], series: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null, games: [], movies: [], series: [] }));

    const wantGames  = tab === 'all' || tab === 'games';
    const wantMovies = tab === 'all' || tab === 'movies';
    const wantSeries = tab === 'all' || tab === 'series';

    // Games — fetch immediately (RAWG is independent of TMDB rate limits)
    if (wantGames) {
      rawgService.search(query, 12)
        .then(results => {
          if (!cancelled) setState(s => ({ ...s, games: results.slice(0, 12) }));
        })
        .catch(() => {
          if (!cancelled) setState(s => ({ ...s, games: [] }));
        });
    }

    // Movies + Series — stagger 300 ms to protect TMDB rate limit
    let tmdbTimer = null;
    if (wantMovies || wantSeries) {
      tmdbTimer = setTimeout(() => {
        movieService.searchMulti(query)
          .then(data => {
            if (cancelled) return;
            setState(s => ({
              ...s,
              movies:  wantMovies ? (data.movies ?? []).slice(0, 16) : s.movies,
              series:  wantSeries ? (data.tv    ?? []).slice(0, 16) : s.series,
              loading: false,
            }));
          })
          .catch(() => {
            if (!cancelled) setState(s => ({ ...s, loading: false, error: 'Search failed. Try again.' }));
          });
      }, 300);
    } else {
      // No TMDB call needed — mark loading done after games resolve
      setTimeout(() => {
        if (!cancelled) setState(s => ({ ...s, loading: false }));
      }, 50);
    }

    return () => {
      cancelled = true;
      if (tmdbTimer) clearTimeout(tmdbTimer);
    };
  }, [query, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ─── useDiscoverTrending — browse-mode trending, separated from rendering ─────

function useDiscoverTrending(tab, genreId, gameSort) {
  const [games,         setGames]         = useState([]);
  const [gamesLoading,  setGamesLoading]  = useState(true);
  const [movies,        setMovies]        = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [series,        setSeries]        = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const fetchedRef   = useRef(false);
  const prevGenreRef = useRef(genreId);
  const prevSortRef  = useRef(gameSort);

  // Initial staggered fetch — runs once (StrictMode-safe via fetchedRef)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    rawgService.getTrending(16)
      .then(setGames).catch(() => {}).finally(() => setGamesLoading(false));

    setTimeout(() => {
      movieService.getTrending()
        .then(d => setMovies((d.results ?? []).slice(0, 20)))
        .catch(() => {})
        .finally(() => setMoviesLoading(false));
    }, 300);

    setTimeout(() => {
      tvService.getTrending()
        .then(d => setSeries((d.results ?? []).slice(0, 20)))
        .catch(() => {})
        .finally(() => setSeriesLoading(false));
    }, 600);
  }, []);

  // Re-fetch when genre chip or game-sort changes
  useEffect(() => {
    const genreChanged = genreId  !== prevGenreRef.current;
    const sortChanged  = gameSort !== prevSortRef.current;
    if (!genreChanged && !sortChanged) return;
    prevGenreRef.current = genreId;
    prevSortRef.current  = gameSort;

    // Game sort changed
    if (sortChanged) {
      setGamesLoading(true);
      const p = gameSort === 'top-rated'
        ? rawgService.getTopRated(16)
        : rawgService.getTrending(16);
      p.then(setGames).catch(() => {}).finally(() => setGamesLoading(false));
    }

    // Genre chip changed — re-fetch movies and/or series
    if (genreChanged) {
      const affectsMovies = tab === 'movies' || tab === 'all';
      const affectsSeries = tab === 'series' || tab === 'all';

      if (affectsMovies) {
        setMoviesLoading(true);
        const p = genreId !== null
          ? movieService.discover({ genres: [genreId], page: 1 })
          : movieService.getTrending();
        p.then(d => setMovies((d.results ?? []).slice(0, 20)))
          .catch(() => {})
          .finally(() => setMoviesLoading(false));
      }

      if (affectsSeries) {
        setSeriesLoading(true);
        const p = genreId !== null
          ? tvService.discover({ genres: [genreId] })
          : tvService.getTrending();
        p.then(d => setSeries((d.results ?? []).slice(0, 20)))
          .catch(() => {})
          .finally(() => setSeriesLoading(false));
      }
    }
  }, [genreId, gameSort, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return { games, gamesLoading, movies, moviesLoading, series, seriesLoading };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ overline, title, color = 'default', count }) {
  const colorMap = {
    accent:  { bar: 'bg-accent',     over: 'text-accent'     },
    amber:   { bar: 'bg-amber-500',  over: 'text-amber-400'  },
    violet:  { bar: 'bg-violet-500', over: 'text-violet-400' },
    default: { bar: 'bg-line',       over: 'text-ink-light'  },
  };
  const c = colorMap[color] ?? colorMap.default;
  return (
    <div className="flex items-end gap-3 mb-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`w-0.5 h-5 ${c.bar} rounded-full shrink-0`} />
          <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.over}`}>{overline}</p>
        </div>
        <h2 className="title-lg">{title}</h2>
      </div>
      {count != null && (
        <span className="mb-0.5 text-xs text-ink-light">
          {count} result{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RowSkeleton({ count = 6 }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 w-52 sm:w-60">
          <div className="skeleton aspect-video rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="skeleton h-3 w-3/4 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

// ─── ResultGrid — media-aware result grid for search mode ─────────────────────

function ResultGrid({ items, type }) {
  const {
    toggleGame,   hasGame,
    toggleMovie,  hasMovie,
    toggleSeries, hasSeries,
  } = useUserLibraryStore();

  const getProps = useCallback((item) => {
    const label = item.title ?? item.name ?? '';
    if (type === 'game') {
      const saved = hasGame(item.id ?? item.rawId);
      return {
        isInLibrary: saved,
        onAddToLibrary: () => {
          toggleGame(item);
          toast(saved ? 'Removed from library' : `Saved — ${label}`);
        },
      };
    }
    if (type === 'movie') {
      const saved = hasMovie(item.tmdbId ?? item.id);
      return {
        isInLibrary: saved,
        onAddToLibrary: () => {
          toggleMovie(item);
          toast(saved ? 'Removed from library' : `Saved — ${label}`);
        },
      };
    }
    const saved = hasSeries(item.tmdbId ?? item.id);
    return {
      isInLibrary: saved,
      onAddToLibrary: () => {
        toggleSeries(item);
        toast(saved ? 'Removed from library' : `Saved — ${label}`);
      },
    };
  }, [type, hasGame, toggleGame, hasMovie, toggleMovie, hasSeries, toggleSeries]);

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map(item => {
        const key = `${type}-${item.tmdbId ?? item.id}`;
        const { isInLibrary, onAddToLibrary } = getProps(item);
        return (
          <div key={key}>
            <UnifiedCard
              item={item}
              type={type}
              isInLibrary={isInLibrary}
              onAddToLibrary={onAddToLibrary}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

function FilterChips({ items, activeId, onSelect, color = 'accent' }) {
  const colors = {
    accent: 'bg-accent text-white border-accent shadow-accent/20',
    amber:  'bg-amber-500 text-white border-amber-500 shadow-amber-500/20',
    violet: 'bg-violet-500 text-white border-violet-500 shadow-violet-500/20',
  };
  const activeClass = colors[color] ?? colors.accent;

  return (
    <DragRow gap="gap-2" className="pb-1">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(activeId === item.id ? null : item.id)}
          className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border
                     transition-all duration-200 pointer-events-auto ${
            activeId === item.id
              ? `${activeClass} shadow-md`
              : 'bg-surface border-line text-ink-mid hover:border-ink/30 hover:text-ink'
          }`}
        >
          {item.label}
        </button>
      ))}
    </DragRow>
  );
}

// ─── Empty / error states ─────────────────────────────────────────────────────

function NoResults({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
      <p className="text-3xl">🔍</p>
      <p className="text-sm font-semibold text-ink mt-1">
        No results for &ldquo;{query}&rdquo;
      </p>
      <p className="text-xs text-ink-light max-w-xs">
        Try different keywords, or browse trending content below.
      </p>
    </div>
  );
}

function SearchError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <p className="text-sm text-ink-mid">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs text-accent hover:underline transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

// ─── DiscoverPage ─────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [searchTerm,     setSearchTerm]     = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab,      setActiveTab]      = useState('all');
  const [genreFilter,    setGenreFilter]    = useState(null); // TMDB genre id | null
  const [gameSort,       setGameSort]       = useState('trending');

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Debounce input → debouncedQuery
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchTerm.trim()), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Reset genre filter when tab switches
  useEffect(() => { setGenreFilter(null); }, [activeTab]);

  const isSearchActive = debouncedQuery.length > 0;

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const {
    games: searchGames, movies: searchMovies, series: searchSeries,
    loading: searchLoading, error: searchError,
  } = useDiscoverSearch(debouncedQuery, activeTab);

  const {
    games: trendGames,  gamesLoading,
    movies: trendMovies, moviesLoading,
    series: trendSeries, seriesLoading,
  } = useDiscoverTrending(activeTab, genreFilter, gameSort);

  const {
    toggleGame, hasGame, toggleMovie, hasMovie, toggleSeries, hasSeries,
  } = useUserLibraryStore();

  // ── Derived ─────────────────────────────────────────────────────────────────
  const resultCounts = useMemo(() => ({
    games:  searchGames.length,
    movies: searchMovies.length,
    series: searchSeries.length,
    all:    searchGames.length + searchMovies.length + searchSeries.length,
  }), [searchGames.length, searchMovies.length, searchSeries.length]);

  const hasAnyResult    = resultCounts.all > 0;
  const showGames       = activeTab === 'all' || activeTab === 'games';
  const showMovies      = activeTab === 'all' || activeTab === 'movies';
  const showSeries      = activeTab === 'all' || activeTab === 'series';
  const showGenreChips  = activeTab === 'movies' || activeTab === 'series' || activeTab === 'all';
  const showSortChips   = activeTab === 'games';

  const activeGenreLabel = TMDB_GENRES.find(g => g.id === genreFilter)?.label ?? '';

  // ExpandableRow library callbacks — toggle + toast feedback
  const gameAddFn = useCallback((item) => {
    const saved = hasGame(item.id ?? item.rawId);
    toggleGame(item);
    toast(saved ? 'Removed from library' : `Saved — ${item.title ?? item.name ?? ''}`);
  }, [toggleGame, hasGame]);

  const movieAddFn = useCallback((item) => {
    const saved = hasMovie(item.tmdbId ?? item.id);
    toggleMovie(item);
    toast(saved ? 'Removed from library' : `Saved — ${item.title ?? item.name ?? ''}`);
  }, [toggleMovie, hasMovie]);

  const seriesAddFn = useCallback((item) => {
    const saved = hasSeries(item.tmdbId ?? item.id);
    toggleSeries(item);
    toast(saved ? 'Removed from library' : `Saved — ${item.title ?? item.name ?? ''}`);
  }, [toggleSeries, hasSeries]);

  const gameCheckFn   = useCallback((item) => hasGame(item.id ?? item.rawId),       [hasGame]);
  const movieCheckFn  = useCallback((item) => hasMovie(item.tmdbId ?? item.id),     [hasMovie]);
  const seriesCheckFn = useCallback((item) => hasSeries(item.tmdbId ?? item.id),    [hasSeries]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    setDebouncedQuery(q => q + ' ');
    setTimeout(() => setDebouncedQuery(q => q.trim()), 10);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-canvas">

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY HEADER — search bar + tab bar
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-14 z-30 bg-canvas/95 backdrop-blur-md border-b border-line">
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pt-4">

          {/* Search input */}
          <div className="relative mb-4">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search games, movies, and series…"
              className="w-full bg-surface border border-line rounded-xl pl-10 pr-10 py-3
                         text-sm text-ink placeholder:text-ink-light
                         focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10
                         transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center
                           justify-center rounded-full bg-line text-ink-mid
                           hover:bg-surface-high hover:text-ink transition-colors text-lg leading-none"
              >
                &times;
              </button>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 -mb-px overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(tab => {
              const count    = isSearchActive ? resultCounts[tab.id] : null;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold
                             border-b-2 transition-all duration-200 ${
                    isActive
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-light hover:text-ink-mid'
                  }`}
                >
                  {tab.label}
                  {count != null && count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-accent/15 text-accent' : 'bg-line text-ink-light'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-20">

        {/* ── SEARCH MODE ──────────────────────────────────────────────── */}
        {isSearchActive && (
          <div key={`search-${activeTab}`} className="pt-8 animate-fade-in">

            {searchLoading && <GridSkeleton count={8} />}

            {!searchLoading && searchError && (
              <SearchError message={searchError} onRetry={handleRetry} />
            )}

            {!searchLoading && !searchError && !hasAnyResult && (
              <NoResults query={debouncedQuery} />
            )}

            {!searchLoading && !searchError && hasAnyResult && (
              <div className="space-y-12">

                {showGames && searchGames.length > 0 && (
                  <section>
                    <SectionHead
                      overline="Games"
                      title="Game results"
                      color="accent"
                      count={searchGames.length}
                    />
                    <ResultGrid items={searchGames} type="game" />
                  </section>
                )}

                {showMovies && searchMovies.length > 0 && (
                  <section>
                    <SectionHead
                      overline="Films"
                      title="Movie results"
                      color="amber"
                      count={searchMovies.length}
                    />
                    <ResultGrid items={searchMovies} type="movie" />
                  </section>
                )}

                {showSeries && searchSeries.length > 0 && (
                  <section>
                    <SectionHead
                      overline="Series"
                      title="TV Series results"
                      color="violet"
                      count={searchSeries.length}
                    />
                    <ResultGrid items={searchSeries} type="series" />
                  </section>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── BROWSE MODE ──────────────────────────────────────────────── */}
        {!isSearchActive && (
          <div key={`browse-${activeTab}`} className="pt-8 space-y-14 animate-fade-in">

            {/* Quick filters */}
            {showSortChips && (
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-ink-light mb-3">
                  Sort
                </p>
                <FilterChips
                  items={GAME_SORTS}
                  activeId={gameSort}
                  onSelect={id => setGameSort(id ?? 'trending')}
                  color="accent"
                />
              </div>
            )}

            {showGenreChips && (
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-ink-light mb-3">
                  Genre
                </p>
                <FilterChips
                  items={TMDB_GENRES}
                  activeId={genreFilter}
                  onSelect={setGenreFilter}
                  color={activeTab === 'series' ? 'violet' : 'amber'}
                />
              </div>
            )}

            {/* Trending Games */}
            {showGames && (
              <section>
                <SectionHead
                  overline="Games"
                  title={gameSort === 'top-rated' ? 'Top Rated Games' : 'Trending Games'}
                  color="accent"
                />
                {gamesLoading ? <RowSkeleton /> : (
                  <ExpandableRow
                    items={trendGames.map(g => ({ item: g, type: 'game' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={gameAddFn}
                    libraryCheck={gameCheckFn}
                  />
                )}
              </section>
            )}

            {/* Trending / Filtered Movies */}
            {showMovies && (
              <section>
                <SectionHead
                  overline="Films"
                  title={
                    genreFilter && activeTab !== 'series'
                      ? `${activeGenreLabel} Movies`
                      : 'Popular Movies'
                  }
                  color="amber"
                />
                {moviesLoading ? <RowSkeleton /> : (
                  <ExpandableRow
                    items={trendMovies.map(m => ({ item: m, type: 'movie' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={movieAddFn}
                    libraryCheck={movieCheckFn}
                  />
                )}
              </section>
            )}

            {/* Trending / Filtered Series */}
            {showSeries && (
              <section>
                <SectionHead
                  overline="Series"
                  title={
                    genreFilter
                      ? `${activeGenreLabel} Series`
                      : 'Trending Series'
                  }
                  color="violet"
                />
                {seriesLoading ? <RowSkeleton /> : (
                  <ExpandableRow
                    items={trendSeries.map(s => ({ item: s, type: 'series' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={seriesAddFn}
                    libraryCheck={seriesCheckFn}
                  />
                )}
              </section>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
