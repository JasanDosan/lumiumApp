import { Link } from 'react-router-dom';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import { toast } from '@/stores/toastStore';

// ─── Type configuration ───────────────────────────────────────────────────────

const TYPE_CFG = {
  game:   { label: 'GAME',   badge: 'bg-accent',     ring: 'hover:ring-accent/40'   },
  movie:  { label: 'FILM',   badge: 'bg-amber-500',  ring: 'hover:ring-amber-500/40' },
  series: { label: 'SERIES', badge: 'bg-violet-500', ring: 'hover:ring-violet-500/40' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function releaseYear(item) {
  const d = item.releaseDate ?? item.addedAt;
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y) ? null : y;
}

function detailHref(item) {
  if (item.type === 'movie')  return `/movie/${item.tmdbId ?? item.externalId}`;
  if (item.type === 'series') return `/series/${item.tmdbId ?? item.externalId}`;
  if (item.type === 'game')   return `/game/${item.rawId ?? item.externalId}`;
  return null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function LibraryCardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] skeleton rounded-xl" />
      <div className="mt-2 space-y-1.5">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-2.5 w-1/3 rounded" />
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function LibraryCard({ item }) {
  const { removeItem } = useUserLibraryStore();

  const cfg   = TYPE_CFG[item.type] ?? TYPE_CFG.movie;
  const href  = detailHref(item);
  const year  = releaseYear(item);
  const image = item.imageUrl ?? item.image ?? item.posterUrl ?? null;
  const title = item.title ?? item.name ?? '—';

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeItem(item.id);
    toast('Removed from library');
  };

  const poster = (
    <div
      className={`group relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-high
                  ring-1 ring-transparent transition-all duration-300 ${cfg.ring}
                  shadow-sm hover:shadow-xl hover:-translate-y-0.5`}
    >
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-400
                     ease-out group-hover:scale-[1.04]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high to-canvas
                        flex items-center justify-center">
          {item.emoji ? (
            <span className="text-5xl opacity-20 select-none">{item.emoji}</span>
          ) : (
            <svg className="w-8 h-8 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14
                   M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {/* Type badge */}
      <span className={`absolute top-2 left-2 text-[9px] font-black tracking-[0.14em] uppercase
                        px-1.5 py-0.5 rounded text-white ${cfg.badge}`}>
        {cfg.label}
      </span>

      {/* Rating pill */}
      {item.rating != null && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold text-white/80
                         bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
          ★ {typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}
        </span>
      )}

      {/* Remove button — visible on hover */}
      <button
        onClick={handleRemove}
        aria-label={`Remove ${title} from library`}
        className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-sm
                   text-white/50 hover:text-red hover:bg-black/80
                   opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  const meta = (
    <div className="mt-2 px-0.5">
      <p className="text-[13px] font-medium text-ink leading-snug line-clamp-2">{title}</p>
      {year && <p className="text-[11px] text-ink-light mt-0.5">{year}</p>}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block animate-fade-in">
        {poster}
        {meta}
      </Link>
    );
  }

  return (
    <div className="animate-fade-in">
      {poster}
      {meta}
    </div>
  );
}
