/**
 * Reusable Card container component with consistent borders and shadows.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'default'|'highlight'|'subtle'|'admin'} [props.variant='default']
 * @param {boolean} [props.hover=false]
 * @param {string} [props.className='']
 */
export default function Card({
  children,
  variant = 'default',
  hover = false,
  className = '',
  ...props
}) {
  const baseStyles = 'rounded-3xl border transition-all duration-200';

  const variantStyles =
    {
      default:
        'bg-slate-900/80 border-slate-800/80 shadow-xl shadow-black/20 backdrop-blur-sm',
      highlight:
        'bg-gradient-to-br from-amber-950/20 via-slate-900/80 to-slate-950 border-amber-500/20 shadow-xl shadow-amber-500/5 backdrop-blur-sm',
      subtle: 'bg-slate-950/60 border-slate-800/60 shadow-md backdrop-blur-sm',
      admin:
        'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/30 backdrop-blur-sm',
    }[variant] || 'bg-slate-900/80 border-slate-800/80';

  const hoverStyles = hover
    ? 'hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/5 hover:-translate-y-0.5'
    : '';

  return (
    <div
      className={`${baseStyles} ${variantStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
