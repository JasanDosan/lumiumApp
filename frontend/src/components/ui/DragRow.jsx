import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Drag-scrollable horizontal container.
 * - Mouse drag / touch drag (existing)
 * - Mouse wheel / trackpad horizontal swipe (new)
 * - Prev/Next arrow buttons on desktop (new)
 * - Keyboard ArrowLeft / ArrowRight (new)
 */
export default function DragRow({ children, gap = 'gap-4', className = '' }) {
  const rowRef      = useRef(null);
  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startX      = useRef(0);
  const scrollStart = useRef(0);

  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ── Scroll-state updater ──────────────────────────────────────────────────────
  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  // ── Passive listeners + wheel override (passive:false required for preventDefault) ──
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    const onWheel = (e) => {
      if (e.deltaX !== 0 || e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaX || e.deltaY;
      }
      // vertical-only scroll (deltaX===0, no Shift) → let page scroll normally
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // ── Drag handlers (unchanged) ─────────────────────────────────────────────────
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

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    if (!rowRef.current) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      rowRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      rowRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  // ── Arrow button scroll ───────────────────────────────────────────────────────
  const scrollByPage = useCallback((dir) => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.75 * dir, behavior: 'smooth' });
  }, []);

  const arrowBase =
    'rounded-full w-9 h-9 bg-surface/90 backdrop-blur border border-line ' +
    'text-ink-mid hover:text-ink hover:bg-surface-high transition ' +
    'absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center';

  return (
    <div className="relative">
      {/* Left arrow — desktop only */}
      <button
        onClick={() => scrollByPage(-1)}
        aria-label="Scroll left"
        className={`${arrowBase} -left-4 ${canScrollLeft ? 'hidden md:flex' : 'hidden'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Right arrow — desktop only */}
      <button
        onClick={() => scrollByPage(1)}
        aria-label="Scroll right"
        className={`${arrowBase} -right-4 ${canScrollRight ? 'hidden md:flex' : 'hidden'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Scroll container */}
      <div
        ref={rowRef}
        className={`flex ${gap} overflow-x-auto pb-2 cursor-grab select-none ${className}`}
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        tabIndex={0}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
