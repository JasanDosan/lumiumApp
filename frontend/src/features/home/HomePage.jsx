import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { rawgService } from '@/services/rawgService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import { useGameStore } from '@/features/games/gameStore';
import { useUserProfileStore } from '@/features/profile/userProfileStore';
import GameRow from '@/features/games/GameRow';
import BecauseYouPlayed from './BecauseYouPlayed';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Static data ──────────────────────────────────────────────────────────────

const TOP_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

// Maps each category id to the RAWG genre/tag slug used for AND filtering
const CATEGORY_FILTER_MAP = {
  'horror':     { type: 'tag',   slug: 'horror' },
  'rpg':        { type: 'genre', slug: 'role-playing-games-rpg' },
  'survival':   { type: 'tag',   slug: 'survival' },
  'sci-fi':     { type: 'tag',   slug: 'sci-fi' },
  'action':     { type: 'genre', slug: 'action' },
  'story':      { type: 'tag',   slug: 'story-rich' },
  'open-world': { type: 'tag',   slug: 'open-world' },
  'adventure':  { type: 'genre', slug: 'adventure' },
  'mystery':    { type: 'tag',   slug: 'mystery' },
  'fantasy':    { type: 'tag',   slug: 'fantasy' },
  'strategy':   { type: 'genre', slug: 'strategy' },
  'stealth':    { type: 'tag',   slug: 'stealth' },
};

// Reverse map: RAWG slug → our category ID (for profile-driven recommendations)
const SLUG_TO_CATEGORY_ID = Object.fromEntries(
  Object.entries(CATEGORY_FILTER_MAP).map(([id, { slug }]) => [slug, id])
);

const ORDER_OPTIONS = [
  { value: 'relevance',  label: 'Relevance' },
  { value: 'rating',     label: 'Rating' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'released',   label: 'Release date' },
  { value: 'metacritic', label: 'Metacritic' },
];

const PLATFORM_OPTIONS = [
  { value: null,  label: 'All platforms' },
  { value: 4,     label: 'PC' },
  { value: 18,    label: 'PlayStation' },
  { value: 1,     label: 'Xbox' },
  { value: 7,     label: 'Nintendo' },
];

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

// Curated tag pool — complements the genre categories
const POPULAR_TAGS = [
  { slug: 'zombies',           label: 'Zombies',      emoji: '🧟' },
  { slug: 'crafting',          label: 'Crafting',     emoji: '⚒️' },
  { slug: 'roguelike',         label: 'Roguelike',    emoji: '🎲' },
  { slug: 'co-op',             label: 'Co-op',        emoji: '👥' },
  { slug: 'fps',               label: 'FPS',          emoji: '🔫' },
  { slug: 'sandbox',           label: 'Sandbox',      emoji: '🏖️' },
  { slug: 'post-apocalyptic',  label: 'Post-Apoc',    emoji: '☢️' },
  { slug: 'pixel-graphics',    label: 'Pixel Art',    emoji: '👾' },
  { slug: 'cyberpunk',         label: 'Cyberpunk',    emoji: '🤖' },
  { slug: 'atmospheric',       label: 'Atmospheric',  emoji: '🌙' },
];

const GAME_MODES = [
  { slug: 'single-player', label: 'Singleplayer', emoji: '🧍' },
  { slug: 'multiplayer',   label: 'Multiplayer',  emoji: '👥' },
];

// Maps game category IDs → TMDB genre IDs (for cross-media "Because You Like" sections)
const CATEGORY_TO_TMDB_GENRES = {
  'horror':     [27],
  'rpg':        [14, 12],
  'survival':   [28, 53],
  'sci-fi':     [878],
  'action':     [28],
  'story':      [18],
  'open-world': [12, 28],
  'adventure':  [12],
  'mystery':    [9648],
  'fantasy':    [14],
  'strategy':   [36],
  'stealth':    [53, 28],
};

// ─── Hero "For You Today" ────────────────────────────────────────────────────

