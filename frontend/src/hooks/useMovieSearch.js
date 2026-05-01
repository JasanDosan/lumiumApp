import { useState, useEffect } from 'react';
import { movieService } from '@/services/movieService';
import { useDebounce } from './useDebounce';

export const useMovieSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setTotalPages(0);
      return;
    }

    const controller = new AbortController();

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await movieService.search(debouncedQuery, page);
        setResults(data.results);
        setTotalPages(data.totalPages);
      } catch (err) {
        if (err.name !== 'CanceledError') setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    return () => controller.abort();
  }, [debouncedQuery, page]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setPage(1);
  };

  return { query, setQuery, results, isLoading, error, page, setPage, totalPages, clearSearch };
};
