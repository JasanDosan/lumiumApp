/**
 * DiscoverPage — cross-media exploration hub.
 *
 * Two modes:
 *   Browse  (empty query)  → trending rows per media type, filterable
 *   Search  (active query) → grouped result sections per type with save buttons
 *
 * Tabs: All | Games | Movies | Series
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { rawgService }           from '@/services/rawgService';
import { mediaDiscoveryService } from '@/services/movieService';
import { tvService }             from '@/services/tvService';
import { useUserLibraryStore }   from '@/features/library/libraryStore';
import { GAME_CATALOG }          from '@/data/gameMovieTags';
import ExpandableRow             from '@/components/ui/ExpandableRow';
import UnifiedCard               from '@/components/ui/UnifiedCard';
import DragRow                   from '@/components/ui/DragRow';
import ContentBand               from '@/components/ui/ContentBand';
import { toast }                 from '@/stores/toastStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',    label: 'All'    },
  { id: 'games',  label: 'Games'  },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
];

const TMDB_GENRES = [
  { id: 28,    label: 'Action'    },
  { id: 35,    label: 'Comedy'    },
  { id: 18,    label: 'Drama'     },
  { id: 27,    label: 'Horror'    },
  { id: 878,   label: 'Sci-Fi'    },
  { id: 10749, label: 'Romance'   },
  { id: 12,    label: 'Adventure' },
  { id: 9648,  label: 'Mystery'   },
  { id: 16,    label: 'Animation' },
  { id: 80,    label: 'Crime'     },
];

const GAME_GENRES = [
  { id: 'action',     label: 'Action'     },
  { id: 'rpg',        label: 'RPG'        },
  { id: 'adventure',  label: 'Adventure'  },
  { id: 'strategy',   label: 'Strategy'   },
  { id: 'horror',     label: 'Horror'     },
  { id: 'sci-fi',     label: 'Sci-Fi'     },
  { id: 'open-world', label: 'Open World' },
  { id: 'story',      label: 'Story Rich' },
];

const SORT_OPTIONS = [
  { id: 'trending',  label: 'Trending'  },
  { id: 'top-rated', label: 'Top Rated' },
  { id: 'newest',    label: 'Newest'    },
];

const GAME_SORT_OPTIONS = [
  { id: 'trending',   label: 'Trending'   },
  { id: 'top-rated',  label: 'Top Rated'  },
  { id: 'newest',     label: 'Newest'     },
  { id: 'metacritic', label: 'Metacritic' },
];

const RATING_OPTIONS = [
  { id: 0, label: 'Any' },
  { id: 6, label: '6+'  },
  { id: 7, label: '7+'  },
  { id: 8, label: '8+'  },
];

const ERA_OPTIONS = [
  { id: null,      label: 'All'     },
  { id: '2020s',   label: '2020s'   },
  { id: '2010s',   label: '2010s'   },
  { id: '2000s',   label: '2000s'   },
  { id: 'classic', label: 'Classic' },
];

const PLATFORM_OPTIONS = [
  { id: null,          label: 'All'         },
  { id: 'pc',          label: 'PC'          },
  { id: 'playstation', label: 'PlayStation' },
  { id: 'xbox',        label: 'Xbox'        },
  { id: 'nintendo',    label: 'Nintendo'    },
];

const PLATFORM_IDS = { pc: 4, playstation: 187, xbox: 186, nintendo: 7 };

// ─── Year range helpers ───────────────────────────────────────────────────────

function getYearParams(yearRange) {
  if (!yearRange) return {};
  const today = new Date().toISOString().split('T')[0];
  if (yearRange === '2020s')   return { year_gte: '2020-01-01', year_lte: today };
  if (yearRange === '2010s')   return { year_gte: '2010-01-01', year_lte: '2019-12-31' };
  if (yearRange === '2000s')   return { year_gte: '2000-01-01', year_lte: '2009-12-31' };
  if (yearRange === 'classic') return { year_lte: '1999-12-31' };
  return {};
}

// ─── useDiscoverSearch ────────────────────────────────────────────────────────

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

    if (wantGames) {
      rawgService.search(query, 12)
        .then(results => {
          if (!cancelled) setState(s => ({ ...s, games: results.slice(0, 12) }));
        })
        .catch(() => {
          if (!cancelled) setState(s => ({ ...s, games: [] }));
        });
    }

    let tmdbTimer = null;
    if (wantMovies || wantSeries) {
      tmdbTimer = setTimeout(() => {
        mediaDiscoveryService.searchMulti(query)
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

// ─── useDiscoverTrending ──────────────────────────────────────────────────────

function useDiscoverTrending(
  tab, genreId, gameSortMode, sortMode,
  ratingFloor, yearRange, platformFilter,
  page, onHasMoreChange,
) {
  const [games,         setGames]         = useState([]);
  const [gamesLoading,  setGamesLoading]  = useState(true);
  const [movies,        setMovies]        = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [series,        setSeries]        = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  // Stable string key representing all filters (excluding page)
  const filterKey = `${tab}|${genreId}|${gameSortMode}|${sortMode}|${ratingFloor}|${yearRange}|${platformFilter}`;
  const prevFilterKey = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const timers = [];

    const isFilterChange = filterKey !== prevFilterKey.current;
    prevFilterKey.current = filterKey;

    // On filter change, wipe existing data immediately
    if (isFilterChange) {
      setGames([]);
      setMovies([]);
      setSeries([]);
    }

    const append = !isFilterChange && page > 1;

    const showGames  = tab === 'all' || tab === 'games';
    const showMovies = tab === 'all' || tab === 'movies';
    const showSeries = tab === 'all' || tab === 'series';

    const gameCount = page === 1 ? 24 : 12;
    const mediaCount = 20;

    // ── Games ─────────────────────────────────────────────────────────────────
    if (showGames) {
      setGamesLoading(true);
      const platformId = platformFilter ? PLATFORM_IDS[platformFilter] : null;

      let gamePromise;
      if (tab === 'games' && genreId) {
        // Genre filter on games tab → use getByCategory (no page support needed, category results are small)
        gamePromise = rawgService.getByCategory(genreId, gameCount);
      } else if (gameSortMode === 'top-rated') {
        gamePromise = rawgService.getTopRated(gameCount, { ordering: '-rating', platform: platformId, page });
      } else if (gameSortMode === 'metacritic') {
        gamePromise = rawgService.getTopRated(gameCount, { ordering: '-metacritic', platform: platformId, page });
      } else if (gameSortMode === 'newest') {
        gamePromise = rawgService.getTrending(gameCount, { ordering: '-released', platform: platformId, page });
      } else {
        gamePromise = rawgService.getTrending(gameCount, { ordering: '-added', platform: platformId, page });
      }

      gamePromise
        .then(results => {
          if (cancelled) return;
          setGames(prev => {
            const existingIds = new Set(prev.map(g => g.id ?? g.rawId));
            const fresh = results.filter(g => !existingIds.has(g.id ?? g.rawId));
            return page === 1 ? results : [...prev, ...fresh];
          });
          onHasMoreChange('games', page < 5 && results.length >= 12);
        })
        .catch(() => {
          if (cancelled) return;
          if (page === 1) {
            const TOP_GAMES = [...GAME_CATALOG]
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 24);
            setGames(TOP_GAMES);
          }
          // page > 1 failure: keep existing results — no append, no duplicates
        })
        .finally(() => { if (!cancelled) setGamesLoading(false); });
    }

    // ── Movies ────────────────────────────────────────────────────────────────
    if (showMovies) {
      const sortByMap = {
        'trending':  'popularity.desc',
        'top-rated': 'vote_average.desc',
        'newest':    'release_date.desc',
      };
      const movieParams = {
        page,
        sort_by: sortByMap[sortMode] ?? 'popularity.desc',
        ...(genreId && tab !== 'series' ? { genres: [genreId] } : {}),
        ...(ratingFloor > 0 ? { rating_gte: ratingFloor } : {}),
        ...getYearParams(yearRange),
      };

      const movieDelay = isFilterChange && showGames ? 300 : 0;
      const tMovies = setTimeout(() => {
        if (cancelled) return;
        setMoviesLoading(true);
        mediaDiscoveryService.discover(movieParams)
          .then(d => {
            if (cancelled) return;
            const results = (d.results ?? []).slice(0, mediaCount);
            if (append) setMovies(prev => [...prev, ...results]);
            else         setMovies(results);
            onHasMoreChange('movies', results.length >= mediaCount);
          })
          .catch(() => {
            if (!cancelled && !append) setMovies([]);
          })
          .finally(() => { if (!cancelled) setMoviesLoading(false); });
      }, movieDelay);
      timers.push(tMovies);
    }

    // ── Series ────────────────────────────────────────────────────────────────
    if (showSeries) {
      const sortByMap = {
        'trending':  'popularity.desc',
        'top-rated': 'vote_average.desc',
        'newest':    'first_air_date.desc',
      };
      const seriesParams = {
        page,
        sort_by: sortByMap[sortMode] ?? 'popularity.desc',
        ...(genreId && tab !== 'movies' ? { genres: [genreId] } : {}),
        ...(ratingFloor > 0 ? { rating_gte: ratingFloor } : {}),
        ...getYearParams(yearRange),
      };

      const seriesDelay = isFilterChange
        ? (showGames && showMovies ? 600 : showGames || showMovies ? 300 : 0)
        : 0;
      const tSeries = setTimeout(() => {
        if (cancelled) return;
        setSeriesLoading(true);
        tvService.discover(seriesParams)
          .then(d => {
            if (cancelled) return;
            const results = (d.results ?? []).slice(0, mediaCount);
            if (append) setSeries(prev => [...prev, ...results]);
            else         setSeries(results);
            onHasMoreChange('series', results.length >= mediaCount);
          })
          .catch(() => {
            if (!cancelled && !append) setSeries([]);
          })
          .finally(() => { if (!cancelled) setSeriesLoading(false); });
      }, seriesDelay);
      timers.push(tSeries);
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [filterKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return { games, gamesLoading, movies, moviesLoading, series, seriesLoading };
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

// ─── ResultGrid — search mode ─────────────────────────────────────────────────

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
            <UnifiedCard item={item} type={type} isInLibrary={isInLibrary} onAddToLibrary={onAddToLibrary} />
          </div>
        );
      })}
    </div>
  );
}

// ─── FilterChips ──────────────────────────────────────────────────────────────

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
          key={String(item.id)}
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

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({
  tab,
  genreFilter, setGenreFilter,
  sortMode, setSortMode,
  gameSortMode, setGameSortMode,
  ratingFloor, setRatingFloor,
  yearRange, setYearRange,
  platformFilter, setPlatformFilter,
  hasActiveFilters, onReset,
}) {
  const isGames  = tab === 'games';
  const isMovies = tab === 'movies';
  const isSeries = tab === 'series';
  const accentColor = isSeries ? 'violet' : isMovies ? 'amber' : 'accent';

  return (
    <ContentBand zone="surface" size="compact" topBorder>
      <div className="flex flex-col gap-5">

        <div className="flex flex-wrap gap-6 items-start">
          {/* Sort */}
          <div className="shrink-0">
            <p className="eyebrow text-ink-light mb-3">Sort</p>
            <FilterChips
              items={isGames ? GAME_SORT_OPTIONS : SORT_OPTIONS}
              activeId={isGames ? gameSortMode : sortMode}
              onSelect={id => isGames
                ? setGameSortMode(id ?? 'trending')
                : setSortMode(id ?? 'trending')}
              color={accentColor}
            />
          </div>

          {/* Genre */}
          <div className="flex-1 min-w-0">
            <p className="eyebrow text-ink-light mb-3">Genre</p>
            <FilterChips
              items={isGames ? GAME_GENRES : TMDB_GENRES}
              activeId={genreFilter}
              onSelect={setGenreFilter}
              color={accentColor}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 items-start">
          {/* Platform — games only */}
          {isGames && (
            <div className="shrink-0">
              <p className="eyebrow text-ink-light mb-3">Platform</p>
              <FilterChips
                items={PLATFORM_OPTIONS}
                activeId={platformFilter}
                onSelect={id => setPlatformFilter(id)}
                color="accent"
              />
            </div>
          )}

          {/* Rating — movies / series / all */}
          {!isGames && (
            <div className="shrink-0">
              <p className="eyebrow text-ink-light mb-3">Rating</p>
              <FilterChips
                items={RATING_OPTIONS}
                activeId={ratingFloor}
                onSelect={id => setRatingFloor(id ?? 0)}
                color={accentColor}
              />
            </div>
          )}

          {/* Era — movies and series only (not all tab) */}
          {(isMovies || isSeries) && (
            <div className="shrink-0">
              <p className="eyebrow text-ink-light mb-3">Era</p>
              <FilterChips
                items={ERA_OPTIONS}
                activeId={yearRange}
                onSelect={id => setYearRange(id)}
                color={accentColor}
              />
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div>
            <button
              onClick={onReset}
              className="text-xs text-ink-light underline hover:text-ink transition-colors"
            >
              Reset filters
            </button>
          </div>
        )}

      </div>
    </ContentBand>
  );
}

