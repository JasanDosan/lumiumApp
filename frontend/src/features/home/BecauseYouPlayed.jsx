import { useState, useEffect, useRef, useMemo } from 'react';
import { GAME_CATALOG, getRelatedGames, translateMetaToTMDB } from '@/data/gameMovieTags';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { useUserLibraryStore, normalizeMovie, normalizeSeries } from '@/features/library/libraryStore';
import ExpandableRow from '@/components/ui/ExpandableRow';

// ─── TMDB genre → game tags mapping ──────────────────────────────────────────

const TMDB_TO_GAME_TAGS = {
  27:    ['Horror'],
  28:    ['Action'],
  12:    ['Adventure'],
  14:    ['Fantasy'],
  878:   ['Sci-Fi'],
  53:    ['Action', 'Survival'],
  9648:  ['Mystery'],
  18:    ['Story-Rich'],
  36:    ['Strategy'],
  80:    ['stealth'],
  35:    ['Story-Rich'],
  10751: ['Adventure'],
};

// Catalog games matching genre IDs — no fallback if no match
function gamesForGenres(genreIds) {
  if (!genreIds.length) return [];
  const tags = new Set();
  genreIds.forEach(gid => (TMDB_TO_GAME_TAGS[gid] ?? []).forEach(t => tags.add(t.toLowerCase())));
  return GAME_CATALOG
    .filter(g => g.tags?.some(t => tags.has(t.toLowerCase())))
    .slice(0, 10)
    .map(g => ({ item: g, type: 'game' }));
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'games',  label: 'Games',  emoji: '🎮', activeClass: 'bg-accent     text-white', inactiveColor: 'text-accent-light' },
  { id: 'movies', label: 'Movies', emoji: '🎬', activeClass: 'bg-amber-500  text-white', inactiveColor: 'text-amber-400'   },
  { id: 'series', label: 'Series', emoji: '📺', activeClass: 'bg-violet-500 text-white', inactiveColor: 'text-violet-400'  },
];

const TAB_ORDER = {
  games:  ['movies', 'series', 'games'],
  movies: ['movies', 'series', 'games'],
  series: ['series', 'movies', 'games'],
};

