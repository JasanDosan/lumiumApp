/**
 * ContentBand — full-bleed editorial section zone.
 *
 * Each ContentBand is a visual "chapter" on the page.
 * Background zones create the Process Academy-style section differentiation:
 * pages are navigated by colour as much as by scroll position.
 *
 * Props:
 *   zone        — 'canvas' | 'surface' | 'deep' | 'accent-tint'
 *   size        — 'compact' | 'default' | 'lg' | 'hero'
 *   contained   — if true (default), wraps children in max-width container
 *   topBorder   — if true, renders a thin separator line at the top
 *   className   — additional classes on the outer band
 *   innerClass  — additional classes on the inner container
 *   children
 */
export default function ContentBand({
  zone        = 'canvas',
  size        = 'default',
  contained   = true,
  topBorder   = false,
  className   = '',
  innerClass  = '',
  children,
}) {
  const zoneCls = {
    canvas:        'bg-canvas',
    surface:       'bg-surface',
    deep:          'bg-zone-deep',
    'accent-tint': 'bg-surface',
  }[zone] ?? 'bg-canvas';

  const paddingCls = {
    compact: 'py-14 sm:py-20',
    default: 'py-20 sm:py-24 lg:py-28',
    lg:      'py-24 sm:py-32 lg:py-36',
    hero:    'py-28 sm:py-36 lg:py-44',
  }[size] ?? 'py-20 sm:py-24 lg:py-28';

  const borderCls  = topBorder ? 'border-t border-line' : '';

  // Accent tint zone gets a purple overlay at 3% opacity
  const accentOverlay = zone === 'accent-tint'
    ? 'relative after:absolute after:inset-0 after:bg-accent/[0.03] after:pointer-events-none after:z-0'
    : '';

  const innerContent = contained ? (
    <div className={`relative z-[1] max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20 ${innerClass}`}>
      {children}
    </div>
  ) : (
    <div className={`relative z-[1] ${innerClass}`}>{children}</div>
  );

  return (
    <div className={`${zoneCls} ${paddingCls} ${borderCls} ${accentOverlay} ${className}`}>
      {innerContent}
    </div>
  );
}
