import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  { id: 'horror',     label: 'Horror',     emoji: '👻', tag: 'Horror',     bg: '#2d0a0a' },
  { id: 'rpg',        label: 'RPG',        emoji: '⚔️',  tag: 'RPG',        bg: '#1a1400' },
  { id: 'survival',   label: 'Survival',   emoji: '🏕️', tag: 'Survival',   bg: '#061a06' },
  { id: 'sci-fi',     label: 'Sci-Fi',     emoji: '🚀', tag: 'Sci-Fi',     bg: '#000d2e' },
  { id: 'action',     label: 'Action',     emoji: '💥', tag: 'Action',     bg: '#1a0800' },
  { id: 'story',      label: 'Story Rich', emoji: '📖', tag: 'Story-Rich', bg: '#12001f' },
  { id: 'open-world', label: 'Open World', emoji: '🗺️', tag: 'Open World', bg: '#001220' },
  { id: 'adventure',  label: 'Adventure',  emoji: '🌄', tag: 'Adventure',  bg: '#001a14' },
  { id: 'mystery',    label: 'Mystery',    emoji: '🔍', tag: 'Mystery',    bg: '#0a0a20' },
  { id: 'fantasy',    label: 'Fantasy',    emoji: '🧙', tag: 'Fantasy',    bg: '#150025' },
  { id: 'strategy',   label: 'Strategy',   emoji: '🎯', tag: 'Strategy',   bg: '#001219' },
  { id: 'stealth',    label: 'Stealth',    emoji: '🥷', tag: 'Stealth',    bg: '#101012' },
];

