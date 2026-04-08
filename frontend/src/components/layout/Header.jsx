import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useGameStore } from '@/features/games/gameStore';
import {
  useUserLibraryStore,
  normalizeMovie,
  normalizeSeries,
} from '@/features/library/libraryStore';
import { mediaDiscoveryService } from '@/services/movieService';
import { rawgService } from '@/services/rawgService';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

// ─── Search dropdown ──────────────────────────────────────────────────────────

function SearchBar({ onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { expandGame } = useGameStore();
  const {
    addGame, removeGame, hasGame,
    hasMovie, addItem: addMovieItem, removeMovie,
    hasSeries, removeSeries,
  } = useUserLibraryStore();

  const [query, setQuery]             = useState('');
  const [isOpen, setIsOpen]           = useState(false);
  const [movies, setMovies]           = useState([]);
  const [tvShows, setTvShows]         = useState([]);
  const [rawgResults, setRawgResults] = useState([]);
  const [searching, setSearching]     = useState(false);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);
  const rawgDebounce = useRef(null);

  // ── Local game filter (instant) ─────────────────────────────────────────
  const localGameResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return GAME_CATALOG.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [query]);

  const gameResults = useMemo(() => {
    const catalogIds = new Set(localGameResults.map(g => g.id));
    const extras = rawgResults.filter(r => !catalogIds.has(r.id));
    return [...localGameResults, ...extras].slice(0, 6);
  }, [localGameResults, rawgResults]);

  // ── RAWG search (debounced) ──────────────────────────────────────────────
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

  // ── Multi-search: movies + series (debounced) ───────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) {
      setMovies([]);
      setTvShows([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      mediaDiscoveryService.searchMulti(query)
        .then(data => {
          setMovies((data.movies || []).slice(0, 4));
          setTvShows((data.tv    || []).slice(0, 4));
        })
        .catch(() => { setMovies([]); setTvShows([]); })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Click outside ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── ESC to close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setIsOpen(false); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleGameClick = useCallback((game) => {
    expandGame(game.id);
    if (location.pathname !== '/') navigate('/');
    setIsOpen(false);
    setQuery('');
    onClose?.();
  }, [expandGame, location.pathname, navigate, onClose]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    onClose?.();
  }, [onClose]);

  const hasResults   = gameResults.length > 0 || movies.length > 0 || tvShows.length > 0;
  const showDropdown = isOpen && query.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative flex items-center">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search…"
          className="w-44 focus:w-64 bg-surface-high border border-line rounded-full pl-8 pr-7 py-1.5 text-xs text-ink
                     placeholder:text-ink-light focus:outline-none focus:border-accent/40 transition-all duration-200"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setMovies([]); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-surface border border-line rounded-2xl shadow-2xl z-[60] overflow-hidden">
          {!hasResults && !searching ? (
            <div className="px-4 py-5 text-sm text-ink-light text-center">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[440px]">

              {/* ── Games ─────────────────────────────────────────────────── */}
              {gameResults.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-accent">
                    Games
                  </p>
                  {gameResults.map(game => (
                    <div key={game.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                      <button
                        onClick={() => handleGameClick(game)}
                        className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                      >
                        {game.image ? (
                          <img src={game.image} alt="" draggable={false}
                            className="w-9 h-9 rounded-md object-cover shrink-0 bg-surface-high" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-surface-high shrink-0 flex items-center justify-center text-lg">
                            {game.emoji}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{game.name}</p>
                          <p className="text-[11px] text-ink-light truncate">{game.tags?.slice(0, 2).join(' · ')}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          hasGame(game.id) ? removeGame(game.id) : addGame(game);
                        }}
                        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                          hasGame(game.id)
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'border-line text-ink-light hover:border-accent/30 hover:text-accent'
                        }`}
                      >
                        {hasGame(game.id) ? '✓' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Movies ────────────────────────────────────────────────── */}
              {movies.length > 0 && (
                <div className={gameResults.length > 0 ? 'border-t border-line' : ''}>
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">
                    Movies
                  </p>
                  {movies.map((m, i) => (
                    <div key={m.tmdbId ?? i} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                      <Link
                        to={`/movie/${m.tmdbId}`}
                        onClick={closeDropdown}
                        className="flex-1 flex items-center gap-2.5 min-w-0"
                      >
                        {m.posterUrl ? (
                          <img src={m.posterUrl} alt="" draggable={false}
                            className="w-7 h-10 rounded object-cover shrink-0 bg-surface-high" />
                        ) : (
                          <div className="w-7 h-10 rounded bg-surface-high shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                          <p className="text-[11px] text-ink-light">{m.releaseDate?.slice(0, 4)}</p>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          hasMovie(m.tmdbId)
                            ? removeMovie(m.tmdbId)
                            : addMovieItem(normalizeMovie(m));
                        }}
                        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                          hasMovie(m.tmdbId)
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'border-line text-ink-light hover:border-amber-500/30 hover:text-amber-400'
                        }`}
                      >
                        {hasMovie(m.tmdbId) ? '✓' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Series ────────────────────────────────────────────────── */}
              {tvShows.length > 0 && (
                <div className="border-t border-line">
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-violet-400">
                    Series
                  </p>
                  {tvShows.map((s, i) => (
                    <div key={s.tmdbId ?? i} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
                      <Link
                        to={`/series/${s.tmdbId}`}
                        onClick={closeDropdown}
                        className="flex-1 flex items-center gap-2.5 min-w-0"
                      >
                        {s.posterUrl ? (
                          <img src={s.posterUrl} alt="" draggable={false}
                            className="w-7 h-10 rounded object-cover shrink-0 bg-surface-high" />
                        ) : (
                          <div className="w-7 h-10 rounded bg-surface-high shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{s.title ?? s.name}</p>
                          <p className="text-[11px] text-ink-light">{s.releaseDate?.slice(0, 4)}</p>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          hasSeries(s.tmdbId)
                            ? removeSeries(s.tmdbId)
                            : addMovieItem(normalizeSeries(s));
                        }}
                        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                          hasSeries(s.tmdbId)
                            ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                            : 'border-line text-ink-light hover:border-violet-500/30 hover:text-violet-400'
                        }`}
                      >
                        {hasSeries(s.tmdbId) ? '✓' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Loading bar */}
              {searching && (
                <div className="flex gap-1.5 px-4 py-3 border-t border-line">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-1.5 flex-1 skeleton rounded-full"
                      style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
              )}

              {/* Full search link */}
              <Link
                to={`/search?q=${encodeURIComponent(query)}`}
                onClick={closeDropdown}
                className="block px-4 py-3 text-xs text-ink-light hover:text-accent border-t border-line text-center transition-colors"
              >
                See all results for &ldquo;{query}&rdquo; →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `text-sm transition-colors duration-150 ${
      isActive ? 'text-ink font-semibold' : 'text-ink-mid hover:text-ink'
    }`;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-line">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link to="/" className="shrink-0">
            <span className="text-sm font-semibold tracking-[0.14em] uppercase text-ink">
              LUMIUM
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {isAuthenticated && (
              <NavLink to="/for-you" className={navLinkClass}>For You</NavLink>
            )}
            <NavLink to="/discover" className={navLinkClass}>Discover</NavLink>
            {isAuthenticated && (
              <NavLink to="/library" className={navLinkClass}>Library</NavLink>
            )}
          </nav>

          {/* Desktop right area: search + auth */}
          <div className="hidden md:flex items-center gap-4 ml-auto">
            <SearchBar />
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <NavLink to="/profile" className={navLinkClass}>
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center
                                  text-[11px] font-bold text-accent-light border border-accent/30">
                    {(user?.name ?? 'U')[0].toUpperCase()}
                  </div>
                </NavLink>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-ink-mid hover:text-ink transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="text-sm bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-full font-medium transition-colors"
                >
                  Get started
                </button>
              </div>
            )}
          </div>

          {/* Mobile right area: search icon + avatar */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            <button
              onClick={() => setMobileSearchOpen(o => !o)}
              className="p-1.5 text-ink-light hover:text-ink transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {isAuthenticated ? (
              <Link to="/profile">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center
                                text-[11px] font-bold text-accent-light border border-accent/30">
                  {(user?.name ?? 'U')[0].toUpperCase()}
                </div>
              </Link>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="text-xs bg-accent text-white px-3 py-1 rounded-full font-medium"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search panel */}
      {mobileSearchOpen && (
        <div className="md:hidden bg-canvas border-t border-line px-5 py-3 animate-fade-in">
          <SearchBar onClose={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
