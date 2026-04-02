import { Link } from 'react-router-dom';
import { useUserLibraryStore, normalizeMovie } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';

export default function HeroMovie({ movie }) {
  const { addItem, removeItem, hasMovie } = useUserLibraryStore();
  const { isAuthenticated } = useAuthStore();

  if (!movie) return null;

  const saved = hasMovie(movie.tmdbId);
  const year = movie.releaseDate?.slice(0, 4);
  const rating = movie.rating ? movie.rating.toFixed(1) : null;

  const handleSave = (e) => {
    e.preventDefault();
    if (saved) removeItem(`movie_${Number(movie.tmdbId)}`);
    else addItem(normalizeMovie(movie));
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'min(72vh, 680px)' }}>
      {/* Backdrop */}
      {movie.backdropUrl && (
        <img
          src={movie.backdropUrl}
          alt={movie.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-5 sm:px-8 lg:px-12 pb-12 pt-20 max-w-screen-xl mx-auto">
        <div className="max-w-lg">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-white/60">
              Trending now
            </p>
            {year && <span className="text-[10px] text-white/40">·</span>}
            {year && <p className="text-[10px] text-white/60">{year}</p>}
            {rating && <span className="text-[10px] text-white/40">·</span>}
            {rating && (
              <p className="text-[10px] text-white/60">★ {rating}</p>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-3 tracking-tight">
            {movie.title}
          </h1>

          {/* Overview */}
          {movie.overview && (
            <p className="text-sm text-white/70 leading-relaxed line-clamp-3 mb-6 max-w-md">
              {movie.overview}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              to={`/movie/${movie.tmdbId}`}
              className="inline-flex items-center gap-2 bg-white text-ink text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-white/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              More info
            </Link>
            {isAuthenticated && (
              <button
                onClick={handleSave}
                className={`inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full border transition-colors ${
                  saved
                    ? 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                    : 'bg-transparent border-white/30 text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg className={`w-4 h-4 ${saved ? 'fill-white stroke-white' : 'fill-none stroke-current'}`} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
