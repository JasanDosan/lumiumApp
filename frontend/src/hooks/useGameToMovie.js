import { useState, useEffect } from 'react';
import { movieService } from '@/services/movieService';
import { GAME_CATALOG, translateMetaToTMDB } from '@/data/gameMovieTags';

/**
 * Fetches movie recommendations for a given game via the Mood Transfer Engine.
 *
 * Converts game.meta → TMDB discover params via translateMetaToTMDB(),
 * then fetches the first page and returns up to 16 results.
 *
 * @param {string|null} gameId - ID from GAME_CATALOG
 * @returns {{ game: object|null, movies: object[], isLoading: boolean }}
 */
export function useGameToMovie(gameId) {
  const [movies, setMovies]     = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const game = GAME_CATALOG.find(g => g.id === gameId) ?? null;

  useEffect(() => {
    if (!gameId) { setMovies([]); return; }

    const g = GAME_CATALOG.find(entry => entry.id === gameId);
    if (!g) return;

    const filters = translateMetaToTMDB(g.meta);

    let cancelled = false;
    setIsLoading(true);

    movieService
      .discover({ ...filters, page: 1 })
      .then(data => {
        if (!cancelled) setMovies((data.results || []).slice(0, 16));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [gameId]);

  return { game, movies, isLoading };
}
