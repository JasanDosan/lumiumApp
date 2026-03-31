import { Link } from 'react-router-dom';

/**
 * Cinematic landscape media card (16:9 aspect ratio).
 * Used in cross-content discovery sections (game → films/series).
 *
 * type: 'movie' | 'tv'
 */

const TYPE_CONFIG = {
  movie: { label: 'FILM',   ring: 'bg-amber-500',  text: 'text-amber-400' },
  tv:    { label: 'SERIES', ring: 'bg-violet-500', text: 'text-violet-400' },
};

export default function LandscapeCard({ item, type = 'movie' }) {
  const cfg  = TYPE_CONFIG[type] ?? TYPE_CONFIG.movie;
  const href = type === 'movie' ? `/movie/${item.tmdbId}` : null;

  // Prefer backdrop (cinematic); fall back to poster
  const image = item.backdropUrl ?? item.posterUrl ?? null;
  const year  = item.releaseDate?.slice(0, 4);

  const inner = (
    <div className="group relative w-full overflow-hidden rounded-xl bg-surface-high"
         style={{ aspectRatio: '16/9' }}>

      {/* Image */}
      {image ? (
        <img
          src={image}
          alt={item.title}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high to-canvas" />
      )}

      {/* Gradient overlay — bottom-heavy for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Hover brightness layer */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />

      {/* Top-left: type badge */}
      <span className={`absolute top-2.5 left-2.5 text-[9px] font-black tracking-[0.15em] uppercase
                        px-2 py-0.5 rounded ${cfg.ring} text-white`}>
        {cfg.label}
      </span>

      {/* Rating top-right */}
      {item.rating != null && (
        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-white/70
                         bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
          ★ {item.rating.toFixed(1)}
        </span>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">
          {item.title}
        </p>
        {year && (
          <p className="text-[11px] text-white/45 mt-0.5">{year}</p>
        )}
      </div>

      {/* Bottom border accent on hover */}
      <div className={`absolute bottom-0 inset-x-0 h-0.5 ${cfg.ring} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </div>
  );

  if (!href) {
    return <div className="cursor-default animate-fade-in">{inner}</div>;
  }

  return (
    <Link to={href} className="block animate-fade-in">
      {inner}
    </Link>
  );
}
