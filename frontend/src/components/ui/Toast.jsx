import { useToastStore } from '@/stores/toastStore';

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
    </svg>
  );
}

function ToastItem({ toast: t }) {
  const remove = useToastStore(s => s.remove);

  const isError = t.type === 'error';
  const dotColor = isError ? 'bg-red' : 'bg-accent';
  const iconColor = isError ? 'text-red' : 'text-accent';

  return (
    <div
      role="status"
      className="flex items-center gap-3 pl-4 pr-2 py-3 rounded-xl shadow-2xl border
                 bg-surface border-line text-sm font-medium text-ink
                 animate-slide-up min-w-[200px] max-w-[340px]"
    >
      {/* Status dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />

      {/* Icon */}
      <span className={iconColor}>
        {isError ? <XIcon /> : <CheckIcon />}
      </span>

      {/* Message */}
      <span className="flex-1 leading-snug">{t.message}</span>

      {/* Dismiss */}
      <button
        onClick={() => remove(t.id)}
        aria-label="Dismiss notification"
        className="shrink-0 w-7 h-7 ml-1 flex items-center justify-center rounded-lg
                   text-ink-light hover:text-ink hover:bg-surface-high transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Mount once in App.jsx — renders active toasts fixed to the bottom-right.
 * aria-live="polite" announces toast messages to screen readers.
 */
export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50
                 flex flex-col items-end gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
