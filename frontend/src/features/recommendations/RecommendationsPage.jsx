import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  useSourceRecs,
  deriveSourceGenres,
} from './usePersonalizedRecs';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import DragRow from '@/components/ui/DragRow';
import UnifiedCard from '@/components/ui/UnifiedCard';

// ─── Fixed editorial section title table ──────────────────────────────────────
// Keys: [sourceMode][recommendedType]

const SECTION_TITLES = {
  game: {
    movie:  'Films from your gaming worlds',
    series: 'Shows from your gaming worlds',
    game:   'More games in your style',
  },
  movie: {
    game:   'Games your films point to',
    series: 'Shows that match your taste',
    movie:  'More films you\'ll love',
  },
  series: {
    game:   'Games your series point to',
    movie:  'Films that match your taste',
    series: 'More shows you\'ll love',
  },
};

// ─── Source + section visual config ──────────────────────────────────────────

const SOURCE_CONFIG = {
  game:   { label: 'MY VIDEOGAMES', emoji: '🎮', color: 'bg-accent',     border: 'border-accent',     text: 'text-accent-light'  },
  movie:  { label: 'MY MOVIES',     emoji: '🎬', color: 'bg-amber-500',  border: 'border-amber-400',  text: 'text-amber-300'     },
  series: { label: 'MY SERIES',     emoji: '📺', color: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-300'    },
};

const SECTION_CONFIG = {
  game:   { accent: 'bg-accent',     textAccent: 'text-accent-light'  },
  movie:  { accent: 'bg-amber-500',  textAccent: 'text-amber-300'     },
  series: { accent: 'bg-violet-500', textAccent: 'text-violet-300'    },
};

// ─── SourceSwitcher ───────────────────────────────────────────────────────────

function SourceSwitcher({ sourceMode, onChange, library }) {
  return (
    <div
      className="inline-flex rounded-2xl border border-line bg-surface-high p-1 gap-1"
      role="tablist"
      aria-label="Source mode"
    >
      {Object.entries(SOURCE_CONFIG).map(([mode, cfg]) => {
        const count  = library.filter(i => i.type === mode).length;
        const active = sourceMode === mode;
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black
                       tracking-widest uppercase transition-all duration-200 focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent
                       ${active
                         ? `${cfg.color} text-white shadow-lg`
                         : 'text-ink-mid hover:text-ink hover:bg-white/60'
                       }`}
          >
            <span className="text-sm leading-none">{cfg.emoji}</span>
            <span className="hidden sm:inline">{cfg.label}</span>
            <span className="sm:hidden">{cfg.label.replace('MY ', '')}</span>
            {count > 0 && (
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none
                            ${active ? 'bg-white/25 text-white' : 'bg-line text-ink-light'}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── SeedCard ─────────────────────────────────────────────────────────────────

function SeedCard({ item, selected, onToggle }) {
  const image = item.imageUrl ?? item.image ?? item.posterUrl ?? null;
  const title = item.title ?? item.name ?? '';
  return (
    <button
      onClick={() => onToggle(item.id)}
      className={`relative flex-shrink-0 w-[72px] rounded-xl overflow-hidden transition-all duration-150
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                 ${selected
                   ? 'ring-2 ring-accent shadow-[0_0_14px_rgba(139,92,246,0.45)] scale-[1.04]'
                   : 'opacity-70 hover:opacity-100 hover:ring-1 hover:ring-white/25'
                 }`}
      style={{ aspectRatio: '2/3' }}
      title={title}
      aria-pressed={selected}
    >
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full bg-surface-high flex items-center justify-center text-xl">
          {item.emoji ?? '🎬'}
        </div>
      )}
      {selected && (
        <div className="absolute inset-0 bg-accent/20 flex items-start justify-end p-1">
          <span className="w-4 h-4 bg-accent rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-3">
        <p className="text-[8px] font-semibold text-white leading-tight line-clamp-2">{title}</p>
      </div>
    </button>
  );
}

// ─── PrecisionSummaryLine ─────────────────────────────────────────────────────
// Always visible regardless of panel state.

function PrecisionSummaryLine({ sourceMode, seedIds, activeGenres, sourceItems }) {
  const srcLabel = sourceMode === 'game' ? 'game library' : sourceMode === 'movie' ? 'movie library' : 'series library';

  if (seedIds.size === 0 && activeGenres.size === 0) {
    return (
      <p className="text-xs text-ink-light">
        Using your full {srcLabel} as the taste source.{' '}
        <span className="text-ink-mid">Select titles below for sharper results.</span>
      </p>
    );
  }

  const parts = [];
  if (seedIds.size > 0) {
    const names = [...seedIds]
      .map(id => sourceItems.find(i => i.id === id))
      .filter(Boolean)
      .slice(0, 2)
      .map(i => i.title ?? i.name ?? '');
    if (names.length === 1) parts.push(`seeded by ${names[0]}`);
    else if (names.length === 2) parts.push(`seeded by ${names[0]} and ${names[1]}`);
    else parts.push(`${seedIds.size} seeds selected`);
  }
  if (activeGenres.size > 0) {
    parts.push(`${activeGenres.size} genre filter${activeGenres.size > 1 ? 's' : ''} active`);
  }

  return (
    <p className="text-xs text-ink-mid">
      <span className="font-semibold text-ink">Precision on</span>
      {' — '}
      {parts.join(' · ')}
    </p>
  );
}

// ─── ActiveSeedChips ─────────────────────────────────────────────────────────
// Always visible when seeds are selected.

function ActiveSeedChips({ seedIds, sourceItems, onToggleSeed, onClearSeeds }) {
  if (seedIds.size === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {[...seedIds].map(id => {
        const item = sourceItems.find(i => i.id === id);
        if (!item) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 text-xs bg-accent/15 text-accent-light
                       border border-accent/30 px-2 py-0.5 rounded-full"
          >
            {item.title ?? item.name}
            <button
              onClick={() => onToggleSeed(id)}
              aria-label={`Remove ${item.title ?? item.name}`}
              className="hover:text-white transition-colors ml-0.5 leading-none"
            >
              ×
            </button>
          </span>
        );
      })}
      {seedIds.size > 1 && (
        <button
          onClick={onClearSeeds}
          className="text-[10px] text-ink-light hover:text-ink transition-colors underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ─── GenreFilters ─────────────────────────────────────────────────────────────

function GenreFilters({ sourceMode, sourceItems, activeGenres, onToggleGenre, onClearGenres }) {
  const availableGenres = deriveSourceGenres(sourceItems, sourceMode);
  if (availableGenres.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-light">
          Filter by {sourceMode === 'game' ? 'tag' : 'genre'}
        </p>
        {activeGenres.size > 0 && (
          <button
            onClick={onClearGenres}
            className="text-[10px] text-ink-light hover:text-ink transition-colors underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableGenres.map(g => {
          const active = activeGenres.has(g.id);
          return (
            <button
              key={g.id}
              onClick={() => onToggleGenre(g.id)}
              aria-pressed={active}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         ${active
                           ? 'bg-accent text-white border-transparent shadow-sm'
                           : 'bg-transparent text-ink-mid border-line hover:border-ink-mid hover:text-ink'
                         }`}
            >
              {g.name}
              <span className="ml-1 text-[9px] opacity-50">{g.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PrecisionLayer ───────────────────────────────────────────────────────────
// Desktop: fully visible by default.
// Mobile: seed row + genre filters are togglable, but summary + active chips
//         are ALWAYS rendered outside the toggle zone.

function PrecisionLayer({
  sourceMode, sourceItems,
  seedIds, onToggleSeed,
  activeGenres, onToggleGenre,
  onClearSeeds, onClearGenres, onClearAll,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const hasPrecision = seedIds.size > 0 || activeGenres.size > 0;

  // Auto-expand on mobile if user has active precision
  useEffect(() => {
    if (hasPrecision) setMobileExpanded(true);
  }, [hasPrecision]);

  const sortedItems = [...sourceItems].sort((a, b) => {
    if (sourceMode === 'game') {
      const ptDiff = (b.metadata?.playtime ?? 0) - (a.metadata?.playtime ?? 0);
      if (ptDiff !== 0) return ptDiff;
    }
    return (b.rating ?? 0) - (a.rating ?? 0);
  }).slice(0, 30);

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 space-y-4">

      {/* Always-visible top row: summary + clear */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-ink-mid">Personalized for you</p>
          <PrecisionSummaryLine
            sourceMode={sourceMode}
            seedIds={seedIds}
            activeGenres={activeGenres}
            sourceItems={sourceItems}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPrecision && (
            <button
              onClick={onClearAll}
              className="text-[10px] font-semibold text-ink-light hover:text-ink transition-colors
                         border border-line rounded-full px-2.5 py-1"
            >
              Reset
            </button>
          )}
          {/* Mobile toggle */}
          <button
            className="sm:hidden flex items-center gap-1 text-[10px] font-semibold text-ink-mid
                       border border-line rounded-full px-2.5 py-1"
            onClick={() => setMobileExpanded(v => !v)}
            aria-expanded={mobileExpanded}
          >
            {mobileExpanded ? 'Hide' : 'Refine'}
            <svg
              className={`w-3 h-3 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Always-visible: active seed chips */}
      <ActiveSeedChips
        seedIds={seedIds}
        sourceItems={sourceItems}
        onToggleSeed={onToggleSeed}
        onClearSeeds={onClearSeeds}
      />

      {/* Controls: always shown on desktop (sm:block), mobile-toggled */}
      <div className={`space-y-4 ${mobileExpanded ? 'block' : 'hidden'} sm:block`}>
        {/* Seed picker */}
        {sortedItems.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-light mb-2">
              Seed from your{' '}
              {sourceMode === 'game' ? 'games' : sourceMode === 'movie' ? 'movies' : 'series'}
            </p>
            <DragRow gap="gap-2.5">
              {sortedItems.map(item => (
                <SeedCard
                  key={item.id}
                  item={item}
                  selected={seedIds.has(item.id)}
                  onToggle={onToggleSeed}
                />
              ))}
            </DragRow>
          </div>
        )}

        {/* Genre filters */}
        <GenreFilters
          sourceMode={sourceMode}
          sourceItems={sourceItems}
          activeGenres={activeGenres}
          onToggleGenre={onToggleGenre}
          onClearGenres={onClearGenres}
        />
      </div>
    </div>
  );
}

// ─── RecommendationSection ────────────────────────────────────────────────────

function RecommendationSection({ section, sourceMode, library, onAddToLibrary }) {
  const { type, items, reason } = section;
  const cfg   = SECTION_CONFIG[type] ?? SECTION_CONFIG.movie;
  const title = SECTION_TITLES[sourceMode]?.[type] ?? type;

  if (!items || items.length === 0) return null;

  return (
    <section aria-label={title}>
      {/* Section header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-1 h-full min-h-[2.5rem] rounded-full flex-shrink-0 mt-0.5 ${cfg.accent}`} />
        <div>
          <h3 className="text-base font-bold text-ink leading-snug">{title}</h3>
          {reason && (
            <p className="text-xs text-ink-light mt-0.5">{reason}</p>
          )}
        </div>
      </div>

      {/* Cards */}
      <DragRow gap="gap-3" className="mt-3">
        {items.map((scored, idx) => {
          const item       = scored.item ?? scored;
          const compoundId = type === 'movie'
            ? `movie_${item.tmdbId}`
            : type === 'series'
            ? `series_${item.tmdbId ?? item.id}`
            : `game_${item.id ?? item.rawId}`;
          const inLib = library.some(i => i.id === compoundId);
          return (
            <div key={item.id ?? item.tmdbId ?? idx} className="flex-shrink-0 w-52">
              <UnifiedCard
                item={item}
                type={type}
                isInLibrary={inLib}
                onAddToLibrary={() => onAddToLibrary(item, type)}
              />
            </div>
          );
        })}
      </DragRow>
    </section>
  );
}

// ─── Empty / low-data / loading states ───────────────────────────────────────

function EmptySourceState({ sourceMode }) {
  const cfg = SOURCE_CONFIG[sourceMode];
  const destinations = {
    game:   { label: 'Browse games',   to: '/games'  },
    movie:  { label: 'Explore movies', to: '/'       },
    series: { label: 'Explore series', to: '/series' },
  };
  const dest = destinations[sourceMode];
  return (
    <div className="py-16 text-center max-w-sm mx-auto">
      <p className="text-5xl mb-5">{cfg.emoji}</p>
      <p className="section-label mb-2">Nothing saved here yet</p>
      <p className="text-sm text-ink-light leading-relaxed mb-6">
        Save at least two{' '}
        {sourceMode === 'game' ? 'games' : sourceMode === 'movie' ? 'movies' : 'series'}{' '}
        to your library and Lumium will build cross-media recommendations from them.
      </p>
      <Link to={dest.to} className="text-sm font-semibold text-ink-mid hover:text-ink transition-colors">
        {dest.label} →
      </Link>
    </div>
  );
}

function LowDataState({ sourceMode, count }) {
  const cfg  = SOURCE_CONFIG[sourceMode];
  const need = 2 - count;
  const noun = sourceMode === 'game' ? 'game' : sourceMode === 'movie' ? 'movie' : 'series';
  return (
    <div className="py-16 text-center max-w-sm mx-auto">
      <p className="text-5xl mb-5">{cfg.emoji}</p>
      <p className="section-label mb-2">Almost there</p>
      <p className="text-sm text-ink-light leading-relaxed">
        You have {count} {count === 1 ? noun : noun + 's'} saved.
        Add {need} more {need === 1 ? noun : noun + 's'} to unlock cross-media recommendations.
      </p>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map(i => (
        <div key={i}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 rounded-full bg-line animate-pulse flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-40 bg-line rounded animate-pulse" />
              <div className="h-2 w-56 bg-line rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            {[0, 1, 2, 3, 4].map(j => (
              <div
                key={j}
                className="flex-shrink-0 w-52 rounded-2xl bg-line animate-pulse"
                style={{ aspectRatio: '16/9' }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const library = useUserLibraryStore(s => s.items);
  const addItem = useUserLibraryStore(s => s.addItem);

  const [sourceMode,   setSourceMode]   = useState(() => localStorage.getItem('pm_rec_source') ?? 'game');
  const [seedIds,      setSeedIds]      = useState(new Set());
  const [activeGenres, setActiveGenres] = useState(new Set());

  // Persist source choice
  useEffect(() => {
    localStorage.setItem('pm_rec_source', sourceMode);
  }, [sourceMode]);

  // Clear refinements when source switches
  const handleSourceChange = useCallback((mode) => {
    setSourceMode(mode);
    setSeedIds(new Set());
    setActiveGenres(new Set());
  }, []);

  const toggleSeed = useCallback((id) => {
    setSeedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSeeds = useCallback(() => setSeedIds(new Set()), []);

  const toggleGenre = useCallback((id) => {
    setActiveGenres(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearGenres  = useCallback(() => setActiveGenres(new Set()), []);
  const clearAll     = useCallback(() => { setSeedIds(new Set()); setActiveGenres(new Set()); }, []);

  const sourceItems = library.filter(i => i.type === sourceMode);

  const { sections, isLoading, isEmpty, hasEnoughData } = useSourceRecs({
    sourceMode,
    seedIds,
    activeGenres,
    library,
  });

  const handleAddToLibrary = useCallback((item, type) => {
    if (type === 'movie') {
      addItem({
        id: `movie_${item.tmdbId}`, externalId: String(item.tmdbId),
        source: 'tmdb', type: 'movie',
        title:   item.title ?? item.name ?? '',
        imageUrl: item.posterUrl ?? item.image ?? null,
        image:    item.posterUrl ?? item.image ?? null,
        rating: item.rating ?? null, genres: item.genres ?? [],
        addedAt: new Date().toISOString(),
      });
    } else if (type === 'series') {
      addItem({
        id: `series_${item.tmdbId ?? item.id}`, externalId: String(item.tmdbId ?? item.id),
        source: 'tmdb', type: 'series',
        title:   item.title ?? item.name ?? '',
        imageUrl: item.posterUrl ?? item.image ?? null,
        image:    item.posterUrl ?? item.image ?? null,
        rating: item.rating ?? null, genres: item.genres ?? [],
        addedAt: new Date().toISOString(),
      });
    } else if (type === 'game') {
      addItem({
        id: `game_${item.id ?? item.rawId}`, externalId: String(item.id ?? item.rawId ?? ''),
        source: 'rawg', type: 'game',
        title:   item.name ?? item.title ?? '',
        imageUrl: item.background_image ?? item.image ?? null,
        image:    item.background_image ?? item.image ?? null,
        rating: item.rating ?? null, genres: [], tags: item.tags ?? [],
        rawId:   String(item.id ?? item.rawId ?? ''),
        addedAt: new Date().toISOString(),
      });
    }
  }, [addItem]);

  return (
    <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10 space-y-8">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div>
        <p className="section-label mb-1">Cross-media discovery</p>
        <h1 className="text-3xl font-semibold text-ink mb-2">For You</h1>
        <p className="text-sm text-ink-light max-w-md leading-relaxed">
          Choose the source of your taste. Lumium will recommend across games, films, and series.
        </p>
      </div>

      {/* ── Source selector ──────────────────────────────────────────────────── */}
      <SourceSwitcher sourceMode={sourceMode} onChange={handleSourceChange} library={library} />

      {/* ── Precision layer (always rendered when source has items) ──────────── */}
      {!isEmpty && sourceItems.length > 0 && (
        <PrecisionLayer
          sourceMode={sourceMode}
          sourceItems={sourceItems}
          seedIds={seedIds}
          onToggleSeed={toggleSeed}
          activeGenres={activeGenres}
          onToggleGenre={toggleGenre}
          onClearSeeds={clearSeeds}
          onClearGenres={clearGenres}
          onClearAll={clearAll}
        />
      )}

      {/* ── Empty source ─────────────────────────────────────────────────────── */}
      {isEmpty && <EmptySourceState sourceMode={sourceMode} />}

      {/* ── Not enough data ──────────────────────────────────────────────────── */}
      {!isEmpty && !hasEnoughData && (
        <LowDataState sourceMode={sourceMode} count={sourceItems.length} />
      )}

      {/* ── Recommendation sections ───────────────────────────────────────────── */}
      {!isEmpty && hasEnoughData && (
        <>
          {isLoading ? (
            <SectionSkeleton />
          ) : sections.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-light">
                No recommendations found with the current filters.{' '}
                <button
                  onClick={clearAll}
                  className="text-ink-mid hover:text-ink transition-colors underline"
                >
                  Reset precision
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map(section => (
                <RecommendationSection
                  key={section.type}
                  section={section}
                  sourceMode={sourceMode}
                  library={library}
                  onAddToLibrary={handleAddToLibrary}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