const BECAUSE_LABEL = {
  games:  'Because you played',
  movies: 'Because you watched',
  series: 'Because you watched',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowLabel({ color, label }) {
  const colors = {
    amber:  { bar: 'bg-amber-500',  text: 'text-amber-400'    },
    violet: { bar: 'bg-violet-500', text: 'text-violet-400'   },
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

/** Dropdown that only renders items from the user's library. */
function ItemSelector({ selectedItem, options, onSelect, activeTab }) {
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

  if (!selectedItem) return null;

  const displayName = selectedItem.title ?? selectedItem.name ?? '—';
  const displayEmoji = selectedItem.emoji ?? (activeTab === 'games' ? '🎮' : activeTab === 'movies' ? '🎬' : '📺');

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
        <span className="text-2xl leading-none">{displayEmoji}</span>
        <span className="text-xl font-black text-accent-light tracking-tight truncate max-w-[220px]">
          {displayName}
        </span>
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
          style={{ background: '#1f1f2e', minWidth: '260px', maxWidth: '340px' }}
        >
          <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {options.map(item => {
              const isSelected = item.id === selectedItem.id;
              const name = item.title ?? item.name ?? '—';
              const emoji = item.emoji ?? displayEmoji;
              return (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent-light font-semibold'
                      : 'text-ink-mid hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span className="text-base shrink-0">{emoji}</span>
                  <span className="truncate flex-1">{name}</span>
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

function ContentSection({ type, items, isLoading, isPrimary }) {
  const config = {
    movies: { label: "Movies you'll like", color: 'amber',  primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    series: { label: "Series you'll like", color: 'violet', primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    games:  { label: 'Related games',      color: 'accent', primaryWidth: 'w-44 sm:w-52',         secondaryWidth: 'w-36 sm:w-40', gap: 'gap-3', skeletonCount: 5 },
  };
  const { label, color, primaryWidth, secondaryWidth, gap, skeletonCount } = config[type];
  const cardWidth = isPrimary ? primaryWidth : secondaryWidth;

  const { addItem, removeItem, hasMovie, hasSeries } = useUserLibraryStore();

  const getAddHandler = (item, itemType) => {
    if (itemType === 'movie')  return () => hasMovie(item.tmdbId)  ? removeItem(`movie_${Number(item.tmdbId)}`)  : addItem(normalizeMovie(item));
    if (itemType === 'series') return () => hasSeries(item.tmdbId) ? removeItem(`series_${Number(item.tmdbId)}`) : addItem(normalizeSeries(item));
    return undefined;
  };

  const getLibraryCheck = (item, itemType) => {
    if (itemType === 'movie')  return hasMovie(item.tmdbId);
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

export default function BecauseYouPlayed() {
  const { games: myGames, movies: myMovies, series: mySeries } = useUserLibraryStore();

  const [activeTab,    setActiveTab]    = useState('games');
  const [selectedItem, setSelectedItem] = useState(null);

  const [recMovies,  setRecMovies]  = useState([]);
  const [recSeries,  setRecSeries]  = useState([]);
  const [recGames,   setRecGames]   = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);

  // Options = only the user's saved items for the active tab
  const options = useMemo(() => (
    activeTab === 'games'  ? myGames  :
    activeTab === 'movies' ? myMovies :
    mySeries
  ), [activeTab, myGames, myMovies, mySeries]);

  // Auto-select first option whenever options become available (or tab changes)
  useEffect(() => {
    if (!selectedItem && options.length > 0) {
      setSelectedItem(options[0]);
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset selection when user switches tabs
  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setSelectedItem(null);
    setRecMovies([]);
    setRecSeries([]);
    setRecGames([]);
  };

  // Fetch recommendations whenever the selected item changes
  useEffect(() => {
    if (!selectedItem) return;

    let cancelled = false;
    setIsLoading(true);
    setRecMovies([]);
    setRecSeries([]);
    setRecGames([]);

    if (selectedItem.type === 'game') {
      // Resolve genre filters from the GAME_CATALOG entry for this game
      const catalogGame = GAME_CATALOG.find(g => String(g.id) === String(selectedItem.rawId ?? selectedItem.id));
      const filters = catalogGame?.meta
        ? translateMetaToTMDB(catalogGame.meta)
        : null;

      if (!filters?.genres?.length) {
        // No genre data — nothing to recommend
        setIsLoading(false);
        return;
      }

      Promise.all([
        movieService.discover({ genres: filters.genres, sort_by: filters.sort_by, page: 1 }),
        tvService.discover({ genres: filters.genres, sort_by: filters.sort_by }),
      ]).then(([mData, tvData]) => {
        if (cancelled) return;
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        const related = getRelatedGames(String(selectedItem.rawId ?? selectedItem.id), 10);
        setRecGames(related.map(g => ({ item: g, type: 'game' })));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });

    } else if (selectedItem.type === 'movie') {
      const genres = selectedItem.genres ?? [];

      if (!genres.length) {
        setIsLoading(false);
        return;
      }

      Promise.all([
        movieService.discover({ genres, page: 1 }),
        tvService.discover({ genres }),
      ]).then(([mData, tvData]) => {
        if (cancelled) return;
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        setRecGames(gamesForGenres(genres));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });

    } else if (selectedItem.type === 'series') {
      const genres = selectedItem.genres ?? [];

      if (!genres.length) {
        setIsLoading(false);
        return;
      }

      Promise.all([
        tvService.discover({ genres }),
        movieService.discover({ genres, page: 1 }),
      ]).then(([tvData, mData]) => {
        if (cancelled) return;
        setRecSeries((tvData?.results ?? tvData?.items ?? []).slice(0, 16).map(s => ({ item: s, type: 'series' })));
        setRecMovies((mData?.results ?? []).slice(0, 16).map(m => ({ item: m, type: 'movie'  })));
        setRecGames(gamesForGenres(genres));
      }).catch(console.error).finally(() => { if (!cancelled) setIsLoading(false); });
    }

    return () => { cancelled = true; };
  }, [selectedItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const allContent  = { movies: recMovies, series: recSeries, games: recGames };
  const orderedTypes = TAB_ORDER[activeTab];
  const libraryCounts = { games: myGames.length, movies: myMovies.length, series: mySeries.length };

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
        </p>
        <p className="text-sm text-ink-mid mb-3">{BECAUSE_LABEL[activeTab]}</p>

        {options.length > 0 ? (
          <ItemSelector
            selectedItem={selectedItem}
            options={options}
            onSelect={setSelectedItem}
            activeTab={activeTab}
          />
        ) : (
          <p className="text-sm text-ink-light italic">
            Save some {activeTab} to get personalised recommendations.
          </p>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 justify-center">
        {TABS.map(tab => {
          const count = libraryCounts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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

      {/* ── Gradient divider ───────────────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent mb-6" />

      {/* ── Content rows ───────────────────────────────────────────────────── */}
      {selectedItem ? (
        orderedTypes.map((type, idx) => (
          <div key={type} style={{ marginTop: idx === 0 ? 0 : '28px' }}>
            <ContentSection
              type={type}
              items={allContent[type]}
              isLoading={isLoading}
              isPrimary={idx === 0}
            />
          </div>
        ))
      ) : (
        !isLoading && (
          <p className="text-center text-xs text-ink-light italic py-4">
            Add {activeTab} to your library to see recommendations.
          </p>
        )
      )}
    </section>
  );
}
