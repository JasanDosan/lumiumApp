/**
 * SectionBlock — unified section header used across all pages.
 * Translates the Process Academy editorial chapter-header pattern into Lumium.
 *
 * Structure: eyebrow (overline) → headline → optional subline → optional action
 *
 * Props:
 *   overline  — small uppercase eyebrow label
 *   title     — section heading
 *   subline   — optional supporting sentence
 *   color     — 'accent' | 'amber' | 'violet' | 'default'
 *   size      — 'sm' (title-lg) | 'md' (headline-md) | 'lg' (headline-lg) | 'xl' (headline-xl)
 *   count     — optional result count
 *   action    — optional JSX rendered to the right
 *   mb        — bottom margin override class (default 'mb-10')
 */
export default function SectionBlock({
  overline  = null,
  title,
  subline   = null,
  color     = 'default',
  size      = 'md',
  count     = null,
  action    = null,
  mb        = 'mb-6',
}) {
  const colorMap = {
    accent:  'text-accent',
    amber:   'text-amber-400',
    violet:  'text-violet-400',
    default: 'text-ink-light',
  };
  const eyebrowColor = colorMap[color] ?? colorMap.default;

  const titleClass =
    size === 'xl' ? 'headline-xl' :
    size === 'lg' ? 'headline-lg' :
    size === 'md' ? 'headline-md' :
    'title-lg';

  return (
    <div className={`${mb}`}>
      {/* Eyebrow + optional action row */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          {overline && (
            <p className={`eyebrow ${eyebrowColor} mb-2`}>{overline}</p>
          )}
          <h2 className={`${titleClass} text-ink`}>{title}</h2>
          {subline && (
            <p className="body-lead text-ink-mid mt-2 max-w-2xl">{subline}</p>
          )}
        </div>
        {(count != null || action) && (
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {count != null && (
              <span className="text-xs text-ink-light">
                {count} result{count !== 1 ? 's' : ''}
              </span>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
