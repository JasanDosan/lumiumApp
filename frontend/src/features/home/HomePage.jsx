import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useAuthStore } from '@/features/auth/authStore';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { GAME_CATALOG, getRelatedGames, translateMetaToTMDB } from '@/data/gameMovieTags';
import { useDebounce } from '@/hooks/useDebounce';
import GameHero from '@/features/games/GameHero';
import GameRow from '@/features/games/GameRow';
import FilterBar from '@/features/discover/FilterBar';
import ContentCarousel from '@/features/discover/ContentCarousel';
import MovieCard from '@/features/movies/MovieCard';
import MovieRow from '@/features/movies/MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_GAME_KEY = 'pm_selected_game';

function getStoredGame() {
  try {
    const saved = localStorage.getItem(LS_GAME_KEY);
    return GAME_CATALOG.some(g => g.id === saved) ? saved : GAME_CATALOG[0].id;
  } catch {
    return GAME_CATALOG[0].id;
  }
}

function parseSearchParams(sp) {
  const person     = sp.get('person');
  const personName = sp.get('personName');
  const genres     = sp.get('genres');
  return {
    ...(person && { with_person: Number(person), personName: personName || undefined }),
    ...(genres && { genres: genres.split(',').map(Number) }),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true">
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

/** Game movie section: shows movies from the currently selected game */
function GameMovieSection({ game, selectedGameId, onGameChange }) {
  const [movies, setMovies]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const fetchedFor              = useRef(null);

  useEffect(() => {
    if (!game || fetchedFor.current === game.id) return;
    fetchedFor.current = game.id;

    let cancelled = false;
    setLoading(true);
    const filters = translateMetaToTMDB(game.meta);

    movieService.discover({ ...filters, page: 1 })
      .then(data => {
        if (!cancelled) setMovies((data.results || []).slice(0, 16));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [game]);

  const relatedGames = useMemo(
    () => getRelatedGames(selectedGameId, 12),
    [selectedGameId],
  );

  if (!game) return null;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="section-label mb-1">Watch after playing</p>
          <h2 className="text-lg font-semibold text-ink">
            {game.emoji} {game.name}
          </h2>
          <p className="text-xs text-ink-mid mt-0.5 italic">{game.tagline}</p>
        </div>
        <Link
          to={`/game/${game.id}`}
          className="text-xs text-ink-light hover:text-ink transition-colors shrink-0"
        >
          Game details →
        </Link>
      </div>

      {/* Movie row */}
      <MovieRow movies={movies} isLoading={loading} cardWidth="w-32 sm:w-36" />

      {/* Related games row */}
      <div>
        <p className="text-[11px] text-ink-light mb-2.5 uppercase tracking-widest font-semibold">
          Games with a similar vibe
        </p>
        <GameRow
          games={relatedGames}
          selectedId={selectedGameId}
          onSelect={onGameChange}
          cardWidth="w-36 sm:w-44"
        />
      </div>
    </section>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const { favorites } = useFavoritesStore();

  // ── Selected game ──────────────────────────────────────────────────────────
  const [selectedGameId, setSelectedGameId] = useState(getStoredGame);

  const handleGameChange = useCallback((id) => {
    localStorage.setItem(LS_GAME_KEY, id);
    setSelectedGameId(id);
  }, []);

  const selectedGame = useMemo(
    () => GAME_CATALOG.find(g => g.id === selectedGameId) ?? GAME_CATALOG[0],
    [selectedGameId],
  );

  // ── Carousel data ──────────────────────────────────────────────────────────
  const [trending, setTrending]                       = useState([]);
  const [trendingLoading, setTrendingLoading]         = useState(true);
  const [trendingTV, setTrendingTV]                   = useState([]);
  const [trendingTVLoading, setTrendingTVLoading]     = useState(true);
  const [personalRecs, setPersonalRecs]               = useState([]);
  const [personalRecsLoading, setPersonalRecsLoading] = useState(false);
  const [similarSections, setSimilarSections]         = useState([]);
  const [allGenres, setAllGenres]                     = useState([]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState(() => parseSearchParams(searchParams));
  const debouncedFilters = useDebounce(filters, 450);

  // ── Grid ───────────────────────────────────────────────────────────────────
  const [gridItems, setGridItems]               = useState([]);
  const [gridPage, setGridPage]                 = useState(1);
  const [gridTotalPages, setGridTotalPages]     = useState(0);
  const [gridTotalResults, setGridTotalResults] = useState(0);
  const [gridLoading, setGridLoading]           = useState(true);

  const gridSentinelRef  = useRef(null);
  const carouselsFetched = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasActiveFilters = useMemo(() => Boolean(
    filters.search ||
    filters.genres?.length > 0 ||
    filters.year_gte || filters.year_lte ||
    filters.rating_gte ||
    filters.with_person ||
    (filters.sort_by && filters.sort_by !== 'popularity.desc'),
  ), [filters]);

  const gridHasMore = gridPage < gridTotalPages;

  const favMovies = useMemo(() => favorites.map(f => ({
    tmdbId: f.tmdbId, title: f.title, posterPath: f.posterPath,
    rating: f.rating, releaseDate: f.releaseDate, genreIds: f.genreIds,
  })), [favorites]);

  // ── Load carousels once ────────────────────────────────────────────────────
  useEffect(() => {
    if (carouselsFetched.current) return;
    carouselsFetched.current = true;

    movieService.getGenres()
      .then(data => setAllGenres(data.genres || []))
      .catch(console.error);

    movieService.getTrending()
      .then(data => setTrending(data.results || []))
      .catch(console.error)
      .finally(() => setTrendingLoading(false));

    tvService.getTrending()
      .then(data => setTrendingTV(data.results || []))
      .catch(console.error)
      .finally(() => setTrendingTVLoading(false));
  }, []);

  // ── Personalised recs ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { setPersonalRecs([]); return; }
    let cancelled = false;
    setPersonalRecsLoading(true);
    movieService.getRecommendations()
      .then(data => { if (!cancelled) setPersonalRecs(data.results || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setPersonalRecsLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // ── "Because you liked X" ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || favorites.length === 0) { setSimilarSections([]); return; }

    const top         = favorites.slice(0, 2);
    const seen        = new Set(favorites.map(f => f.tmdbId));
    const sectionSeen = new Set();
    const acc         = [];

    const loadNext = (index) => {
      if (index >= top.length) {
        setSimilarSections(acc.filter(s => s.movies.length > 0));
        return;
      }
      const fav = top[index];
      movieService.getSimilar(fav.tmdbId)
        .then(data => {
          const movies = (data.results || [])
            .filter(m => !seen.has(m.tmdbId) && !sectionSeen.has(m.tmdbId))
            .slice(0, 12);
          movies.forEach(m => sectionSeen.add(m.tmdbId));
          acc.push({ favoriteId: fav.tmdbId, favoriteTitle: fav.title, movies });
        })
        .catch(() => {})
        .finally(() => setTimeout(() => loadNext(index + 1), 300));
    };
    loadNext(0);
  }, [isAuthenticated, favorites.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset grid on filter change ────────────────────────────────────────────
  useEffect(() => {
    setGridPage(1);
    setGridItems([]);
    setGridTotalResults(0);
    setGridTotalPages(0);
  }, [debouncedFilters]);

  // ── Fetch grid ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setGridLoading(true);

    const call = debouncedFilters.search
      ? movieService.search(debouncedFilters.search, gridPage)
      : movieService.discover({
          genres:      debouncedFilters.genres,
          year_gte:    debouncedFilters.year_gte,
          year_lte:    debouncedFilters.year_lte,
          rating_gte:  debouncedFilters.rating_gte,
          sort_by:     debouncedFilters.sort_by || 'popularity.desc',
          with_person: debouncedFilters.with_person,
          page:        gridPage,
        });

    call
      .then(data => {
        if (cancelled) return;
        const incoming = data.results || [];
        setGridItems(prev => {
          if (gridPage === 1) return incoming;
          const seen = new Set(prev.map(m => m.tmdbId));
          return [...prev, ...incoming.filter(m => !seen.has(m.tmdbId))];
        });
        setGridTotalResults(data.totalResults || incoming.length);
        setGridTotalPages(Math.min(data.totalPages || 1, 500));
      })
      .catch(err => { if (!cancelled) console.error(err); })
      .finally(() => { if (!cancelled) setGridLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedFilters, gridPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IntersectionObserver ──────────────────────────────────────────────────
  useEffect(() => {
    if (gridLoading || !gridHasMore) return;
    const el = gridSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setGridPage(p => p + 1); },
      { rootMargin: '400px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [gridLoading, gridHasMore]);

  const handleFiltersChange = useCallback((updater) => {
    setFilters(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  // ── Grid header text ──────────────────────────────────────────────────────
  const gridLabel    = hasActiveFilters ? 'Filtered results' : 'Discover';
  const gridTitle    = filters.search
    ? `"${filters.search}"`
    : filters.with_person && filters.personName
      ? `Films with ${filters.personName}`
      : hasActiveFilters ? 'Filtered films' : 'All films';
  const gridSubtitle = !gridLoading && gridTotalResults > 0
    ? `${gridItems.length.toLocaleString()} of ${gridTotalResults.toLocaleString()} films`
    : null;

  const isFirstLoad = gridLoading && gridPage === 1;
  const isAppending = gridLoading && gridPage > 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ── 1. Game Hero ──────────────────────────────────────────────────── */}
      {!hasActiveFilters && (
        <GameHero game={selectedGame} />
      )}

      {/* ── FilterBar (sticky below fixed header) ─────────────────────────── */}
      <FilterBar genres={allGenres} filters={filters} onChange={handleFiltersChange} />

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10 space-y-14">

        {/* ── Auth greeting ─────────────────────────────────────────────── */}
        {isAuthenticated && user && !hasActiveFilters && (
          <p className="text-xl font-semibold text-ink -mb-6">
            Hey, {user.name?.split(' ')[0]}.
          </p>
        )}

        {/* ── 2. Games Library ──────────────────────────────────────────── */}
        {!hasActiveFilters && (
          <SectionWrapper label="Library" title="Browse Games">
            <GameRow
              games={GAME_CATALOG}
              selectedId={selectedGameId}
              onSelect={handleGameChange}
              cardWidth="w-40 sm:w-48"
            />
          </SectionWrapper>
        )}

        {/* ── 3. Game → Movies ──────────────────────────────────────────── */}
        {!hasActiveFilters && (
          <GameMovieSection
            game={selectedGame}
            selectedGameId={selectedGameId}
            onGameChange={handleGameChange}
          />
        )}

        {/* ── 4. Saved collection (auth) ────────────────────────────────── */}
        {isAuthenticated && favMovies.length > 0 && !hasActiveFilters && (
          <SectionWrapper
            label="Your collection"
            title={`${favorites.length} saved film${favorites.length !== 1 ? 's' : ''}`}
            seeAllTo="/favorites"
          >
            <MovieRow movies={favMovies} />
          </SectionWrapper>
        )}

        {isAuthenticated && favorites.length === 1 && !hasActiveFilters && (
          <p className="text-sm text-ink-light border-t border-line pt-6 -mt-8">
            Add one more film to unlock personalised recommendations.
          </p>
        )}

        {/* ── 5. Trending TV ───────────────────────────────────────────── */}
        {!hasActiveFilters && (
          <ContentCarousel
            label="Series"
            title="Trending on TV"
            items={trendingTV}
            isLoading={trendingTVLoading}
          />
        )}

        {/* ── 6. Recommended for you (auth) ────────────────────────────── */}
        {!hasActiveFilters && (isAuthenticated || personalRecsLoading) && (
          <ContentCarousel
            label="For you"
            title="Recommended"
            items={personalRecs}
            isLoading={personalRecsLoading}
            showScore
          />
        )}

        {/* ── 7. Because you liked X ───────────────────────────────────── */}
        {!hasActiveFilters && similarSections.map(section => (
          <SectionWrapper
            key={section.favoriteId}
            label="Because you liked"
            title={section.favoriteTitle}
          >
            <MovieRow movies={section.movies} />
          </SectionWrapper>
        ))}

        {/* ── 8. Trending movies ───────────────────────────────────────── */}
        {!hasActiveFilters && (
          <ContentCarousel
            label="This week"
            title="Trending"
            items={trending}
            isLoading={trendingLoading}
          />
        )}

        {/* ── Active filter pills ──────────────────────────────────────── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 -mt-8">
            {filters.genres?.map(id => {
              const g = allGenres.find(a => a.id === id);
              return g ? (
                <span key={id} className="text-[11px] bg-accent/20 text-accent px-2.5 py-0.5 rounded-full border border-accent/30">
                  {g.name}
                </span>
              ) : null;
            })}
            {(filters.year_gte || filters.year_lte) && (
              <span className="text-[11px] bg-surface text-ink-mid px-2.5 py-0.5 rounded-full border border-line">
                {filters.year_gte || '…'} – {filters.year_lte || 'now'}
              </span>
            )}
            {filters.rating_gte && (
              <span className="text-[11px] bg-surface text-ink-mid px-2.5 py-0.5 rounded-full border border-line">
                ★ {filters.rating_gte}+
              </span>
            )}
          </div>
        )}

        {/* ── 9. Discover grid (always visible, infinite scroll) ────────── */}
        <section>
          <div className="mb-6">
            <p className="section-label mb-1">{gridLabel}</p>
            <h2 className="text-lg font-semibold text-ink">{gridTitle}</h2>
            {gridSubtitle && (
              <p className="text-xs text-ink-light mt-0.5">{gridSubtitle}</p>
            )}
          </div>

          {isFirstLoad && <GridSkeleton count={12} />}

          {!isFirstLoad && gridItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {gridItems.map(movie => (
                <MovieCard key={movie.tmdbId} movie={movie} />
              ))}
            </div>
          )}

          {!isFirstLoad && !gridLoading && gridItems.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-ink-light">
                No films match these filters — try adjusting them.
              </p>
            </div>
          )}

          {isAppending && <GridSkeleton count={6} />}

          {!gridHasMore && gridItems.length > 0 && !gridLoading && (
            <p className="text-center text-xs text-ink-light mt-10">
              All {gridItems.length.toLocaleString()} films loaded
            </p>
          )}

          <div ref={gridSentinelRef} className="h-px mt-4" aria-hidden="true" />
        </section>

        {/* ── Guest CTA ─────────────────────────────────────────────────── */}
        {!isAuthenticated && (
          <div className="border-t border-line pt-8 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-ink">Want personalised picks?</p>
              <p className="text-xs text-ink-mid mt-0.5">
                Create a free account and save films to your collection.
              </p>
            </div>
            <Link
              to="/register"
              className="shrink-0 text-sm bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-full font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
