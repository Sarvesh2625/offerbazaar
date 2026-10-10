import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Award,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const STATUS_CONFIGS = {
  // Offer Statuses
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  pending_review: {
    label: 'Pending Review',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Clock,
  },
  flagged_for_review: {
    label: 'Flagged for Review',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    icon: AlertTriangle,
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-950/60',
    text: 'text-rose-400',
    border: 'border-rose-800/80',
    icon: XCircle,
  },

  // Vendor Statuses
  active: {
    label: 'Active Store',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Profile Incomplete',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Clock,
  },
  suspended: {
    label: 'Suspended',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    icon: XCircle,
  },

  // Special Badges
  verified: {
    label: 'Verified Shop',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: ShieldCheck,
  },
  top_rated: {
    label: 'Top Rated',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    icon: Award,
  },
  discount: {
    label: 'Special Deal',
    bg: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20',
    text: 'text-amber-300',
    border: 'border-orange-500/30',
    icon: Sparkles,
  },
};

/**
 * Reusable semantic Badge component.
 *
 * @param {object} props
 * @param {string} props.status - Key for status (approved, active, pending, etc.)
 * @param {string} [props.label] - Optional override label
 * @param {boolean} [props.showIcon=true] - Whether to render status icon
 * @param {'sm'|'md'} [props.size='sm'] - Badge size
 * @param {string} [props.className='']
 */
export default function Badge({
  status,
  label,
  showIcon = true,
  size = 'sm',
  className = '',
}) {
  const config = STATUS_CONFIGS[status] || {
    label: status || 'General',
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
    icon: null,
  };

  const displayText = label || config.label;
  const IconComponent = config.icon;

  const sizeStyles =
    {
      sm: 'px-2 py-0.5 text-[10px] gap-1',
      md: 'px-2.5 py-1 text-xs gap-1.5',
    }[size] || 'px-2 py-0.5 text-[10px] gap-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border tracking-wide uppercase ${config.bg} ${config.text} ${config.border} ${sizeStyles} ${className}`}
    >
      {showIcon && IconComponent && (
        <IconComponent className="w-3 h-3 shrink-0" />
      )}
      <span>{displayText}</span>
    </span>
  );
}