// ─── ViewToggle ───────────────────────────────────────────────────────────────

function ViewToggle({ viewMode, onToggle }) {
  const btnBase = 'p-1.5 rounded transition-colors';
  return (
    <div className="flex items-center gap-1 ml-auto">
      <button
        onClick={() => onToggle('row')}
        aria-label="Row view"
        className={`${btnBase} ${viewMode === 'row'
          ? 'bg-surface-high text-ink'
          : 'text-ink-light hover:text-ink'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>
      <button
        onClick={() => onToggle('grid')}
        aria-label="Grid view"
        className={`${btnBase} ${viewMode === 'grid'
          ? 'bg-surface-high text-ink'
          : 'text-ink-light hover:text-ink'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </button>
    </div>
  );
}

// ─── LoadMoreButton ───────────────────────────────────────────────────────────

function LoadMoreButton({ onClick, loading }) {
  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-line
                   text-sm text-ink-mid hover:text-ink hover:border-ink/30
                   transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          'Load more'
        )}
      </button>
    </div>
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
      <button onClick={onRetry} className="text-xs text-accent hover:underline transition-colors">
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
  const [genreFilter,    setGenreFilter]    = useState(null);
  const [sortMode,       setSortMode]       = useState('trending');
  const [gameSortMode,   setGameSortMode]   = useState('trending');
  const [ratingFloor,    setRatingFloor]    = useState(0);
  const [yearRange,      setYearRange]      = useState(null);
  const [platformFilter, setPlatformFilter] = useState(null);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState({ games: true, movies: true, series: true });
  const [viewMode,       setViewMode]       = useState('row');

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchTerm.trim()), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Reset genre + page when tab changes
  useEffect(() => {
    setGenreFilter(null);
    setPage(1);
  }, [activeTab]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [genreFilter, sortMode, gameSortMode, ratingFloor, yearRange, platformFilter]);

  const isSearchActive = debouncedQuery.length > 0;

  // Callback for hook to update hasMore
  const handleHasMoreChange = useCallback((type, value) => {
    setHasMore(prev => ({ ...prev, [type]: value }));
  }, []);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const {
    games: searchGames, movies: searchMovies, series: searchSeries,
    loading: searchLoading, error: searchError,
  } = useDiscoverSearch(debouncedQuery, activeTab);

  const {
    games: trendGames,  gamesLoading,
    movies: trendMovies, moviesLoading,
    series: trendSeries, seriesLoading,
  } = useDiscoverTrending(
    activeTab, genreFilter, gameSortMode, sortMode,
    ratingFloor, yearRange, platformFilter,
    page, handleHasMoreChange,
  );

  const {
    toggleGame, hasGame, toggleMovie, hasMovie, toggleSeries, hasSeries,
  } = useUserLibraryStore();

  // ── Derived ────────────────────────────────────────────────────────────────
  const resultCounts = useMemo(() => ({
    games:  searchGames.length,
    movies: searchMovies.length,
    series: searchSeries.length,
    all:    searchGames.length + searchMovies.length + searchSeries.length,
  }), [searchGames.length, searchMovies.length, searchSeries.length]);

  const hasAnyResult   = resultCounts.all > 0;
  const showGames      = activeTab === 'all' || activeTab === 'games';
  const showMovies     = activeTab === 'all' || activeTab === 'movies';
  const showSeries     = activeTab === 'all' || activeTab === 'series';

  const hasActiveFilters = genreFilter !== null
    || (activeTab === 'games' ? gameSortMode !== 'trending' : sortMode !== 'trending')
    || ratingFloor !== 0
    || yearRange !== null
    || platformFilter !== null;

  const handleResetFilters = useCallback(() => {
    setGenreFilter(null);
    setSortMode('trending');
    setGameSortMode('trending');
    setRatingFloor(0);
    setYearRange(null);
    setPlatformFilter(null);
  }, []);

  // ── Library callbacks ──────────────────────────────────────────────────────
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

  const gameCheckFn   = useCallback((item) => hasGame(item.id ?? item.rawId),    [hasGame]);
  const movieCheckFn  = useCallback((item) => hasMovie(item.tmdbId ?? item.id),  [hasMovie]);
  const seriesCheckFn = useCallback((item) => hasSeries(item.tmdbId ?? item.id), [hasSeries]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    setDebouncedQuery(q => q + ' ');
    setTimeout(() => setDebouncedQuery(q => q.trim()), 10);
  }, []);

  // ── Section headline labels ────────────────────────────────────────────────
  const activeGenreLabel = (activeTab === 'games' ? GAME_GENRES : TMDB_GENRES)
    .find(g => g.id === genreFilter)?.label ?? '';

  const gameSectionLabel =
    gameSortMode === 'top-rated'  ? 'Top Rated Games'  :
    gameSortMode === 'newest'     ? 'New Releases'      :
    gameSortMode === 'metacritic' ? 'Best by Metacritic' :
    genreFilter   ? `${activeGenreLabel} Games`         : 'Trending Games';

  const movieSectionLabel =
    sortMode === 'top-rated' ? 'Top Rated Movies' :
    sortMode === 'newest'    ? 'New Movie Releases' :
    genreFilter && activeTab !== 'series' ? `${activeGenreLabel} Movies` : 'Popular Movies';

  const seriesSectionLabel =
    sortMode === 'top-rated' ? 'Top Rated Series' :
    sortMode === 'newest'    ? 'New Series'        :
    genreFilter ? `${activeGenreLabel} Series`     : 'Trending Series';

  // ── Grid renderer helper ───────────────────────────────────────────────────
  const renderGrid = (items, type, addFn, checkFn) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map(item => {
        const key = `${type}-${item.tmdbId ?? item.id}`;
        return (
          <UnifiedCard
            key={key}
            item={item}
            type={type}
            isInLibrary={checkFn(item)}
            onAddToLibrary={() => addFn(item)}
          />
        );
      })}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-canvas">

      {/* PAGE HERO */}
      <div
        className="bg-canvas flex flex-col justify-center px-6 sm:px-12 lg:px-20 pb-20"
        style={{ minHeight: '68vh' }}
      >
        <div className="max-w-[1280px] mx-auto w-full pt-16">
          <p className="eyebrow text-accent mb-7">Discover</p>
          <h1 className="display text-ink mb-7 max-w-3xl">
            Find your next<br />obsession.
          </h1>
          <p className="body-lead text-ink-mid max-w-2xl">
            Search across games, movies, and series &mdash; or browse what&apos;s trending right now.
          </p>
        </div>
      </div>

      {/* STICKY HEADER */}
      <div className="sticky top-14 z-30 bg-canvas/95 backdrop-blur-xl border-b border-line/60">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20 pt-4">

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
              className="w-full bg-surface border border-line/70 rounded-xl pl-10 pr-10 py-3
                         text-[14px] text-ink placeholder:text-ink-light
                         focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/8
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

      {/* MAIN CONTENT */}
      <div className="pb-0">

        {/* SEARCH MODE */}
        {isSearchActive && (
          <div key={`search-${activeTab}`} className="animate-fade-in">

            {searchLoading && (
              <ContentBand zone="canvas" size="lg">
                <GridSkeleton count={8} />
              </ContentBand>
            )}

            {!searchLoading && searchError && (
              <ContentBand zone="canvas" size="lg">
                <SearchError message={searchError} onRetry={handleRetry} />
              </ContentBand>
            )}

            {!searchLoading && !searchError && !hasAnyResult && (
              <ContentBand zone="canvas" size="lg">
                <NoResults query={debouncedQuery} />
              </ContentBand>
            )}

            {!searchLoading && !searchError && hasAnyResult && (
              <div>
                {showGames && searchGames.length > 0 && (
                  <ContentBand zone="surface" size="lg" topBorder>
                    <p className="eyebrow text-accent mb-5">Games</p>
                    <h2 className="headline-lg text-ink mb-10">
                      Game results
                      <span className="ml-4 text-[1rem] font-normal text-ink-mid">{searchGames.length}</span>
                    </h2>
                    <ResultGrid items={searchGames} type="game" />
                  </ContentBand>
                )}
                {showMovies && searchMovies.length > 0 && (
                  <ContentBand zone="canvas" size="lg" topBorder>
                    <p className="eyebrow text-amber-400 mb-5">Films</p>
                    <h2 className="headline-lg text-ink mb-10">
                      Movie results
                      <span className="ml-4 text-[1rem] font-normal text-ink-mid">{searchMovies.length}</span>
                    </h2>
                    <ResultGrid items={searchMovies} type="movie" />
                  </ContentBand>
                )}
                {showSeries && searchSeries.length > 0 && (
                  <ContentBand zone="surface" size="lg" topBorder>
                    <p className="eyebrow text-violet-400 mb-5">Series</p>
                    <h2 className="headline-lg text-ink mb-10">
                      TV Series results
                      <span className="ml-4 text-[1rem] font-normal text-ink-mid">{searchSeries.length}</span>
                    </h2>
                    <ResultGrid items={searchSeries} type="series" />
                  </ContentBand>
                )}
              </div>
            )}
          </div>
        )}

        {/* BROWSE MODE */}
        {!isSearchActive && (
          <div key={`browse-${activeTab}`} className="animate-fade-in">

            {/* Filter bar */}
            <FilterBar
              tab={activeTab}
              genreFilter={genreFilter}       setGenreFilter={setGenreFilter}
              sortMode={sortMode}             setSortMode={setSortMode}
              gameSortMode={gameSortMode}     setGameSortMode={setGameSortMode}
              ratingFloor={ratingFloor}       setRatingFloor={setRatingFloor}
              yearRange={yearRange}           setYearRange={setYearRange}
              platformFilter={platformFilter} setPlatformFilter={setPlatformFilter}
              hasActiveFilters={hasActiveFilters}
              onReset={handleResetFilters}
            />

            {/* Games section */}
            {showGames && (
              <ContentBand zone="canvas" size="lg" topBorder>
                <div className="flex items-start gap-4 mb-10">
                  <div className="flex-1">
                    <p className="eyebrow text-accent mb-5">Games</p>
                    <h2 className="headline-lg text-ink">{gameSectionLabel}</h2>
                  </div>
                  <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
                </div>
                {gamesLoading && trendGames.length === 0 ? (
                  <RowSkeleton />
                ) : viewMode === 'grid' ? (
                  renderGrid(trendGames, 'game', gameAddFn, gameCheckFn)
                ) : (
                  <ExpandableRow
                    items={trendGames.map(g => ({ item: g, type: 'game' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={gameAddFn}
                    libraryCheck={gameCheckFn}
                  />
                )}
                {hasMore.games && (
                  <LoadMoreButton
                    onClick={() => setPage(p => p + 1)}
                    loading={gamesLoading && trendGames.length > 0}
                  />
                )}
              </ContentBand>
            )}

            {/* Movies section */}
            {showMovies && (
              <ContentBand zone="surface" size="lg" topBorder>
                <div className="flex items-start gap-4 mb-10">
                  <div className="flex-1">
                    <p className="eyebrow text-amber-400 mb-5">Films</p>
                    <h2 className="headline-lg text-ink">{movieSectionLabel}</h2>
                  </div>
                  <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
                </div>
                {moviesLoading && trendMovies.length === 0 ? (
                  <RowSkeleton />
                ) : viewMode === 'grid' ? (
                  renderGrid(trendMovies, 'movie', movieAddFn, movieCheckFn)
                ) : (
                  <ExpandableRow
                    items={trendMovies.map(m => ({ item: m, type: 'movie' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={movieAddFn}
                    libraryCheck={movieCheckFn}
                  />
                )}
                {hasMore.movies && (
                  <LoadMoreButton
                    onClick={() => setPage(p => p + 1)}
                    loading={moviesLoading && trendMovies.length > 0}
                  />
                )}
              </ContentBand>
            )}

            {/* Series section */}
            {showSeries && (
              <ContentBand zone="canvas" size="lg" topBorder>
                <div className="flex items-start gap-4 mb-10">
                  <div className="flex-1">
                    <p className="eyebrow text-violet-400 mb-5">Series</p>
                    <h2 className="headline-lg text-ink">{seriesSectionLabel}</h2>
                  </div>
                  <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
                </div>
                {seriesLoading && trendSeries.length === 0 ? (
                  <RowSkeleton />
                ) : viewMode === 'grid' ? (
                  renderGrid(trendSeries, 'series', seriesAddFn, seriesCheckFn)
                ) : (
                  <ExpandableRow
                    items={trendSeries.map(s => ({ item: s, type: 'series' }))}
                    cardWidth="w-52 sm:w-60"
                    gap="gap-3"
                    onAddToLibrary={seriesAddFn}
                    libraryCheck={seriesCheckFn}
                  />
                )}
                {hasMore.series && (
                  <LoadMoreButton
                    onClick={() => setPage(p => p + 1)}
                    loading={seriesLoading && trendSeries.length > 0}
                  />
                )}
              </ContentBand>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
