import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG, translateMetaToTMDB } from '@/data/gameMovieTags';
import GameRow from '@/features/games/GameRow';
import BecauseYouPlayed from './BecauseYouPlayed';
import GameModal from './GameModal';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Static derived data ──────────────────────────────────────────────────────

const TRENDING_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

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
          <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.over}`}>
            {overline}
          </p>
        </div>
        <h2 className="text-xl font-bold text-ink leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ─── Hero game card ───────────────────────────────────────────────────────────

function HeroGameCard({ game, onClick }) {
  return (
    <button
      onClick={() => onClick(game)}
      className="group relative shrink-0 overflow-hidden rounded-2xl cursor-pointer focus:outline-none"
      style={{ aspectRatio: '3/2', width: '100%' }}
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

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />

      {/* Rating */}
      {game.rating != null && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold text-white/70
                         bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
          ★ {game.rating.toFixed(1)}
        </span>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
        {game.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="inline-block text-[9px] font-black tracking-[0.14em] uppercase
                                     px-1.5 py-0.5 rounded bg-accent text-white mr-1 mb-1.5">
            {tag}
          </span>
        ))}
        <p className="text-[15px] font-bold text-white leading-snug line-clamp-2">
          {game.emoji} {game.name}
        </p>
        {game.tagline && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{game.tagline}</p>
        )}
      </div>

      {/* Bottom accent on hover */}
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </button>
  );
}

// ─── Spotlight card (Game News) ───────────────────────────────────────────────

function SpotlightCard({ game, onClick }) {
  return (
    <button
      onClick={() => onClick(game)}
      className="group relative shrink-0 w-full overflow-hidden rounded-xl cursor-pointer focus:outline-none text-left"
    >
      <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '16/9' }}>
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
            <span className="text-5xl opacity-20 select-none">{game.emoji}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
        <span className="absolute top-2.5 left-2.5 text-[9px] font-black tracking-[0.15em] uppercase
                         px-2 py-0.5 rounded bg-accent text-white">
          GAME
        </span>
        {game.rating != null && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-white/70
                           bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
            ★ {game.rating.toFixed(1)}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">
            {game.name}
          </p>
          {game.price != null && (
            <p className="text-[11px] text-white/40 mt-0.5">
              {game.price === 0 ? 'Free to Play' : `$${game.price.toFixed(2)}`}
            </p>
          )}
        </div>
        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </button>
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

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalGame, setModalGame] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback((game) => {
    setModalGame(game);
    handleGameChange(game.id);
    setIsModalOpen(true);
  }, [handleGameChange]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleModalGameSelect = useCallback((id) => {
    handleGameChange(id);
    const game = GAME_CATALOG.find(g => g.id === id);
    if (game) setModalGame(game);
  }, [handleGameChange]);

  // ── Game discover data (drives modal + BecauseYouPlayed) ──────────────────
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

  // ── Static fetches: Movie News + Trending Movies ──────────────────────────
  const staticFetchDone = useRef(false);

  const [movieNews, setMovieNews]                   = useState([]);
  const [movieNewsLoading, setMovieNewsLoading]     = useState(true);
  const [trendingMovies, setTrendingMovies]         = useState([]);
  const [trendingMoviesLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    if (staticFetchDone.current) return;
    staticFetchDone.current = true;

    const t1 = setTimeout(() => {
      movieService.discover({
        year_gte: new Date().getFullYear(),
        sort_by: 'release_date.desc',
        rating_gte: 5,
      })
        .then(data => setMovieNews((data.results || []).slice(0, 14)))
        .catch(console.error)
        .finally(() => setMovieNewsLoading(false));
    }, 300);

    const t2 = setTimeout(() => {
      movieService.getTrending()
        .then(data => setTrendingMovies((data.results || []).slice(0, 14)))
        .catch(console.error)
        .finally(() => setTrendingLoading(false));
    }, 600);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Hero games: top 8 by rating ───────────────────────────────────────────
  const heroGames = useMemo(
    () => [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [],
  );

  // ── Spotlight games (Game News): editorial picks ──────────────────────────
  const spotlightGames = useMemo(
    () => GAME_CATALOG.slice(0, 6),
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          1. YOUR GAMES — HERO (large, visual, dominant)
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

        {/* Primary hero row: 3 large cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {heroGames.slice(0, 3).map(game => (
            <HeroGameCard key={game.id} game={game} onClick={openModal} />
          ))}
        </div>

        {/* Secondary row: 5 smaller cards */}
        <DragRow gap="gap-3">
          {heroGames.slice(3).map(game => (
            <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
              <UnifiedCard item={game} type="game" />
            </div>
          ))}
        </DragRow>
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
          3. BECAUSE YOU PLAYED — discovery section
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
          <GameRow
            games={TRENDING_GAMES}
            selectedId={selectedGameId}
            onSelect={handleGameChange}
            cardWidth="w-44 sm:w-52"
          />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            5. GAME NEWS — editorial spotlight
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead
            overline="Spotlight"
            title="Game News"
            color="accent"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {spotlightGames.map(game => (
              <SpotlightCard key={game.id} game={game} onClick={openModal} />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            6. MOVIE NEWS — recent releases
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
          <SectionHead
            overline="Movies"
            title="Trending This Week"
            color="violet"
          />
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

      {/* ══════════════════════════════════════════════════════════════════
          GAME MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <GameModal
        game={modalGame}
        movies={gamesMovies}
        series={gamesSeries}
        isLoading={discoverLoading}
        isOpen={isModalOpen}
        onClose={closeModal}
        onGameSelect={handleModalGameSelect}
      />

    </div>
  );
}
