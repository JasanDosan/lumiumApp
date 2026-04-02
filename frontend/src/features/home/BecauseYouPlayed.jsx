import { useState, useMemo, useEffect, useRef } from 'react';
import { GAME_CATALOG, getRelatedGames } from '@/data/gameMovieTags';
import ExpandableRow from '@/components/ui/ExpandableRow';

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'movies',  label: 'Movies',  emoji: '🎬', activeClass: 'bg-amber-500  text-white', inactiveColor: 'text-amber-400'  },
  { id: 'series',  label: 'Series',  emoji: '📺', activeClass: 'bg-violet-500 text-white', inactiveColor: 'text-violet-400' },
  { id: 'games',   label: 'Games',   emoji: '🎮', activeClass: 'bg-accent     text-white', inactiveColor: 'text-accent-light' },
];

// Tab determines which row is shown first (primary) — others follow
const TAB_ORDER = {
  movies: ['movies', 'series', 'games'],
  series: ['series', 'movies', 'games'],
  games:  ['games',  'movies', 'series'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function GameSelector({ game, gameOptions, selectedGameId, onGameChange, myGames }) {
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

  const myGameIds = useMemo(() => new Set(myGames.map(g => String(g.id))), [myGames]);

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
          {myGames.length > 0 && (
            <p className="px-4 py-2 text-[10px] font-black tracking-[0.15em] uppercase text-ink-light border-b border-subtle">
              Your Library first
            </p>
          )}
          <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {gameOptions.map(g => {
              const isSelected = g.id === selectedGameId;
              const inLibrary  = myGameIds.has(g.id);
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

// ─── Content row ──────────────────────────────────────────────────────────────

function ContentRow({ type, items, isLoading, isPrimary }) {
  const config = {
    movies: { label: "Movies you'll like", color: 'amber',  primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    series: { label: "Series you'll like", color: 'violet', primaryWidth: 'w-56 sm:w-64 lg:w-72', secondaryWidth: 'w-44 sm:w-52', gap: 'gap-4', skeletonCount: 4 },
    games:  { label: 'Related games',      color: 'accent', primaryWidth: 'w-44 sm:w-52',         secondaryWidth: 'w-36 sm:w-40', gap: 'gap-3', skeletonCount: 5 },
  };
  const { label, color, primaryWidth, secondaryWidth, gap, skeletonCount } = config[type];
  const cardWidth = isPrimary ? primaryWidth : secondaryWidth;
  const skeletonWidth = isPrimary ? primaryWidth : secondaryWidth;

  const emptyMessages = {
    movies: "No films matched this game's vibe.",
    series: "No series matched this game's vibe.",
    games:  '',
  };

  if (!isLoading && !items.length && !emptyMessages[type]) return null;

  return (
    <div>
      <RowLabel color={color} label={label} />
      {isLoading ? (
        <SkeletonRow count={skeletonCount} width={skeletonWidth} />
      ) : items.length > 0 ? (
        <ExpandableRow items={items} cardWidth={cardWidth} gap={gap} />
      ) : (
        emptyMessages[type] && (
          <p className="text-sm text-ink-light italic py-2">{emptyMessages[type]}</p>
        )
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BecauseYouPlayed({
  game,
  movies = [],
  series = [],
  isLoading = false,
  selectedGameId,
  onGameChange,
  myGames = [],
}) {
  const [activeTab, setActiveTab] = useState('movies');

  const similarGames = useMemo(() => getRelatedGames(selectedGameId, 10), [selectedGameId]);

  const allContent = useMemo(() => ({
    movies: movies.map(m => ({ item: m, type: 'movie' })),
    series: series.map(s => ({ item: s, type: 'series' })),
    games:  similarGames.map(g => ({ item: g, type: 'game' })),
  }), [movies, series, similarGames]);

  // Selector: always GAME_CATALOG entries, library games sorted first
  const gameOptions = useMemo(() => {
    const myIds = new Set(myGames.map(g => String(g.id)));
    return [
      ...GAME_CATALOG.filter(g => myIds.has(g.id)),
      ...GAME_CATALOG.filter(g => !myIds.has(g.id)),
    ].slice(0, 24);
  }, [myGames]);

  if (!game) return null;

  const orderedTabs = TAB_ORDER[activeTab];

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(139,92,246,0.15) 0%, rgba(11,11,15,0.9) 100%)',
        border: '1px solid rgba(139,92,246,0.22)',
        borderRadius: '24px',
        padding: '36px 32px',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center mb-6">
        <p className="text-[10px] font-black tracking-[0.28em] text-accent uppercase mb-2">
          Personalized for you
          {myGames.length > 0 && (
            <span className="ml-2 normal-case tracking-normal font-normal text-ink-light">
              · {myGames.length} game{myGames.length !== 1 ? 's' : ''} in your library
            </span>
          )}
        </p>
        <p className="text-sm text-ink-mid mb-3">Because you played</p>

        <GameSelector
          game={game}
          gameOptions={gameOptions}
          selectedGameId={selectedGameId}
          onGameChange={onGameChange}
          myGames={myGames}
        />

        {game.tagline && (
          <p className="text-sm text-ink-mid mt-3 max-w-lg leading-relaxed">{game.tagline}</p>
        )}
        {game.meta?.mood?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {game.meta.mood.slice(0, 5).map(m => (
              <span key={m} className="text-[10px] px-2.5 py-0.5 rounded-full border border-subtle bg-surface text-ink-mid capitalize">
                {m.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 justify-center">
        {TABS.map(tab => (
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
          </button>
        ))}
      </div>

      {/* ── Gradient divider ───────────────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent mb-6" />

      {/* ── Content rows — ordered by active tab ───────────────────────────── */}
      {orderedTabs.map((type, idx) => (
        <div key={type} style={{ marginTop: idx === 0 ? 0 : '28px' }}>
          <ContentRow
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
