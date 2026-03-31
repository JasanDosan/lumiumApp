import { Link } from 'react-router-dom';

/**
 * Universal landscape (16:9) card for game / movie / series.
 *
 * type: 'game' | 'movie' | 'series'
 *
 * Item shape:
 *   Game:   { id, name, image, emoji, rating, tags }
 *   Movie:  { tmdbId, title, backdropUrl, posterUrl, rating, releaseDate }
 *   Series: { tmdbId, title, backdropUrl, posterUrl, rating, releaseDate }
 */

const TYPE_CONFIG = {
  game:   { label: 'GAME',   badge: 'bg-accent',    border: 'bg-accent' },
  movie:  { label: 'FILM',   badge: 'bg-amber-500', border: 'bg-amber-500' },
  series: { label: 'SERIES', badge: 'bg-violet-500', border: 'bg-violet-500' },
};

export default function UnifiedCard({ item, type = 'movie' }) {
  const cfg   = TYPE_CONFIG[type] ?? TYPE_CONFIG.movie;
  const title = item.title ?? item.name;

  // Resolve image: games use item.image, media uses backdropUrl → posterUrl
  const image = item.image ?? item.backdropUrl ?? item.posterUrl ?? null;

  // Rating: games have raw number, media has TMDB rating
  const rating = item.rating;

  // Year (movies/series only)
  const year = item.releaseDate?.slice(0, 4);

  // Href
  let href = null;
  if (type === 'game')  href = `/game/${item.id}`;
  if (type === 'movie') href = `/movie/${item.tmdbId}`;
  // series: no detail page → href = null

  const inner = (
    <div
      className="group relative w-full overflow-hidden rounded-xl bg-surface-high"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Image */}
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high to-canvas flex items-center justify-center">
          {item.emoji && (
            <span className="text-5xl opacity-25 select-none">{item.emoji}</span>
          )}
        </div>
      )}

      {/* Bottom gradient for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Hover brightness overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />

      {/* Type badge — always visible */}
      <span className={`absolute top-2.5 left-2.5 text-[9px] font-black tracking-[0.15em] uppercase
                       px-2 py-0.5 rounded text-white ${cfg.badge}`}>
        {cfg.label}
      </span>

      {/* Rating */}
      {rating != null && (
        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-white/70
                        bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
          ★ {typeof rating === 'number' ? rating.toFixed(1) : rating}
        </span>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {year ?? (type === 'game' && item.price != null
            ? (item.price === 0 ? 'Free to Play' : `$${item.price.toFixed(2)}`)
            : null)}
        </p>
      </div>

      {/* Bottom accent border on hover */}
      <div className={`absolute bottom-0 inset-x-0 h-0.5 ${cfg.border}
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </div>
  );

  if (!href) {
    return (
      <div className="animate-fade-in" style={{ cursor: type === 'series' ? 'default' : 'pointer' }}>
        {inner}
      </div>
    );
  }

  return (
    <Link to={href} className="block animate-fade-in">
      {inner}
    </Link>
  );
}
