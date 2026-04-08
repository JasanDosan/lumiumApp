import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import LibraryCard, { LibraryCardSkeleton } from './LibraryCard';
import DragRow from '@/components/ui/DragRow';
import ContentBand from '@/components/ui/ContentBand';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',    label: 'All'    },
  { id: 'game',   label: 'Games'  },
  { id: 'movie',  label: 'Movies' },
  { id: 'series', label: 'Series' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recent' },
  { id: 'rating', label: 'Rating' },
  { id: 'title',  label: 'Title'  },
];

const TYPE_CFG = {
  game: {
    label:     'Games',
    overline:  'Your games',
    bar:       'bg-accent',
    color:     'text-accent',
    emptyIcon: '🎮',
    emptyHead: 'No games saved yet',
    emptyBody: 'Save games from the home screen or any game detail page.',
  },
  movie: {
    label:     'Movies',
    overline:  'Saved films',
    bar:       'bg-amber-500',
    color:     'text-amber-400',
    emptyIcon: '🎬',
    emptyHead: 'No movies saved yet',
    emptyBody: 'Browse Discover or open a film\'s detail page and hit Save.',
  },
  series: {
    label:     'Series',
    overline:  'Saved shows',
    bar:       'bg-violet-500',
    color:     'text-violet-400',
    emptyIcon: '📺',
    emptyHead: 'No series saved yet',
    emptyBody: 'Find a show on Discover and save it to track what you want to watch.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortItems(items, sort) {
  const copy = [...items];
  if (sort === 'recent') return copy.sort((a, b) => new Date(b.addedAt ?? 0) - new Date(a.addedAt ?? 0));
  if (sort === 'rating') return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sort === 'title')  return copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  return copy;
}

// ─── Header stat badges ───────────────────────────────────────────────────────

function StatBadge({ count, label, color, barColor, onClick }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line
                 hover:border-line/60 transition-colors group"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${barColor}`} />
      <span className={`text-sm font-black ${color}`}>{count}</span>
      <span className="text-xs text-ink-light group-hover:text-ink-mid transition-colors">{label}</span>
    </button>
  );
}

// ─── Sort pills ───────────────────────────────────────────────────────────────

