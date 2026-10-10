import { useState, useEffect, useId, useCallback } from 'react';
import {
  ShieldCheck,
  Store,
  Tag,
  BarChart3,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Eye,
  ShieldAlert,
  X,
  Ban,
  Filter,
} from 'lucide-react';
import StarRating from '../components/StarRating';
import { useAuth } from '../context';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'live' | 'vendors' | 'analytics'

  // ========================================================
  // 1. REVIEW QUEUE STATE
  // ========================================================

  const [queueOffers, setQueueOffers] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [queuePagination, setQueuePagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });

  // Rejection modal state
  const [rejectModalOffer, setRejectModalOffer] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  // Approve action loading state per offer ID
  const [actionLoading, setActionLoading] = useState({});

  // Image preview modal state
  const [previewImage, setPreviewImage] = useState(null);

  // ========================================================
  // 1B. LIVE OFFERS STATE
  // ========================================================
  const [liveOffers, setLiveOffers] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [livePagination, setLivePagination] = useState({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [liveSearch, setLiveSearch] = useState('');
  const [liveVendor, setLiveVendor] = useState('');
  const [liveCity, setLiveCity] = useState('');
  const [liveCategory, setLiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Takedown modal state
  const [takedownModalOffer, setTakedownModalOffer] = useState(null);
  const [takedownReason, setTakedownReason] = useState('');
  const [takedownSubmitting, setTakedownSubmitting] = useState(false);
  const [takedownError, setTakedownError] = useState(null);

  // ========================================================
  // 2. VENDOR MANAGEMENT STATE
  // ========================================================
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState(null);
  const [vendorPagination, setVendorPagination] = useState({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorStatusFilter, setVendorStatusFilter] = useState('all');

  // Confirmation modal for vendor suspend/reactivate
  const [vendorConfirmModal, setVendorConfirmModal] = useState(null); // { vendor, targetStatus }
  const [vendorActionLoading, setVendorActionLoading] = useState(false);

  // ========================================================
  // 3. ANALYTICS STATE
  // ========================================================
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Global notification toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper to retrieve auth token
  const authHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  // ========================================================
  // FETCH REVIEW QUEUE
  // ========================================================
  const fetchReviewQueue = useCallback(
    async (page = 1) => {
      setQueueLoading(true);
      setQueueError(null);
      try {
        const res = await fetch(
          `/api/admin/review-queue?page=${page}&limit=${queuePagination.limit}`,
          {
            headers: authHeaders(),
            credentials: 'include',
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch review queue');
        }
        setQueueOffers(data.data.offers || []);
        setQueuePagination(data.data.pagination);
      } catch (err) {
        setQueueError(err.message);
      } finally {
        setQueueLoading(false);
      }
    },
    [authHeaders, queuePagination.limit]
  );

  // ========================================================
  // FETCH LIVE OFFERS
  // ========================================================
  const fetchLiveOffers = useCallback(
    async (page = 1) => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: livePagination.limit.toString(),
        });
        if (liveSearch.trim()) params.set('search', liveSearch.trim());
        if (liveVendor.trim()) params.set('vendor', liveVendor.trim());
        if (liveCity.trim()) params.set('city', liveCity.trim());
        if (liveCategory && liveCategory !== 'all') {
          params.set('category', liveCategory);
        }

        const res = await fetch(`/api/admin/live-offers?${params.toString()}`, {
          headers: authHeaders(),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch live offers');
        }
        setLiveOffers(data.data.offers || []);
        setLivePagination(data.data.pagination);
      } catch (err) {
        setLiveError(err.message);
      } finally {
        setLiveLoading(false);
      }
    },
    [
      authHeaders,
      liveCategory,
      liveCity,
      livePagination.limit,
      liveSearch,
      liveVendor,
    ]
  );

  // ========================================================
  // FETCH VENDORS
  // ========================================================
  const fetchVendors = useCallback(
    async (page = 1) => {
      setVendorLoading(true);
      setVendorError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: vendorPagination.limit.toString(),
        });
        if (vendorSearch.trim()) params.set('search', vendorSearch.trim());
        if (vendorStatusFilter && vendorStatusFilter !== 'all') {
          params.set('status', vendorStatusFilter);
        }

        const res = await fetch(`/api/admin/vendors?${params.toString()}`, {
          headers: authHeaders(),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch vendors');
        }
        setVendors(data.data.vendors || []);
        setVendorPagination(data.data.pagination);
      } catch (err) {
        setVendorError(err.message);
      } finally {
        setVendorLoading(false);
      }
    },
    [authHeaders, vendorPagination.limit, vendorSearch, vendorStatusFilter]
  );

  // ========================================================
  // FETCH ANALYTICS
  // ========================================================
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch('/api/admin/analytics', {
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch analytics');
      }
      setAnalyticsData(data.data);
    } catch (err) {
      setAnalyticsError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authHeaders]);

  // Load categories for filters
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCategories(data.data);
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Initial load and tab switching
  useEffect(() => {
    if (activeTab === 'queue') {
      fetchReviewQueue(queuePagination.page);
    } else if (activeTab === 'live') {
      fetchLiveOffers(livePagination.page);
    } else if (activeTab === 'vendors') {
      fetchVendors(vendorPagination.page);
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [
    activeTab,
    fetchAnalytics,
    fetchLiveOffers,
    fetchReviewQueue,
    fetchVendors,
    livePagination.page,
    queuePagination.page,
    vendorPagination.page,
  ]);

  // ========================================================
  // APPROVE OFFER
  // ========================================================
  const handleApproveOffer = async (offerId) => {
    setActionLoading((prev) => ({ ...prev, [offerId]: true }));
    try {
      const res = await fetch(`/api/admin/review-queue/${offerId}/decision`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          decision: 'approved',
          reason: 'Approved by administrator upon review',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve offer');
      }
      showToast(
        'Offer approved successfully! It is now live to shoppers.',
        'success'
      );
      // Remove from list or refresh
      fetchReviewQueue(queuePagination.page);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [offerId]: false }));
    }
  };

  // ========================================================
  // REJECT OFFER
  // ========================================================
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError(
        'Please provide a specific rejection reason for the vendor.'
      );
      return;
    }

    setRejectSubmitting(true);
    setRejectError(null);
    try {
      const res = await fetch(
        `/api/admin/review-queue/${rejectModalOffer._id}/decision`,
        {
          method: 'POST',
          headers: authHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            decision: 'rejected',
            reason: rejectReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reject offer');
      }
      showToast(
        'Offer rejected. The reason has been logged to the audit trail and sent to the vendor.',
        'info'
      );
      setRejectModalOffer(null);
      setRejectReason('');
      fetchReviewQueue(queuePagination.page);
    } catch (err) {
      setRejectError(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  };

  // ========================================================
  // TAKE DOWN LIVE OFFER
  // ========================================================
  const handleConfirmTakedown = async (e) => {
    e.preventDefault();
    if (!takedownReason.trim()) {
      setTakedownError(
        'Please provide a specific takedown reason for the audit trail and vendor.'
      );
      return;
    }

    setTakedownSubmitting(true);
    setTakedownError(null);
    try {
      const res = await fetch(
        `/api/admin/live-offers/${takedownModalOffer._id}/takedown`,
        {
          method: 'POST',
          headers: authHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            reason: takedownReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to take down offer');
      }
      showToast(
        'Offer taken down successfully. It is now hidden from customer search and the vendor has been notified.',
        'warning'
      );
      setTakedownModalOffer(null);
      setTakedownReason('');
      fetchLiveOffers(livePagination.page);
    } catch (err) {
      setTakedownError(err.message);
    } finally {
      setTakedownSubmitting(false);
    }
  };

  // ========================================================
  // UPDATE VENDOR STATUS (SUSPEND / REACTIVATE)
  // ========================================================
  const handleConfirmVendorStatus = async () => {
    if (!vendorConfirmModal) return;
    const { vendor, targetStatus } = vendorConfirmModal;

    setVendorActionLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor._id}/status`, {
        method: 'PUT',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update vendor status');
      }

      if (targetStatus === 'suspended') {
        showToast(
          `Vendor "${vendor.shopName}" suspended. Their approved offers are now hidden from customer search queries.`,
          'warning'
        );
      } else {
        showToast(
          `Vendor "${vendor.shopName}" reactivated. Their approved offers are now visible to customers again!`,
          'success'
        );
      }

      setVendorConfirmModal(null);
      fetchVendors(vendorPagination.page);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setVendorActionLoading(false);
    }
  };

  const rejectReasonInputId = useId();
  const takedownReasonInputId = useId();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-800'
              : toast.type === 'warning'
                ? 'bg-amber-950/95 text-amber-200 border-amber-800'
                : toast.type === 'info'
                  ? 'bg-sky-950/95 text-sky-200 border-sky-800'
                  : 'bg-emerald-950/95 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 mb-8 relative overflow-hidden backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Administrative Moderation Console
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight font-display">
              Marketplace Operations &amp; Review
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Audit flagged retail promotions, enforce vendor compliance, and
              inspect platform analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              System Root
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('queue')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              activeTab === 'queue'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Review Queue</span>
            {queuePagination.total > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {queuePagination.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('live')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              activeTab === 'live'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>Live Offers</span>
            {livePagination.total > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">
                {livePagination.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              activeTab === 'vendors'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Store className="w-4 h-4 text-amber-400" />
            <span>Vendor Management</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              activeTab === 'analytics'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Analytics Panel</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: REVIEW QUEUE                                      */}
      {/* ======================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
                <Tag className="w-5 h-5 text-amber-400" />
                Pending &amp; Flagged Offer Queue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review promotional offers that triggered automated moderation
                flags or require manual intervention.
              </p>
            </div>

            <button
              onClick={() => fetchReviewQueue(queuePagination.page)}
              disabled={queueLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {queueError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {queueError}
            </div>
          )}

          {queueLoading ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading review queue...</p>
            </div>
          ) : queueOffers.length === 0 ? (
            <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">
                No Offers Waiting for Review
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                You&apos;re all caught up! All promotional offers submitted by
                vendors have been approved or resolved.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {queueOffers.map((offer) => {
                const audit = offer.latestAuditLog;
                const checks = audit?.checksPerformed || {};

                return (
                  <div
                    key={offer._id}
                    className="p-6 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-xl backdrop-blur-sm"
                  >
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Left: Offer Details & Media */}
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                              offer.status === 'flagged_for_review'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                            }`}
                          >
                            {offer.status === 'flagged_for_review'
                              ? 'Flagged for Review'
                              : 'Pending Review'}
                          </span>

                          {offer.discountText && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {offer.discountText}
                            </span>
                          )}

                          {offer.category?.name && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {offer.category.name}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white tracking-tight">
                            {offer.title}
                          </h3>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                            {offer.description}
                          </p>
                        </div>

                        {/* Vendor & Dates Metadata */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                              Shop Information
                            </span>
                            <div className="font-semibold text-white">
                              {offer.vendorId?.shopName || 'Unknown Shop'}
                            </div>
                            <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-purple-400" />
                              <span>
                                {offer.vendorId?.city || 'No City'},{' '}
                                {offer.vendorId?.address || ''}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                              Validity Window
                            </span>
                            <div className="text-slate-200 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-purple-400" />
                              <span>
                                {new Date(offer.validFrom).toLocaleDateString()}{' '}
                                &ndash;{' '}
                                {new Date(offer.validTill).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Images Gallery */}
                        {offer.images && offer.images.length > 0 && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-2">
                              Promotional Images ({offer.images.length})
                            </span>
                            <div className="flex flex-wrap gap-3">
                              {offer.images.map((imgUrl, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setPreviewImage(imgUrl)}
                                  className="relative group rounded-xl overflow-hidden border border-slate-800 h-20 w-24 bg-slate-950 cursor-pointer"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Offer thumbnail ${i + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Automated Check Results & Decision Actions */}
                      <div className="w-full lg:w-96 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-6 lg:pt-0 lg:pl-6 space-y-4">
                        <div className="space-y-3">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                            Automated Check Breakdown
                          </span>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Location */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                checks.locationValid
                                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {checks.locationValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              <span>Location</span>
                            </div>

                            {/* Dates */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                checks.dateValid
                                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {checks.dateValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              <span>Dates</span>
                            </div>

                            {/* Text Coherence */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                checks.textValid
                                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {checks.textValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              <span>Text Analysis</span>
                            </div>

                            {/* Images */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                checks.imageValid
                                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {checks.imageValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              <span>Visual Media</span>
                            </div>
                          </div>

                          {/* Audit Reason Display */}
                          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs text-slate-300 space-y-1">
                            <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                              Audit Reason / Pipeline Note:
                            </span>
                            <p className="leading-relaxed font-mono text-[11px] text-amber-200/90">
                              {audit?.reason ||
                                (offer.rejectionReason?.length
                                  ? offer.rejectionReason.join('; ')
                                  : 'Automated checks completed with flags')}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-slate-800 flex gap-3">
                          <button
                            onClick={() => handleApproveOffer(offer._id)}
                            disabled={actionLoading[offer._id]}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {actionLoading[offer._id]
                              ? 'Approving...'
                              : 'Approve Offer'}
                          </button>

                          <button
                            onClick={() => {
                              setRejectModalOffer(offer);
                              setRejectReason('');
                              setRejectError(null);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 transition-all cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject Offer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Queue Pagination */}
              {queuePagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                  <span>
                    Showing page {queuePagination.page} of{' '}
                    {queuePagination.totalPages} ({queuePagination.total} total
                    offers)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchReviewQueue(queuePagination.page - 1)}
                      disabled={queuePagination.page <= 1 || queueLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <button
                      onClick={() => fetchReviewQueue(queuePagination.page + 1)}
                      disabled={
                        queuePagination.page >= queuePagination.totalPages ||
                        queueLoading
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
      )}

      {/* ======================================================== */}
      {/* TAB 1B: LIVE OFFERS                                      */}
      {/* ======================================================== */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
                <Tag className="w-5 h-5 text-emerald-400" />
                Live Marketplace Offers
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Browse, search, filter, and moderate active offers currently
                visible to shoppers.
              </p>
            </div>

            <button
              onClick={() => fetchLiveOffers(livePagination.page)}
              disabled={liveLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col lg:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={liveSearch}
                onChange={(e) => setLiveSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLiveOffers(1)}
                placeholder="Search offer title, description, or discount..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
              <input
                type="text"
                value={liveVendor}
                onChange={(e) => setLiveVendor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLiveOffers(1)}
                placeholder="Vendor / Shop..."
                className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-36"
              />

              <input
                type="text"
                value={liveCity}
                onChange={(e) => setLiveCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLiveOffers(1)}
                placeholder="City..."
                className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-28"
              />

              <select
                value={liveCategory}
                onChange={(e) => {
                  setLiveCategory(e.target.value);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer w-full sm:w-36"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id || c.slug} value={c._id || c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => fetchLiveOffers(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>

              {(liveSearch ||
                liveVendor ||
                liveCity ||
                liveCategory !== 'all') && (
                <button
                  onClick={() => {
                    setLiveSearch('');
                    setLiveVendor('');
                    setLiveCity('');
                    setLiveCategory('all');
                    fetch('/api/admin/live-offers?page=1&limit=8', {
                      headers: authHeaders(),
                      credentials: 'include',
                    })
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.success) {
                          setLiveOffers(d.data.offers || []);
                          setLivePagination(d.data.pagination);
                        }
                      })
                      .catch((err) => setLiveError(err.message));
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {liveError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {liveError}
            </div>
          )}

          {liveLoading ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">
                Loading live marketplace offers...
              </p>
            </div>
          ) : liveOffers.length === 0 ? (
            <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
              <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">
                No Live Offers Found
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                No approved offers match your current search and filter
                criteria. Try adjusting the filters.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {liveOffers.map((offer) => (
                  <div
                    key={offer._id}
                    className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-xl backdrop-blur-sm flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Top Badges & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                          </span>

                          {offer.discountText && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {offer.discountText}
                            </span>
                          )}

                          {offer.category?.name && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {offer.category.name}
                            </span>
                          )}
                        </div>

                        {/* Direct Takedown Trigger Button */}
                        <button
                          onClick={() => {
                            setTakedownModalOffer(offer);
                            setTakedownReason('');
                            setTakedownError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-400" />
                          Take Down
                        </button>
                      </div>

                      {/* Offer Info */}
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {offer.title}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed line-clamp-3">
                          {offer.description}
                        </p>
                      </div>

                      {/* Vendor & Validity Metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                            Shop Details
                          </span>
                          <div className="font-semibold text-white truncate">
                            {offer.vendorId?.shopName || 'Unknown Shop'}
                          </div>
                          <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">
                              {offer.vendorId?.city || 'No City'}
                              {offer.vendorId?.address
                                ? `, ${offer.vendorId.address}`
                                : ''}
                            </span>
                          </div>
                          {offer.vendorId?.totalRatings > 0 && (
                            <div className="mt-1.5">
                              <StarRating
                                rating={offer.vendorId.avgRating}
                                totalRatings={offer.vendorId.totalRatings}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs flex flex-col justify-between">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                              Validity Window
                            </span>
                            <div className="text-slate-200 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span>
                                {new Date(offer.validFrom).toLocaleDateString()}{' '}
                                &ndash;{' '}
                                {new Date(offer.validTill).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {offer.vendorId?.userId?.email && (
                            <div className="text-[11px] text-slate-500 truncate mt-2">
                              Vendor: {offer.vendorId.userId.email}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Images Thumbnails */}
                      {offer.images && offer.images.length > 0 && (
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1.5">
                            Photos ({offer.images.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {offer.images.map((imgUrl, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setPreviewImage(imgUrl)}
                                className="relative group rounded-lg overflow-hidden border border-slate-800 h-14 w-16 bg-slate-950 cursor-pointer"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Offer thumbnail ${i + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Action */}
                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">
                        ID: {offer._id}
                      </span>
                      <button
                        onClick={() => {
                          setTakedownModalOffer(offer);
                          setTakedownReason('');
                          setTakedownError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-600/30 transition-all cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                        Take Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Offers Pagination */}
              {livePagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                  <span>
                    Showing page {livePagination.page} of{' '}
                    {livePagination.totalPages} ({livePagination.total} live
                    offers)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchLiveOffers(livePagination.page - 1)}
                      disabled={livePagination.page <= 1 || liveLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <button
                      onClick={() => fetchLiveOffers(livePagination.page + 1)}
                      disabled={
                        livePagination.page >= livePagination.totalPages ||
                        liveLoading
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
      )}

      {/* ======================================================== */}
      {/* TAB 2: VENDOR MANAGEMENT                                 */}
      {/* ======================================================== */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Registered Vendors &amp; Store Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Search, filter, inspect shop profiles, and suspend/reactivate
                vendor selling accounts.
              </p>
            </div>

            <button
              onClick={() => fetchVendors(vendorPagination.page)}
              disabled={vendorLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${vendorLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVendors(1)}
                placeholder="Search by shop name, city, or address..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={vendorStatusFilter}
                onChange={(e) => {
                  setVendorStatusFilter(e.target.value);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>

              <button
                onClick={() => fetchVendors(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shrink-0"
              >
                Search
              </button>
            </div>
          </div>

          {vendorError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {vendorError}
            </div>
          )}

          {/* Vendors Table */}
          {vendorLoading ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading vendors...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
              <Store className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">
                No Vendors Found
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                No store records match your current search terms or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Shop Name &amp; Contact</th>
                    <th className="px-6 py-4">City / Location</th>
                    <th className="px-6 py-4">Categories</th>
                    <th className="px-6 py-4">Ratings</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor._id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">
                          {vendor.shopName || '(Unnamed Shop)'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {vendor.userId?.name} &bull; {vendor.userId?.email}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200">
                          {vendor.city || 'Not declared'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {vendor.address || 'No physical address'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {vendor.categories && vendor.categories.length > 0 ? (
                            vendor.categories.map((c) => (
                              <span
                                key={c._id || c}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {c.name || 'Category'}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">
                              None
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StarRating
                          rating={vendor.avgRating}
                          totalRatings={vendor.totalRatings}
                          size="sm"
                        />
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                            vendor.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : vendor.status === 'suspended'
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              vendor.status === 'active'
                                ? 'bg-emerald-400'
                                : vendor.status === 'suspended'
                                  ? 'bg-rose-400'
                                  : 'bg-amber-400'
                            }`}
                          />
                          {vendor.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {vendor.status === 'active' ? (
                          <button
                            onClick={() =>
                              setVendorConfirmModal({
                                vendor,
                                targetStatus: 'suspended',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : vendor.status === 'suspended' ? (
                          <button
                            onClick={() =>
                              setVendorConfirmModal({
                                vendor,
                                targetStatus: 'active',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setVendorConfirmModal({
                                vendor,
                                targetStatus: 'active',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                          >
                            Verify &amp; Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vendors Pagination */}
          {vendorPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Showing page {vendorPagination.page} of{' '}
                {vendorPagination.totalPages} ({vendorPagination.total} total
                vendors)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchVendors(vendorPagination.page - 1)}
                  disabled={vendorPagination.page <= 1 || vendorLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  onClick={() => fetchVendors(vendorPagination.page + 1)}
                  disabled={
                    vendorPagination.page >= vendorPagination.totalPages ||
                    vendorLoading
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

      {/* ======================================================== */}
      {/* TAB 3: ANALYTICS PANEL                                   */}
      {/* ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Platform Metrics &amp; Moderation Trends
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time inventory distribution, vendor verification metrics,
                and a 30-day moderation audit timeline.
              </p>
            </div>

            <button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {analyticsError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {analyticsError}
            </div>
          )}

          {analyticsLoading ? (
            <div className="p-16 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">
                Aggregating platform analytics...
              </p>
            </div>
          ) : analyticsData ? (
            <div className="space-y-8">
              {/* Stat Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Vendors */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Total Vendors
                    </span>
                    <Store className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white mt-2">
                    {analyticsData.vendorsByStatus.total}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[10px]">
                    <span className="text-emerald-400 font-semibold">
                      {analyticsData.vendorsByStatus.active} active
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-amber-400 font-semibold">
                      {analyticsData.vendorsByStatus.pending} pending
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-rose-400 font-semibold">
                      {analyticsData.vendorsByStatus.suspended} suspended
                    </span>
                  </div>
                </div>

                {/* Total Offers */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Total Offers
                    </span>
                    <Tag className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white mt-2">
                    {analyticsData.offersByStatus.total}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[10px]">
                    <span className="text-emerald-400 font-semibold">
                      {analyticsData.offersByStatus.approved} approved
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-rose-400 font-semibold">
                      {analyticsData.offersByStatus.rejected} rejected
                    </span>
                  </div>
                </div>

                {/* In Review Queue */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Waiting Review
                    </span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-amber-300 mt-2">
                    {analyticsData.offersByStatus.flagged_for_review +
                      analyticsData.offersByStatus.pending_review}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[10px]">
                    <span className="text-amber-400 font-semibold">
                      {analyticsData.offersByStatus.flagged_for_review} flagged
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-yellow-400 font-semibold">
                      {analyticsData.offersByStatus.pending_review} pending
                    </span>
                  </div>
                </div>

                {/* Category Count */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Active Categories
                    </span>
                    <BarChart3 className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white mt-2">
                    {analyticsData.offersByCategory.length}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-800/80">
                    With registered promotional listings
                  </p>
                </div>
              </div>

              {/* 30-Day Moderation Timeline Chart */}
              <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      30-Day Offer Moderation Timeline
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Daily counts of offers approved vs. rejected computed from
                      AdminReviewLog audit records.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      Approved
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      Rejected
                    </div>
                  </div>
                </div>

                {/* Bar chart visualization */}
                <div className="space-y-2">
                  <div className="h-44 w-full flex items-end gap-1 sm:gap-2 pt-4 px-2 pb-2 bg-slate-950/60 rounded-2xl border border-slate-800/60 overflow-x-auto">
                    {(() => {
                      const days = analyticsData.dailyDecisionsLast30Days;
                      const maxVal = Math.max(
                        1,
                        ...days.map((d) => Math.max(d.approved, d.rejected))
                      );

                      return days.map((d) => {
                        const approvedHeight = Math.max(
                          4,
                          (d.approved / maxVal) * 100
                        );
                        const rejectedHeight = Math.max(
                          4,
                          (d.rejected / maxVal) * 100
                        );

                        return (
                          <div
                            key={d.date}
                            className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group relative"
                          >
                            {/* Hover tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                              <div className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded-lg px-2 py-1 shadow-2xl whitespace-nowrap">
                                <span className="font-bold block text-white">
                                  {d.date}
                                </span>
                                <span className="text-emerald-400">
                                  Approved: {d.approved}
                                </span>
                                <span className="text-slate-400"> | </span>
                                <span className="text-rose-400">
                                  Rejected: {d.rejected}
                                </span>
                              </div>
                            </div>

                            {/* Dual Bars */}
                            <div className="w-full flex gap-0.5 sm:gap-1 items-end justify-center">
                              <div
                                style={{
                                  height:
                                    d.approved > 0
                                      ? `${approvedHeight}%`
                                      : '2px',
                                }}
                                className={`w-1.5 sm:w-2.5 rounded-t-sm transition-all ${
                                  d.approved > 0
                                    ? 'bg-emerald-500 group-hover:bg-emerald-400'
                                    : 'bg-slate-800'
                                }`}
                              />
                              <div
                                style={{
                                  height:
                                    d.rejected > 0
                                      ? `${rejectedHeight}%`
                                      : '2px',
                                }}
                                className={`w-1.5 sm:w-2.5 rounded-t-sm transition-all ${
                                  d.rejected > 0
                                    ? 'bg-rose-500 group-hover:bg-rose-400'
                                    : 'bg-slate-800'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 font-mono px-2">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>

              {/* Offers Per Category Breakdown */}
              <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800">
                <h3 className="text-base font-bold text-white mb-1">
                  Offers per Category
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Distribution of promotional listings grouped across retail
                  category verticals.
                </p>

                {analyticsData.offersByCategory.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No category data recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {(() => {
                      const totalCatOffers =
                        analyticsData.offersByCategory.reduce(
                          (acc, curr) => acc + curr.count,
                          0
                        );

                      return analyticsData.offersByCategory.map((cat) => {
                        const pct =
                          totalCatOffers > 0
                            ? Math.round((cat.count / totalCatOffers) * 100)
                            : 0;

                        return (
                          <div
                            key={cat.categoryId}
                            className="space-y-1 text-xs"
                          >
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-200">
                                {cat.categoryName}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {cat.count} offers ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                              <div
                                style={{ width: `${pct}%` }}
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* REJECT MODAL                                             */}
      {/* ======================================================== */}
      {rejectModalOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <XCircle className="w-5 h-5" />
                Reject Promotional Offer
              </div>
              <button
                onClick={() => setRejectModalOffer(null)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-slate-400 block font-semibold mb-1">
                  Offer Title:
                </span>
                <p className="text-sm font-bold text-white bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  {rejectModalOffer.title}
                </p>
              </div>

              <div>
                <label
                  htmlFor={rejectReasonInputId}
                  className="text-xs text-slate-300 block font-semibold mb-1.5"
                >
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id={rejectReasonInputId}
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain clearly why this offer is being rejected (e.g., promotional terms are misleading, image is non-compliant, price contradictory)..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Notice: This reason is stored alongside existing automated
                  check findings in the permanent audit trail and communicated
                  to the vendor.
                </p>
              </div>

              {rejectError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  {rejectError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectModalOffer(null)}
                  disabled={rejectSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {rejectSubmitting ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAKE DOWN LIVE OFFER MODAL                               */}
      {/* ======================================================== */}
      {takedownModalOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <Ban className="w-5 h-5" />
                Take Down Approved Offer
              </div>
              <button
                onClick={() => setTakedownModalOffer(null)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTakedown} className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-slate-400 block font-semibold mb-1">
                  Offer Title &amp; Vendor:
                </span>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <p className="text-sm font-bold text-white">
                    {takedownModalOffer.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    Store:{' '}
                    {takedownModalOffer.vendorId?.shopName || 'Unknown Shop'} (
                    {takedownModalOffer.vendorId?.city || 'No City'})
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-200 text-xs leading-relaxed">
                <strong>Moderation Impact:</strong> Taking down this offer
                immediately changes its status to rejected, completely removing
                it from shopper search queries and discovery feeds. An audit
                entry with decision{' '}
                <code className="text-rose-300">
                  manual_takedown_post_approval
                </code>{' '}
                will be recorded and the vendor will be notified.
              </div>

              <div>
                <label
                  htmlFor={takedownReasonInputId}
                  className="text-xs text-slate-300 block font-semibold mb-1.5"
                >
                  Takedown Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id={takedownReasonInputId}
                  rows={4}
                  value={takedownReason}
                  onChange={(e) => setTakedownReason(e.target.value)}
                  placeholder="Explain why this approved offer is being taken down (e.g., policy violation, customer complaints, misleading promotion, fraudulent terms)..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Notice: This reason is stored in{' '}
                  <code className="text-slate-300">rejectionReason</code>,
                  logged in the audit trail under your admin ID, and
                  communicated directly to the vendor.
                </p>
              </div>

              {takedownError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  {takedownError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTakedownModalOffer(null)}
                  disabled={takedownSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={takedownSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {takedownSubmitting ? 'Taking Down...' : 'Confirm Take Down'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VENDOR SUSPEND / REACTIVATE CONFIRMATION MODAL           */}
      {/* ======================================================== */}
      {vendorConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-2.5 rounded-xl border ${
                  vendorConfirmModal.targetStatus === 'suspended'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                {vendorConfirmModal.targetStatus === 'suspended'
                  ? 'Suspend Vendor Account?'
                  : 'Reactivate Vendor Account?'}
              </h3>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed mb-6">
              <p>
                Store:{' '}
                <strong className="text-white font-bold">
                  {vendorConfirmModal.vendor.shopName}
                </strong>
              </p>
              {vendorConfirmModal.targetStatus === 'suspended' ? (
                <p className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-200">
                  <strong>Critical Policy:</strong> Suspending this vendor will
                  immediately hide all of their approved promotional offers from
                  customer search queries. Reactivating will restore them
                  without needing re-approval.
                </p>
              ) : (
                <p className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-200">
                  Reactivating this vendor will restore their account and
                  immediately make their approved offers visible to shoppers
                  again.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setVendorConfirmModal(null)}
                disabled={vendorActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVendorStatus}
                disabled={vendorActionLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                  vendorConfirmModal.targetStatus === 'suspended'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {vendorActionLoading
                  ? 'Updating...'
                  : vendorConfirmModal.targetStatus === 'suspended'
                    ? 'Confirm Suspension'
                    : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* IMAGE PREVIEW LIGHTBOX MODAL                             */}
      {/* ======================================================== */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <img
              src={previewImage}
              alt="Full size offer preview"
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
