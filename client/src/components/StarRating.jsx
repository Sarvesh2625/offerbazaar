import { useState } from 'react';
import { Star, StarHalf } from 'lucide-react';

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

/**
 * StarRating Component
 * Renders filled, half-filled, and empty stars for a numeric rating (0 - 5).
 * Also supports interactive mode for rating submissions.
 *
 * @param {object} props
 * @param {number} props.rating - Float rating between 0 and 5
 * @param {number} [props.totalRatings] - Optional total count of reviews
 * @param {'sm'|'md'|'lg'|'xl'} [props.size] - Star size
 * @param {boolean} [props.showCount] - Whether to show total count
 * @param {boolean} [props.showNumber] - Whether to display numeric rating (e.g. 4.5)
 * @param {boolean} [props.interactive] - If true, enables hover and click selection
 * @param {function} [props.onChange] - Callback when star is clicked (interactive only)
 */
export default function StarRating({
  rating = 0,
  totalRatings,
  size = 'sm',
  showCount = true,
  showNumber = true,
  interactive = false,
  onChange,
}) {
  const [hoverRating, setHoverRating] = useState(null);

  const numericRating = Math.max(0, Math.min(5, parseFloat(rating) || 0));
  const activeRating = hoverRating !== null ? hoverRating : numericRating;

  const sizeClasses =
    {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
      xl: 'w-7 h-7',
    }[size] || 'w-3.5 h-3.5';

  const textClasses =
    {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base font-bold',
      xl: 'text-lg font-extrabold',
    }[size] || 'text-xs';

  if (interactive) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-1.5">
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHoverRating(null)}
          >
            {[1, 2, 3, 4, 5].map((starValue) => {
              const isFilled = activeRating >= starValue;

              return (
                <button
                  type="button"
                  key={starValue}
                  onClick={() => onChange && onChange(starValue)}
                  onMouseEnter={() => setHoverRating(starValue)}
                  className="p-1 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer"
                  aria-label={`${starValue} star${starValue > 1 ? 's' : ''} - ${RATING_LABELS[starValue]}`}
                >
                  <Star
                    className={`${sizeClasses} transition-transform hover:scale-115 ${
                      isFilled
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600 fill-slate-800/40 hover:text-amber-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <span className="text-xs font-semibold text-amber-400 min-w-[70px]">
            {activeRating > 0
              ? `${activeRating} - ${RATING_LABELS[activeRating] || ''}`
              : 'Select rating'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((index) => {
          const fillValue = numericRating - index;

          if (fillValue >= 0.75) {
            // Full star
            return (
              <Star
                key={index}
                className={`${sizeClasses} text-amber-400 fill-amber-400`}
              />
            );
          } else if (fillValue >= 0.25) {
            // Half star
            return (
              <StarHalf
                key={index}
                className={`${sizeClasses} text-amber-400 fill-amber-400`}
              />
            );
          } else {
            // Empty star
            return (
              <Star
                key={index}
                className={`${sizeClasses} text-slate-700 fill-slate-800/40`}
              />
            );
          }
        })}
      </div>

      {showNumber && (
        <span className={`font-semibold text-slate-200 ${textClasses}`}>
          {numericRating > 0 ? numericRating.toFixed(1) : '0.0'}
        </span>
      )}

      {showCount && totalRatings !== undefined && (
        <span className="text-[11px] text-slate-400">({totalRatings})</span>
      )}
    </div>
  );
}
