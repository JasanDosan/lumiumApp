import { useRef, useCallback } from 'react';

/**
 * Drag-scrollable horizontal container.
 * Drop-in for any row that needs mouse drag + touch support.
 */
export default function DragRow({ children, gap = 'gap-4', className = '' }) {
  const rowRef      = useRef(null);
  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startX      = useRef(0);
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

  return (
    <div
      ref={rowRef}
      className={`flex ${gap} overflow-x-auto pb-2 cursor-grab select-none ${className}`}
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
}
