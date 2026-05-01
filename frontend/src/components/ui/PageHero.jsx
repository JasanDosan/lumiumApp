/**
 * PageHero — editorial page-level hero.
 *
 * Creates a full-height (or min-height constrained) editorial entry point
 * for Discover, Library, For You, and other primary destinations.
 *
 * Props:
 *   eyebrow     — tiny uppercase overline
 *   headline    — large hero heading (uses headline-xl by default, 'display' if size="display")
 *   subline     — supporting paragraph (body-lead)
 *   size        — 'default' (headline-xl) | 'display'
 *   eyebrowColor — Tailwind color class, e.g. 'text-accent', 'text-amber-400'
 *   minHeight   — e.g. '65vh' (default), '80vh', '55vh'
 *   align       — 'left' (default) | 'center'
 *   zone        — 'canvas' | 'surface' | 'deep'
 *   children    — optional slot for stat badges, CTAs, etc.
 */
export default function PageHero({
  eyebrow,
  headline,
  subline,
  size          = 'default',
  eyebrowColor  = 'text-accent',
  minHeight     = '65vh',
  align         = 'left',
  zone          = 'canvas',
  children      = null,
}) {
  const zoneBg = {
    canvas:  'bg-canvas',
    surface: 'bg-surface',
    deep:    'bg-zone-deep',
  }[zone] ?? 'bg-canvas';

  const headlineClass = size === 'display' ? 'display' : 'headline-xl';

  const alignCls = align === 'center'
    ? 'items-center text-center'
    : 'items-start text-left';

  return (
    <div
      className={`${zoneBg} flex flex-col justify-center px-6 sm:px-12 lg:px-20 pt-8 pb-16`}
      style={{ minHeight }}
    >
      <div className={`max-w-[1280px] mx-auto w-full flex flex-col ${alignCls}`}>
        {eyebrow && (
          <p className={`eyebrow ${eyebrowColor} mb-6`}>{eyebrow}</p>
        )}
        {headline && (
          <h1 className={`${headlineClass} text-ink ${align === 'center' ? 'max-w-3xl' : 'max-w-4xl'} mb-6`}>
            {headline}
          </h1>
        )}
        {subline && (
          <p className={`body-lead text-ink-mid ${align === 'center' ? 'max-w-xl' : 'max-w-2xl'} mb-0`}>
            {subline}
          </p>
        )}
        {children && (
          <div className="mt-10 w-full">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