function getCategoryImage(tag) {
  const games = GAME_CATALOG
    .filter(g => g.tags?.includes(tag) && g.image)
    .sort((a, b) => b.rating - a.rating);
  return games[0]?.image ?? null;
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

// ─── Hero Search ──────────────────────────────────────────────────────────────

function HeroSearch({ onGameExpand, onCategoryClick }) {
  const [query, setQuery]           = useState('');
  const [isOpen, setIsOpen]         = useState(false);
  const [movies, setMovies]         = useState([]);
  const [tvShows, setTvShows]       = useState([]);
  const [rawgResults, setRawgResults] = useState([]);
  const [searching, setSearching]   = useState(false);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);
  const rawgDebounce = useRef(null);

  const { expandGame, toggleGame, hasGame } = useGameStore();

  // Local game filter (instant)
  const localGameResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return GAME_CATALOG.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [query]);

  // Merge local + RAWG
  const gameResults = useMemo(() => {
    const catalogIds = new Set(localGameResults.map(g => g.id));
    const extras = rawgResults.filter(r => !catalogIds.has(r.id));
    return [...localGameResults, ...extras].slice(0, 8);
  }, [localGameResults, rawgResults]);

  // RAWG search (debounced)
  useEffect(() => {
    clearTimeout(rawgDebounce.current);
    if (!query.trim() || query.length < 2) { setRawgResults([]); return; }
    rawgDebounce.current = setTimeout(() => {
      rawgService.search(query, 6)
        .then(setRawgResults)
        .catch(() => setRawgResults([]));
    }, 500);
    return () => clearTimeout(rawgDebounce.current);
  }, [query]);

  // TMDB multi search (debounced)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setMovies([]); setTvShows([]); return; }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      movieService.searchMulti(query)
        .then(data => {
          setMovies((data.movies || []).slice(0, 4));
          setTvShows((data.tv    || []).slice(0, 4));
        })
        .catch(() => { setMovies([]); setTvShows([]); })
        .finally(() => setSearching(false));
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleGameClick = useCallback((game) => {
    expandGame(game.id);
    onGameExpand?.(game.id);
    setIsOpen(false);
    setQuery('');
  }, [expandGame, onGameExpand]);

  const handleChipClick = useCallback((catId) => {
    onCategoryClick?.(catId);
    document.getElementById('browse-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [onCategoryClick]);

  const hasResults   = gameResults.length > 0 || movies.length > 0 || tvShows.length > 0;
  const showDropdown = isOpen && query.length > 0;

  return (
    <section
      className="flex flex-col items-center justify-center px-5 sm:px-8 pt-28 pb-16"
      style={{ minHeight: '60vh' }}
    >
      <div className="w-full max-w-2xl">
        {/* Headline */}
        <p className="text-[10px] font-black tracking-[0.28em] uppercase text-accent text-center mb-4">
          Pellicola
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-ink text-center leading-tight mb-2">
          Discover your next<br />
          <span className="text-accent">obsession</span>
        </h1>
        <p className="text-sm text-ink-mid text-center mb-8">
          Games, movies, and series &mdash; all in one place.
        </p>

        {/* Search input + dropdown */}
        <div ref={containerRef} className="relative">
          <div className="relative flex items-center">
            <svg
              className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-light pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search games, movies, series..."
              className="w-full bg-white border border-line rounded-2xl pl-12 pr-12 py-4 text-base text-ink
                         placeholder:text-ink-light focus:outline-none focus:border-accent/50
                         focus:ring-4 focus:ring-accent/10 shadow-sm transition-all duration-200"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setMovies([]); inputRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center
                           rounded-full bg-line text-ink-mid hover:bg-surface-high hover:text-ink transition-colors
                           text-lg leading-none"
              >
                &times;
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-line rounded-2xl shadow-2xl z-[60] overflow-hidden">
              {!hasResults && !searching ? (
                <div className="px-4 py-6 text-sm text-ink-light text-center">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[60vh]">

                  {/* Games */}
                  {gameResults.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-accent">
                        Games
                      </p>
                      {gameResults.map(game => (
                        <div key={game.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                          <button
                            onClick={() => handleGameClick(game)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            {game.image ? (
                              <img src={game.image} alt="" draggable={false}
                                className="w-12 h-8 rounded-lg object-cover shrink-0 bg-surface-high" />
                            ) : (
                              <div className="w-12 h-8 rounded-lg bg-surface-high shrink-0 flex items-center justify-center text-xl">
                                {game.emoji}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{game.name}</p>
                              <p className="text-[11px] text-ink-light truncate">{game.tags?.slice(0, 3).join(' · ')}</p>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGame(game.id); }}
                            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                              hasGame(game.id)
                                ? 'bg-accent/10 border-accent/30 text-accent'
                                : 'border-line text-ink-light hover:border-accent/30 hover:text-accent'
                            }`}
                          >
                            {hasGame(game.id) ? '✓ Saved' : '+ Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Movies */}
                  {movies.length > 0 && (
                    <div className={gameResults.length > 0 ? 'border-t border-line' : ''}>
                      <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-amber-500">
                        Movies
                      </p>
                      {movies.map((m, i) => (
                        <Link
                          key={m.tmdbId ?? i}
                          to={`/movie/${m.tmdbId}`}
                          onClick={() => { setIsOpen(false); setQuery(''); }}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high"
                        >
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt="" draggable={false}
                              className="w-8 h-11 rounded object-cover shrink-0 bg-surface-high" />
                          ) : (
                            <div className="w-8 h-11 rounded bg-surface-high shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                            <p className="text-[11px] text-ink-light">{m.releaseDate?.slice(0, 4)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Series */}
                  {tvShows.length > 0 && (
                    <div className="border-t border-line">
                      <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-violet-500">
                        Series
                      </p>
                      {tvShows.map((s, i) => (
                        <div key={s.tmdbId ?? i} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                          {s.posterUrl ? (
                            <img src={s.posterUrl} alt="" draggable={false}
                              className="w-8 h-11 rounded object-cover shrink-0 bg-surface-high" />
                          ) : (
                            <div className="w-8 h-11 rounded bg-surface-high shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{s.title ?? s.name}</p>
                            <p className="text-[11px] text-ink-light">{s.releaseDate?.slice(0, 4)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Loading */}
                  {searching && (
                    <div className="flex gap-1.5 px-4 py-3 border-t border-line">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="h-1.5 flex-1 skeleton rounded-full"
                          style={{ animationDelay: `${i * 100}ms` }} />
                      ))}
                    </div>
                  )}

                  <Link
                    to={`/search?q=${encodeURIComponent(query)}`}
                    onClick={() => { setIsOpen(false); setQuery(''); }}
                    className="block px-4 py-3 text-xs text-ink-light hover:text-accent border-t border-line text-center transition-colors"
                  >
                    See all results for &ldquo;{query}&rdquo; &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick category chips */}
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {CATEGORIES.slice(0, 8).map(cat => (
            <button
              key={cat.id}
              onClick={() => handleChipClick(cat.id)}
              className="text-xs text-ink-mid border border-line rounded-full px-3 py-1.5 bg-white
                         hover:border-accent/40 hover:text-accent transition-colors"
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── My Games section (collapsible) ──────────────────────────────────────────

function MyGamesSection({ myGames, expandedGameId, onExpand }) {
  const [isOpen, setIsOpen] = useState(false);
  const { removeGame } = useGameStore();

  if (!myGames.length) return null;

  return (
    <section className="border-t border-b border-line bg-white">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-2 py-4 w-full text-left text-xs font-black tracking-[0.2em] uppercase text-ink-mid hover:text-ink transition-colors"
        >
          <span>My Games</span>
          <span className={`transition-transform duration-200 text-[10px] ${isOpen ? 'rotate-180' : ''}`}>▾</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold">
            {myGames.length}
          </span>
        </button>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 300ms ease-in-out',
          }}
        >
          <div className="overflow-hidden">
            <div className="flex gap-3 pb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {myGames.map(game => (
                <div key={game.id} className="group relative shrink-0 w-40 sm:w-48">
                  <button
                    onClick={() => onExpand(game.id)}
                    className={`block w-full text-left rounded-xl overflow-hidden border transition-all duration-200 ${
                      expandedGameId === game.id
                        ? 'border-accent'
                        : 'border-line hover:border-accent/40'
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
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/50 hover:text-white
                               text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label={`Remove ${game.name}`}
                  >
                    &times;
                  </button>
                  <p className="mt-1.5 text-xs font-medium text-ink truncate px-0.5">{game.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
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

            {/* Meta */}
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
                ) : movies.length > 0 ? (
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
                ) : series.length > 0 ? (
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

// ─── Category card (large visual) ────────────────────────────────────────────

function CategoryCard({ cat, isActive, onClick }) {
  const image      = getCategoryImage(cat.tag);
  const gamesCount = GAME_CATALOG.filter(g => g.tags?.includes(cat.tag)).length;

  return (
    <button
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl transition-all duration-200 group border-2 ${
        isActive ? 'border-accent scale-[0.98]' : 'border-transparent hover:scale-[1.02]'
      }`}
      style={{ aspectRatio: '4/3', background: cat.bg }}
    >
      {image && (
        <img
          src={image}
          alt={cat.label}
          draggable={false}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.15) 100%)' }}
      />
      {/* Active tint */}
      {isActive && <div className="absolute inset-0 bg-accent/15" />}
      {/* Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl mb-2 drop-shadow-lg">{cat.emoji}</span>
        <p className="text-xl font-black text-white tracking-wide drop-shadow-lg">{cat.label}</p>
        <p className="text-xs text-white/50 mt-1">{gamesCount} games</p>
      </div>
      {/* Bottom accent line */}
      <div
        className={`absolute bottom-0 inset-x-0 h-0.5 bg-accent transition-opacity duration-300 ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
      />
    </button>
  );
}

// ─── Category game item ────────────────────────────────────────────────────────

function CategoryGameItem({ game }) {
  const { expandGame, toggleGame, hasGame } = useGameStore();

  return (
    <div className="group">
      <button
        onClick={() => expandGame(game.id)}
        className="block w-full text-left"
      >
        <div
          className="relative rounded-xl overflow-hidden bg-surface-high"
          style={{ aspectRatio: '16/9' }}
        >
          {game.image ? (
            <img
              src={game.image}
              alt={game.name}
              draggable={false}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {game.emoji}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          {game.rating != null && (
            <span className="absolute top-2 right-2 text-[10px] font-semibold text-white/80
                             bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
              &#9733; {game.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-2">
          <p className="text-sm font-semibold text-ink truncate leading-tight group-hover:text-accent transition-colors">
            {game.name}
          </p>
          {game.tags?.length > 0 && (
            <p className="text-[11px] text-ink-light truncate mt-0.5">
              {game.tags.slice(0, 2).join(' · ')}
            </p>
          )}
        </div>
      </button>
      <button
        onClick={() => toggleGame(game.id)}
        className={`mt-1.5 w-full text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
          hasGame(game.id)
            ? 'bg-accent/10 border-accent/30 text-accent'
            : 'border-line text-ink-light hover:border-accent/30 hover:text-accent'
        }`}
      >
        {hasGame(game.id) ? '✓ Saved' : '+ Add to My Games'}
      </button>
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
  const categoryPanelRef = useRef(null);

  const activeCategory = useMemo(
    () => CATEGORIES.find(c => c.id === activeCategoryId) ?? null,
    [activeCategoryId],
  );

  const categoryGames = useMemo(() => {
    if (!activeCategory) return [];
    return GAME_CATALOG.filter(g => g.tags?.includes(activeCategory.tag));
  }, [activeCategory]);

  const toggleCategory = useCallback((id) => {
    setActiveCategoryId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        setTimeout(() => {
          categoryPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      }
      return next;
    });
  }, []);

  // ── Expanded game panel scroll ref ────────────────────────────────────────
  const gamePanelRef = useRef(null);

  const handleGameExpand = useCallback(() => {
    setTimeout(() => {
      gamePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  useEffect(() => {
    if (expandedGameId) handleGameExpand();
  }, [expandedGameId, handleGameExpand]);

  // ── Discover data (ExpandedGamePanel + BecauseYouPlayed) ──────────────────
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

  // ── Static fetches ────────────────────────────────────────────────────────
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
        const data = await movieService.discover({
          year_gte: new Date().getFullYear() - 1,
          sort_by:  'primary_release_date.desc',
        });
        const results = (data.results || []).slice(0, 14);
        if (results.length > 0) {
          setMovieNews(results);
        } else {
          const pop = await movieService.getPopular();
          setMovieNews((pop.results || []).slice(0, 14));
        }
      } catch (_) {
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

  // ── RAWG trending ─────────────────────────────────────────────────────────
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

  // Editorial game picks (always populated from catalog)
  const gameNewsPicks = useMemo(
    () => [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO SEARCH
      ══════════════════════════════════════════════════════════════════ */}
      <HeroSearch
        onGameExpand={handleGameExpand}
        onCategoryClick={toggleCategory}
      />

      {/* ══════════════════════════════════════════════════════════════════
          2. MY GAMES (COLLAPSIBLE)
      ══════════════════════════════════════════════════════════════════ */}
      <MyGamesSection
        myGames={myGames}
        expandedGameId={expandedGameId}
        onExpand={(id) => expandGame(id)}
      />

      {/* ══════════════════════════════════════════════════════════════════
          3. EXPANDED GAME PANEL
      ══════════════════════════════════════════════════════════════════ */}
      <div ref={gamePanelRef} className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <ExpandedGamePanel
          game={expandedGame}
          movies={gamesMovies}
          series={gamesSeries}
          isLoading={discoverLoading}
          isOpen={expandedGameId !== null}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. BROWSE BY CATEGORY
      ══════════════════════════════════════════════════════════════════ */}
      <section id="browse-categories" className="pt-14 max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <SectionHead overline="Explore" title="Browse by Category" color="accent" />

        {/* Category grid: 3 col desktop, 2 tablet, 1 mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              isActive={activeCategoryId === cat.id}
              onClick={() => toggleCategory(cat.id)}
            />
          ))}
        </div>

        {/* Inline category panel */}
        <div
          ref={categoryPanelRef}
          style={{
            display: 'grid',
            gridTemplateRows: activeCategoryId ? '1fr' : '0fr',
            transition: 'grid-template-rows 400ms ease-in-out',
          }}
        >
          <div className="overflow-hidden">
            {activeCategory && (
              <div className="pt-8 pb-4">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-ink">
                      {activeCategory.emoji} {activeCategory.label}
                    </h3>
                    <p className="text-sm text-ink-light mt-1">
                      {categoryGames.length} {categoryGames.length === 1 ? 'game' : 'games'} in this category
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveCategoryId(null)}
                    className="shrink-0 text-xs text-ink-light hover:text-ink border border-line rounded-full px-3 py-1.5 transition-colors"
                  >
                    Close
                  </button>
                </div>
                {categoryGames.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-6">
                    {categoryGames.map(game => (
                      <CategoryGameItem key={game.id} game={game} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-light py-8 text-center">
                    No games in this category yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          5. BECAUSE YOU PLAYED
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
            6. TRENDING GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead overline="Games" title="Trending Now" />
          {rawgLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-44 sm:w-52">
                  <div className="skeleton aspect-video rounded-xl" />
                </div>
              ))}
            </div>
          ) : rawgGames.length > 0 ? (
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
            7. NEWS
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead overline="Latest" title="What's New" color="amber" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* Game picks — editorial, always populated */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Featured Games</p>
              </div>
              <div className="space-y-3">
                {gameNewsPicks.slice(0, 4).map(game => (
                  <button
                    key={game.id}
                    onClick={() => expandGame(game.id)}
                    className="flex items-center gap-3 w-full text-left group hover:bg-white rounded-xl p-2 -mx-2 transition-colors"
                  >
                    {game.image ? (
                      <img src={game.image} alt={game.name} draggable={false}
                        className="w-20 h-12 object-cover rounded-lg shrink-0 group-hover:scale-[1.02] transition-transform" />
                    ) : (
                      <div className="w-20 h-12 bg-surface-high rounded-lg shrink-0 flex items-center justify-center text-2xl">
                        {game.emoji}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
                        {game.name}
                      </p>
                      <p className="text-[11px] text-ink-light truncate mt-0.5">
                        {game.tags?.slice(0, 3).join(' · ')}
                      </p>
                      {game.rating != null && (
                        <p className="text-[10px] text-accent font-semibold mt-0.5">
                          &#9733; {game.rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Movie news — TMDB fallback always exists */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">In Theaters</p>
              </div>
              {movieNewsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <div className="skeleton w-20 h-12 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-3 rounded w-3/4" />
                        <div className="skeleton h-2.5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : movieNews.length > 0 ? (
                <div className="space-y-3">
                  {movieNews.slice(0, 4).map(movie => (
                    <Link
                      key={movie.tmdbId}
                      to={`/movie/${movie.tmdbId}`}
                      className="flex items-center gap-3 group hover:bg-white rounded-xl p-2 -mx-2 transition-colors"
                    >
                      {movie.posterUrl ? (
                        <img src={movie.posterUrl} alt={movie.title} draggable={false}
                          className="w-8 h-12 object-cover rounded-lg shrink-0 group-hover:scale-[1.02] transition-transform" />
                      ) : (
                        <div className="w-8 h-12 bg-surface-high rounded-lg shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
                          {movie.title}
                        </p>
                        <p className="text-[11px] text-ink-light mt-0.5">
                          {movie.releaseDate?.slice(0, 4)}
                          {movie.rating > 0 && ` · \u2605 ${movie.rating.toFixed(1)}`}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                /* Fallback: more game picks */
                <div className="space-y-3">
                  {gameNewsPicks.slice(4, 8).map(game => (
                    <button
                      key={game.id}
                      onClick={() => expandGame(game.id)}
                      className="flex items-center gap-3 w-full text-left group hover:bg-white rounded-xl p-2 -mx-2 transition-colors"
                    >
                      {game.image && (
                        <img src={game.image} alt={game.name} draggable={false}
                          className="w-20 h-12 object-cover rounded-lg shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
                          {game.name}
                        </p>
                        <p className="text-[11px] text-ink-light truncate mt-0.5">
                          {game.tags?.slice(0, 2).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            8. TRENDING MOVIES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14 pb-20">
          <SectionHead overline="Movies" title="Trending This Week" color="violet" />
          <LandscapeRow items={trendingMovies} type="movie" isLoading={trendingMoviesLoading} />
        </section>

      </div>

      {/* FOOTER */}
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
