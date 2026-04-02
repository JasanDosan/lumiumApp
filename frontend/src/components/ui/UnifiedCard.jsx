import { Link } from 'react-router-dom';
import { useGameStore } from '@/features/games/gameStore';

/**
 * Universal landscape (16:9) card for game / movie / series.
 *
 * type: 'game' | 'movie' | 'series'
 *
 * Interaction model:
 *   - If `onClick` is provided → all types use it (inline expansion mode).
 *   - Games with no onClick → default expandGame via store.
 *   - Movies with no onClick → navigate to /movie/:id.
 *   - Series with no onClick → non-interactive display.
 *
 * isActive → shows accent ring (item is currently expanded).
 */

const TYPE_CONFIG = {
  game:   { label: 'GAME',   badge: 'bg-accent',     border: 'bg-accent'     },
  movie:  { label: 'FILM',   badge: 'bg-amber-500',  border: 'bg-amber-500'  },
  series: { label: 'SERIES', badge: 'bg-violet-500', border: 'bg-violet-500' },
};

export default function UnifiedCard({ item, type = 'movie', onClick, isActive = false }) {
  const { expandGame } = useGameStore();

  const cfg    = TYPE_CONFIG[type] ?? TYPE_CONFIG.movie;
  const title  = item.title ?? item.name;
  const image  = item.image ?? item.backdropUrl ?? item.posterUrl ?? null;
  const rating = item.rating;
  const year   = item.releaseDate?.slice(0, 4);

  // onClick overrides navigation for all types (inline expansion).
  // Fallback: games → expandGame store, movies → Link, series → display only.
  const handleClick = onClick ?? (type === 'game' ? () => expandGame(item.id) : null);
  const movieHref   = (!onClick && type === 'movie') ? `/movie/${item.tmdbId}` : null;

  const inner = (
    <div
      className={`group relative w-full overflow-hidden rounded-2xl bg-surface-high
                 shadow-md hover:shadow-2xl transition-all duration-300
                 ${isActive ? 'ring-2 ring-accent ring-offset-2' : ''}`}
      style={{ aspectRatio: '16/9' }}
    >
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high to-canvas flex items-center justify-center">
          {item.emoji && (
            <span className="text-5xl opacity-25 select-none">{item.emoji}</span>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.04] transition-colors duration-300" />

      <span className={`absolute top-2.5 left-2.5 text-[9px] font-black tracking-[0.15em] uppercase
                       px-2 py-0.5 rounded-md text-white ${cfg.badge}`}>
        {cfg.label}
      </span>

      {rating != null && (
        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-white/70
                        bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          ★ {typeof rating === 'number' ? rating.toFixed(1) : String(rating)}
        </span>
      )}

      <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2
                      drop-shadow-sm">
          {title}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {year ?? (type === 'game' && item.price != null
            ? (item.price === 0 ? 'Free to Play' : `$${item.price.toFixed(2)}`)
            : null)}
        </p>
      </div>

      <div className={`absolute bottom-0 inset-x-0 h-[3px] ${cfg.border}
                      opacity-0 group-hover:opacity-100 transition-all duration-300
                      rounded-b-2xl`} />
    </div>
  );

  // All types: button when onClick provided
  if (handleClick) {
    return (
      <button
        onClick={handleClick}
        className="block w-full text-left animate-fade-in focus:outline-none
                   transition-transform duration-300 hover:-translate-y-1"
      >
        {inner}
      </button>
    );
  }

  // Movies without onClick: navigate
  if (movieHref) {
    return (
      <Link
        to={movieHref}
        className="block animate-fade-in transition-transform duration-300 hover:-translate-y-1"
      >
        {inner}
      </Link>
    );
  }

  // Series / display-only
  return (
    <div className="animate-fade-in transition-transform duration-300 hover:-translate-y-1">
      {inner}
    </div>
  );
}
