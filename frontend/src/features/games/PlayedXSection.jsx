import { useEffect, useState } from 'react';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG, translateMetaToTMDB } from '@/data/gameMovieTags';
import LandscapeCard from '@/components/ui/LandscapeCard';

// ─── Horizontal landscape card row ───────────────────────────────────────────

function LandscapeRow({ items, type, isLoading }) {
  if (isLoading) {
    return (
      <div className="scroll-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-64 sm:w-72 xl:w-80">
            <div className="skeleton aspect-video rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  if (!items.length) return (
    <p className="text-sm text-ink-light py-2">Nothing found for this game.</p>
  );
  return (
    <div className="scroll-row">
      {items.map(item => (
        <div key={item.tmdbId} className="shrink-0 w-64 sm:w-72 xl:w-80">
          <LandscapeCard item={item} type={type} />
        </div>
      ))}
    </div>
  );
}

// ─── PlayedXSection ───────────────────────────────────────────────────────────

export default function PlayedXSection({ game, selectedGameId, onGameChange }) {
  const [movies, setMovies]               = useState([]);
  const [series, setSeries]               = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    if (!game) return;
    let cancelled = false;

    setMovies([]);
    setSeries([]);
    setMoviesLoading(true);
    setSeriesLoading(true);

    const filters = translateMetaToTMDB(game.meta);

    movieService.discover({ ...filters, page: 1 })
      .then(data => { if (!cancelled) setMovies((data.results || []).slice(0, 14)); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setMoviesLoading(false); });

    tvService.discover({ genres: filters.genres, sort_by: filters.sort_by })
      .then(data => { if (!cancelled) setSeries((data.results || []).slice(0, 14)); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setSeriesLoading(false); });

    return () => { cancelled = true; };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return null;

  return (
    <section className="relative overflow-hidden w-full">

      {/* Blurred game backdrop texture */}
      {game.image && (
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `url(${game.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(56px)',
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* Gradient fade to canvas at bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-canvas/75 to-canvas pointer-events-none" />
      {/* Top edge blend */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-canvas to-transparent pointer-events-none" />

      <div className="relative max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-16">

        {/* ── Section identity ─────────────────────────────────────────── */}
        <div className="mb-12">
          <p className="text-[11px] font-black tracking-[0.22em] text-accent uppercase mb-3">
            Because you played
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-ink leading-none tracking-tight">
            {game.emoji}&nbsp;{game.name}
          </h2>
          {game.tagline && (
            <p className="text-sm text-ink-mid mt-3 italic">{game.tagline}</p>
          )}
        </div>

        {/* ── Content rows ─────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Films */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-0.5 h-5 bg-amber-500 rounded-full shrink-0" />
              <p className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">
                Films
              </p>
            </div>
            <LandscapeRow items={movies} type="movie" isLoading={moviesLoading} />
          </div>

          {/* Series */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-0.5 h-5 bg-violet-500 rounded-full shrink-0" />
              <p className="text-[10px] font-black tracking-[0.2em] text-violet-400 uppercase">
                Series
              </p>
            </div>
            <LandscapeRow items={series} type="series" isLoading={seriesLoading} />
          </div>
        </div>

        {/* ── Game switcher ─────────────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-line/30">
          <p className="text-[10px] text-ink-light tracking-[0.18em] uppercase mb-4">
            Switch game
          </p>
          <div className="flex flex-wrap gap-2">
            {GAME_CATALOG.slice(0, 14).map(g => (
              <button
                key={g.id}
                onClick={() => onGameChange(g.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                  g.id === selectedGameId
                    ? 'bg-accent border-accent text-white font-medium'
                    : 'bg-transparent border-line text-ink-mid hover:border-accent/40 hover:text-ink'
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
