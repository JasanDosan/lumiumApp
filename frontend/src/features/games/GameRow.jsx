import { useRef, useCallback } from 'react';
import GameCard from './GameCard';

/**
 * Horizontal drag-scrollable row of GameCards.
 *
 * Props:
 *   games      — array of game entries from GAME_CATALOG
 *   selectedId — highlights the currently selected game
 *   onSelect   — if provided, card clicks call onSelect(id) instead of navigating
 *   cardWidth  — Tailwind width class for each card slot
 */
export default function GameRow({
  games = [],
  selectedId,
  onSelect,
  cardWidth = 'w-44 sm:w-52',
}) {
  const rowRef     = useRef(null);
  const isDragging = useRef(false);
  const didDrag    = useRef(false);
  const startX     = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (!rowRef.current) return;
    isDragging.current  = true;
    didDrag.current     = false;
    startX.current      = e.pageX - rowRef.current.offsetLeft;
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

  const onClickCapture = useCallback((e) => {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  if (!games.length) return null;

  return (
    <div
      ref={rowRef}
      className="flex gap-3 overflow-x-auto pb-2 cursor-grab select-none"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onClickCapture={onClickCapture}
    >
      {games.map(game => (
        <div key={game.id} className={`${cardWidth} flex-shrink-0 pointer-events-auto`}>
          <GameCard
            game={game}
            isSelected={game.id === selectedId}
            onClick={onSelect}
          />
        </div>
      ))}
    </div>
  );
}
