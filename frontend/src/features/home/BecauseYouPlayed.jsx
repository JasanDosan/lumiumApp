import { useMemo } from 'react';
import { GAME_CATALOG, getRelatedGames } from '@/data/gameMovieTags';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

/**
 * THE signature discovery section.
 *
 * Receives pre-fetched movie + series data from the parent.
 * Mixes games + movies + series in a single cinematic scroll row.
 */
export default function BecauseYouPlayed({
  game,
  movies = [],
  series = [],
  isLoading = false,
  selectedGameId,
  onGameChange,
}) {
  const similarGames = useMemo(
    () => getRelatedGames(selectedGameId, 6),
    [selectedGameId],
  );

  // Interleave: 2 games → [movie, series, game, movie, series, ...] pattern
  const mixedItems = useMemo(() => {
    if (!movies.length && !series.length && !similarGames.length) return [];

    const result = [];

    // Lead with 2 similar games
    similarGames.slice(0, 2).forEach(g =>
      result.push({ item: g, type: 'game', key: `game-${g.id}-lead` }),
    );

    const maxLen = Math.max(movies.length, series.length);
    for (let i = 0; i < maxLen; i++) {
      if (movies[i])  result.push({ item: movies[i],  type: 'movie',  key: `movie-${movies[i].tmdbId ?? i}`  });
      if (series[i])  result.push({ item: series[i],  type: 'series', key: `series-${series[i].tmdbId ?? i}` });
      // Scatter similar games through the row
      if (i === 3 && similarGames[2]) result.push({ item: similarGames[2], type: 'game', key: `game-${similarGames[2].id}-mid` });
      if (i === 7 && similarGames[3]) result.push({ item: similarGames[3], type: 'game', key: `game-${similarGames[3].id}-late` });
    }

    return result;
  }, [movies, series, similarGames]);

  if (!game) return null;

  return (
    <section className="relative overflow-hidden w-full">

      {/* ── Blurred game backdrop ──────────────────────────────────────────── */}
      {game.image && (
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url(${game.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(64px)',
            transform: 'scale(1.2)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/60 via-canvas/75 to-canvas pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-canvas to-transparent pointer-events-none" />

      <div className="relative max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-16">

        {/* ── Identity ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <p className="text-[11px] font-black tracking-[0.24em] text-accent uppercase mb-3">
            Because you played
          </p>
          <h2 className="text-5xl sm:text-6xl font-black text-ink leading-none tracking-tight">
            {game.emoji}&nbsp;{game.name}
          </h2>
          {game.tagline && (
            <p className="text-sm text-ink-mid mt-3">{game.tagline}</p>
          )}
        </div>

        {/* ── Mixed content row ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="shrink-0 w-56 sm:w-64 xl:w-72">
                <div className="skeleton aspect-video rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <DragRow gap="gap-3">
            {mixedItems.map(({ item, type, key }) => (
              <div key={key} className="shrink-0 w-56 sm:w-64 xl:w-72 pointer-events-auto">
                <UnifiedCard item={item} type={type} />
              </div>
            ))}
          </DragRow>
        )}

        {/* ── Game chip switcher ────────────────────────────────────────────── */}
        <div className="mt-10 pt-7 border-t border-white/[0.06]">
          <span className="text-[10px] text-ink-light tracking-[0.18em] uppercase mr-4">
            Switch game
          </span>
          <div className="flex flex-wrap gap-2 mt-3">
            {GAME_CATALOG.slice(0, 14).map(g => (
              <button
                key={g.id}
                onClick={() => onGameChange(g.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${
                  g.id === selectedGameId
                    ? 'bg-accent border-accent text-white font-medium'
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
