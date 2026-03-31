import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useAuthStore } from '@/features/auth/authStore';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useDebounce } from '@/hooks/useDebounce';
import HeroMovie from './HeroMovie';
import FilterBar from '@/features/discover/FilterBar';
import GameSelector from '@/features/discover/GameSelector';
import ContentCarousel from '@/features/discover/ContentCarousel';
import MovieCard from '@/features/movies/MovieCard';
import MovieRow from '@/features/movies/MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Returns up to `count` games similar to `selectedId`,
 * ranked by overlapping theme + mood tags.
 */
function getRelatedGames(selectedId, count = 10) {
  const selected = GAME_CATALOG.find(g => g.id === selectedId);
  if (!selected) return GAME_CATALOG.slice(0, count);
  const themes = new Set(selected.meta.theme);
  const moods  = new Set(selected.meta.mood);
  return GAME_CATALOG
    .filter(g => g.id !== selectedId)
    .map(g => ({
      ...g,
      _score: g.meta.theme.filter(t => themes.has(t)).length * 2
             + g.meta.mood.filter(m => moods.has(m)).length,
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, count);
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

function GameChip({ game, onSelect }) {
  return (
    <button
      onClick={() => onSelect(game.id)}
      className="flex-shrink-0 flex flex-col items-start gap-1 w-32 sm:w-36 p-3
                 bg-white border border-line rounded-lg text-left
                 hover:border-ink/25 hover:shadow-sm transition-all duration-200"
    >
      <span className="text-2xl leading-none">{game.emoji}</span>
      <span className="text-[12px] font-medium text-ink leading-snug line-clamp-1 mt-0.5">
        {game.name}
      </span>
      <span className="text-[11px] text-ink-light leading-snug line-clamp-2">
        {game.tagline}
      </span>
    </button>
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

  // ── Carousels data ─────────────────────────────────────────────────────────
  const [trending, setTrending]                 = useState([]);
  const [trendingLoading, setTrendingLoading]   = useState(true);
  const [trendingTV, setTrendingTV]             = useState([]);
  const [trendingTVLoading, setTrendingTVLoading] = useState(true);
  const [personalRecs, setPersonalRecs]         = useState([]);
  const [personalRecsLoading, setPersonalRecsLoading] = useState(false);
  const [similarSections, setSimilarSections]   = useState([]);
  const [allGenres, setAllGenres]               = useState([]);

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

  // Hero: top personal rec when authed, else first trending
  const heroMovie = isAuthenticated && personalRecs.length > 0
    ? personalRecs[0]
    : trending[0] ?? null;

  const favMovies = useMemo(() => favorites.map(f => ({
    tmdbId: f.tmdbId, title: f.title, posterPath: f.posterPath,
    rating: f.rating, releaseDate: f.releaseDate, genreIds: f.genreIds,
  })), [favorites]);

  const relatedGames = useMemo(() => getRelatedGames(selectedGameId, 10), [selectedGameId]);

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

  // ── Personalised recs (re-runs on auth change) ─────────────────────────────
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

  // ── "Because you liked X" — sequential to respect TMDB rate limit ─────────
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

  // ── Reset grid when debounced filters change ───────────────────────────────
  useEffect(() => {
    setGridPage(1);
    setGridItems([]);
    setGridTotalResults(0);
    setGridTotalPages(0);
  }, [debouncedFilters]);

  // ── Fetch grid — always active, content driven by filters ─────────────────
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

  // ── IntersectionObserver: load next page ──────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFiltersChange = useCallback((updater) => {
    setFilters(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  // ── Grid header ───────────────────────────────────────────────────────────
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

      {/* ── Hero (hides when filters active, gives space to results) ──────── */}
      {!hasActiveFilters && heroMovie && !trendingLoading && (
        <HeroMovie movie={heroMovie} />
      )}

      {/* ── FilterBar (sticky below fixed header) ─────────────────────────── */}
      <FilterBar genres={allGenres} filters={filters} onChange={handleFiltersChange} />

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10 space-y-14">

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        {isAuthenticated && user && (
          <p className="text-xl font-semibold text-ink -mb-6">
            Hey, {user.name?.split(' ')[0]}.
          </p>
        )}

        {/* ── 1. Saved films (auth) ──────────────────────────────────────── */}
        {isAuthenticated && favMovies.length > 0 && (
          <SectionWrapper
            label="Your collection"
            title={`${favorites.length} saved film${favorites.length !== 1 ? 's' : ''}`}
            seeAllTo="/favorites"
          >
            <MovieRow movies={favMovies} />
          </SectionWrapper>
        )}

        {/* Prompt: add one more to unlock recs */}
        {isAuthenticated && favorites.length === 1 && (
          <p className="text-sm text-ink-light border-t border-line pt-6 -mt-8">
            Add one more film to unlock personalised recommendations.
          </p>
        )}

        {/* ── 2. Tonight after playing… ──────────────────────────────────── */}
        <GameSelector selectedId={selectedGameId} onGameChange={handleGameChange} />

        {/* ── 3. Similar games ──────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <p className="section-label mb-1">Because you selected</p>
            <h2 className="text-base font-bold text-ink">Games you might also like</h2>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {relatedGames.map(g => (
              <GameChip key={g.id} game={g} onSelect={handleGameChange} />
            ))}
          </div>
        </section>

        {/* ── 4. Series — Trending TV ────────────────────────────────────── */}
        <ContentCarousel
          label="Series"
          title="Trending on TV"
          items={trendingTV}
          isLoading={trendingTVLoading}
        />

        {/* ── 5. Recommended for you (auth-gated) ───────────────────────── */}
        {(isAuthenticated || personalRecsLoading) && (
          <ContentCarousel
            label="For you"
            title="Recommended"
            items={personalRecs}
            isLoading={personalRecsLoading}
            showScore
          />
        )}

        {/* ── 6. Because you liked X ─────────────────────────────────────── */}
        {similarSections.map(section => (
          <SectionWrapper
            key={section.favoriteId}
            label="Because you liked"
            title={section.favoriteTitle}
          >
            <MovieRow movies={section.movies} />
          </SectionWrapper>
        ))}

        {/* ── 7. Trending this week ──────────────────────────────────────── */}
        <ContentCarousel
          label="This week"
          title="Trending"
          items={trending}
          isLoading={trendingLoading}
        />

        {/* ── Active filter pills ────────────────────────────────────────── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 -mt-8">
            {filters.genres?.map(id => {
              const g = allGenres.find(a => a.id === id);
              return g ? (
                <span key={id} className="text-[11px] bg-ink text-white px-2.5 py-0.5 rounded-full">
                  {g.name}
                </span>
              ) : null;
            })}
            {(filters.year_gte || filters.year_lte) && (
              <span className="text-[11px] bg-neutral-100 text-ink-mid px-2.5 py-0.5 rounded-full border border-line">
                {filters.year_gte || '…'} – {filters.year_lte || 'now'}
              </span>
            )}
            {filters.rating_gte && (
              <span className="text-[11px] bg-neutral-100 text-ink-mid px-2.5 py-0.5 rounded-full border border-line">
                ★ {filters.rating_gte}+
              </span>
            )}
          </div>
        )}

        {/* ── 8. Main grid (always visible, infinite scroll) ─────────────── */}
        <section>
          {/* Header */}
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

          {/* Sentinel for infinite scroll */}
          <div ref={gridSentinelRef} className="h-px mt-4" aria-hidden="true" />
        </section>

        {/* ── Guest CTA ──────────────────────────────────────────────────── */}
        {!isAuthenticated && (
          <div className="border-t border-line pt-8 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-ink">Want personalised picks?</p>
              <p className="text-xs text-ink-light mt-0.5">
                Create a free account and save films to your collection.
              </p>
            </div>
            <Link
              to="/register"
              className="shrink-0 text-sm bg-ink text-white px-4 py-2 rounded-full font-medium hover:bg-ink/80 transition-colors"
            >
              Get started
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
