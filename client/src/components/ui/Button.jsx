import { Loader2 } from 'lucide-react';

/**
 * Reusable accessible Button component with warm marketplace aesthetic.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'primary'|'secondary'|'danger'|'outline'|'ghost'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className='']
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]';

  const sizeStyles =
    {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-xs sm:text-sm gap-2',
      lg: 'px-5 py-2.5 text-sm sm:text-base gap-2.5',
    }[size] || 'px-4 py-2 text-xs sm:text-sm gap-2';

  const variantStyles =
    {
      primary:
        'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30',
      secondary:
        'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 shadow-sm',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20',
      outline:
        'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600',
      ghost:
        'bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200',
    }[variant] ||
    'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
