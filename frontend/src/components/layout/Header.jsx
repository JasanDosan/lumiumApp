import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useGameStore } from '@/features/games/gameStore';
import { useLibraryStore } from '@/features/library/libraryStore';
import { movieService } from '@/services/movieService';
import { rawgService } from '@/services/rawgService';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

// ─── Search dropdown ──────────────────────────────────────────────────────────

function SearchBar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { expandGame } = useGameStore();
  const { toggleGame, hasGame } = useLibraryStore();

  const [query, setQuery]           = useState('');
  const [isOpen, setIsOpen]         = useState(false);
  const [movies, setMovies]         = useState([]);
  const [tvShows, setTvShows]       = useState([]);
  const [rawgResults, setRawgResults] = useState([]);
  const [searching, setSearching]   = useState(false);

  const inputRef      = useRef(null);
  const containerRef  = useRef(null);
  const debounceRef   = useRef(null);
  const rawgDebounce  = useRef(null);

  // ── Local game filter (GAME_CATALOG — instant) ──────────────────────────
  const localGameResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return GAME_CATALOG.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [query]);

  // Merge: local catalog first, then RAWG extras not already in catalog
  const gameResults = useMemo(() => {
    const catalogIds = new Set(localGameResults.map(g => g.id));
    const extras = rawgResults.filter(r => !catalogIds.has(r.id));
    return [...localGameResults, ...extras].slice(0, 6);
  }, [localGameResults, rawgResults]);

  // ── RAWG search (debounced, only if key is configured) ──────────────────
  useEffect(() => {
    clearTimeout(rawgDebounce.current);
    if (!query.trim() || query.length < 2) { setRawgResults([]); return; }
    rawgDebounce.current = setTimeout(() => {
      rawgService.search(query, 6)
        .then(setRawgResults)
        .catch((err) => { console.warn('[Header] RAWG search failed:', err.message); setRawgResults([]); });
    }, 500);
    return () => clearTimeout(rawgDebounce.current);
  }, [query]);

  // ── Multi search: movies + series (debounced) ───────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) {
      setMovies([]);
      setTvShows([]);
      return;
    }

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
    const handler = (e) => { if (e.key === 'Escape') { setIsOpen(false); inputRef.current?.blur(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleGameClick = useCallback((game) => {
    expandGame(game.id);
    if (location.pathname !== '/') navigate('/');
    setIsOpen(false);
    setQuery('');
  }, [expandGame, location.pathname, navigate]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setMovies([]);
    inputRef.current?.focus();
  }, []);

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
          placeholder="Search games, movies…"
          className="w-44 focus:w-64 bg-surface-high border border-line rounded-full pl-8 pr-7 py-1.5 text-xs text-ink
                     placeholder:text-ink-light focus:outline-none focus:border-accent/40 transition-all duration-200"
        />
        {query && (
          <button onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink text-base leading-none">
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
                        onClick={(e) => { e.stopPropagation(); toggleGame(game); }}
                        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
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
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">
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
                          className="w-7 h-10 rounded object-cover shrink-0 bg-surface-high" />
                      ) : (
                        <div className="w-7 h-10 rounded bg-surface-high shrink-0" />
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
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-violet-400">
                    Series
                  </p>
                  {tvShows.map((s, i) => (
                    <div key={s.tmdbId ?? i} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-high">
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
                    </div>
                  ))}
                </div>
              )}

              {/* Loading indicator */}
              {searching && (
                <div className="flex gap-1.5 px-4 py-3 border-t border-line">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-1.5 flex-1 skeleton rounded-full" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
              )}

              {/* Link to full search page */}
              <Link
                to={`/search?q=${encodeURIComponent(query)}`}
                onClick={() => { setIsOpen(false); setQuery(''); }}
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
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `text-sm transition-colors duration-150 ${
      isActive ? 'text-ink font-medium' : 'text-ink-mid hover:text-ink'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

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
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/movies" className={navLinkClass}>Platforms</NavLink>
          </nav>

          {/* Search + auth */}
          <div className="hidden md:flex items-center gap-4 ml-auto">
            <SearchBar />
            {isAuthenticated ? (
              <NavLink to="/profile" className={navLinkClass}>
                {user?.name?.split(' ')[0]}
              </NavLink>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-ink-mid hover:text-ink transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="text-sm bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-full font-medium transition-colors"
                >
                  Get started
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-ink-mid hover:text-ink p-1 transition-colors"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-canvas border-t border-line px-5 py-5 flex flex-col gap-4 animate-fade-in">
          <NavLink to="/" end className={navLinkClass} onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/search" className={navLinkClass} onClick={() => setMenuOpen(false)}>Search</NavLink>
          <NavLink to="/movies" className={navLinkClass} onClick={() => setMenuOpen(false)}>Platforms</NavLink>
          {isAuthenticated && (
            <NavLink to="/profile" className={navLinkClass} onClick={() => setMenuOpen(false)}>Profile</NavLink>
          )}
          <div className="border-t border-line pt-4">
            {isAuthenticated ? (
              <button className="text-sm text-ink-mid hover:text-ink transition-colors" onClick={handleLogout}>
                Sign out
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => { navigate('/login'); setMenuOpen(false); }}
                  className="text-sm text-ink-mid hover:text-ink transition-colors">Sign in</button>
                <button onClick={() => { navigate('/register'); setMenuOpen(false); }}
                  className="text-sm bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-full font-medium transition-colors">Get started</button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
