import { useState, useCallback } from 'react';
import DragRow from './DragRow';
import UnifiedCard from './UnifiedCard';
import InlineDetail from './InlineDetail';

/**
 * Drag-scrollable row of mixed content cards (games, movies, series)
 * with unified inline expansion.
 *
 * Props:
 *   items            — [{ item, type }]  where type is 'game' | 'movie' | 'series'
 *   cardWidth        — Tailwind class for card width (default 'w-48 sm:w-56')
 *   gap              — Tailwind gap class (default 'gap-3')
 *   onAddToLibrary   — optional (item, type) => void — enables library button on each card
 *   libraryCheck     — optional (item, type) => bool — returns true if item is already saved
 */
export default function ExpandableRow({
  items = [],
  cardWidth = 'w-48 sm:w-56',
  gap = 'gap-3',
  onAddToLibrary,
  libraryCheck,
}) {
  const [expanded, setExpanded] = useState(null); // { item, type, key } | null

  const handleClick = useCallback((item, type) => {
    const key = `${type}-${item.id ?? item.tmdbId}`;
    setExpanded(prev => (prev?.key === key ? null : { item, type, key }));
  }, []);

  if (!items.length) return null;

  return (
    <div>
      <DragRow gap={gap}>
        {items.map(({ item, type }) => {
          const key      = `${type}-${item.id ?? item.tmdbId}`;
          const isActive = expanded?.key === key;

          return (
            <div key={key} className={`shrink-0 ${cardWidth} pointer-events-auto`}>
              <UnifiedCard
                item={item}
                type={type}
                onClick={() => handleClick(item, type)}
                isActive={isActive}
                onAddToLibrary={onAddToLibrary ? () => onAddToLibrary(item, type) : undefined}
                isInLibrary={libraryCheck ? libraryCheck(item, type) : false}
              />
            </div>
          );
        })}
      </DragRow>

      <InlineDetail
        item={expanded?.item ?? null}
        type={expanded?.type ?? 'movie'}
        isOpen={!!expanded}
        onClose={() => setExpanded(null)}
      />
    </div>
  );
}
