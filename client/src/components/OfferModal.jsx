import { useState, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import { X, Loader2, AlertCircle, Calendar, Sparkles } from 'lucide-react';

/**
 * Modal dialog for creating or editing an offer
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {Object|null} props.offer - Existing offer object if editing
 * @param {Object[]} props.categories - List of seeded categories
 * @param {function} props.onSuccess - Callback upon successful save
 */
export default function OfferModal({
  isOpen,
  onClose,
  offer,
  categories = [],
  onSuccess,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [category, setCategory] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTill, setValidTill] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = !!offer?._id;

  // Initialize form state
  useEffect(() => {
    if (offer) {
      setTitle(offer.title || '');
      setDescription(offer.description || '');
      setDiscountText(offer.discountText || '');
      setCategory(offer.category?._id || offer.category || '');
      setValidFrom(
        offer.validFrom
          ? new Date(offer.validFrom).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setValidTill(
        offer.validTill
          ? new Date(offer.validTill).toISOString().slice(0, 10)
          : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      );
      setImages(offer.images || []);
    } else {
      setTitle('');
      setDescription('');
      setDiscountText('');
      setCategory(categories[0]?._id || '');
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidTill(
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      );
      setImages([]);
    }
    setError(null);
  }, [offer, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side date check
    const fromDate = new Date(validFrom);
    const tillDate = new Date(validTill);

    if (tillDate <= fromDate) {
      setError('Valid till date must be strictly after valid from date.');
      return;
    }

    if (!category) {
      setError('Please select a category for this offer.');
      return;
    }

    setLoading(true);

    try {
      const url = isEditing
        ? `/api/vendor/offers/${offer._id}`
        : '/api/vendor/offers';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          discountText,
          category,
          validFrom: fromDate.toISOString(),
          validTill: tillDate.toISOString(),
          images,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save offer');
      }

      onSuccess(data.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Error saving offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing
                  ? 'Edit & Resubmit Offer'
                  : 'Create New Promotional Offer'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Saving changes will reset the offer status to pending review'
                  : 'Submitted offers will be reviewed for text, dates, and quality'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Offer Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flat 30% Off On All Winter Wear"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category *
              </label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Discount Tag / Badge
              </label>
              <input
                type="text"
                value={discountText}
                onChange={(e) => setDiscountText(e.target.value)}
                placeholder="e.g. 30% OFF / BOGO"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description &amp; Terms *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the offer details, eligibility, or voucher terms..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Date Range with validation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Valid From Date *
              </label>
              <input
                type="date"
                required
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Valid Till Date *
              </label>
              <input
                type="date"
                required
                value={validTill}
                onChange={(e) => setValidTill(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Image Upload (1 to 3 images) */}
          <div className="pt-2">
            <ImageUploader
              images={images}
              onChange={setImages}
              max={3}
              label="Offer Promotional Images (1-3 images)"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading
                ? 'Submitting...'
                : isEditing
                  ? 'Update & Resubmit Offer'
                  : 'Publish Offer for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
