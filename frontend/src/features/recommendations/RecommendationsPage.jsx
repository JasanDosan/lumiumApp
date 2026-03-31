import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import MovieGrid from '@/features/movies/MovieGrid';

export default function RecommendationsPage() {
  const { favorites } = useFavoritesStore();
  const [movies, setMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasEnoughFavorites = favorites.length >= 2;

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await movieService.getRecommendations();
      setMovies(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasEnoughFavorites) fetchRecommendations();
  }, []); // eslint-disable-line

  if (!hasEnoughFavorites) {
    return (
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-20">
        <div className="max-w-xs">
          <p className="section-label mb-2">Not enough data</p>
          <h1 className="text-xl font-semibold text-ink mb-2">Add more films first</h1>
          <p className="text-sm text-ink-light leading-relaxed mb-6">
            You need at least 2 saved films.
            You currently have {favorites.length}.
          </p>
          <Link to="/" className="text-sm text-ink-mid hover:text-ink transition-colors">
            Browse films →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">

      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="section-label mb-1">Picked for you</p>
          <h1 className="text-2xl font-semibold text-ink">Recommendations</h1>
          {favorites[0]?.title && (
            <p className="text-sm text-ink-light mt-1">
              Because you watched <span className="text-ink-mid">{favorites[0].title}</span>
              {favorites.length > 1 && ` + ${favorites.length - 1} other${favorites.length > 2 ? 's' : ''}`}
            </p>
          )}
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-sm text-ink-light hover:text-ink
                     transition-colors disabled:opacity-40"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      <MovieGrid
        movies={movies}
        isLoading={isLoading}
        error={error}
        emptyMessage="No recommendations yet. Try adding more diverse films."
        showScore
      />
    </div>
  );
}
