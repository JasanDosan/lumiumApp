import { useState, useMemo, useEffect, useRef } from 'react';
import { GAME_CATALOG, getRelatedGames, translateMetaToTMDB } from '@/data/gameMovieTags';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useLibraryStore } from '@/features/library/libraryStore';
import ExpandableRow from '@/components/ui/ExpandableRow';

// ─── TMDB genre → game tags mapping (for movies/series tab → related games) ────
const TMDB_TO_GAME_TAGS = {
  27:   ['Horror'],
  28:   ['Action'],
  12:   ['Adventure'],
  14:   ['Fantasy'],
  878:  ['Sci-Fi'],
  53:   ['Action', 'Survival'],
  9648: ['Mystery'],
  18:   ['Story-Rich'],
  36:   ['Strategy'],
  80:   ['stealth'],
  35:   ['Story-Rich'],
  10751: ['Adventure'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Aggregate TMDB genre IDs from library items (movies or series)
function extractGenreIds(items) {
  const freq = {};
  items.forEach(item => {
    (item.genreIds ?? []).forEach(id => {
      freq[id] = (freq[id] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => Number(id))
    .slice(0, 3);
}

// Find catalog games matching a set of TMDB genre IDs
function gamesForGenres(genreIds) {
  if (!genreIds.length) return GAME_CATALOG.slice(0, 8).map(g => ({ item: g, type: 'game' }));
  const tags = new Set();
  genreIds.forEach(gid => (TMDB_TO_GAME_TAGS[gid] ?? []).forEach(t => tags.add(t.toLowerCase())));
  const matched = GAME_CATALOG.filter(g =>
    g.tags?.some(t => tags.has(t.toLowerCase()))
  ).slice(0, 10);
  return (matched.length ? matched : GAME_CATALOG.slice(0, 8)).map(g => ({ item: g, type: 'game' }));
}

// Combine genres from ALL library games, frequency-sorted, top-3
function combineLibraryFilters(games, fallbackGame) {
  const freq = {};
  games
    .map(mg => GAME_CATALOG.find(g => g.id === mg.id) ?? mg)
    .filter(g => g?.meta)
    .forEach(g => {
      const f = translateMetaToTMDB(g.meta);
      (f.genres ?? []).forEach(id => { freq[id] = (freq[id] || 0) + 1; });
    });

  const base = translateMetaToTMDB(fallbackGame?.meta ?? { theme: [], mood: [], pacing: [] });
  const combined = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => Number(id))
    .slice(0, 3);

  return {
    genres:     combined.length > 0 ? combined : (base.genres ?? []),
    sort_by:    base.sort_by,
    rating_gte: base.rating_gte,
  };
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'games',  label: 'Games',  emoji: '🎮', activeClass: 'bg-accent     text-white', inactiveColor: 'text-accent-light', emptyMsg: 'Add games to your library to personalise this.' },
  { id: 'movies', label: 'Movies', emoji: '🎬', activeClass: 'bg-amber-500  text-white', inactiveColor: 'text-amber-400',   emptyMsg: 'Save movies from recommendations to personalise this.' },
  { id: 'series', label: 'Series', emoji: '📺', activeClass: 'bg-violet-500 text-white', inactiveColor: 'text-violet-400',  emptyMsg: 'Save series from recommendations to personalise this.' },
];

// Per-tab: content order (primary type shown first with larger cards)
const TAB_ORDER = {
  games:  ['movies', 'series', 'games'],
  movies: ['movies', 'series', 'games'],
  series: ['series', 'movies', 'games'],
};

// ─── Row label ────────────────────────────────────────────────────────────────

function RowLabel({ color, label }) {
  const colors = {
    amber:  { bar: 'bg-amber-500',  text: 'text-amber-400'   },
    violet: { bar: 'bg-violet-500', text: 'text-violet-400'  },
    accent: { bar: 'bg-accent',     text: 'text-accent-light' },
  };
  const c = colors[color] ?? colors.accent;
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-0.5 h-4 ${c.bar} rounded-full shrink-0`} />
      <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.text}`}>{label}</p>
    </div>
  );
}

function SkeletonRow({ count = 5, width = 'w-52 sm:w-60' }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`shrink-0 ${width}`}>
          <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />
          <div className="skeleton h-2.5 w-3/4 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

// ─── Game selector ────────────────────────────────────────────────────────────

function GameSelector({ game, gameOptions, selectedGameId, onGameChange, libraryGames }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const libraryIds = useMemo(() => new Set(libraryGames.map(g => String(g.id))), [libraryGames]);

  return (
    <div ref={ref} className="relative inline-flex flex-col items-center">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl
                   border-2 border-accent/35 bg-accent/12
                   hover:border-accent/65 hover:bg-accent/18
                   transition-all duration-200 hover:shadow-lg hover:shadow-accent/10"
      >
        <span className="text-2xl leading-none">{game.emoji}</span>
        <span className="text-xl font-black text-accent-light tracking-tight">{game.name}</span>
        <svg
          className={`w-4 h-4 text-accent-light/70 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 z-50 rounded-2xl overflow-hidden border border-subtle shadow-2xl"
          style={{ background: '#1f1f2e', minWidth: '240px', maxWidth: '320px' }}
        >
          {libraryGames.length > 0 && (
            <p className="px-4 py-2 text-[10px] font-black tracking-[0.15em] uppercase text-ink-light border-b border-subtle">
              Your Library first
            </p>
          )}
          <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {gameOptions.map(g => {
              const isSelected = g.id === selectedGameId;
              const inLibrary  = libraryIds.has(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => { onGameChange(g.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent-light font-semibold'
                      : 'text-ink-mid hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span className="text-base shrink-0">{g.emoji}</span>
                  <span className="truncate flex-1">{g.name}</span>
                  {inLibrary && !isSelected && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent-light font-bold shrink-0">
                      SAVED
                    </span>
                  )}
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" clipRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Content section ──────────────────────────────────────────────────────────

function ContentSection({ type, items, isLoading, isPrimary }) {
  const config = {
    movies: { label: "Movies you'll like", color: 'amber',  primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    series: { label: "Series you'll like", color: 'violet', primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    games:  { label: 'Related games',      color: 'accent', primaryWidth: 'w-44 sm:w-52',         secondaryWidth: 'w-36 sm:w-40', gap: 'gap-3', skeletonCount: 5 },
  };
  const { label, color, primaryWidth, secondaryWidth, gap, skeletonCount } = config[type];
  const cardWidth = isPrimary ? primaryWidth : secondaryWidth;

  const { toggleMovie, hasMovie, toggleSeries, hasSeries } = useLibraryStore();

  const getAddHandler = (item, itemType) => {
    if (itemType === 'movie') return () => toggleMovie(item);
    if (itemType === 'series') return () => toggleSeries(item);
    return undefined;
  };
  const getLibraryCheck = (item, itemType) => {
    if (itemType === 'movie') return hasMovie(item.tmdbId);
    if (itemType === 'series') return hasSeries(item.tmdbId);
    return false;
  };

  if (!isLoading && !items.length) return null;

  return (
    <div>
      <RowLabel color={color} label={label} />
      {isLoading ? (
        <SkeletonRow count={skeletonCount} width={isPrimary ? primaryWidth : secondaryWidth} />
      ) : (
        <ExpandableRow
          items={items}
          cardWidth={cardWidth}
          gap={gap}
          onAddToLibrary={type !== 'games' ? getAddHandler : undefined}
          libraryCheck={type !== 'games' ? getLibraryCheck : undefined}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BecauseYouPlayed({ selectedGameId, onGameChange }) {
  const { games: libraryGames, movies: libraryMovies, series: librarySeries } = useLibraryStore();

  const [activeTab, setActiveTab] = useState('games');

  // Recommendation state — managed internally
  const [recMovies,  setRecMovies]  = useState([]);
  const [recSeries,  setRecSeries]  = useState([]);
  const [recGames,   setRecGames]   = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);

  // Resolve selected game
  const selectedGame = useMemo(
    () => GAME_CATALOG.find(g => g.id === selectedGameId)
          ?? libraryGames.find(g => String(g.id) === String(selectedGameId))
          ?? GAME_CATALOG[0],
    [selectedGameId, libraryGames],
  );

  // Game selector options — library games first
  const gameOptions = useMemo(() => {
    const libraryIds = new Set(libraryGames.map(g => String(g.id)));
    return [
      ...GAME_CATALOG.filter(g => libraryIds.has(g.id)),
      ...GAME_CATALOG.filter(g => !libraryIds.has(g.id)),
    ].slice(0, 24);
  }, [libraryGames]);

  // ── Recommendation engine — tab + library drive the fetches ─────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setRecMovies([]);
    setRecSeries([]);
    setRecGames([]);

    if (activeTab === 'games') {
      // Derive filters from ALL library games (or fallback to selected game)
      const filters = combineLibraryFilters(libraryGames, selectedGame);

      Promise.all([
        movieService.discover({ ...filters, page: 1 }),
        tvService.discover({ genres: filters.genres, sort_by: filters.sort_by }),
      ]).then(([mData, tvData]) => {
        if (cancelled) return;
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        setRecGames(getRelatedGames(selectedGameId, 10).map(g => ({ item: g, type: 'game' })));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });

    } else if (activeTab === 'movies') {
      const genreIds = extractGenreIds(libraryMovies);
      const discover = genreIds.length
        ? { genres: genreIds, page: 1 }
        : { sort_by: 'popularity.desc', page: 1 };

      Promise.all([
        movieService.discover(discover),
        tvService.discover(genreIds.length ? { genres: genreIds } : { sort_by: 'popularity.desc' }),
      ]).then(([mData, tvData]) => {
        if (cancelled) return;
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        setRecGames(gamesForGenres(genreIds));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });

    } else if (activeTab === 'series') {
      const genreIds = extractGenreIds(librarySeries);
      const discover = genreIds.length
        ? { genres: genreIds }
        : { sort_by: 'popularity.desc' };

      Promise.all([
        tvService.discover(discover),
        movieService.discover(genreIds.length ? { genres: genreIds, page: 1 } : { sort_by: 'popularity.desc', page: 1 }),
      ]).then(([tvData, mData]) => {
        if (cancelled) return;
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecGames(gamesForGenres(genreIds));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });
    }

    return () => { cancelled = true; };
  // Re-fetch when: active tab changes, game selection changes, or any library section changes
  }, [activeTab, selectedGameId, libraryGames, libraryMovies, librarySeries]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedGame) return null;

  const allContent = { movies: recMovies, series: recSeries, games: recGames };
  const orderedTypes = TAB_ORDER[activeTab];

  const activeTabConfig = TABS.find(t => t.id === activeTab);
  const activeLibrary   = activeTab === 'games' ? libraryGames : activeTab === 'movies' ? libraryMovies : librarySeries;

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(139,92,246,0.18) 0%, rgba(11,11,15,0.95) 100%)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '24px',
        padding: '36px 32px',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center mb-6">
        <p className="text-[10px] font-black tracking-[0.28em] text-accent uppercase mb-2">
          Personalized for you
          {libraryGames.length > 0 && (
            <span className="ml-2 normal-case tracking-normal font-normal text-ink-light">
              · {libraryGames.length} game{libraryGames.length !== 1 ? 's' : ''} in library
            </span>
          )}
        </p>
        <p className="text-sm text-ink-mid mb-3">Because you played</p>

        <GameSelector
          game={selectedGame}
          gameOptions={gameOptions}
          selectedGameId={selectedGameId}
          onGameChange={onGameChange}
          libraryGames={libraryGames}
        />

        {selectedGame.tagline && (
          <p className="text-sm text-ink-mid mt-3 max-w-lg leading-relaxed">{selectedGame.tagline}</p>
        )}
        {selectedGame.meta?.mood?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {selectedGame.meta.mood.slice(0, 5).map(m => (
              <span key={m} className="text-[10px] px-2.5 py-0.5 rounded-full border border-subtle bg-surface text-ink-mid capitalize">
                {m.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 justify-center">
        {TABS.map(tab => {
          const count = tab.id === 'games'
            ? libraryGames.length
            : tab.id === 'movies'
            ? libraryMovies.length
            : librarySeries.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold
                         border transition-all duration-150 ${
                activeTab === tab.id
                  ? `${tab.activeClass} border-transparent shadow-md`
                  : `border-subtle bg-surface ${tab.inactiveColor} hover:border-accent/30`
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-high text-ink-light'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Library hint — shown when active tab's library is empty */}
      {!isLoading && activeLibrary.length === 0 && activeTab !== 'games' && (
        <p className="text-center text-xs text-ink-light italic mb-4">
          {activeTabConfig?.emptyMsg}
        </p>
      )}

      {/* ── Gradient divider ───────────────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent mb-6" />

      {/* ── Content rows — ordered by active tab ───────────────────────────── */}
      {orderedTypes.map((type, idx) => (
        <div key={type} style={{ marginTop: idx === 0 ? 0 : '28px' }}>
          <ContentSection
            type={type}
            items={allContent[type]}
            isLoading={isLoading}
            isPrimary={idx === 0}
          />
        </div>
      ))}
    </section>
  );
}
