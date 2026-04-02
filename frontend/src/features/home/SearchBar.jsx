import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchBar({ query, onChange, onClear, placeholder = 'Search films, people…', autoFocus = false }) {
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const [multiResults, setMultiResults] = useState({ movies: [], people: [] });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Fetch multi results for the dropdown
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMultiResults({ movies: [], people: [] });
      setDropdownOpen(false);
      return;
    }
    setLoading(true);
    movieService.searchMulti(debouncedQuery.trim())
      .then(data => {
        setMultiResults(data);
        setDropdownOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && query.trim()) {
      setDropdownOpen(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}&page=1`);
    }
  };

  const handleMovieClick = useCallback((movie) => {
    setDropdownOpen(false);
    navigate(`/movie/${movie.tmdbId}`);
  }, [navigate]);

  const handlePersonClick = useCallback((person) => {
    setDropdownOpen(false);
    navigate(`/person/${person.id}`);
  }, [navigate]);

  const hasDropdown = dropdownOpen && (multiResults.movies.length > 0 || multiResults.people.length > 0);
  const topMovies = multiResults.movies.slice(0, 4);
  const topPeople = multiResults.people.slice(0, 3);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Input */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (multiResults.movies.length || multiResults.people.length) setDropdownOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`
            w-full pl-11 pr-10 py-3 text-sm
            bg-surface border border-line
            text-ink placeholder:text-ink-light
            focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/10
            transition-all duration-150
            ${hasDropdown ? 'rounded-t-2xl rounded-b-none border-b-0' : 'rounded-full'}
          `}
        />
        {query && (
          <button
            onClick={() => { onClear(); setDropdownOpen(false); setMultiResults({ movies: [], people: [] }); }}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {hasDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 bg-surface border border-line border-t-0 rounded-b-2xl shadow-lg overflow-hidden">

          {/* People */}
          {topPeople.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-light">People</p>
              {topPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => handlePersonClick(person)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-100 shrink-0">
                    {person.profileUrl ? (
                      <img src={person.profileUrl} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-faint text-xs">◎</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{person.name}</p>
                    {person.department && (
                      <p className="text-[11px] text-ink-light">{person.department}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Movies */}
          {topMovies.length > 0 && (
            <div>
              <p className={`px-4 pb-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-light ${topPeople.length > 0 ? 'pt-2 border-t border-line mt-1' : 'pt-3'}`}>Films</p>
              {topMovies.map(movie => (
                <button
                  key={movie.tmdbId}
                  onClick={() => handleMovieClick(movie)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-12 rounded overflow-hidden bg-neutral-100 shrink-0">
                    {movie.posterUrl ? (
                      <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-100" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{movie.title}</p>
                    {movie.releaseDate && (
                      <p className="text-[11px] text-ink-light">{movie.releaseDate.slice(0, 4)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="px-4 py-3 text-[13px] text-ink-light">Searching…</div>
          )}

          {/* See all results */}
          {!loading && (topMovies.length > 0 || topPeople.length > 0) && (
            <button
              onClick={() => {
                setDropdownOpen(false);
                navigate(`/search?q=${encodeURIComponent(query.trim())}&page=1`);
              }}
              className="w-full px-4 py-3 text-left text-[12px] font-medium text-ink-mid
                         hover:bg-neutral-50 border-t border-line transition-colors"
            >
              See all results for "{query}" →
            </button>
          )}

          <div className="h-1" />
        </div>
      )}
    </div>
  );
}