function HeroForYou({ featured, featuredType = 'game', supporting = [], isLoading }) {
  const heroTitle    = featured?.title ?? featured?.name;
  const heroImage    = featured?.image ?? featured?.backdropUrl ?? null;
  const heroSubtitle = featuredType === 'game'
    ? (featured?.tags?.slice(0, 2).join(' · ') ?? '')
    : (featured?.releaseDate?.slice(0, 4) ?? '');

  if (isLoading && !featured) {
    return (
      <section className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pt-2 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-line block" />
          <div className="skeleton h-2.5 w-24 rounded" />
          <div className="flex-1 h-px bg-line" />
        </div>
        <div className="flex gap-5 items-start">
          <div className="shrink-0 w-[280px] sm:w-[320px] lg:w-[360px]">
            <div className="skeleton rounded-2xl w-full" style={{ aspectRatio: '16/9' }} />
            <div className="skeleton h-4 w-3/4 rounded mt-3" />
            <div className="skeleton h-3 w-1/2 rounded mt-2" />
          </div>
          <div className="flex-1 min-w-0 flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="shrink-0 w-[200px]">
                <div className="skeleton rounded-2xl w-full" style={{ aspectRatio: '16/9' }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!featured) return null;

  return (
    <section className="relative overflow-hidden">
      {/* Ambient glow from featured item */}
      {heroImage && (
        <div className="absolute inset-x-0 top-0 h-72 pointer-events-none overflow-hidden">
          <img
            src={heroImage} alt="" draggable={false}
            className="w-full h-full object-cover object-center blur-3xl opacity-[0.13] scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/20 to-canvas" />
        </div>
      )}

      <div className="relative max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pt-2 pb-10">
        {/* Label row */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" style={{ boxShadow: '0 0 6px 2px rgba(var(--color-accent-rgb,0,0,0),0.4)' }} />
          <p className="text-[10px] font-black tracking-[0.28em] uppercase text-accent">For You Today</p>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Content row */}
        <div className="flex gap-5 items-start">
          {/* Featured — larger card */}
          <div className="shrink-0 w-[260px] sm:w-[300px] lg:w-[360px]">
            <UnifiedCard item={featured} type={featuredType} />
            <div className="mt-3">
              <p className="text-base font-black text-ink leading-tight line-clamp-2">{heroTitle}</p>
              {heroSubtitle && (
                <p className="text-xs text-ink-mid mt-1 truncate">{heroSubtitle}</p>
              )}
            </div>
          </div>

          {/* Supporting row — drag scrollable */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <DragRow gap="gap-3">
              {supporting.map(({ item, type }) => (
                <div
                  key={`${type}-${item.id ?? item.tmdbId}`}
                  className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px] pointer-events-auto"
                >
                  <UnifiedCard item={item} type={type} />
                </div>
              ))}
            </DragRow>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── "Because You Like" — profile-driven mixed section ───────────────────────

function BecauseYouLike({ categoryId, games = [], movies = [], series = [], isLoading }) {
  const cat = CATEGORIES.find(c => c.id === categoryId);

  const mixedItems = useMemo(() => {
    const result = [];
    const maxLen = Math.max(games.length, movies.length, series.length);
    for (let i = 0; i < maxLen && result.length < 14; i++) {
      if (games[i])  result.push({ item: games[i],  type: 'game',   key: `g-${games[i].id}` });
      if (movies[i]) result.push({ item: movies[i], type: 'movie',  key: `m-${movies[i].tmdbId ?? i}` });
      if (series[i]) result.push({ item: series[i], type: 'series', key: `s-${series[i].tmdbId ?? i}` });
    }
    return result;
  }, [games, movies, series]);

  if (!categoryId) return null;
  if (!isLoading && !mixedItems.length) return null;

  const backdropImage = games[0]?.image ?? null;

  return (
    <section className="pt-14 relative overflow-hidden">
      {/* Ambient backdrop from top game */}
      {backdropImage && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={backdropImage} alt="" draggable={false}
            className="w-full h-full object-cover blur-3xl opacity-[0.06] scale-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/70 to-canvas" />
        </div>
      )}
      <div className="relative">
        <SectionHead
          overline="Picked for you"
          title={`${cat?.emoji ?? '🎮'} Because you like ${cat?.label ?? categoryId}`}
          color="violet"
        />
        {isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-48 sm:w-56">
                <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />
              </div>
            ))}
          </div>
        ) : (
          <DragRow gap="gap-3">
            {mixedItems.map(({ item, type, key }) => (
              <div key={key} className="shrink-0 w-48 sm:w-56 pointer-events-auto">
                <UnifiedCard item={item} type={type} />
              </div>
            ))}
          </DragRow>
        )}
      </div>
    </section>
  );
}

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
        .catch((err) => { console.warn('[HeroSearch] RAWG search failed:', err.message); setRawgResults([]); });
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
                            onClick={(e) => { e.stopPropagation(); toggleGame(game); }}
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
                    className={`block w-full text-left rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      expandedGameId === game.id
                        ? 'border-accent ring-2 ring-accent/20 scale-[0.97]'
                        : 'border-transparent hover:border-accent/40'
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
        transition: 'grid-template-rows 400ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div className="overflow-hidden">
        {game && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)',
              border: '1px solid #e5e5e5',
              margin: '16px 0 8px',
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.99)',
              transition: 'opacity 350ms cubic-bezier(0.16,1,0.3,1), transform 350ms cubic-bezier(0.16,1,0.3,1)',
              willChange: 'opacity, transform',
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
                  onClick={() => toggleGame(game)}
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
                <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-surface-high text-ink-mid border border-line capitalize">
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
                  <p className="text-sm text-ink-light py-2 italic">No movies matched this game&apos;s vibe.</p>
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
      className={`relative w-full overflow-hidden rounded-2xl transition-all duration-250 group border-2 ${
        isActive
          ? 'border-accent shadow-lg shadow-accent/20 scale-[1.01]'
          : 'border-transparent hover:border-accent/40 hover:shadow-md hover:-translate-y-0.5'
      }`}
      style={{ height: '72px', background: cat.bg }}
    >
      {image && (
        <img
          src={image}
          alt={cat.label}
          draggable={false}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08] opacity-60"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      {/* Active tint */}
      {isActive && <div className="absolute inset-0 bg-accent/25" />}
      {/* Label */}
      <div className="absolute inset-0 flex items-center gap-3 px-4">
        <span className="text-2xl drop-shadow-lg shrink-0 transition-transform duration-200 group-hover:scale-110">
          {cat.emoji}
        </span>
        <div className="min-w-0 text-left">
          <p className={`text-sm font-black leading-tight truncate transition-colors duration-200 ${isActive ? 'text-white' : 'text-white group-hover:text-white'}`}>
            {cat.label}
          </p>
          <p className="text-[10px] text-white/50">{gamesCount} games</p>
        </div>
        {isActive && (
          <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      {/* Left accent bar when active */}
      <div
        className={`absolute left-0 inset-y-0 w-0.5 bg-accent transition-opacity duration-200 ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
        }`}
      />
    </button>
  );
}

// ─── Category game item ────────────────────────────────────────────────────────

function CategoryGameItem({ game }) {
  const { expandGame, toggleGame, hasGame }   = useGameStore();
  const { recordInteraction }                 = useUserProfileStore();

  const handleClick = useCallback(() => {
    expandGame(game.id);
    recordInteraction(game, 1); // click = weight 1
  }, [game, expandGame, recordInteraction]);

  const handleAdd = useCallback(() => {
    toggleGame(game);
    if (!hasGame(game.id)) recordInteraction(game, 2); // add = weight 2
  }, [game, toggleGame, hasGame, recordInteraction]);

  return (
    <div className="group">
      <button onClick={handleClick} className="block w-full text-left">
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
        onClick={handleAdd}
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


// ─── News column ─────────────────────────────────────────────────────────────

function NewsColumn({ items, isLoading }) {
  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 5).map((article, i) => (
        <a
          key={article.url ?? i}
          href={article.url !== '#' ? article.url : undefined}
          target={article.url !== '#' ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="flex items-start gap-3 group hover:bg-white rounded-xl p-2 -mx-2 transition-colors"
        >
          {article.image ? (
            <img
              src={article.image}
              alt={article.title}
              draggable={false}
              className="w-20 h-12 object-cover rounded-lg shrink-0 group-hover:scale-[1.02] transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-12 bg-surface-high rounded-lg shrink-0 flex items-center justify-center text-xl opacity-40">
              📰
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink line-clamp-2 group-hover:text-accent transition-colors leading-snug">
              {article.title}
            </p>
            <p className="text-[11px] text-ink-light mt-0.5">
              {article.source}
              {article.publishedAt && ` · ${new Date(article.publishedAt).toLocaleDateString()}`}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  const { selectedGameId, expandedGameId, expandGame, selectGame, myGames } = useGameStore();

  const selectedGame = useMemo(
    () => GAME_CATALOG.find(g => g.id === selectedGameId) ?? GAME_CATALOG[0],
    [selectedGameId],
  );

  const expandedGame = useMemo(() => {
    if (!expandedGameId) return null;
    return (
      GAME_CATALOG.find(g => g.id === expandedGameId) ??
      myGames.find(g => g.id === expandedGameId) ??
      null
    );
  }, [expandedGameId, myGames]);

  // ── Category explorer — multi-select + ordering + platform + tags + mode ──
  const [selectedGenres, setSelectedGenres]             = useState([]);
  const [selectedTags, setSelectedTags]                 = useState([]);
  const [selectedGameMode, setSelectedGameMode]         = useState(null); // null | 'single-player' | 'multiplayer'
  const [orderBy, setOrderBy]                           = useState('relevance');
  const [selectedPlatform, setSelectedPlatform]         = useState(null);
  const [categoryGames, setCategoryGames]               = useState([]);
  const [filteredGames, setFilteredGames]               = useState([]);
  const [categoryGamesLoading, setCategoryGamesLoading] = useState(false);
  const categoryPanelRef = useRef(null);


  const anyFilterActive = selectedGenres.length > 0 || selectedTags.length > 0 || selectedGameMode !== null;

  const clearAllFilters = useCallback(() => {
    setSelectedGenres([]);
    setSelectedTags([]);
    setSelectedGameMode(null);
    setOrderBy('relevance');
    setSelectedPlatform(null);
  }, []);

  const toggleTag = useCallback((slug) => {
    setSelectedTags(prev => prev.includes(slug) ? prev.filter(t => t !== slug) : [...prev, slug]);
  }, []);


  const toggleGenre = useCallback((id) => {
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }, []);

  // Re-apply full AND intersection filter whenever any filter dimension or raw pool changes
  useEffect(() => {
    if (!anyFilterActive) { setFilteredGames([]); return; }

    const result = categoryGames.filter(game => {
      // 1. Genre/category AND
      const genreOk = selectedGenres.every(catId => {
        const mapping = CATEGORY_FILTER_MAP[catId];
        if (!mapping) return true;
        if (mapping.type === 'genre') return game.genreSlugs?.includes(mapping.slug) ?? false;
        return game.tagSlugs?.includes(mapping.slug) ?? false;
      });

      // 2. Extra tag AND
      const tagOk = selectedTags.every(slug => game.tagSlugs?.includes(slug) ?? false);

      // 3. Game mode AND
      const modeOk = !selectedGameMode || (game.tagSlugs?.includes(selectedGameMode) ?? false);

      return genreOk && tagOk && modeOk;
    });

    setFilteredGames(result);
  }, [selectedGenres, selectedTags, selectedGameMode, categoryGames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch from RAWG whenever any filter that affects the pool changes
  useEffect(() => {
    if (!anyFilterActive) {
      setCategoryGames([]);
      return;
    }

    // Build the tag slugs to send to the backend pool fetch
    // (game mode and extra tags are included; genre tags are handled via categories)
    const poolTags = [...selectedTags];
    if (selectedGameMode) poolTags.push(selectedGameMode);

    let cancelled = false;
    setCategoryGamesLoading(true);
    setCategoryGames([]);

    rawgService.getMultiCategory(selectedGenres, {
      count:     40,
      ordering:  orderBy,
      platform:  selectedPlatform,
      extraTags: poolTags,
    })
      .then(results => {
        if (cancelled) return;
        setCategoryGames(results);
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = GAME_CATALOG.filter(game =>
            selectedGenres.some(id => {
              const cat = CATEGORIES.find(c => c.id === id);
              return cat && game.tags?.includes(cat.tag);
            })
          );
          setCategoryGames(fallback);
        }
      })
      .finally(() => { if (!cancelled) setCategoryGamesLoading(false); });

    return () => { cancelled = true; };
  }, [selectedGenres, selectedTags, selectedGameMode, orderBy, selectedPlatform]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategoryLabels = useMemo(
    () => selectedGenres.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean),
    [selectedGenres],
  );

  // All active filter labels for the summary bar
  const activeFilterLabels = useMemo(() => {
    const parts = [
      ...selectedGenres.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean),
      ...selectedTags.map(slug => POPULAR_TAGS.find(t => t.slug === slug)?.label).filter(Boolean),
      ...(selectedGameMode ? [GAME_MODES.find(m => m.slug === selectedGameMode)?.label].filter(Boolean) : []),
      ...(selectedPlatform !== null ? [PLATFORM_OPTIONS.find(p => p.value === selectedPlatform)?.label].filter(Boolean) : []),
    ];
    return parts;
  }, [selectedGenres, selectedTags, selectedGameMode, selectedPlatform]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hero section: trending movies + series ────────────────────────────────
  const [heroMovies, setHeroMovies] = useState([]);
  const [heroSeries, setHeroSeries] = useState([]);

  useEffect(() => {
    Promise.all([
      movieService.getTrending('week'),
      tvService.getTrending('week'),
    ])
      .then(([mData, tvData]) => {
        setHeroMovies((mData.results ?? []).slice(0, 8));
        setHeroSeries((tvData.results ?? []).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  // Build hero featured item + supporting mix
  const heroFeatured = useMemo(() => {
    if (myGames.length > 0) return { item: myGames[0], type: 'game' };
    if (rawgGames.length > 0) return { item: rawgGames[0], type: 'game' };
    return null;
  }, [myGames, rawgGames]);

  const heroSupporting = useMemo(() => {
    const skipId = String(heroFeatured?.item?.id ?? heroFeatured?.item?.tmdbId ?? '');
    const games  = rawgGames.filter(g => String(g.id) !== skipId).slice(0, 5);
    const movs   = heroMovies.slice(0, 5);
    const ser    = heroSeries.slice(0, 5);
    const pool   = [];
    const maxLen = Math.max(games.length, movs.length, ser.length);
    for (let i = 0; i < maxLen && pool.length < 8; i++) {
      if (movs[i])  pool.push({ item: movs[i],  type: 'movie'  });
      if (ser[i])   pool.push({ item: ser[i],   type: 'series' });
      if (games[i]) pool.push({ item: games[i], type: 'game'   });
    }
    return pool;
  }, [heroFeatured, rawgGames, heroMovies, heroSeries]);

  // ── Profile-driven "Because You Like" section ──────────────────────────────
  const { getTopPreference, totalInteractions } = useUserProfileStore();

  const [recommendedGames, setRecommendedGames]   = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [becauseCategoryId, setBecauseCategoryId] = useState(null);
  const [becauseMovies, setBecauseMovies]         = useState([]);
  const [becauseSeries, setBecauseSeries]         = useState([]);

  useEffect(() => {
    const total = totalInteractions();
    if (total < 2) return; // not enough signal yet

    const pref = getTopPreference();
    if (!pref) return;

    const categoryId = SLUG_TO_CATEGORY_ID[pref.slug];
    if (!categoryId) return;

    setBecauseCategoryId(categoryId);

    let cancelled = false;
    setRecommendedLoading(true);

    const tmdbGenres = CATEGORY_TO_TMDB_GENRES[categoryId] ?? [];

    Promise.all([
      rawgService.getByCategory(categoryId, 12),
      tmdbGenres.length
        ? movieService.discover({ genres: tmdbGenres, page: 1 })
        : Promise.resolve({ results: [] }),
      tmdbGenres.length
        ? tvService.discover({ genres: tmdbGenres })
        : Promise.resolve({ results: [] }),
    ])
      .then(([games, mData, tvData]) => {
        if (cancelled) return;
        setRecommendedGames(games);
        setBecauseMovies((mData.results ?? []).slice(0, 8));
        setBecauseSeries((tvData.results ?? []).slice(0, 8));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRecommendedLoading(false); });

    return () => { cancelled = true; };
  }, []); // run once on mount — profile is read from localStorage // eslint-disable-line react-hooks/exhaustive-deps

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

  const GNEWS_KEY = import.meta.env.VITE_GNEWS_API_KEY;

  const NEWS_FALLBACK = [
    { title: 'News unavailable right now', description: '', image: null, url: '#', source: '' },
  ];

  const [gamingNews, setGamingNews] = useState([]);
  const [movieNews,  setMovieNews]  = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    if (staticFetchDone.current) return;
    staticFetchDone.current = true;

    const fetchNews = async () => {
      try {
        const [gamingRes, movieRes] = await Promise.all([
          fetch(`https://gnews.io/api/v4/search?q=gaming&lang=en&max=6&sortby=publishedAt&apikey=${GNEWS_KEY}`),
          fetch(`https://gnews.io/api/v4/search?q=movies&lang=en&max=6&sortby=publishedAt&apikey=${GNEWS_KEY}`),
        ]);

        const gamingData = await gamingRes.json();
        const movieData  = await movieRes.json();

        console.log('GAMING NEWS:', gamingData);
        console.log('MOVIE NEWS:',  movieData);

        const mapArticles = (articles) =>
          (articles || []).map(a => ({
            title:       a.title,
            description: a.description,
            image:       a.image,
            url:         a.url,
            source:      a.source?.name ?? '',
            publishedAt: a.publishedAt,
          }));

        const gaming = mapArticles(gamingData.articles);
        const movies = mapArticles(movieData.articles);

        setGamingNews(gaming.length ? gaming : NEWS_FALLBACK);
        setMovieNews(movies.length  ? movies : NEWS_FALLBACK);
      } catch (err) {
        console.warn('[News] fetch failed:', err.message);
        setGamingNews(NEWS_FALLBACK);
        setMovieNews(NEWS_FALLBACK);
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAWG trending ─────────────────────────────────────────────────────────
  const [rawgGames, setRawgGames]     = useState([]);
  const [rawgLoading, setRawgLoading] = useState(true);

  useEffect(() => {
    rawgService.getTrending(12)
      .then(setRawgGames)
      .catch(() => {})
      .finally(() => setRawgLoading(false));
  }, []);

  const trendingGames = rawgGames.length ? rawgGames : TOP_GAMES;


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO SEARCH
      ══════════════════════════════════════════════════════════════════ */}
      <HeroSearch
        onGameExpand={handleGameExpand}
        onCategoryClick={toggleGenre}
      />

      {/* ══════════════════════════════════════════════════════════════════
          1b. FOR YOU TODAY — personalized hero
      ══════════════════════════════════════════════════════════════════ */}
      <HeroForYou
        featured={heroFeatured?.item}
        featuredType={heroFeatured?.type ?? 'game'}
        supporting={heroSupporting}
        isLoading={rawgLoading && !heroFeatured}
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
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Explore</p>
            </div>
            <h2 className="text-xl font-bold text-ink leading-tight">Browse by Category</h2>
          </div>
          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="shrink-0 text-xs text-ink-light hover:text-ink border border-line rounded-full px-3 py-1.5 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Category grid: 4 col desktop, 3 tablet, 2 mobile — compact strips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              isActive={selectedGenres.includes(cat.id)}
              onClick={() => toggleGenre(cat.id)}
            />
          ))}
        </div>

        {/* Inline results panel */}
        <div
          ref={categoryPanelRef}
          style={{
            display: 'grid',
            gridTemplateRows: anyFilterActive ? '1fr' : '0fr',
            transition: 'grid-template-rows 400ms ease-in-out',
          }}
        >
          <div className="overflow-hidden">
            {anyFilterActive && (
              <div className="pt-8 pb-4">

                {/* Panel header */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent mb-1.5">
                      Showing results for
                    </p>
                    <h3 className="text-xl font-black text-ink leading-tight">
                      {activeFilterLabels.join(' + ') || 'All games'}
                    </h3>
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="shrink-0 text-xs text-ink-light hover:text-ink border border-line rounded-full px-3 py-1.5 transition-colors"
                  >
                    Close
                  </button>
                </div>

                {/* Active filter chips — each individually removable */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {selectedGenres.map(id => {
                    const cat = CATEGORIES.find(c => c.id === id);
                    if (!cat) return null;
                    return (
                      <button key={id} onClick={() => toggleGenre(id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
                                   bg-accent text-white hover:bg-accent/80 transition-colors">
                        {cat.emoji} {cat.label}
                        <span className="opacity-70 text-sm leading-none">&times;</span>
                      </button>
                    );
                  })}
                  {selectedTags.map(slug => {
                    const tag = POPULAR_TAGS.find(t => t.slug === slug);
                    if (!tag) return null;
                    return (
                      <button key={slug} onClick={() => toggleTag(slug)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
                                   bg-violet-500 text-white hover:bg-violet-400 transition-colors">
                        {tag.emoji} {tag.label}
                        <span className="opacity-70 text-sm leading-none">&times;</span>
                      </button>
                    );
                  })}
                  {selectedGameMode && (() => {
                    const mode = GAME_MODES.find(m => m.slug === selectedGameMode);
                    return mode ? (
                      <button key={selectedGameMode} onClick={() => setSelectedGameMode(null)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
                                   bg-amber-500 text-white hover:bg-amber-400 transition-colors">
                        {mode.emoji} {mode.label}
                        <span className="opacity-70 text-sm leading-none">&times;</span>
                      </button>
                    ) : null;
                  })()}
                </div>

                {/* ── Filter / sort controls ── */}
                <div className="flex flex-wrap items-center gap-3 py-3 border-y border-line mb-6">

                  {/* Sort by */}
                  <div className="flex items-center gap-2 min-w-0">
                    <label className="text-[10px] font-black tracking-[0.15em] uppercase text-ink-light shrink-0">
                      Sort by
                    </label>
                    <div className="relative">
                      <select
                        value={orderBy}
                        onChange={e => setOrderBy(e.target.value)}
                        className="appearance-none bg-white border border-line rounded-lg pl-3 pr-7 py-1.5
                                   text-xs font-semibold text-ink cursor-pointer
                                   focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/10
                                   transition-colors hover:border-ink/20"
                      >
                        {ORDER_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-light"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-4 bg-line shrink-0" />

                  {/* Platform */}
                  <div className="flex items-center gap-2 min-w-0">
                    <label className="text-[10px] font-black tracking-[0.15em] uppercase text-ink-light shrink-0">
                      Platform
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORM_OPTIONS.map(p => (
                        <button
                          key={String(p.value)}
                          onClick={() => setSelectedPlatform(prev => prev === p.value ? null : p.value)}
                          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-200 ${
                            selectedPlatform === p.value
                              ? 'bg-ink text-white border-ink shadow-md shadow-ink/20 scale-[1.04]'
                              : 'bg-white border-line text-ink-mid hover:border-ink/30 hover:text-ink hover:bg-canvas'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active filter summary */}
                  {(orderBy !== 'relevance' || selectedPlatform !== null) && (
                    <button
                      onClick={() => { setOrderBy('relevance'); setSelectedPlatform(null); }}
                      className="ml-auto text-[10px] text-ink-light hover:text-accent transition-colors underline underline-offset-2"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Game mode row */}
                <div className="flex flex-wrap items-center gap-3 pb-4 mb-2 border-b border-line">
                  <span className="text-[10px] font-black tracking-[0.15em] uppercase text-ink-light shrink-0">
                    Mode
                  </span>
                  <div className="flex gap-1.5">
                    {GAME_MODES.map(m => (
                      <button
                        key={m.slug}
                        onClick={() => setSelectedGameMode(prev => prev === m.slug ? null : m.slug)}
                        className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-200 ${
                          selectedGameMode === m.slug
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30 scale-[1.04]'
                            : 'bg-white border-line text-ink-mid hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        {m.emoji} {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular tags row */}
                <div className="flex flex-wrap items-start gap-3 pb-5 mb-1">
                  <span className="text-[10px] font-black tracking-[0.15em] uppercase text-ink-light shrink-0 pt-1">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_TAGS.map(tag => (
                      <button
                        key={tag.slug}
                        onClick={() => toggleTag(tag.slug)}
                        className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-200 ${
                          selectedTags.includes(tag.slug)
                            ? 'bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/30 scale-[1.04]'
                            : 'bg-white border-line text-ink-mid hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50'
                        }`}
                      >
                        {tag.emoji} {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loading skeleton */}
                {categoryGamesLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-6">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i}>
                        <div className="skeleton rounded-xl" style={{ aspectRatio: '16/9' }} />
                        <div className="mt-2 skeleton h-3 w-3/4 rounded" />
                        <div className="mt-1.5 skeleton h-6 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Result count */}
                {!categoryGamesLoading && (
                  <p className="text-xs text-ink-light mb-4">
                    {filteredGames.length > 0
                      ? `${filteredGames.length} game${filteredGames.length !== 1 ? 's' : ''} match your filters`
                      : null}
                  </p>
                )}

                {/* Results grid */}
                {!categoryGamesLoading && filteredGames.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-6">
                    {filteredGames.map(game => (
                      <CategoryGameItem key={game.id} game={game} />
                    ))}
                  </div>
                )}

                {/* No-results state */}
                {!categoryGamesLoading && filteredGames.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-2xl mb-2">🎮</p>
                    <p className="text-sm font-semibold text-ink">No games match your filters</p>
                    <p className="text-xs text-ink-light mt-1">
                      Try adjusting the categories, platform, or sort order
                    </p>
                    <button
                      onClick={() => { setOrderBy('relevance'); setSelectedPlatform(null); }}
                      className="mt-3 text-xs text-accent hover:underline"
                    >
                      Reset sort &amp; platform
                    </button>
                  </div>
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
          ) : (
            <DragRow gap="gap-3">
              {trendingGames.map(game => (
                <div key={game.id} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                  <UnifiedCard item={game} type="game" />
                </div>
              ))}
            </DragRow>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════
            7. BECAUSE YOU LIKE — profile-driven mixed section
        ════════════════════════════════════════════════════════════════ */}
        <BecauseYouLike
          categoryId={becauseCategoryId}
          games={recommendedGames}
          movies={becauseMovies}
          series={becauseSeries}
          isLoading={recommendedLoading}
        />

        {/* ════════════════════════════════════════════════════════════════
            8. NEWS
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14 pb-20">
          <SectionHead overline="Latest" title="What's New" color="amber" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* Gaming news */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Gaming News</p>
              </div>
              <NewsColumn items={gamingNews} isLoading={newsLoading} />
            </div>

            {/* Movie news */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">Movie News</p>
              </div>
              <NewsColumn items={movieNews} isLoading={newsLoading} />
            </div>

          </div>
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
