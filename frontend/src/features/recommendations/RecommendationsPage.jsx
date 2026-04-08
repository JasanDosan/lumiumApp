import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSourceRecs, deriveSourceGenres } from './usePersonalizedRecs';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import DragRow from '@/components/ui/DragRow';
import UnifiedCard from '@/components/ui/UnifiedCard';
import ContentBand from '@/components/ui/ContentBand';

// ─── Config tables ─────────────────────────────────────────────────────────────

/**
 * Fixed editorial section titles.
 * Keys: SECTION_TITLES[sourceMode][recommendedType]
 */
const SECTION_TITLES = {
  game: {
    movie:  'Films inspired by your games',
    series: 'Series from your worlds',
    game:   'More videogames in your style',
  },
  movie: {
    game:   'Videogames from your favourite films',
    series: 'Series that match your cinema taste',
    movie:  'More movies in your style',
  },
  series: {
    game:   'Videogames from your favourite series',
    movie:  'Films shaped by your shows',
    series: 'More series in your style',
  },
};

const SOURCE_CONFIG = {
  game: {
    label:       'MY VIDEOGAMES',
    labelShort:  'GAMES',
    emoji:       '🎮',
    description: 'Your saved games become the engine for cross-media discovery',
    colorBg:     'bg-accent',
    colorBorder: 'border-accent',
    colorText:   'text-accent',
    colorMid:    'text-accent-light',
    colorTint:   'bg-accent/5',
  },
  movie: {
    label:       'MY MOVIES',
    labelShort:  'MOVIES',
    emoji:       '🎬',
    description: 'Your film taste drives discovery across games and series',
    colorBg:     'bg-amber-500',
    colorBorder: 'border-amber-500',
    colorText:   'text-amber-500',
    colorMid:    'text-amber-400',
    colorTint:   'bg-amber-500/5',
  },
  series: {
    label:       'MY SERIES',
    labelShort:  'SERIES',
    emoji:       '📺',
    description: 'Your shows unlock games and films from the same worlds',
    colorBg:     'bg-violet-500',
    colorBorder: 'border-violet-500',
    colorText:   'text-violet-500',
    colorMid:    'text-violet-400',
    colorTint:   'bg-violet-500/5',
  },
};

// ─── 1. HeroZone ──────────────────────────────────────────────────────────────

function HeroZone({ sourceMode }) {
  const activeCfg = SOURCE_CONFIG[sourceMode];
  return (
    <ContentBand zone="deep" size="hero" className="border-b border-line/50">
      <p className={`eyebrow ${activeCfg.colorText} mb-7`}>For You</p>
      <h1 className="display text-ink mb-7 max-w-4xl">
        Choose the source<br />of your taste.
      </h1>
      <p className="body-lead text-ink-mid max-w-2xl">
        Pick a source library below. Lumium maps your saved titles to recommendations
        across videogames, movies, and series — cross-media first.
      </p>
    </ContentBand>
  );
}

// ─── 2. SourceCards ───────────────────────────────────────────────────────────

