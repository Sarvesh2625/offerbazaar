import Button from './Button';

/**
 * Reusable EmptyState component for feeds, search results, and queues.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.actionText]
 * @param {function} [props.onAction]
 * @param {string} [props.className='']
 */
export default function EmptyState({
  icon = null,
  title,
  description,
  actionText = null,
  onAction = null,
  className = '',
}) {
  return (
    <div
      className={`p-12 sm:p-16 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-4 max-w-lg mx-auto my-6 ${className}`}
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          {icon}
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-white font-display">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {actionText && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
