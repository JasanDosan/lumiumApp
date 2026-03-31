import { Link } from 'react-router-dom';

/**
 * Standard section container: label + title + optional "see all" link + content.
 */
export default function SectionWrapper({ label, title, seeAllTo, children, className = '' }) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          {label && <p className="section-label mb-1">{label}</p>}
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
        </div>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="text-xs text-ink-light hover:text-ink transition-colors shrink-0"
          >
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
