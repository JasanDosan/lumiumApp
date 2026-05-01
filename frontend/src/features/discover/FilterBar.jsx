import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

const SORT_OPTIONS = [
  { value: 'popularity.desc',           label: 'Most popular' },
  { value: 'vote_average.desc',         label: 'Highest rated' },
  { value: 'primary_release_date.desc', label: 'Newest' },
  { value: 'revenue.desc',              label: 'Box office' },
];

export default function FilterBar({ genres = [], filters, onChange }) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 380);

  useEffect(() => {
    onChange(prev => ({ ...prev, search: debouncedSearch || undefined }));
  }, [debouncedSearch]); // eslint-disable-line

  const toggleGenre = (id) => {
    const current = filters.genres || [];
    const next = current.includes(id)
      ? current.filter(g => g !== id)
      : [...current, id];
    onChange(prev => ({ ...prev, genres: next.length ? next : undefined }));
  };

  const set = (key, value) =>
    onChange(prev => ({ ...prev, [key]: value || undefined }));

  const hasActiveFilters =
    (filters.genres?.length > 0) ||
    filters.year_gte || filters.year_lte ||
    filters.rating_gte || searchInput ||
    filters.with_person;

  const clearAll = () => {
    setSearchInput('');
    onChange({});
  };

  const clearPerson = () =>
    onChange(prev => ({ ...prev, with_person: undefined, personName: undefined }));

  const inputClass = `text-[13px] border border-line rounded-full bg-surface text-ink
                      placeholder:text-ink-light focus:outline-none focus:border-line/60`;

  return (
    <div className="sticky top-14 z-40 bg-canvas/95 backdrop-blur-md border-b border-line">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-3 space-y-3">

        {/* Row 1: search + controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-44 sm:w-52">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-light pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search films…"
              className={`${inputClass} w-full pl-8 pr-3 py-2`}
            />
          </div>

          {/* Sort */}
          <select
            value={filters.sort_by || 'popularity.desc'}
            onChange={e => set('sort_by', e.target.value)}
            className={`${inputClass} px-3 py-2 cursor-pointer`}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Year range */}
          <div className="hidden sm:flex items-center gap-1.5">
            <input
              type="number" placeholder="From" min={1900} max={2025}
              value={filters.year_gte || ''}
              onChange={e => set('year_gte', e.target.value)}
              className={`${inputClass} w-[4.5rem] px-3 py-2`}
            />
            <span className="text-ink-faint text-xs">–</span>
            <input
              type="number" placeholder="To" min={1900} max={2025}
              value={filters.year_lte || ''}
              onChange={e => set('year_lte', e.target.value)}
              className={`${inputClass} w-[4.5rem] px-3 py-2`}
            />
          </div>

          {/* Min rating */}
          <select
            value={filters.rating_gte || ''}
            onChange={e => set('rating_gte', e.target.value)}
            className={`hidden md:block ${inputClass} px-3 py-2 cursor-pointer`}
          >
            <option value="">Any rating</option>
            {[6, 7, 7.5, 8, 8.5].map(r => (
              <option key={r} value={r}>★ {r}+</option>
            ))}
          </select>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-[13px] text-ink-light hover:text-ink transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Person filter pill */}
        {filters.with_person && filters.personName && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[12px] bg-accent/20 text-accent px-3 py-1 rounded-full border border-accent/30">
              <span>Person: {filters.personName}</span>
              <button
                onClick={clearPerson}
                className="ml-1 hover:opacity-70 transition-opacity"
                aria-label="Remove person filter"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Row 2: genre pills */}
        {genres.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-0.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {genres.map(g => {
              const active = (filters.genres || []).includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className={`
                    flex-shrink-0 text-[12px] px-3 py-1 rounded-full border transition-all duration-150
                    ${active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-ink-mid border-line hover:border-line/60 hover:text-ink'
                    }
                  `}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
