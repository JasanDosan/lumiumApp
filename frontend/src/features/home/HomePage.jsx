import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { rawgService } from '@/services/rawgService';
import { useAuthStore } from '@/features/auth/authStore';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useGameStore } from '@/features/games/gameStore';
import { useLibraryStore } from '@/features/library/libraryStore';
import { useUserProfileStore } from '@/features/profile/userProfileStore';
import BecauseYouPlayed from './BecauseYouPlayed';
import ExpandableRow from '@/components/ui/ExpandableRow';
import InlineDetail from '@/components/ui/InlineDetail';
import RecentlySaved from './sections/RecentlySaved';
import TrendingNow from './sections/TrendingNow';
import ContentBand from '@/components/ui/ContentBand';
import SteamRecentRow from '@/features/steam/SteamRecentRow';

// ─── Static data ──────────────────────────────────────────────────────────────

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

// ─── "Because You Like" — profile-driven mixed section ───────────────────────

function BecauseYouLike({ categoryId, games = [], movies = [], series = [], isLoading }) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  const { toggleMovie, hasMovie, toggleSeries, hasSeries } = useLibraryStore();

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

  const handleAddToLibrary = useCallback((item, type) => {
    if (type === 'movie') toggleMovie(item);
    if (type === 'series') toggleSeries(item);
  }, [toggleMovie, toggleSeries]);

  const libraryCheck = useCallback((item, type) => {
    if (type === 'movie') return hasMovie(item.tmdbId);
    if (type === 'series') return hasSeries(item.tmdbId);
    return false;
  }, [hasMovie, hasSeries]);

  if (!categoryId) return null;
  if (!isLoading && !mixedItems.length) return null;

  const backdropImage = games[0]?.image ?? null;

  return (
    <section className="relative overflow-hidden">
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
        <p className="eyebrow text-violet-400 mb-6">Picked for you</p>
        <h2 className="headline-lg text-ink mb-10">
          {cat?.emoji ?? '🎮'} Because you like {cat?.label ?? categoryId}
        </h2>
        {isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-48 sm:w-56">
                <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />
              </div>
            ))}
          </div>
        ) : (
          <ExpandableRow
            items={mixedItems}
            cardWidth="w-48 sm:w-56"
            gap="gap-3"
            onAddToLibrary={handleAddToLibrary}
            libraryCheck={libraryCheck}
          />
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

// ─── Hero Search ──────────────────────────────────────────────────────────────

function HeroSearch({ onCategoryClick }) {
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

  const { selectGame } = useGameStore();
  const { toggleGame, hasGame, addMovie, removeMovie, hasMovie, addSeries, removeSeries, hasSeries } = useLibraryStore();

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
    selectGame(game.id);
    setIsOpen(false);
    setQuery('');
    setTimeout(() => {
      document.getElementById('because-you-played')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [selectGame]);

  const handleChipClick = useCallback((catId) => {
    onCategoryClick?.(catId);
    document.getElementById('browse-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [onCategoryClick]);

  const hasResults   = gameResults.length > 0 || movies.length > 0 || tvShows.length > 0;
  const showDropdown = isOpen && query.length > 0;

  return (
    <section
      className="flex flex-col items-center justify-center bg-canvas px-6 sm:px-12 lg:px-20 pb-20"
      style={{ minHeight: '88vh' }}
    >
      <div className="w-full max-w-[1280px] mx-auto pt-16">
        {/* Editorial masthead */}
        <p className="eyebrow text-accent text-center mb-7">LUMIUM</p>
        <h1 className="display text-ink text-center mb-7">
          Discover your<br />next obsession.
        </h1>
        <p className="body-lead text-ink-mid text-center max-w-xl mx-auto mb-14">
          Games, movies, and series &mdash; discovered through the lens of what you actually love.
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
              className="w-full bg-surface border border-line/80 rounded-2xl pl-12 pr-12 py-4 text-[15px] text-ink
                         placeholder:text-ink-light focus:outline-none focus:border-accent/40
                         focus:ring-4 focus:ring-accent/8 transition-all duration-200"
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
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-line rounded-2xl shadow-2xl z-[60] overflow-hidden">
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
                        <div key={m.tmdbId ?? i} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                          <Link
                            to={`/movie/${m.tmdbId}`}
                            onClick={() => { setIsOpen(false); setQuery(''); }}
                            className="flex-1 flex items-center gap-3 min-w-0"
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
                          <button
                            onClick={(e) => { e.stopPropagation(); hasMovie(m.tmdbId) ? removeMovie(m.tmdbId) : addMovie(m); }}
                            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                              hasMovie(m.tmdbId)
                                ? 'bg-accent/10 border-accent/30 text-accent'
                                : 'border-line text-ink-light hover:border-accent/30 hover:text-accent'
                            }`}
                          >
                            {hasMovie(m.tmdbId) ? '✓ Saved' : '+ Add'}
                          </button>
                        </div>
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
                          <div className="flex-1 flex items-center gap-3 min-w-0">
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
                          <button
                            onClick={(e) => { e.stopPropagation(); hasSeries(s.tmdbId) ? removeSeries(s.tmdbId) : addSeries(s); }}
                            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                              hasSeries(s.tmdbId)
                                ? 'bg-accent/10 border-accent/30 text-accent'
                                : 'border-line text-ink-light hover:border-accent/30 hover:text-accent'
                            }`}
                          >
                            {hasSeries(s.tmdbId) ? '✓ Saved' : '+ Add'}
                          </button>
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
        <div className="flex flex-wrap gap-2.5 justify-center mt-8">
          {CATEGORIES.slice(0, 8).map(cat => (
            <button
              key={cat.id}
              onClick={() => handleChipClick(cat.id)}
              className="text-[13px] font-medium text-ink-mid border border-line/70 rounded-full
                         px-4 py-2 bg-surface hover:border-accent/35 hover:text-ink
                         transition-all duration-200"
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Category card (large visual) ────────────────────────────────────────────

function CategoryCard({ cat, isActive, onClick }) {
  const image      = getCategoryImage(cat.tag);
  const gamesCount = GAME_CATALOG.filter(g => g.tags?.includes(cat.tag)).length;

  return (
    <button
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl transition-all duration-300 group border ${
        isActive
          ? 'border-accent shadow-lg shadow-accent/25 scale-[1.01]'
          : 'border-subtle hover:border-accent/40 hover:shadow-lg hover:-translate-y-1'
      }`}
      style={{ height: '96px', background: cat.bg }}
    >
      {image && (
        <img
          src={image}
          alt={cat.label}
          draggable={false}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08] opacity-50"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {/* Gradient overlay — bottom to top, cinematic */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      {/* Active tint */}
      {isActive && <div className="absolute inset-0 bg-accent/20" />}
      {/* Label — pinned to bottom */}
      <div className="absolute bottom-0 inset-x-0 flex items-end gap-3 px-4 pb-3">
        <span className="text-2xl drop-shadow-lg shrink-0 transition-transform duration-200 group-hover:scale-110">
          {cat.emoji}
        </span>
        <div className="min-w-0 text-left flex-1">
          <p className="text-sm font-black leading-tight truncate text-white">
            {cat.label}
          </p>
          <p className="text-[10px] text-white/45">{gamesCount} games</p>
        </div>
        {isActive && (
          <div className="shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-sm shadow-accent/40">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      {/* Bottom accent bar when active */}
      <div
        className={`absolute bottom-0 inset-x-0 h-0.5 bg-accent transition-opacity duration-200 ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
      />
    </button>
  );
}

// ─── Category game item ────────────────────────────────────────────────────────

function CategoryGameItem({ game, isExpanded, onExpand }) {
  const { toggleGame, hasGame }  = useLibraryStore();
  const { recordInteraction }    = useUserProfileStore();

  const handleClick = useCallback(() => {
    onExpand(game);                  // inline expand — never scrolls to top
    recordInteraction(game, 1);
  }, [game, onExpand, recordInteraction]);

  const handleAdd = useCallback(() => {
    toggleGame(game);
    if (!hasGame(game.id)) recordInteraction(game, 2);
  }, [game, toggleGame, hasGame, recordInteraction]);

  return (
    <div className="group">
      <button
        onClick={handleClick}
        className="block w-full text-left"
      >
        <div
          className={`relative rounded-2xl overflow-hidden border transition-all duration-300
                      shadow-sm hover:shadow-xl hover:-translate-y-0.5
                      ${isExpanded
                        ? 'bg-surface-high ring-2 ring-accent border-accent/40 shadow-[0_0_16px_rgba(139,92,246,0.25)]'
                        : 'bg-surface border-subtle hover:bg-surface-high hover:border-accent/40'}`}
          style={{ aspectRatio: '16/9' }}
        >
          {game.image ? (
            <img
              src={game.image}
              alt={game.name}
              draggable={false}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {game.emoji}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          {game.rating != null && (
            <span className="absolute top-2 right-2 text-[10px] font-semibold text-white/80
                             bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-sm pointer-events-none">
              &#9733; {game.rating.toFixed(1)}
            </span>
          )}
          {isExpanded && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" />
          )}
        </div>
        <div className="mt-2">
          <p className={`text-sm font-semibold truncate leading-tight transition-colors ${
            isExpanded ? 'text-accent' : 'text-ink group-hover:text-accent'
          }`}>
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


// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  const { games: myGames } = useLibraryStore();

  // ── Category explorer — multi-select + ordering + platform + tags + mode ──
  const [selectedGenres, setSelectedGenres]             = useState([]);
  const [selectedTags, setSelectedTags]                 = useState([]);
  const [selectedGameMode, setSelectedGameMode]         = useState(null); // null | 'single-player' | 'multiplayer'
  const [orderBy, setOrderBy]                           = useState('relevance');
  const [selectedPlatform, setSelectedPlatform]         = useState(null);
  const [categoryGames, setCategoryGames]               = useState([]);
  const [filteredGames, setFilteredGames]               = useState([]);
  const [categoryGamesLoading, setCategoryGamesLoading] = useState(false);
  const [expandedCategoryGame, setExpandedCategoryGame] = useState(null); // { game } | null

  const handleCategoryGameExpand = useCallback((game) => {
    setExpandedCategoryGame(prev =>
      prev?.game?.id === game.id ? null : { game }
    );
  }, []);


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

  // All active filter labels for the summary bar
  const activeFilterLabels = useMemo(() => {
    const parts = [
      ...selectedGenres.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean),
      ...selectedTags.map(slug => POPULAR_TAGS.find(t => t.slug === slug)?.label).filter(Boolean),
      ...(selectedGameMode ? [GAME_MODES.find(m => m.slug === selectedGameMode)?.label].filter(Boolean) : []),
      ...(selectedPlatform !== null ? [PLATFORM_OPTIONS.find(p => p.value === selectedPlatform)?.label].filter(Boolean) : []),
    ];
    return parts;
  }, [selectedGenres, selectedTags, selectedGameMode, selectedPlatform]);

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
  }, [myGames, getTopPreference, totalInteractions]); // re-run when library changes

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas">

      {/* ══ CHAPTER 1 — MASTHEAD ════════════════════════════════════════════ */}
      <HeroSearch onCategoryClick={toggleGenre} />

      {/* ══ CHAPTER 2 — RECENTLY SAVED ══════════════════════════════════════ */}
      <ContentBand zone="surface" size="compact" topBorder>
        <p className="eyebrow text-ink-light mb-2">Your library</p>
        <RecentlySaved />
      </ContentBand>

      {/* ══ STEAM RECENT — silently shown when connected + data available ═══ */}
      <SteamRecentRow />

      {/* ══ CHAPTER 3 — BECAUSE YOU PLAYED ═════════════════════════════════ */}
      <ContentBand id="because-you-played" zone="canvas" size="compact" topBorder>
        <p className="eyebrow text-accent mb-2">Because you played</p>
        <BecauseYouPlayed />
      </ContentBand>

      {/* ══ CHAPTER 4 — TRENDING NOW (zones handled inside TrendingNow) ════ */}
      <ContentBand zone="deep" size="compact" topBorder contained={false}>
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20 pb-4">
          <p className="eyebrow text-amber-400 mb-1">Right now</p>
          <h2 className="headline-xl text-ink mb-2">Trending</h2>
          <p className="body-lead text-ink-mid max-w-2xl">
            What everyone is playing, watching, and saving this week.
          </p>
        </div>
        <TrendingNow />
      </ContentBand>

      {/* ══ CHAPTER 5 — BECAUSE YOU LIKE ════════════════════════════════════ */}
      <ContentBand zone="accent-tint" size="compact" topBorder>
        <BecauseYouLike
          categoryId={becauseCategoryId}
          games={recommendedGames}
          movies={becauseMovies}
          series={becauseSeries}
          isLoading={recommendedLoading}
        />
      </ContentBand>

      {/* ══ CHAPTER 6 — BROWSE BY CATEGORY ═════════════════════════════════ */}
      <ContentBand zone="canvas" size="compact" topBorder>
        <section id="browse-categories">
        <div className="flex items-start justify-between gap-6 mb-4">
          <div>
            <p className="eyebrow text-accent mb-3">Explore</p>
            <h2 className="headline-lg text-ink mb-2">What are you in the mood for?</h2>
            <p className="body-lead text-ink-mid max-w-xl">
              Pick a genre and Lumium will surface the best games, films, and shows in that world.
            </p>
          </div>
          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="shrink-0 mt-1 text-[13px] font-medium text-ink-light hover:text-ink
                         border border-line/70 rounded-full px-4 py-2 transition-colors"
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
                        className="appearance-none bg-surface border border-line rounded-lg pl-3 pr-7 py-1.5
                                   text-xs font-semibold text-ink cursor-pointer
                                   focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/10
                                   transition-colors hover:border-line/60"
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
                              ? 'bg-accent text-white border-accent shadow-md shadow-accent/30 scale-[1.04]'
                              : 'bg-surface border-line text-ink-mid hover:border-ink/30 hover:text-ink'
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
                            : 'bg-surface border-line text-ink-mid hover:border-amber-400 hover:text-amber-400'
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
                            : 'bg-surface border-line text-ink-mid hover:border-violet-400 hover:text-violet-400'
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

                {/* Results grid — accordion: InlineDetail inserted inline below each row */}
                {!categoryGamesLoading && filteredGames.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-6">
                    {filteredGames.map(game => {
                      const isExpanded = expandedCategoryGame?.game?.id === game.id;
                      return (
                        // display:contents makes wrapper invisible to grid — children participate directly
                        <div key={game.id} className="contents">
                          <CategoryGameItem
                            game={game}
                            isExpanded={isExpanded}
                            onExpand={handleCategoryGameExpand}
                          />
                          {isExpanded && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <InlineDetail
                                item={game}
                                type="game"
                                isOpen={true}
                                onClose={() => setExpandedCategoryGame(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
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
      </ContentBand>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="bg-zone-deep border-t border-line/50 py-16 px-6 sm:px-12 lg:px-20">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-[13px] font-black tracking-[0.22em] uppercase text-ink">LUMIUM</p>
            <p className="text-[13px] text-ink-light mt-2 leading-relaxed">
              A cross-media taste engine for games, films, and series.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/search"   className="text-[13px] text-ink-light hover:text-ink transition-colors">Search</Link>
            <Link to="/discover" className="text-[13px] text-ink-light hover:text-ink transition-colors">Discover</Link>
            {!isAuthenticated && (
              <Link to="/register" className="text-[13px] font-semibold bg-ink text-canvas px-5 py-2.5 rounded-full hover:bg-ink/80 transition-colors">
                Get started
              </Link>
            )}
          </div>
        </div>
      </footer>

    </div>
  );
}
