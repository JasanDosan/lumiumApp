import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { rawgService } from '@/services/rawgService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import { useGameStore } from '@/features/games/gameStore';
import GameRow from '@/features/games/GameRow';
import BecauseYouPlayed from './BecauseYouPlayed';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Static data ──────────────────────────────────────────────────────────────

const TOP_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

const CATEGORIES = [
  { id: 'horror',     label: 'Horror',     emoji: '👻', tag: 'Horror'     },
  { id: 'survival',   label: 'Survival',   emoji: '🏕️', tag: 'Survival'   },
  { id: 'rpg',        label: 'RPG',        emoji: '⚔️',  tag: 'RPG'        },
  { id: 'open-world', label: 'Open World', emoji: '🗺️', tag: 'Open World' },
  { id: 'sci-fi',     label: 'Sci-Fi',     emoji: '🚀', tag: 'Sci-Fi'     },
  { id: 'action',     label: 'Action',     emoji: '💥', tag: 'Action'     },
  { id: 'story',      label: 'Story Rich', emoji: '📖', tag: 'Story-Rich' },
  { id: 'strategy',   label: 'Strategy',   emoji: '🎯', tag: 'Strategy'   },
  { id: 'mystery',    label: 'Mystery',    emoji: '🔍', tag: 'Mystery'    },
  { id: 'fantasy',    label: 'Fantasy',    emoji: '🧙', tag: 'Fantasy'    },
];

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ overline, title, color = 'default', action }) {
  const colorMap = {
    accent:  { bar: 'bg-accent',     over: 'text-accent' },
    amber:   { bar: 'bg-amber-500',  over: 'text-amber-400' },
    violet:  { bar: 'bg-violet-500', over: 'text-violet-400' },
    default: { bar: 'bg-line',       over: 'text-ink-light' },
  };
  const c = colorMap[color] ?? colorMap.default;
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`w-0.5 h-5 ${c.bar} rounded-full shrink-0`} />
          <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.over}`}>{overline}</p>
        </div>
        <h2 className="text-xl font-bold text-ink leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ─── Hero game card ───────────────────────────────────────────────────────────

function HeroGameCard({ game, isExpanded }) {
  const { expandGame, toggleGame, hasGame } = useGameStore();

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '3/2' }}>
      {/* Click area (expand) */}
      <button
        onClick={() => expandGame(game.id)}
        className="absolute inset-0 w-full h-full focus:outline-none"
        aria-label={`Expand ${game.name}`}
      >
        {game.image ? (
          <img
            src={game.image}
            alt={game.name}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-high to-canvas flex items-center justify-center">
            <span className="text-7xl opacity-20 select-none">{game.emoji}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
      </button>

      {/* Expanded indicator — visible ring + top bar */}
      {isExpanded && (
        <>
          <div className="absolute inset-0 ring-2 ring-inset ring-accent rounded-2xl pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-1 bg-accent rounded-t-2xl pointer-events-none" />
        </>
      )}

      {/* Rating */}
      {game.rating != null && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold text-white/70
                         bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
          ★ {game.rating.toFixed(1)}
        </span>
      )}

      {/* Add to My Games — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleGame(game.id); }}
        className={`absolute top-3 left-3 text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm
                    border transition-all duration-200
                    opacity-0 group-hover:opacity-100
                    ${hasGame(game.id)
                      ? 'bg-accent/90 border-accent text-white'
                      : 'bg-black/50 border-white/20 text-white/80 hover:bg-accent/90 hover:border-accent'
                    }`}
      >
        {hasGame(game.id) ? '✓ Saved' : '+ My Games'}
      </button>

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pointer-events-none">
        {game.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="inline-block text-[9px] font-black tracking-[0.14em] uppercase
                                     px-1.5 py-0.5 rounded bg-accent text-white mr-1 mb-1.5">
            {tag}
          </span>
        ))}
        <p className="text-[15px] font-bold text-white leading-snug">
          {game.emoji} {game.name}
        </p>
        {game.tagline && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{game.tagline}</p>
        )}
      </div>

      <div className={`absolute bottom-0 inset-x-0 h-0.5 bg-accent pointer-events-none transition-opacity duration-300
                      ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
    </div>
  );
}

// ─── Expanded game panel ──────────────────────────────────────────────────────

