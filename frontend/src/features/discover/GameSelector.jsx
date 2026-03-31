import { useState, useEffect } from 'react';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useGameToMovie } from '@/hooks/useGameToMovie';
import MovieRow from '@/features/movies/MovieRow';

const LS_SESSION_KEY = 'pm_game_session';

/**
 * Returns a contextual string based on how long ago the game was selected.
 * Returns null if no session data exists for this game.
 */
function getSessionContext(gameId) {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    const { id, timestamp } = JSON.parse(raw);
    if (id !== gameId) return null;

    const min = Math.floor((Date.now() - timestamp) / 60000);
    if (min < 3)  return 'Just now · still in the zone';
    if (min < 60) return `${min}m ago · the mood is fresh`;
    const h = Math.floor(min / 60);
    if (h < 6)   return `${h}h ago · perfect timing for tonight`;
    if (h < 24)  return 'Earlier today · end the night right';
    return 'Last time you played · revisit the mood';
  } catch {
    return null;
  }
}

/**
 * Controlled game selector — selectedId and onGameChange are owned by the parent.
 * Falls back to localStorage-driven standalone mode if props are not provided.
 *
 * @param {{ selectedId: string, onGameChange: (id: string) => void }} props
 */
export default function GameSelector({ selectedId, onGameChange }) {
  const [sessionCtx, setSessionCtx] = useState(null);
  const { game, movies, isLoading } = useGameToMovie(selectedId);

  useEffect(() => {
    setSessionCtx(getSessionContext(selectedId));
  }, [selectedId]);

  const handleChange = (id) => {
    localStorage.setItem('pm_game_session', JSON.stringify({ id, timestamp: Date.now() }));
    onGameChange?.(id);
  };

  return (
    <section>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">

        {/* Left: label + game name + context */}
        <div className="min-w-0">
          <p className="section-label mb-1">Tonight after playing</p>
          <h2 className="text-base font-bold text-ink leading-snug">
            {game?.emoji} {game?.name}
          </h2>
          {game?.tagline && (
            <p className="text-xs text-ink-light mt-0.5 italic">{game.tagline}</p>
          )}
          {sessionCtx && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-mid">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              {sessionCtx}
            </p>
          )}
        </div>

        {/* Right: game picker */}
        <div className="shrink-0">
          <select
            value={selectedId}
            onChange={e => handleChange(e.target.value)}
            className="text-[13px] border border-line rounded-full pl-3 pr-7 py-1.5 bg-white
                       text-ink-mid focus:outline-none focus:border-ink/30 cursor-pointer
                       appearance-none"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a0a0a0'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.6rem center',
              backgroundSize: '1rem',
            }}
          >
            {GAME_CATALOG.map(g => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Movie row ──────────────────────────────────────────────────────── */}
      <MovieRow movies={movies} isLoading={isLoading} />
    </section>
  );
}
