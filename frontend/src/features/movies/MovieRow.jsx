import { useRef, useCallback } from 'react';
import MovieCard from './MovieCard';

/**
 * Horizontal drag-scrollable movie row.
 * Supports mouse drag, touch, and scroll wheel.
 */
export default function MovieRow({
  movies = [],
  isLoading = false,
  showScore = false,
  cardWidth = 'w-32 sm:w-36',
}) {
  const rowRef = useRef(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (!rowRef.current) return;
    isDragging.current = true;
    didDrag.current = false;
    startX.current = e.pageX - rowRef.current.offsetLeft;
    scrollStart.current = rowRef.current.scrollLeft;
    rowRef.current.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current || !rowRef.current) return;
    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const delta = (x - startX.current) * 1.4;
    if (Math.abs(delta) > 4) didDrag.current = true;
    rowRef.current.scrollLeft = scrollStart.current - delta;
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (rowRef.current) rowRef.current.style.cursor = 'grab';
  }, []);

  // Block click-through after drag
  const onClickCapture = useCallback((e) => {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`${cardWidth} flex-shrink-0`}>
            <div className="aspect-[2/3] skeleton rounded-md" />
            <div className="mt-2.5 space-y-1.5 px-0.5">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-2.5 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!movies.length) return null;

  return (
    <div
      ref={rowRef}
      className="flex gap-4 overflow-x-auto pb-2 cursor-grab select-none"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onClickCapture={onClickCapture}
    >
      {movies.map(movie => (
        <div key={movie.tmdbId} className={`${cardWidth} flex-shrink-0 pointer-events-auto`}>
          <MovieCard
            movie={movie}
            showScore={showScore}
            to={movie.mediaType === 'tv' ? null : undefined}
          />
        </div>
      ))}
    </div>
  );
}
