import { useLibraryStore } from '@/features/library/libraryStore';
import { useFavoritesStore } from './favoritesStore';
import { Link } from 'react-router-dom';
import MovieGrid from '@/features/movies/MovieGrid';

export default function FavoritesPage() {
  // libraryStore is the live source of truth; favoritesStore provides loading state
  const { movies } = useLibraryStore();
  const { isLoading } = useFavoritesStore();

  return (
    <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">

      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="section-label mb-1">Your library</p>
          <h1 className="text-2xl font-semibold text-ink">Collection</h1>
          {!isLoading && (
            <p className="text-sm text-ink-light mt-1">
              {movies.length} {movies.length === 1 ? 'film' : 'films'}
            </p>
          )}
        </div>
        {!isLoading && movies.length >= 2 && (
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-1.5 text-sm text-ink-mid hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Recommendations
          </Link>
        )}
      </div>

      <MovieGrid
        movies={movies}
        isLoading={isLoading}
        emptyMessage="Nothing saved yet — browse films and hit the bookmark to save them."
      />

      {!isLoading && movies.length === 0 && (
        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-ink-mid hover:text-ink transition-colors">
            Browse films →
          </Link>
        </div>
      )}
    </div>
  );
}
