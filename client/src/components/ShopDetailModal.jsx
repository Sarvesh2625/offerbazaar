import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import {
  X,
  Store,
  MapPin,
  CheckCircle2,
  Calendar,
  Tag,
  Loader2,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';
import StarRating from './StarRating';

/**
 * ShopDetailModal Component
 * Displays full storefront profile (images, bio, city, address, rating),
 * active approved deals, and a customer ratings & review system with upsert capability.
 *
 * @param {object} props
 * @param {string} props.vendorId - The Vendor document ID
 * @param {function} props.onClose - Callback to close the modal
 */
export default function ShopDetailModal({ vendorId, onClose }) {
  const { user, token } = useAuth();

  // Store & Offers State
  const [shopData, setShopData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ratings List & Pagination State
  const [ratings, setRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsPage, setRatingsPage] = useState(1);
  const [ratingsTotalPages, setRatingsTotalPages] = useState(1);
  const [totalRatingsCount, setTotalRatingsCount] = useState(0);

  // Customer's Rating Form State
  const [myRatingId, setMyRatingId] = useState(null);
  const [formStars, setFormStars] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState(null);
  const [ratingErrorMsg, setRatingErrorMsg] = useState(null);

  const authHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // 1. Fetch public shop profile and active offers
  useEffect(() => {
    let isMounted = true;
    const fetchShop = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/vendor/${vendorId}/public`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to load shop profile');
        }
        if (isMounted) {
          setShopData(data.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (vendorId) {
      fetchShop();
    }

    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  // 2. Fetch paginated shop reviews
  const fetchRatings = useCallback(
    async (page = 1) => {
      if (!vendorId) return;
      setRatingsLoading(true);
      try {
        const res = await fetch(
          `/api/vendors/${vendorId}/ratings?page=${page}&limit=5`,
          {
            headers: authHeaders(),
            credentials: 'include',
          }
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setRatings(data.data.ratings || []);
          setRatingsPage(data.data.pagination.page);
          setRatingsTotalPages(data.data.pagination.totalPages);
          setTotalRatingsCount(data.data.pagination.total);
        }
      } catch (err) {
        console.error('Failed to load ratings', err);
      } finally {
        setRatingsLoading(false);
      }
    },
    [vendorId, authHeaders]
  );

  // 3. Fetch customer's own previous rating (for pre-fill)
  const fetchMyRating = useCallback(async () => {
    if (!vendorId || user?.role !== 'customer') return;
    try {
      const res = await fetch(`/api/vendors/${vendorId}/ratings/my-rating`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success && data.data.rating) {
        setMyRatingId(data.data.rating._id);
        setFormStars(data.data.rating.stars || 5);
        setFormComment(data.data.rating.comment || '');
      }
    } catch (err) {
      console.error('Failed to load customer rating', err);
    }
  }, [vendorId, user, authHeaders]);

  useEffect(() => {
    fetchRatings(1);
    fetchMyRating();
  }, [fetchRatings, fetchMyRating]);

  // 4. Handle Rating Submission / Upsert
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!formStars || formStars < 1 || formStars > 5) {
      setRatingErrorMsg('Please select a rating between 1 and 5 stars.');
      return;
    }

    setSubmittingRating(true);
    setRatingSuccessMsg(null);
    setRatingErrorMsg(null);

    try {
      const res = await fetch(`/api/vendors/${vendorId}/ratings`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          stars: formStars,
          comment: formComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit rating');
      }

      setRatingSuccessMsg(
        myRatingId
          ? 'Your review has been updated successfully!'
          : 'Thank you! Your review has been published.'
      );
      setMyRatingId(data.data.rating._id);

      // Update local vendor stats in modal header
      if (data.data.vendorStats && shopData?.vendor) {
        setShopData((prev) => ({
          ...prev,
          vendor: {
            ...prev.vendor,
            avgRating: data.data.vendorStats.avgRating,
            totalRatings: data.data.vendorStats.totalRatings,
          },
        }));
      }

      // Refresh reviews list to show the new/updated review
      fetchRatings(1);
    } catch (err) {
      setRatingErrorMsg(err.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const vendor = shopData?.vendor;
  const offers = shopData?.offers || [];
  const isOwner = vendor?.userId === user?._id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Store Profile, Deals &amp; Reviews
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">
                Loading storefront details...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-center text-xs">
              {error}
            </div>
          ) : vendor ? (
            <>
              {/* Storefront Hero Card */}
              <div className="p-6 rounded-3xl bg-slate-950/80 border border-slate-800/90 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h1 className="text-2xl font-extrabold text-white">
                        {vendor.shopName}
                      </h1>
                      {vendor.isVerifiedShop && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Verified Shop
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>
                        {vendor.city}{' '}
                        {vendor.address ? `\u2022 ${vendor.address}` : ''}
                      </span>
                    </div>

                    {/* Star Rating Display */}
                    <div className="mb-4">
                      <StarRating
                        rating={vendor.avgRating}
                        totalRatings={vendor.totalRatings}
                        size="md"
                      />
                    </div>

                    {vendor.shopDescription && (
                      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                        {vendor.shopDescription}
                      </p>
                    )}
                  </div>
                </div>

                {/* Categories */}
                {vendor.categories && vendor.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-800/80">
                    {vendor.categories.map((cat) => (
                      <span
                        key={cat._id || cat}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {cat.name || 'Category'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Store Photos */}
                {vendor.shopImages && vendor.shopImages.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-slate-800/80">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Storefront Gallery
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {vendor.shopImages.map((imgUrl, i) => (
                        <div
                          key={i}
                          className="aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900"
                        >
                          <img
                            src={imgUrl}
                            alt={`${vendor.shopName} photo ${i + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Deals Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Active Promotional Deals ({offers.length})
                    </h3>
                  </div>
                </div>

                {offers.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">
                      This shop currently has no active live offers. Check back
                      soon!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {offers.map((offer) => (
                      <div
                        key={offer._id}
                        className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            {offer.discountText ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {offer.discountText}
                              </span>
                            ) : (
                              <span />
                            )}
                            {offer.category?.name && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300">
                                {offer.category.name}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-white mb-1.5">
                            {offer.title}
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed mb-4">
                            {offer.description}
                          </p>

                          {/* Image preview */}
                          {offer.images && offer.images.length > 0 && (
                            <div className="h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 mb-3">
                              <img
                                src={offer.images[0]}
                                alt={offer.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              Valid till{' '}
                              {new Date(offer.validTill).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-semibold">
                            Active Deal
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* RATINGS & REVIEWS SECTION                                */}
              {/* ======================================================== */}
              <div className="space-y-6 pt-6 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Customer Ratings &amp; Reviews
                      </h3>
                      <p className="text-xs text-slate-400">
                        Real feedback from verified shoppers
                      </p>
                    </div>
                  </div>

                  {/* Summary badge */}
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="text-2xl font-black text-amber-400">
                      {vendor.avgRating
                        ? Number(vendor.avgRating).toFixed(1)
                        : '0.0'}
                    </div>
                    <div>
                      <StarRating
                        rating={vendor.avgRating}
                        showCount={false}
                        showNumber={false}
                        size="sm"
                      />
                      <div className="text-[11px] text-slate-400 font-medium">
                        Based on {vendor.totalRatings || 0} review
                        {vendor.totalRatings === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RATE THIS SHOP CONTROL (For logged-in customers) */}
                {user?.role === 'customer' && !isOwner && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-amber-500/20 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white">
                        {myRatingId ? 'Update Your Rating' : 'Rate This Shop'}
                      </h4>
                      {myRatingId && (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Previously Rated
                        </span>
                      )}
                    </div>

                    {ratingSuccessMsg && (
                      <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{ratingSuccessMsg}</span>
                      </div>
                    )}

                    {ratingErrorMsg && (
                      <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                        {ratingErrorMsg}
                      </div>
                    )}

                    <form onSubmit={handleRatingSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Your Rating
                        </label>
                        <StarRating
                          interactive={true}
                          rating={formStars}
                          onChange={(val) => setFormStars(val)}
                          size="md"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-300">
                            Write a Review{' '}
                            <span className="text-slate-500 font-normal">
                              (optional)
                            </span>
                          </label>
                          <span
                            className={`text-[11px] ${
                              formComment.length > 300
                                ? 'text-rose-400 font-bold'
                                : 'text-slate-500'
                            }`}
                          >
                            {formComment.length}/300
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={formComment}
                          onChange={(e) => setFormComment(e.target.value)}
                          maxLength={300}
                          placeholder="Tell other shoppers about product quality, discounts, and customer service..."
                          className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all resize-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingRating}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {submittingRating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {myRatingId ? 'Update Review' : 'Submit Review'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Notice for non-customers */}
                {!user ? (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                    Log in with a customer account to rate and review this shop.
                  </div>
                ) : user.role !== 'customer' ? (
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                    Rating submission is reserved for customer shopper accounts.
                  </div>
                ) : isOwner ? (
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                    You are the owner of this shop.
                  </div>
                ) : null}

                {/* PAGINATED RECENT RATINGS LIST */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Recent Reviews ({totalRatingsCount})
                    </h4>
                  </div>

                  {ratingsLoading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                      <p className="text-[11px] text-slate-500">
                        Loading reviews...
                      </p>
                    </div>
                  ) : ratings.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center">
                      <p className="text-xs text-slate-400">
                        No customer reviews yet. Be the first to share your
                        experience!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ratings.map((review) => (
                        <div
                          key={review._id}
                          className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                                {review.customerId?.name
                                  ? review.customerId.name
                                      .charAt(0)
                                      .toUpperCase()
                                  : 'C'}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">
                                  {review.customerId?.name ||
                                    'Verified Customer'}
                                </div>
                                {review.customerId?.city && (
                                  <div className="text-[10px] text-slate-400">
                                    {review.customerId.city}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <StarRating
                                rating={review.stars}
                                showCount={false}
                                showNumber={false}
                                size="sm"
                              />
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {review.createdAt
                                  ? new Date(
                                      review.createdAt
                                    ).toLocaleDateString()
                                  : 'Recent'}
                              </div>
                            </div>
                          </div>

                          {review.comment && (
                            <p className="text-xs text-slate-300 leading-relaxed pl-9">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Pagination Controls */}
                      {ratingsTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
                          <span>
                            Page {ratingsPage} of {ratingsTotalPages}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => fetchRatings(ratingsPage - 1)}
                              disabled={ratingsPage <= 1 || ratingsLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Previous
                            </button>
                            <button
                              type="button"
                              onClick={() => fetchRatings(ratingsPage + 1)}
                              disabled={
                                ratingsPage >= ratingsTotalPages ||
                                ratingsLoading
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
          >
            Back to All Deals
          </button>
        </div>
      </div>
    </div>
  );
}
