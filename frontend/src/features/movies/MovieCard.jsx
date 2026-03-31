import { Link } from 'react-router-dom';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const FALLBACK = '/placeholder-poster.svg';

/**
 * @param {{ movie, showScore?: boolean, to?: string|null }} props
 *
 * `to` overrides the default link target `/movie/:tmdbId`.
 * Pass `to={null}` for items with no detail page (e.g. TV shows).
 */
export default function MovieCard({ movie, showScore = false, to }) {
  const { isFavorite, add, remove } = useFavoritesStore();
  const favorited = isFavorite(movie.tmdbId);
  const poster = movie.posterPath ? `${IMAGE_BASE}${movie.posterPath}` : FALLBACK;
  const href = to !== undefined ? to : `/movie/${movie.tmdbId}`;

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    favorited ? remove(movie.tmdbId) : add(movie);
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
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {movie.score.toFixed(1)}
          </div>
        )}

        {/* TV badge */}
        {movie.mediaType === 'tv' && (
          <span className="absolute bottom-2 left-2 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded">
            SERIES
          </span>
        )}

        {/* Favorite button (only for items with a detail page) */}
        {href && (
          <button
            onClick={toggleFavorite}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            className={`
              absolute top-2 right-2 p-1.5 rounded-full
              transition-all duration-200
              ${favorited
                ? 'opacity-100 bg-black/70 text-red-400'
                : 'opacity-0 group-hover:opacity-100 bg-black/60 text-white/60 hover:text-red-400 backdrop-blur-sm'
              }
            `}
          >
            <svg className="w-3.5 h-3.5" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
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
