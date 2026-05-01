export default function Input({
  label,
  error,
  hint,
  className = '',
  containerClassName = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-medium text-ink-mid tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-3 rounded-xl text-sm
          bg-surface border border-line
          text-ink placeholder:text-ink-light
          focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
          transition-all duration-150
          disabled:opacity-50
          ${error ? 'border-red focus:border-red focus:ring-red/20' : ''}
          ${className}
        `}
        {...props}
      />
      {hint && !error && <p className="text-xs text-ink-light">{hint}</p>}
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
