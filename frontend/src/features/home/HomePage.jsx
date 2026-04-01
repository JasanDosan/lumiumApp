import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { rawgService } from '@/services/rawgService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import GameRow from '@/features/games/GameRow';
import BecauseYouPlayed from './BecauseYouPlayed';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Static derived data ──────────────────────────────────────────────────────

const CATALOG_TRENDING = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_GAME_KEY   = 'pm_selected_game';
const LS_RECENT_KEY = 'pm_recent_games';

function getStoredGame() {
  try {
    const saved = localStorage.getItem(LS_GAME_KEY);
    return GAME_CATALOG.some(g => g.id === saved) ? saved : GAME_CATALOG[0].id;
  } catch { return GAME_CATALOG[0].id; }
}

function getRecentGames() {
  try {
    const ids = JSON.parse(localStorage.getItem(LS_RECENT_KEY) || '[]');
    return ids.map(id => GAME_CATALOG.find(g => g.id === id)).filter(Boolean);
  } catch { return []; }
}

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

function HeroGameCard({ game, isExpanded, onClick }) {
  return (
    <button
      onClick={() => onClick(game)}
      className="group relative w-full overflow-hidden rounded-2xl cursor-pointer focus:outline-none"
      style={{ aspectRatio: '3/2' }}
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

      {/* Expanded indicator */}
      {isExpanded && (
        <div className="absolute inset-0 ring-2 ring-inset ring-accent rounded-2xl" />
      )}

      {/* Rating */}
      {game.rating != null && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold text-white/70
                         bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
          ★ {game.rating.toFixed(1)}
        </span>
      )}

      {/* Bottom */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
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

      <div className={`absolute bottom-0 inset-x-0 h-0.5 bg-accent transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
    </button>
  );
}

// ─── Expanded game panel ──────────────────────────────────────────────────────

function ExpandedGamePanel({ game, movies, series, isLoading, onClose, onGameSelect, isOpen }) {
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
          <div className="mt-3 rounded-2xl bg-surface border border-line">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6">
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-accent uppercase mb-1.5">
                  {game.tags?.[0] ?? 'Game'}
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-ink leading-tight">
                  {game.emoji}&nbsp;{game.name}
                </h3>
                {game.tagline && (
                  <p className="text-sm text-ink-mid mt-1.5">{game.tagline}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 mt-1 w-8 h-8 flex items-center justify-center rounded-full
                           bg-surface-high text-ink-light hover:text-ink transition-colors"
                aria-label="Close panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Meta strip ─────────────────────────────────────────────── */}
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

            {/* ── Content ────────────────────────────────────────────────── */}
            <div className="px-6 sm:px-8 py-8 space-y-10">

              {/* Movies */}
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">Films</p>
                </div>
                <h4 className="text-lg font-bold text-ink mb-4">
                  Movies for {game.name} fans
                  {!isLoading && (
                    <span className="ml-2 text-xs font-normal text-ink-light">{movies.length} titles</span>
                  )}
                </h4>
                {isLoading ? (
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-64 xl:w-72">
                        <div className="skeleton aspect-video rounded-xl" />
                      </div>
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
                  {!isLoading && (
                    <span className="ml-2 text-xs font-normal text-ink-light">{series.length} titles</span>
                  )}
                </h4>
                {isLoading ? (
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-64 xl:w-72">
                        <div className="skeleton aspect-video rounded-xl" />
                      </div>
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
                  onSelect={onGameSelect}
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

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  // ── Game selection ────────────────────────────────────────────────────────
  const [selectedGameId, setSelectedGameId] = useState(getStoredGame);
  const [recentGames]                       = useState(getRecentGames);

  const handleGameChange = useCallback((id) => {
    localStorage.setItem(LS_GAME_KEY, id);
    setSelectedGameId(id);
  }, []);

  const selectedGame = useMemo(
    () => GAME_CATALOG.find(g => g.id === selectedGameId) ?? GAME_CATALOG[0],
    [selectedGameId],
  );

  // ── Expanding panel state ─────────────────────────────────────────────────
  const [expandedGameId, setExpandedGameId] = useState(null);

  const expandedGame = useMemo(
    () => (expandedGameId ? GAME_CATALOG.find(g => g.id === expandedGameId) ?? null : null),
    [expandedGameId],
  );

  const handleCardClick = useCallback((game) => {
    const next = expandedGameId === game.id ? null : game.id;
    setExpandedGameId(next);
    if (next) handleGameChange(next);
  }, [expandedGameId, handleGameChange]);

  const closePanel = useCallback(() => setExpandedGameId(null), []);

  const handlePanelGameSelect = useCallback((id) => {
    handleGameChange(id);
    setExpandedGameId(id);
  }, [handleGameChange]);

  // ── Game discover data (drives panel + BecauseYouPlayed) ──────────────────
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

    const t2 = setTimeout(() => {
      movieService.discover({
        year_gte: new Date().getFullYear(),
        sort_by: 'primary_release_date.desc',
        rating_gte: 5,
      })
        .then(data => setMovieNews((data.results || []).slice(0, 14)))
        .catch(console.error)
        .finally(() => setMovieNewsLoading(false));
    }, 600);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── RAWG trending games (falls back to static catalog) ───────────────────
  const [rawgGames, setRawgGames]     = useState([]);
  const [rawgLoading, setRawgLoading] = useState(!!import.meta.env.VITE_RAWG_API_KEY);

  useEffect(() => {
    if (!import.meta.env.VITE_RAWG_API_KEY) return;
    rawgService.getTrending(12)
      .then(setRawgGames)
      .catch(() => { /* no key or network — use static fallback */ })
      .finally(() => setRawgLoading(false));
  }, []);

  const trendingGames = rawgGames.length ? rawgGames : CATALOG_TRENDING;

  // ── Hero games: top 8 by rating ───────────────────────────────────────────
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
      <section className="pt-20 pb-4 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
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

        {/* 3-column hero grid */}
        <div className="grid grid-cols-3 gap-4">
          {heroGames.slice(0, 3).map(game => (
            <HeroGameCard
              key={game.id}
              game={game}
              isExpanded={expandedGameId === game.id}
              onClick={handleCardClick}
            />
          ))}
        </div>

        {/* Expanding detail panel — sits between big cards and secondary row */}
        <ExpandedGamePanel
          game={expandedGame}
          movies={gamesMovies}
          series={gamesSeries}
          isLoading={discoverLoading}
          isOpen={expandedGameId !== null}
          onClose={closePanel}
          onGameSelect={handlePanelGameSelect}
        />

        {/* Secondary row */}
        <div className="mt-4">
          <DragRow gap="gap-3">
            {heroGames.slice(3).map(game => (
              <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                <UnifiedCard
                  item={game}
                  type="game"
                  onClick={() => handleCardClick(game)}
                />
              </div>
            ))}
          </DragRow>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* ════════════════════════════════════════════════════════════════
            2. CONTINUE PLAYING
        ════════════════════════════════════════════════════════════════ */}
        {recentGames.length > 0 && (
          <section className="pt-14">
            <SectionHead overline="Your library" title="Continue Playing" color="accent" />
            <GameRow
              games={recentGames}
              selectedId={selectedGameId}
              onSelect={handleGameChange}
              cardWidth="w-44 sm:w-52"
            />
          </section>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. BECAUSE YOU PLAYED
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-14">
        <BecauseYouPlayed
          game={selectedGame}
          movies={gamesMovies}
          series={gamesSeries}
          isLoading={discoverLoading}
          selectedGameId={selectedGameId}
          onGameChange={handleGameChange}
        />
      </div>

      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* ════════════════════════════════════════════════════════════════
            4. TRENDING GAMES
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
              games={CATALOG_TRENDING}
              selectedId={selectedGameId}
              onSelect={handleGameChange}
              cardWidth="w-44 sm:w-52"
            />
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════
            5. MOVIE NEWS — recent releases
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
            6. TRENDING MOVIES
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
