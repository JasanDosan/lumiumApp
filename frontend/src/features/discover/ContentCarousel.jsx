import SectionWrapper from '@/components/ui/SectionWrapper';
import MovieRow from '@/features/movies/MovieRow';

/**
 * Reusable horizontal carousel section.
 *
 * Renders nothing if not loading and items is empty — allows conditional
 * sections (e.g. auth-gated recommendations) to disappear cleanly.
 *
 * @param {{
 *   label: string,
 *   title: string,
 *   items: object[],
 *   isLoading: boolean,
 *   cardWidth?: string,
 *   showScore?: boolean,
 * }} props
 */
export default function ContentCarousel({
  label,
  title,
  items,
  isLoading,
  cardWidth,
  showScore = false,
}) {
  if (!isLoading && items.length === 0) return null;

  return (
    <SectionWrapper label={label} title={title}>
      <MovieRow
        movies={items}
        isLoading={isLoading}
        cardWidth={cardWidth}
        showScore={showScore}
      />
    </SectionWrapper>
  );
}
