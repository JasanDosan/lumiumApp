import MovieCard from './MovieCard';

export default function MovieGrid({
  movies = [],
  isLoading = false,
  error = null,
  emptyMessage = 'No films found.',
  showScore = false,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] skeleton rounded-md" />
            <div className="mt-2.5 space-y-1.5">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-2.5 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-ink-mid">{error}</p>
      </div>
    );
  }

  if (!movies.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-ink-light">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {movies.map(movie => (
        <MovieCard key={movie.tmdbId} movie={movie} showScore={showScore} />
      ))}
    </div>
  );
}