function SortPills({ sort, onSort }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light mr-0.5 hidden sm:block">
        Sort
      </span>
      {SORT_OPTIONS.map(o => (
        <button
          key={o.id}
          onClick={() => onSort(o.id)}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150 ${
            sort === o.id
              ? 'bg-surface-high border-accent/40 text-ink'
              : 'border-line bg-surface text-ink-light hover:text-ink hover:border-ink/20'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ type, count, onViewAll }) {
  const cfg   = TYPE_CFG[type];
  const eyebrowColor = type === 'game' ? 'text-accent' : type === 'movie' ? 'text-amber-400' : 'text-violet-400';
  return (
    <div className="flex items-start justify-between gap-4 mb-10">
      <div>
        <p className={`eyebrow ${eyebrowColor} mb-4`}>{cfg.overline}</p>
        <h2 className="headline-lg text-ink">{cfg.label}</h2>
      </div>
      {count > 0 && onViewAll && (
        <button
          onClick={onViewAll}
          className="shrink-0 text-[13px] font-medium text-ink-light hover:text-ink transition-colors mt-1"
        >
          View all {count} →
        </button>
      )}
    </div>
  );
}

// ─── Per-type empty state (used in filtered view) ─────────────────────────────

function TypeEmptyState({ type }) {
  const cfg = TYPE_CFG[type];
  return (
    <div className="flex flex-col items-center text-center py-20 border border-dashed border-line rounded-2xl">
      <p className="text-3xl mb-3">{cfg.emptyIcon}</p>
      <p className="text-sm font-semibold text-ink-mid mb-1.5">{cfg.emptyHead}</p>
      <p className="text-xs text-ink-light max-w-[26ch] leading-relaxed">{cfg.emptyBody}</p>
      <Link
        to="/discover"
        className="mt-5 text-xs text-accent hover:text-accent-hover font-medium transition-colors"
      >
        Go to Discover →
      </Link>
    </div>
  );
}

// ─── Global empty state (no items at all) ─────────────────────────────────────

function GlobalEmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-28 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-surface-high border border-line
                      flex items-center justify-center text-2xl">
        📂
      </div>
      <div>
        <p className="text-base font-semibold text-ink mb-1.5">Your library is empty</p>
        <p className="text-sm text-ink-light max-w-[30ch] leading-relaxed">
          Save games, movies, and series to build your personal collection.
        </p>
      </div>
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold
                   bg-accent text-white hover:bg-accent-hover transition-colors"
      >
        Explore Discover
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <LibraryCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── FavoritesPage ────────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const { library, games, movies, series, loading } = useUserLibraryStore();

  const [activeTab, setActiveTab] = useState('all');
  const [sort, setSort]           = useState('recent');

  const counts = {
    all:    library.length,
    game:   games.length,
    movie:  movies.length,
    series: series.length,
  };

  // Flat sorted list used in filtered (non-All) views
  const visibleItems = useMemo(() => {
    const base =
      activeTab === 'game'   ? games   :
      activeTab === 'movie'  ? movies  :
      activeTab === 'series' ? series  :
      library;
    return sortItems(base, sort);
  }, [activeTab, sort, library, games, movies, series]);

  const isEmpty = library.length === 0;

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Editorial Hero ──────────────────────────────────────────────────── */}
      <div
        className="bg-zone-deep flex flex-col justify-center px-6 sm:px-12 lg:px-20 border-b border-line/50"
        style={{ minHeight: '60vh' }}
      >
        <div className="max-w-[1280px] mx-auto w-full pt-16 pb-16">
          <p className="eyebrow text-accent mb-7">Your collection</p>
          <h1 className="display text-ink mb-7">Library.</h1>
          {!loading && !isEmpty && (
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <StatBadge
                count={games.length}  label="games"
                color="text-accent"     barColor="bg-accent"
                onClick={() => setActiveTab('game')}
              />
              <StatBadge
                count={movies.length} label="movies"
                color="text-amber-400"  barColor="bg-amber-500"
                onClick={() => setActiveTab('movie')}
              />
              <StatBadge
                count={series.length} label="series"
                color="text-violet-400" barColor="bg-violet-500"
                onClick={() => setActiveTab('series')}
              />
            </div>
          )}
          {isEmpty && !loading && (
            <p className="body-lead text-ink-mid max-w-xl">
              Everything you save — games, movies, and series — lives here.
            </p>
          )}
        </div>
      </div>

    <div className="pb-20">

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <ContentBand zone="canvas" size="lg">
          <LoadingSkeleton />
        </ContentBand>

      ) : isEmpty ? (
        <ContentBand zone="canvas" size="lg" topBorder>
          <GlobalEmptyState />
        </ContentBand>

      ) : (
        <>
          {/* ── Tabs + sort bar ───────────────────────────────────────────────── */}
          <ContentBand zone="surface" size="compact" topBorder>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div
                className="flex items-center gap-0 border-b border-line/60 overflow-x-auto"
                style={{ scrollbarWidth: 'none' }}
                role="tablist"
              >
                {TABS.map(tab => {
                  const count    = counts[tab.id] ?? 0;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-5 py-3 text-[13px] font-semibold
                                 border-b-2 -mb-px transition-all duration-200 ${
                        isActive
                          ? 'border-accent text-ink'
                          : 'border-transparent text-ink-light hover:text-ink-mid'
                      }`}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                          isActive ? 'bg-accent/15 text-accent' : 'bg-line text-ink-light'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <SortPills sort={sort} onSort={setSort} />
            </div>
          </ContentBand>

          {/* ── Content ───────────────────────────────────────────────────────── */}

          {activeTab === 'all' && (
            <div key="all" className="animate-fade-in">
              {games.length > 0 && (
                <ContentBand zone="canvas" size="lg" topBorder>
                  <SectionHead type="game" count={games.length} onViewAll={() => setActiveTab('game')} />
                  <DragRow gap="gap-3">
                    {sortItems(games, sort).map(item => (
                      <div key={item.id} className="shrink-0 w-28 sm:w-32 pointer-events-auto">
                        <LibraryCard item={item} />
                      </div>
                    ))}
                  </DragRow>
                </ContentBand>
              )}
              {movies.length > 0 && (
                <ContentBand zone="surface" size="lg" topBorder>
                  <SectionHead type="movie" count={movies.length} onViewAll={() => setActiveTab('movie')} />
                  <DragRow gap="gap-3">
                    {sortItems(movies, sort).map(item => (
                      <div key={item.id} className="shrink-0 w-28 sm:w-32 pointer-events-auto">
                        <LibraryCard item={item} />
                      </div>
                    ))}
                  </DragRow>
                </ContentBand>
              )}
              {series.length > 0 && (
                <ContentBand zone="canvas" size="lg" topBorder>
                  <SectionHead type="series" count={series.length} onViewAll={() => setActiveTab('series')} />
                  <DragRow gap="gap-3">
                    {sortItems(series, sort).map(item => (
                      <div key={item.id} className="shrink-0 w-28 sm:w-32 pointer-events-auto">
                        <LibraryCard item={item} />
                      </div>
                    ))}
                  </DragRow>
                </ContentBand>
              )}
            </div>
          )}

          {activeTab !== 'all' && (
            <div key={activeTab} className="animate-fade-in">
              {visibleItems.length === 0 ? (
                <ContentBand zone="canvas" size="lg" topBorder>
                  <TypeEmptyState type={activeTab} />
                </ContentBand>
              ) : (
                <ContentBand zone="canvas" size="lg" topBorder>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {visibleItems.map(item => (
                      <LibraryCard key={item.id} item={item} />
                    ))}
                  </div>
                </ContentBand>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
