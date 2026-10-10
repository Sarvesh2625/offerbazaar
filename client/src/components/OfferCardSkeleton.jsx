/**
 * OfferCardSkeleton Component
 * Shimmering loading skeleton for offer cards during queries and filter changes.
 */
export default function OfferCardSkeleton() {
  return (
    <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 overflow-hidden animate-pulse flex flex-col justify-between">
      <div>
        {/* Image Skeleton */}
        <div className="h-44 bg-slate-800/60 w-full relative">
          <div className="absolute top-3 left-3 h-5 w-20 bg-slate-700/60 rounded-full" />
          <div className="absolute top-3 right-3 h-5 w-16 bg-slate-700/60 rounded-full" />
        </div>

        {/* Content Skeleton */}
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 bg-slate-700/60 rounded w-28" />
            <div className="h-3.5 bg-slate-700/60 rounded w-16" />
          </div>

          <div className="h-5 bg-slate-700/80 rounded w-4/5" />
          <div className="h-3.5 bg-slate-800 rounded w-full" />
          <div className="h-3.5 bg-slate-800 rounded w-2/3" />
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <div className="h-3 bg-slate-800 rounded w-24" />
        <div className="h-3 bg-slate-800 rounded w-20" />
      </div>
    </div>
  );
}
