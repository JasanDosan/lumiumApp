import { Link } from 'react-router-dom';

/**
 * Full-width game hero banner.
 * Used on the HomePage (shows the currently selected game)
 * and on GameDetailPage (shows that page's game).
 *
 * Props:
 *   game    — game entry from GAME_CATALOG
 *   compact — reduces height for secondary contexts
 */
export default function GameHero({ game, compact = false }) {
  if (!game) return null;

  const height = compact ? 'min(52vh, 480px)' : 'min(70vh, 640px)';

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      {/* Background */}
      {game.image ? (
        <img
          src={game.image}
          alt={game.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high via-canvas to-canvas flex items-center justify-center">
          <span className="text-[10rem] opacity-10 select-none">{game.emoji}</span>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-black/20 to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-5 sm:px-8 lg:px-12 pb-12 pt-20 max-w-screen-xl mx-auto">
        <div className="max-w-xl">

          {/* Tags */}
          {game.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {game.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 text-white/65 border border-white/10 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-2">
            {game.name}
          </h1>

          {/* Tagline */}
          <p className="text-sm text-white/60 leading-relaxed max-w-md mb-6">
            {game.tagline}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={`/game/${game.id}`}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Explore Game
            </Link>

            <div className="flex items-center gap-3 text-sm text-white/50">
              {game.rating != null && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {game.rating}
                </span>
              )}
              {game.price != null && (
                <span className="font-semibold text-white/70">
                  {game.price === 0 ? 'Free to Play' : `$${game.price.toFixed(2)}`}
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
