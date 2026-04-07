import { useRef, useCallback } from 'react';

// ─── Drag-scroll hook ─────────────────────────────────────────────────────────

function useDragScroll() {
  const ref        = useRef(null);
  const isDragging = useRef(false);
  const didDrag    = useRef(false);
  const startX     = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (!ref.current) return;
    isDragging.current  = true;
    didDrag.current     = false;
    startX.current      = e.pageX - ref.current.offsetLeft;
    scrollStart.current = ref.current.scrollLeft;
    ref.current.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const delta = (e.pageX - ref.current.offsetLeft - startX.current) * 1.4;
    if (Math.abs(delta) > 4) didDrag.current = true;
    ref.current.scrollLeft = scrollStart.current - delta;
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (ref.current) ref.current.style.cursor = 'grab';
  }, []);

  const onClickCapture = useCallback((e) => {
    if (didDrag.current) { e.preventDefault(); e.stopPropagation(); }
  }, []);

  return { ref, onMouseDown, onMouseMove, stopDrag, onClickCapture };
}

// ─── HScrollRow ───────────────────────────────────────────────────────────────
/**
 * Drag-scrollable horizontal row with optional loading skeleton.
 *
 * Props:
 *   isLoading     — show skeleton instead of children
 *   skeletonCount — number of skeleton cards
 *   skeletonAspect — Tailwind aspect string used in skeleton (default "2/3" → portrait)
 *   skeletonWidth  — Tailwind width class for each skeleton card (default "w-28")
 */
export default function HScrollRow({
  children,
  isLoading     = false,
  skeletonCount = 7,
  skeletonAspect = '2/3',
  skeletonWidth  = 'w-28',
}) {
  const drag = useDragScroll();

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className={`shrink-0 ${skeletonWidth}`}>
            <div className={`skeleton aspect-[${skeletonAspect}] rounded-md`} />
            <div className="skeleton h-3 w-20 mt-2 rounded" />
            <div className="skeleton h-2.5 w-14 mt-1.5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={drag.ref}
      className="flex gap-4 overflow-x-auto pb-2 cursor-grab select-none"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.stopDrag}
      onMouseLeave={drag.stopDrag}
      onClickCapture={drag.onClickCapture}
    >
      {children}
    </div>
  );
}