function SourceCards({ sourceMode, onChange, library }) {
  return (
    <ContentBand zone="surface" size="default" topBorder>
      <p className="eyebrow text-ink-light mb-10">Source</p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        role="tablist"
        aria-label="Choose source mode"
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
              className={`
                relative text-left p-8 rounded-2xl border transition-all duration-250
                focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${active
                  ? `${cfg.colorBorder} border-2 ${cfg.colorTint}`
                  : 'border-line/60 bg-canvas hover:border-line hover:bg-surface/50'
                }
              `}
            >
              {active && (
                <div className={`absolute top-0 inset-x-0 h-px rounded-t-2xl ${cfg.colorBg} opacity-60`} />
              )}
              <div className="flex items-start justify-between mb-6">
                <span className={`text-4xl leading-none ${active ? '' : 'opacity-50'}`}>
                  {cfg.emoji}
                </span>
                {active && (
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.colorBg} mt-1`} />
                )}
              </div>
              <p className={`eyebrow mb-3 transition-colors ${active ? cfg.colorText : 'text-ink-light'}`}>
                {cfg.labelShort}
              </p>
              <p className={`headline-md mb-3 transition-colors ${active ? 'text-ink' : 'text-ink-mid'}`}>
                {count > 0 ? `${count} saved` : 'Empty'}
              </p>
              <p className={`text-[13px] leading-relaxed transition-colors ${active ? 'text-ink-mid' : 'text-ink-light/60'}`}>
                {cfg.description}
              </p>
            </button>
          );
        })}
      </div>
    </ContentBand>
  );
}

// ─── 3. PrecisionStudio ───────────────────────────────────────────────────────

function SeedCard({ item, selected, onToggle }) {
  const image = item.imageUrl ?? item.image ?? item.posterUrl ?? null;
  const title = item.title ?? item.name ?? '';
  return (
    <button
      onClick={() => onToggle(item.id)}
      aria-pressed={selected}
      title={title}
      className={`
        relative flex-shrink-0 w-24 rounded-xl overflow-hidden
        transition-all duration-150 focus:outline-none
        focus-visible:ring-2 focus-visible:ring-accent
        ${selected
          ? 'ring-2 ring-accent shadow-[0_0_16px_rgba(139,92,246,0.5)] scale-[1.06]'
          : 'opacity-60 hover:opacity-100 hover:scale-[1.02]'
        }
      `}
      style={{ aspectRatio: '2/3' }}
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
        <div className="w-full h-full bg-surface-high flex items-center justify-center text-2xl">
          {item.emoji ?? '🎬'}
        </div>
      )}
      {selected && (
        <div className="absolute inset-0 bg-accent/25 flex items-start justify-end p-1.5">
          <span className="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1.5 pt-4">
        <p className="text-[9px] font-semibold text-white leading-tight line-clamp-2">{title}</p>
      </div>
    </button>
  );
}

function PrecisionStudio({
  sourceMode, sourceItems,
  seedIds, onToggleSeed,
  activeGenres, onToggleGenre,
  onClearSeeds, onClearGenres, onClearAll,
}) {
  const cfg = SOURCE_CONFIG[sourceMode];
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasPrecision   = seedIds.size > 0 || activeGenres.size > 0;
  const availableGenres = deriveSourceGenres(sourceItems, sourceMode);

  // Auto-open on mobile when precision is active
  useEffect(() => {
    if (hasPrecision) setMobileOpen(true);
  }, [hasPrecision]);

  const sortedItems = [...sourceItems].sort((a, b) => {
    if (sourceMode === 'game') {
      const pt = (b.metadata?.playtime ?? 0) - (a.metadata?.playtime ?? 0);
      if (pt !== 0) return pt;
    }
    return (b.rating ?? 0) - (a.rating ?? 0);
  }).slice(0, 30);

  // Always-visible precision summary
  const summaryLine = (() => {
    if (!hasPrecision) {
      const noun = sourceMode === 'game' ? 'game' : sourceMode === 'movie' ? 'movie' : 'series';
      return `Using your full ${noun} library as the taste source`;
    }
    const parts = [];
    if (seedIds.size > 0) {
      const names = [...seedIds]
        .map(id => sourceItems.find(i => i.id === id))
        .filter(Boolean)
        .slice(0, 2)
        .map(i => i.title ?? i.name ?? '');
      if (names.length >= 2)       parts.push(`seeded by ${names[0]} and ${names[1]}`);
      else if (names.length === 1) parts.push(`seeded by ${names[0]}`);
      else                         parts.push(`${seedIds.size} titles selected`);
    }
    if (activeGenres.size > 0)
      parts.push(`${activeGenres.size} genre${activeGenres.size > 1 ? 's' : ''} active`);
    return 'Precision on — ' + parts.join(' · ');
  })();

  return (
    <ContentBand zone="canvas" size="compact" topBorder className={`border-l-4 ${cfg.colorBorder}`}>
      <div className="space-y-6">

        {/* Studio header — always visible */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <p className={`text-[10px] font-black tracking-[0.18em] uppercase ${cfg.colorText}`}>
              Precision Studio
            </p>
            <p className="text-sm font-medium text-ink leading-snug">{summaryLine}</p>
            {!hasPrecision && (
              <p className="text-xs text-ink-light mt-0.5">
                Select specific titles to focus the recommendations below.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {hasPrecision && (
              <button
                onClick={onClearAll}
                className="text-[10px] font-semibold text-ink-light hover:text-ink
                           border border-line rounded-full px-3 py-1 transition-colors"
              >
                Reset
              </button>
            )}
            {/* Mobile-only toggle */}
            <button
              className="sm:hidden text-[10px] font-semibold text-ink-mid border border-line
                         rounded-full px-3 py-1 flex items-center gap-1 transition-colors"
              onClick={() => setMobileOpen(v => !v)}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? 'Hide' : 'Refine'}
              <svg
                className={`w-3 h-3 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Active seed chips — always visible */}
        {seedIds.size > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {[...seedIds].map(id => {
              const item = sourceItems.find(i => i.id === id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 text-xs bg-accent/15 text-accent-light
                             border border-accent/30 px-2.5 py-1 rounded-full"
                >
                  {item.title ?? item.name}
                  <button
                    onClick={() => onToggleSeed(id)}
                    aria-label={`Remove ${item.title ?? item.name}`}
                    className="hover:text-white transition-colors ml-0.5 text-sm leading-none"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {seedIds.size > 1 && (
              <button
                onClick={onClearSeeds}
                className="text-[10px] text-ink-light hover:text-ink underline transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Controls: always shown on desktop, toggle-gated on mobile */}
        <div className={`space-y-6 ${mobileOpen ? 'block' : 'hidden'} sm:block`}>

          {/* Seed selector */}
          {sortedItems.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-ink-light mb-3">
                Seed from your{' '}
                {sourceMode === 'game' ? 'games' : sourceMode === 'movie' ? 'movies' : 'series'}
              </p>
              <DragRow gap="gap-3">
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
          {availableGenres.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-ink-light">
                  Filter by {sourceMode === 'game' ? 'tag' : 'genre'}
                </p>
                {activeGenres.size > 0 && (
                  <button
                    onClick={onClearGenres}
                    className="text-[10px] text-ink-light hover:text-ink underline transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableGenres.map(g => {
                  const active = activeGenres.has(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => onToggleGenre(g.id)}
                      aria-pressed={active}
                      className={`
                        text-xs px-3 py-1.5 rounded-full border transition-all duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        ${active
                          ? 'bg-accent text-white border-transparent shadow-sm'
                          : 'bg-transparent text-ink-mid border-line hover:border-ink-mid hover:text-ink'
                        }
                      `}
                    >
                      {g.name}
                      <span className="ml-1 text-[9px] opacity-50">{g.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </ContentBand>
  );
}

// ─── 4. RecommendationSection ─────────────────────────────────────────────────

function RecommendationSection({ section, sourceMode, library, onAddToLibrary }) {
  const { type, items, reason } = section;
  const title   = SECTION_TITLES[sourceMode]?.[type] ?? type;
  const color   = type === 'game' ? 'accent' : type === 'movie' ? 'amber' : 'violet';
  const overline =
    type === 'game'   ? 'Games'  :
    type === 'movie'  ? 'Films'  :
    'Series';

  if (!items || items.length === 0) return null;

  const zoneAlt = type === 'game' ? 'surface' : type === 'movie' ? 'canvas' : 'surface';

  return (
    <ContentBand zone={zoneAlt} size="lg" topBorder aria-label={title}>
      <p className={`eyebrow mb-5 ${
        color === 'accent' ? 'text-accent' :
        color === 'amber'  ? 'text-amber-400' :
        'text-violet-400'
      }`}>{overline}</p>
      <h2 className="headline-lg text-ink mb-4">{title}</h2>
      {reason && (
        <p className="body-lead text-ink-mid max-w-2xl mb-10">{reason}</p>
      )}
      <DragRow gap="gap-3">
        {items.map((scored, idx) => {
          const item       = scored.item ?? scored;
          const compoundId = type === 'movie'
            ? `movie_${item.tmdbId}`
            : type === 'series'
            ? `series_${item.tmdbId ?? item.id}`
            : `game_${item.id ?? item.rawId}`;
          const inLib = library.some(i => i.id === compoundId);
          return (
            <div key={item.id ?? item.tmdbId ?? idx} className="flex-shrink-0 w-56 sm:w-64">
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
    </ContentBand>
  );
}

// ─── Empty / low-data / loading states ────────────────────────────────────────

function EmptySourceState({ sourceMode }) {
  const cfg  = SOURCE_CONFIG[sourceMode];
  const noun = sourceMode === 'game' ? 'games' : sourceMode === 'movie' ? 'movies' : 'series';
  return (
    <ContentBand zone="canvas" size="lg" topBorder>
      <span className="text-6xl mb-8 block">{cfg.emoji}</span>
      <p className="eyebrow text-ink-light mb-6">No {noun} saved yet</p>
      <h2 className="headline-lg text-ink mb-6 max-w-xl">
        Save some {noun} to unlock recommendations
      </h2>
      <p className="body-lead text-ink-mid max-w-lg mb-10">
        Save at least two {noun} to your library. Lumium will build
        cross-media recommendations from them.
      </p>
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 text-[13px] font-semibold
                   bg-ink text-canvas px-6 py-3 rounded-full hover:bg-ink/80 transition-colors"
      >
        Find {noun} to save →
      </Link>
    </ContentBand>
  );
}

function LowDataState({ sourceMode, count }) {
  const cfg  = SOURCE_CONFIG[sourceMode];
  const need = 2 - count;
  const noun = sourceMode === 'game' ? 'game' : sourceMode === 'movie' ? 'movie' : 'series';
  return (
    <ContentBand zone="canvas" size="lg" topBorder>
      <span className="text-6xl mb-8 block">{cfg.emoji}</span>
      <p className="eyebrow text-ink-light mb-6">Almost ready</p>
      <h2 className="headline-lg text-ink mb-6 max-w-xl">
        Save {need} more {need === 1 ? noun : noun + 's'} to unlock
      </h2>
      <p className="body-lead text-ink-mid max-w-lg mb-10">
        You have {count} {count === 1 ? noun : noun + 's'} saved.
        Add {need} more and Lumium will start building cross-media recommendations.
      </p>
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 text-[13px] font-semibold
                   bg-ink text-canvas px-6 py-3 rounded-full hover:bg-ink/80 transition-colors"
      >
        Find more {noun + 's'} →
      </Link>
    </ContentBand>
  );
}

function SectionSkeleton() {
  return (
    <div>
      {[0, 1, 2].map(i => (
        <ContentBand key={i} zone={i % 2 === 0 ? 'canvas' : 'surface'} size="lg" topBorder>
          <div className="skeleton h-2.5 w-16 rounded mb-5" />
          <div className="skeleton h-10 w-80 rounded mb-4" />
          <div className="skeleton h-4 w-96 rounded mb-12" />
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4].map(j => (
              <div
                key={j}
                className="skeleton flex-shrink-0 w-56 sm:w-64 rounded-2xl"
                style={{ aspectRatio: '16/9' }}
              />
            ))}
          </div>
        </ContentBand>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const library = useUserLibraryStore(s => s.library);
  const addItem = useUserLibraryStore(s => s.addItem);

  const [sourceMode,   setSourceMode]   = useState(() => localStorage.getItem('pm_rec_source') ?? 'game');
  const [seedIds,      setSeedIds]      = useState(new Set());
  const [activeGenres, setActiveGenres] = useState(new Set());

  useEffect(() => {
    localStorage.setItem('pm_rec_source', sourceMode);
  }, [sourceMode]);

  const handleSourceChange = useCallback((mode) => {
    setSourceMode(mode);
    setSeedIds(new Set());
    setActiveGenres(new Set());
  }, []);

  const toggleSeed = useCallback((id) => {
    setSeedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSeeds  = useCallback(() => setSeedIds(new Set()), []);

  const toggleGenre = useCallback((id) => {
    setActiveGenres(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearGenres = useCallback(() => setActiveGenres(new Set()), []);
  const clearAll    = useCallback(() => {
    setSeedIds(new Set());
    setActiveGenres(new Set());
  }, []);

  const sourceItems = library.filter(i => i.type === sourceMode);

  const { sections, isLoading, isEmpty, hasEnoughData } = useSourceRecs({
    sourceMode, seedIds, activeGenres, library,
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
    <div className="min-h-screen bg-zone-deep">

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <HeroZone sourceMode={sourceMode} />

      {/* ── 2. Source cards ─────────────────────────────────────────────────── */}
      <SourceCards sourceMode={sourceMode} onChange={handleSourceChange} library={library} />

      {/* ── 3. Precision Studio ─────────────────────────────────────────────── */}
      {!isEmpty && sourceItems.length > 0 && (
        <PrecisionStudio
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

      {/* ── 4. Content zone ─────────────────────────────────────────────────── */}
      {isEmpty ? (
        <EmptySourceState sourceMode={sourceMode} />
      ) : !hasEnoughData ? (
        <LowDataState sourceMode={sourceMode} count={sourceItems.length} />
      ) : isLoading ? (
        <SectionSkeleton />
      ) : sections.length === 0 ? (
        <ContentBand zone="canvas" size="lg" topBorder>
          <p className="body-lead text-ink-mid">
            No recommendations found with the current filters.{' '}
            <button
              onClick={clearAll}
              className="text-ink hover:text-accent underline transition-colors"
            >
              Reset precision
            </button>
          </p>
        </ContentBand>
      ) : (
        <div>
          {sections.map((section) => (
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
    </div>
  );
}
