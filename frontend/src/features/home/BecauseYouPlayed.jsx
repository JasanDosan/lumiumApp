import { useMemo } from 'react';
import { GAME_CATALOG, getRelatedGames } from '@/data/gameMovieTags';
import ExpandableRow from '@/components/ui/ExpandableRow';

/**
 * Signature discovery section.
 *
 * Shows three clearly separated rows — Similar Games, Films, Series —
 * each with its own ExpandableRow for consistent inline expansion.
 */

function RowHead({ color, label }) {
  const colors = {
    accent: { bar: 'bg-accent',     text: 'text-accent'     },
    amber:  { bar: 'bg-amber-500',  text: 'text-amber-400'  },
    violet: { bar: 'bg-violet-500', text: 'text-violet-400' },
  };
  const c = colors[color] ?? colors.accent;
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-0.5 h-5 ${c.bar} rounded-full shrink-0`} />
      <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.text}`}>{label}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="shrink-0 w-52 sm:w-60">
          <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />
        </div>
      ))}
    </div>
  );
}

export default function BecauseYouPlayed({
  game,
  movies = [],
  series = [],
  isLoading = false,
  selectedGameId,
  onGameChange,
}) {
  const similarGames = useMemo(
    () => getRelatedGames(selectedGameId, 10),
    [selectedGameId],
  );

  const gamesItems  = useMemo(() => similarGames.map(g => ({ item: g, type: 'game' })),   [similarGames]);
  const moviesItems = useMemo(() => movies.map(m => ({ item: m, type: 'movie' })),         [movies]);
  const seriesItems = useMemo(() => series.map(s => ({ item: s, type: 'series' })),        [series]);

  if (!game) return null;

  return (
    <section className="relative overflow-hidden w-full">

      {/* ── Blurred game backdrop ──────────────────────────────────────────── */}
      {game.image && (
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `url(${game.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(72px)',
            transform: 'scale(1.2)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-canvas/80 to-canvas pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-canvas to-transparent pointer-events-none" />

      <div className="relative max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-16">

        {/* ── Identity header ────────────────────────────────────────────── */}
        <div className="mb-14">
          <p className="text-[11px] font-black tracking-[0.24em] text-accent uppercase mb-4">
            Because you played
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink leading-[0.95] tracking-tight">
            {game.emoji}&nbsp;{game.name}
          </h2>
          {game.tagline && (
            <p className="text-base text-ink-mid mt-4 max-w-xl leading-relaxed">{game.tagline}</p>
          )}
          {game.meta?.mood?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {game.meta.mood.map(m => (
                <span key={m}
                      className="text-[11px] px-3 py-1 rounded-full bg-white/[0.08]
                                 text-ink-mid border border-white/[0.10] capitalize">
                  {m.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 1: Similar Games ───────────────────────────────────── */}
        {gamesItems.length > 0 && (
          <div className="mb-12">
            <RowHead color="accent" label="Similar Games" />
            <ExpandableRow
              items={gamesItems}
              cardWidth="w-44 sm:w-52"
              gap="gap-3"
            />
          </div>
        )}

        {/* ── Section 2: Films ──────────────────────────────────────────── */}
        <div className="mb-12">
          <RowHead color="amber" label="Films for fans" />
          {isLoading ? (
            <SkeletonRow />
          ) : moviesItems.length > 0 ? (
            <ExpandableRow
              items={moviesItems}
              cardWidth="w-52 sm:w-60 lg:w-64"
              gap="gap-4"
            />
          ) : (
            <p className="text-sm text-ink-light italic py-2">
              No films matched this game&apos;s vibe.
            </p>
          )}
        </div>

        {/* ── Section 3: Series ─────────────────────────────────────────── */}
        <div className="mb-12">
          <RowHead color="violet" label="Series" />
          {isLoading ? (
            <SkeletonRow />
          ) : seriesItems.length > 0 ? (
            <ExpandableRow
              items={seriesItems}
              cardWidth="w-52 sm:w-60 lg:w-64"
              gap="gap-4"
            />
          ) : (
            <p className="text-sm text-ink-light italic py-2">No series matched.</p>
          )}
        </div>

        {/* ── Game chip switcher ─────────────────────────────────────────── */}
        <div className="pt-8 border-t border-white/[0.06]">
          <span className="text-[10px] text-ink-light tracking-[0.18em] uppercase block mb-3">
            Switch game
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {GAME_CATALOG.slice(0, 16).map(g => (
              <button
                key={g.id}
                onClick={() => onGameChange(g.id)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${
                  g.id === selectedGameId
                    ? 'bg-accent border-accent text-white font-medium shadow-sm shadow-accent/30'
                    : 'border-line text-ink-mid hover:border-accent/30 hover:text-ink'
                }`}
              >
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