function ExpandedGamePanel({ game, movies, series, isLoading, isOpen }) {
  const { collapseGame, expandGame, toggleGame, hasGame } = useGameStore();

  const similarGames = useMemo(
    () => (game ? getRelatedGames(game.id, 6) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game?.id],
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 350ms ease-in-out',
      }}
    >
      <div className="overflow-hidden">
        {game && (
          <div
            style={{
              background: '#111827',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.08)',
              margin: '16px 0 8px',
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 300ms ease-in-out, transform 300ms ease-in-out',
            }}
          >

            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.2em] text-accent uppercase mb-1.5">
                  {game.tags?.[0] ?? 'Game'}
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-ink leading-tight truncate">
                  {game.emoji}&nbsp;{game.name}
                </h3>
                {game.tagline && (
                  <p className="text-sm text-ink-mid mt-1.5">{game.tagline}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleGame(game.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    hasGame(game.id)
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-line text-ink-mid hover:border-accent/40 hover:text-accent'
                  }`}
                >
                  {hasGame(game.id) ? '✓ In My Games' : '+ Add to My Games'}
                </button>
                <button
                  onClick={collapseGame}
                  className="w-8 h-8 flex items-center justify-center rounded-full
                             bg-surface-high text-ink-light hover:text-ink transition-colors"
                  aria-label="Close panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Meta + description */}
            <div className="flex flex-wrap items-center gap-3 px-6 sm:px-8 py-4 border-b border-line">
              {game.rating != null && (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-ink">{game.rating}</span>
                  <span className="text-xs text-ink-light">/ 10</span>
                </div>
              )}
              {game.price != null && (
                <span className="text-sm font-semibold text-ink px-2 py-0.5 rounded bg-surface-high">
                  {game.price === 0 ? 'Free to Play' : `$${game.price.toFixed(2)}`}
                </span>
              )}
              {game.meta?.mood?.map(m => (
                <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.07] text-ink-mid border border-white/[0.08] capitalize">
                  {m.replace('_', ' ')}
                </span>
              ))}
              {game.description && (
                <p className="w-full text-sm text-ink-mid leading-relaxed mt-1">{game.description}</p>
              )}
            </div>

            {/* Content */}
            <div className="px-6 sm:px-8 py-8 space-y-10">

              {/* Movies */}
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">Films</p>
                </div>
                <h4 className="text-lg font-bold text-ink mb-4">
                  Movies for {game.name} fans
                  {!isLoading && <span className="ml-2 text-xs font-normal text-ink-light">{movies.length} titles</span>}
                </h4>
                {isLoading ? (
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-64 xl:w-72"><div className="skeleton aspect-video rounded-xl" /></div>
                    ))}
                  </div>
                ) : movies.length ? (
                  <DragRow gap="gap-4">
                    {movies.map(item => (
                      <div key={item.tmdbId ?? item.id} className="shrink-0 w-64 xl:w-72 pointer-events-auto">
                        <UnifiedCard item={item} type="movie" />
                      </div>
                    ))}
                  </DragRow>
                ) : (
                  <p className="text-sm text-ink-light">No movies matched.</p>
                )}
              </div>

              {/* Series */}
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-0.5 h-5 bg-violet-500 rounded-full shrink-0" />
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-violet-400">Series</p>
                </div>
                <h4 className="text-lg font-bold text-ink mb-4">
                  Shows that match {game.name}
                  {!isLoading && <span className="ml-2 text-xs font-normal text-ink-light">{series.length} titles</span>}
                </h4>
                {isLoading ? (
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-64 xl:w-72"><div className="skeleton aspect-video rounded-xl" /></div>
                    ))}
                  </div>
                ) : series.length ? (
                  <DragRow gap="gap-4">
                    {series.map(item => (
                      <div key={item.tmdbId ?? item.id} className="shrink-0 w-64 xl:w-72 pointer-events-auto">
                        <UnifiedCard item={item} type="series" />
                      </div>
                    ))}
                  </DragRow>
                ) : (
                  <p className="text-sm text-ink-light">No series matched.</p>
                )}
              </div>

              {/* Similar games */}
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Similar Games</p>
                </div>
                <h4 className="text-lg font-bold text-ink mb-4">You might also like</h4>
                <GameRow
                  games={similarGames}
                  onSelect={(id) => expandGame(id)}
                  cardWidth="w-40 sm:w-48"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Landscape media row ──────────────────────────────────────────────────────

function LandscapeRow({ items, type, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-72 xl:w-80">
            <div className="skeleton aspect-video rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  if (!items.length) return null;
  return (
    <DragRow gap="gap-4">
      {items.map(item => (
        <div key={item.tmdbId ?? item.id} className="shrink-0 w-72 xl:w-80 pointer-events-auto">
          <UnifiedCard item={item} type={type} />
        </div>
      ))}
    </DragRow>
  );
}

// ─── My Games mini-card ───────────────────────────────────────────────────────

function MyGameCard({ game }) {
  const { expandGame, removeGame, expandedGameId } = useGameStore();
  const isExpanded = expandedGameId === game.id;
  return (
    <div className="group relative shrink-0 w-40 sm:w-48">
      <button
        onClick={() => expandGame(game.id)}
        className={`block w-full text-left rounded-xl overflow-hidden border transition-all duration-200 ${
          isExpanded ? 'border-accent' : 'border-line hover:border-accent/40'
        }`}
        style={{ aspectRatio: '460/215' }}
      >
        {game.image ? (
          <img src={game.image} alt={game.name} draggable={false}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="w-full h-full bg-surface-high flex items-center justify-center text-4xl">
            {game.emoji}
          </div>
        )}
      </button>
      <button
        onClick={() => removeGame(game.id)}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/50 hover:text-white text-xs
                   opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label={`Remove ${game.name}`}
      >
        ×
      </button>
      <p className="mt-1.5 text-xs font-medium text-ink truncate px-0.5">{game.name}</p>
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  // ── Game store ────────────────────────────────────────────────────────────
  const { selectedGameId, expandedGameId, expandGame, selectGame, myGameIds } = useGameStore();

  const selectedGame = useMemo(
    () => GAME_CATALOG.find(g => g.id === selectedGameId) ?? GAME_CATALOG[0],
    [selectedGameId],
  );

  const expandedGame = useMemo(
    () => (expandedGameId ? GAME_CATALOG.find(g => g.id === expandedGameId) ?? null : null),
    [expandedGameId],
  );

  const myGames = useMemo(
    () => myGameIds.map(id => GAME_CATALOG.find(g => g.id === id)).filter(Boolean),
    [myGameIds],
  );

  // ── Category explorer ─────────────────────────────────────────────────────
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const activeCategory = useMemo(
    () => CATEGORIES.find(c => c.id === activeCategoryId) ?? null,
    [activeCategoryId],
  );

  const categoryGames = useMemo(() => {
    if (!activeCategory) return [];
    return GAME_CATALOG.filter(g => g.tags?.includes(activeCategory.tag));
  }, [activeCategory]);

  const toggleCategory = (id) => setActiveCategoryId(prev => prev === id ? null : id);

  // ── Discover data (panel + BecauseYouPlayed) ──────────────────────────────
  const [gamesMovies, setGamesMovies]         = useState([]);
  const [gamesSeries, setGamesSeries]         = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDiscoverLoading(true);
    setGamesMovies([]);
    setGamesSeries([]);

    const filters = translateMetaToTMDB(selectedGame.meta);

    Promise.all([
      movieService.discover({ ...filters, page: 1 }),
      tvService.discover({ genres: filters.genres, sort_by: filters.sort_by }),
    ])
      .then(([movieData, tvData]) => {
        if (cancelled) return;
        setGamesMovies((movieData.results || []).slice(0, 16));
        setGamesSeries((tvData.results   || []).slice(0, 16));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setDiscoverLoading(false); });

    return () => { cancelled = true; };
  }, [selectedGameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Static fetches: Trending Movies + Movie News ──────────────────────────
  const staticFetchDone = useRef(false);

  const [trendingMovies, setTrendingMovies]         = useState([]);
  const [trendingMoviesLoading, setTrendingLoading] = useState(true);
  const [movieNews, setMovieNews]                   = useState([]);
  const [movieNewsLoading, setMovieNewsLoading]     = useState(true);

  useEffect(() => {
    if (staticFetchDone.current) return;
    staticFetchDone.current = true;

    const t1 = setTimeout(() => {
      movieService.getTrending()
        .then(data => setTrendingMovies((data.results || []).slice(0, 14)))
        .catch(console.error)
        .finally(() => setTrendingLoading(false));
    }, 300);

    const t2 = setTimeout(async () => {
      try {
        // Try recent popular releases (year window gives better vote counts than strict currentYear)
        const data = await movieService.discover({
          year_gte: new Date().getFullYear() - 1,
          sort_by:  'primary_release_date.desc',
        });
        const results = (data.results || []).slice(0, 14);
        if (results.length > 0) {
          setMovieNews(results);
        } else {
          // Fallback: popular movies always have data
          const pop = await movieService.getPopular();
          setMovieNews((pop.results || []).slice(0, 14));
        }
      } catch {
        try {
          const pop = await movieService.getPopular();
          setMovieNews((pop.results || []).slice(0, 14));
        } catch (e) { console.error(e); }
      } finally {
        setMovieNewsLoading(false);
      }
    }, 600);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── RAWG trending (falls back to static) ─────────────────────────────────
  const [rawgGames, setRawgGames]     = useState([]);
  const [rawgLoading, setRawgLoading] = useState(!!import.meta.env.VITE_RAWG_API_KEY);

  useEffect(() => {
    if (!import.meta.env.VITE_RAWG_API_KEY) return;
    rawgService.getTrending(12)
      .then(setRawgGames)
      .catch(() => {})
      .finally(() => setRawgLoading(false));
  }, []);

  const trendingGames = rawgGames.length ? rawgGames : TOP_GAMES;

  // ── Hero games ────────────────────────────────────────────────────────────
  const heroGames = useMemo(
    () => [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          1. YOUR GAMES — HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section className="pt-20 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] text-accent uppercase mb-2">
              Your Games
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-ink leading-tight">
              What are you playing?
            </h1>
          </div>
          <Link to="/search" className="text-xs text-ink-light hover:text-ink transition-colors shrink-0">
            Search all →
          </Link>
        </div>

        {/* 3 large hero cards */}
        <div className="grid grid-cols-3 gap-4">
          {heroGames.slice(0, 3).map(game => (
            <HeroGameCard
              key={game.id}
              game={game}
              isExpanded={expandedGameId === game.id}
            />
          ))}
        </div>

        {/* ── Expanding detail panel ─────────────────────────────────── */}
        <ExpandedGamePanel
          game={expandedGame}
          movies={gamesMovies}
          series={gamesSeries}
          isLoading={discoverLoading}
          isOpen={expandedGameId !== null}
        />

        {/* Secondary row */}
        <div className="mt-4">
          <DragRow gap="gap-3">
            {heroGames.slice(3).map(game => (
              <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                <UnifiedCard
                  item={game}
                  type="game"
                  onClick={() => expandGame(game.id)}
                />
              </div>
            ))}
          </DragRow>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. MY LIBRARY
      ══════════════════════════════════════════════════════════════════ */}
      {myGames.length > 0 && (
        <section className="pt-14 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
          <SectionHead overline="My Library" title="My Games" color="accent" />
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {myGames.map(game => (
              <MyGameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3. CATEGORY EXPLORER
      ══════════════════════════════════════════════════════════════════ */}
      <section className="pt-14 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <SectionHead overline="Explore" title="Browse by Category" />

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-all duration-200 ${
                activeCategoryId === cat.id
                  ? 'bg-accent border-accent text-white font-medium'
                  : 'border-line text-ink-mid hover:border-accent/40 hover:text-ink'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Filtered games */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: activeCategoryId ? '1fr' : '0fr',
            transition: 'grid-template-rows 300ms ease-in-out',
          }}
        >
          <div className="overflow-hidden">
            {activeCategory && (
              <div className="pb-2">
                {categoryGames.length ? (
                  <DragRow gap="gap-3">
                    {categoryGames.map(game => (
                      <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                        <UnifiedCard
                          item={game}
                          type="game"
                          onClick={() => expandGame(game.id)}
                        />
                      </div>
                    ))}
                  </DragRow>
                ) : (
                  <p className="text-sm text-ink-light py-4">No games in this category.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4. BECAUSE YOU PLAYED
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-14">
        <BecauseYouPlayed
          game={selectedGame}
          movies={gamesMovies}
          series={gamesSeries}
          isLoading={discoverLoading}
          selectedGameId={selectedGameId}
          onGameChange={(id) => selectGame(id)}
        />
      </div>

      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* ════════════════════════════════════════════════════════════════
            5. TRENDING GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead overline="Games" title="Trending Games" />
          {rawgLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-44 sm:w-52">
                  <div className="skeleton aspect-video rounded-xl" />
                </div>
              ))}
            </div>
          ) : rawgGames.length ? (
            <DragRow gap="gap-3">
              {trendingGames.map(game => (
                <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                  <UnifiedCard item={game} type="game" />
                </div>
              ))}
            </DragRow>
          ) : (
            <GameRow
              games={trendingGames}
              selectedId={selectedGameId}
              onSelect={(id) => expandGame(id)}
              cardWidth="w-44 sm:w-52"
            />
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════
            6. MOVIE NEWS
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead
            overline="In Theaters"
            title="Movie News"
            color="amber"
            action={
              <Link to="/movies" className="text-xs text-ink-light hover:text-ink transition-colors shrink-0">
                Browse platforms →
              </Link>
            }
          />
          <LandscapeRow items={movieNews} type="movie" isLoading={movieNewsLoading} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            7. TRENDING MOVIES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14 pb-20">
          <SectionHead overline="Movies" title="Trending This Week" color="violet" />
          <LandscapeRow items={trendingMovies} type="movie" isLoading={trendingMoviesLoading} />
        </section>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-line py-10 px-5 sm:px-8 lg:px-12">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] uppercase text-ink">Pellicola</p>
            <p className="text-xs text-ink-light mt-1">
              Discover films and series from the games you love.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/search" className="text-xs text-ink-light hover:text-ink transition-colors">Search</Link>
            <Link to="/movies" className="text-xs text-ink-light hover:text-ink transition-colors">Platforms</Link>
            {!isAuthenticated && (
              <Link to="/register" className="text-xs bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-full font-medium transition-colors">
                Get started
              </Link>
            )}
          </div>
        </div>
      </footer>

    </div>
  );
}
