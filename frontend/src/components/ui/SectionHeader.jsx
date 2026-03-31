export default function SectionHeader({ label, title, action, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between mb-5 ${className}`}>
      <div>
        {label && <p className="section-label mb-1">{label}</p>}
        {title && (
          <h2 className="text-xl font-semibold text-ink leading-tight">{title}</h2>
        )}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}
