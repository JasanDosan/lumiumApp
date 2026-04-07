import { Link } from 'react-router-dom';
import { useUserLibraryStore, normalizeMovie } from '@/features/library/libraryStore';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const FALLBACK = '/placeholder-poster.svg';

/**
 * @param {{ movie, showScore?: boolean, to?: string|null }} props
 *
 * `to` overrides the default link target `/movie/:tmdbId`.
 * Pass `to={null}` for items with no detail page (e.g. TV shows).
 */
export default function MovieCard({ movie, showScore = false, to }) {
  const { addItem, removeItem, hasMovie } = useUserLibraryStore();

  const saved = hasMovie(movie.tmdbId);
  const poster = movie.posterPath ? `${IMAGE_BASE}${movie.posterPath}` : FALLBACK;
  const href = to !== undefined ? to : `/movie/${movie.tmdbId}`;

  const toggleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) removeItem(`movie_${Number(movie.tmdbId)}`);
    else addItem(normalizeMovie(movie));
  };

  const inner = (
    <>
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-high">
        <img
          src={poster}
          alt={movie.title}
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          onError={(e) => { e.currentTarget.src = FALLBACK; }}
        />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 rounded-md" />

        {showScore && movie.score != null && (
          <div className="group/score absolute top-2 left-2 z-10">
            {/* Score badge */}
            <div className="bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-default">
              {movie.score.toFixed(1)}
            </div>

            {/* Explanation tooltip — only rendered when data is present */}
            {movie.explanation?.length > 0 && (
              <div
                className="pointer-events-none absolute top-full left-0 mt-1.5
                           hidden group-hover/score:block
                           bg-black/90 backdrop-blur-sm text-white rounded-xl
                           px-3 py-2.5 w-48 space-y-1 shadow-lg"
              >
                {movie.explanation.map((line, i) => (
                  <p key={i} className="text-[10px] leading-snug">
                    {i === 0 ? '★ ' : '· '}{line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Type badge — always visible when mediaType is set */}
        {movie.mediaType && (
          <span className={`absolute bottom-2 left-2 text-[9px] font-black tracking-[0.12em] uppercase
                           px-2 py-0.5 rounded text-white
                           ${movie.mediaType === 'tv' ? 'bg-violet-500' : 'bg-amber-500'}`}>
            {movie.mediaType === 'tv' ? 'SERIES' : 'FILM'}
          </span>
        )}

        {/* Save button (library + favorites) */}
        {href && (
          <button
            onClick={toggleSave}
            aria-label={saved ? 'Remove from library' : 'Add to library'}
            className={`
              absolute top-2 right-2 p-1.5 rounded-full
              transition-all duration-200
              ${saved
                ? 'opacity-100 bg-black/70 text-accent-light'
                : 'opacity-0 group-hover:opacity-100 bg-black/60 text-white/60 hover:text-accent-light backdrop-blur-sm'
              }
            `}
          >
            <svg className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Meta — below poster */}
      <div className="mt-2.5 px-0.5">
        <p className="text-[13px] font-medium text-ink leading-snug line-clamp-1">
          {movie.title}
        </p>
        {movie.releaseDate && (
          <p className="text-xs text-ink-light mt-0.5">
            {new Date(movie.releaseDate).getFullYear()}
          </p>
        )}
      </div>
    </>
  );

  if (!href) {
    return <div className="group block animate-fade-in cursor-default">{inner}</div>;
  }

  return (
    <Link to={href} className="group block animate-fade-in">
      {inner}
    </Link>
  );
}
