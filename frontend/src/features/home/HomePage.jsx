import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG, translateMetaToTMDB } from '@/data/gameMovieTags';
import GameHero from '@/features/games/GameHero';
import GameRow from '@/features/games/GameRow';
import BecauseYouPlayed from './BecauseYouPlayed';
import MovieRow from '@/features/movies/MovieRow';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Static derived data ──────────────────────────────────────────────────────

const TRENDING_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

const DEAL_GAMES = GAME_CATALOG
  .filter(g => g.price > 0 && g.price <= 29.99)
  .sort((a, b) => (b.rating / b.price) - (a.rating / a.price))
  .slice(0, 10);

const DISCOVERY_GENRES = [
  { id: 28,    label: 'Action',    emoji: '💥' },
  { id: 27,    label: 'Horror',    emoji: '👻' },
  { id: 878,   label: 'Sci-Fi',    emoji: '🚀' },
  { id: 53,    label: 'Thriller',  emoji: '🔪' },
  { id: 18,    label: 'Drama',     emoji: '🎭' },
  { id: 14,    label: 'Fantasy',   emoji: '🧙' },
  { id: 80,    label: 'Crime',     emoji: '🔫' },
  { id: 35,    label: 'Comedy',    emoji: '😄' },
  { id: 12,    label: 'Adventure', emoji: '🗺️' },
  { id: 10752, label: 'War',       emoji: '⚔️' },
  { id: 9648,  label: 'Mystery',   emoji: '🔍' },
  { id: 37,    label: 'Western',   emoji: '🤠' },
];

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

// ─── Section header helpers ───────────────────────────────────────────────────

function SectionHead({ overline, title, color = 'default', action }) {
  const colorMap = {
    accent:  { bar: 'bg-accent',    over: 'text-accent' },
    amber:   { bar: 'bg-amber-500', over: 'text-amber-400' },
    violet:  { bar: 'bg-violet-500', over: 'text-violet-400' },
    default: { bar: 'bg-line',      over: 'text-ink-light' },
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

// ─── LandscapeRow (local) ─────────────────────────────────────────────────────

function LandscapeRow({ items, type, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-64 xl:w-72">
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
        <div key={item.tmdbId ?? item.id} className="shrink-0 w-64 xl:w-72 pointer-events-auto">
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

  // Featured game = highest-rated (static)
  const featuredGame = useMemo(() => TRENDING_GAMES[0], []);

  // ── Remote data ───────────────────────────────────────────────────────────
  const [recs, setRecs]                       = useState([]);
  const [recsLoading, setRecsLoading]         = useState(false);
  const [gamesMovies, setGamesMovies]         = useState([]);
  const [gamesSeries, setGamesSeries]         = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);

  // ── Fetch recommendations (auth) ──────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { setRecs([]); return; }
    let cancelled = false;
    setRecsLoading(true);
    movieService.getRecommendations()
      .then(d => { if (!cancelled) setRecs((d.results || []).slice(0, 16)); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setRecsLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // ── Fetch movies + series for selected game ───────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO — FEATURED GAME
      ══════════════════════════════════════════════════════════════════ */}
      <GameHero game={featuredGame} />

      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* ════════════════════════════════════════════════════════════════
            2. CONTINUE PLAYING
        ════════════════════════════════════════════════════════════════ */}
        {recentGames.length > 0 && (
          <section className="pt-12">
            <SectionHead overline="Your library" title="Continue Playing" color="accent" />
            <GameRow
              games={recentGames}
              selectedId={selectedGameId}
              onSelect={handleGameChange}
              cardWidth="w-44 sm:w-52"
            />
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            3. RECOMMENDED FOR YOU (auth users only)
        ════════════════════════════════════════════════════════════════ */}
        {isAuthenticated && (recsLoading || recs.length > 0) && (
          <section className="pt-14">
            <SectionHead
              overline="Personalised"
              title="Recommended for you"
              color="accent"
              action={
                <Link to="/recommendations" className="text-xs text-ink-light hover:text-ink transition-colors shrink-0">
                  See all →
                </Link>
              }
            />
            <MovieRow movies={recs} isLoading={recsLoading} showScore />
          </section>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. BECAUSE YOU PLAYED X — PRIMARY, FULL-BLEED
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
            5. TRENDING GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead overline="Games" title="Trending Games" color="accent" />
          <GameRow
            games={TRENDING_GAMES}
            selectedId={selectedGameId}
            onSelect={handleGameChange}
            cardWidth="w-44 sm:w-52"
          />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            6. DEALS
        ════════════════════════════════════════════════════════════════ */}
        {DEAL_GAMES.length > 0 && (
          <section className="pt-14">
            <SectionHead overline="Store" title="On Sale" />
            <GameRow
              games={DEAL_GAMES}
              selectedId={selectedGameId}
              onSelect={handleGameChange}
              cardWidth="w-44 sm:w-52"
            />
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            7. GENRES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead overline="Browse" title="Explore by Genre" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {DISCOVERY_GENRES.map(g => (
              <Link
                key={g.id}
                to={`/search?q=${encodeURIComponent(g.label)}`}
                className="flex flex-col items-center justify-center gap-2 py-5 px-3
                           bg-surface border border-line rounded-2xl
                           hover:border-accent/30 hover:bg-surface-high
                           transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  {g.emoji}
                </span>
                <span className="text-[11px] font-semibold text-ink-mid group-hover:text-ink transition-colors">
                  {g.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            8. MOVIES BASED ON YOUR GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead
            overline="Films"
            title={`Movies from ${selectedGame.name}`}
            color="amber"
            action={
              <Link to="/movies" className="text-xs text-ink-light hover:text-ink transition-colors shrink-0">
                Browse platforms →
              </Link>
            }
          />
          <LandscapeRow items={gamesMovies} type="movie" isLoading={discoverLoading} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            9. SERIES BASED ON YOUR GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14 pb-20">
          <SectionHead
            overline="Series"
            title={`Series from ${selectedGame.name}`}
            color="violet"
          />
          <LandscapeRow items={gamesSeries} type="series" isLoading={discoverLoading} />
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
