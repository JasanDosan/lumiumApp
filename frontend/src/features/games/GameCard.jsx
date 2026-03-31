import { Link } from 'react-router-dom';

const FALLBACK_BG = '#1e1e22';

/**
 * Landscape game card — Steam header image format (460×215 ratio).
 *
 * Props:
 *   game       — game entry from GAME_CATALOG
 *   isSelected — renders accent ring (used in library row)
 *   onClick    — if provided, renders as a button (for in-page selection).
 *                if omitted, renders as a Link to /game/:id.
 */
export default function GameCard({ game, isSelected = false, onClick }) {
  const inner = (
    <>
      {/* Image — 460:215 Steam header ratio */}
      <div
        className={`relative overflow-hidden rounded-md transition-all duration-200 ${
          isSelected ? 'ring-2 ring-accent ring-offset-1 ring-offset-canvas' : ''
        }`}
        style={{ aspectRatio: '460/215', background: FALLBACK_BG }}
      >
        {game.image ? (
          <img
            src={game.image}
            alt={game.name}
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-high to-canvas">
            <span className="text-5xl opacity-50 select-none">{game.emoji}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 rounded-md" />

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" />
        )}

        {/* Type badge */}
        <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wide bg-black/60 text-white/80 px-1.5 py-0.5 rounded">
          GAME
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2 px-0.5">
        <p className="text-[13px] font-medium text-ink leading-snug line-clamp-1">
          {game.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {game.price != null && (
            <p className={`text-[12px] font-semibold ${isSelected ? 'text-accent' : 'text-ink-mid'}`}>
              {game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`}
            </p>
          )}
          {game.rating != null && (
            <p className="text-[11px] text-ink-light">★ {game.rating}</p>
          )}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={() => onClick(game.id)}
        className="group block text-left w-full animate-fade-in"
        aria-pressed={isSelected}
        aria-label={`Select ${game.name}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link to={`/game/${game.id}`} className="group block animate-fade-in">
      {inner}
    </Link>
  );
}
