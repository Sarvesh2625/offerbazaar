import { useState, useEffect } from 'react';
import { useAuth } from '../context';
import LeafletMapPicker from '../components/LeafletMapPicker';
import ImageUploader from '../components/ImageUploader';
import OfferModal from '../components/OfferModal';
import {
  Store,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  AlertCircle,
  RotateCcw,
  BarChart3,
  Award,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import StarRating from '../components/StarRating';

export default function VendorDashboard() {
  const { user } = useAuth();

  // Navigation tabs: 'profile' or 'offers'
  const [activeTab, setActiveTab] = useState('profile');

  // Vendor Profile State
  const [profile, setProfile] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [categories, setCategories] = useState([]);

  // Profile Form Fields
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [coordinates, setCoordinates] = useState(null); // [lng, lat]
  const [shopImages, setShopImages] = useState([]);

  // Profile Status & Alerts
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Offers State
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState(null);

  // Offer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);

  // Delete Offer Confirmation
  const [deletingId, setDeletingId] = useState(null);

  // 1. Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // 2. Fetch Vendor Profile & Checklist
  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/vendor/profile', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || 'Failed to fetch vendor profile');

      const v = data.data;
      setProfile(v);
      setChecklist(data.checklist);

      // Populate form
      setShopName(v.shopName || '');
      setShopDescription(v.shopDescription || '');
      setAddress(v.address || '');
      setCity(v.city || '');
      setSelectedCategories(
        v.categories ? v.categories.map((c) => (c._id ? c._id : c)) : []
      );
      setCoordinates(
        v.location?.coordinates && v.location.coordinates.length === 2
          ? v.location.coordinates
          : null
      );
      setShopImages(v.shopImages || []);

      // If profile is pending or shopName is empty, show profile tab first
      if (v.status === 'pending' || !v.shopName) {
        setActiveTab('profile');
      } else {
        setActiveTab('offers');
      }
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // 3. Fetch Vendor Offers
  const fetchOffers = async () => {
    setOffersLoading(true);
    setOffersError(null);
    try {
      const res = await fetch('/api/vendor/offers', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load offers');
      setOffers(data.data || []);
    } catch (err) {
      setOffersError(err.message);
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'offers') {
      fetchOffers();
    }
  }, [activeTab]);

  // Handle Category Toggle in Multi-Select
  const toggleCategory = (catId) => {
    if (selectedCategories.includes(catId)) {
      setSelectedCategories(selectedCategories.filter((id) => id !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  // Save Shop Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const payload = {
        shopName,
        shopDescription,
        address,
        city,
        categories: selectedCategories,
        shopImages,
      };

      if (coordinates) {
        payload.location = {
          type: 'Point',
          coordinates,
        };
      }

      const res = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setProfile(data.data);
      setChecklist(data.checklist);
      setProfileSuccess(data.message);

      if (data.data.status === 'active') {
        setTimeout(() => {
          setActiveTab('offers');
        }, 1500);
      }
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Delete Offer
  const handleDeleteOffer = async (offerId) => {
    if (
      !window.confirm('Are you sure you want to delete this promotional offer?')
    ) {
      return;
    }

    setDeletingId(offerId);
    try {
      const res = await fetch(`/api/vendor/offers/${offerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete offer');
      setOffers(offers.filter((o) => o._id !== offerId));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    return <Badge status={status} size="sm" />;
  };

  if (profileLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-indigo-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isProfileComplete = profile?.status === 'active';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-950 border border-amber-500/20 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-2">
              <Store className="w-3.5 h-3.5" />
              Vendor Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
              {profile?.shopName || user?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Configure your storefront profile, publish promotions, and reach
              neighborhood shoppers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge status={profile?.status || 'pending'} size="md" />
            {profile?.isVerifiedShop && <Badge status="verified" size="md" />}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 mb-8 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('offers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'offers'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Tag className="w-4 h-4" />
          My Promotional Offers ({offers.length})
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Store className="w-4 h-4" />
          Shop Profile &amp; Location
          {!isProfileComplete && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'analytics'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Performance &amp; Reputation
        </button>
      </div>

      {/* TAB 1: SHOP PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          {/* Activation Checklist Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              Store Activation Checklist
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Your store will transition from{' '}
              <span className="text-amber-300 font-semibold">PENDING</span> to{' '}
              <span className="text-emerald-300 font-semibold">ACTIVE</span>{' '}
              once all 3 prerequisites below are completed:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  checklist?.hasShopName
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                {checklist?.hasShopName ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="text-xs font-medium">1. Shop Name Provided</div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  checklist?.hasLocation
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                {checklist?.hasLocation ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="text-xs font-medium">2. Map Pin Placed</div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  checklist?.hasCategories
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                {checklist?.hasCategories ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="text-xs font-medium">3. Category Selected</div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {profileSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* Shop Profile Form */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Metro Electronics &amp; Mobiles"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shop Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. 4, MG Road, Fort"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shop Description
              </label>
              <textarea
                rows={3}
                value={shopDescription}
                onChange={(e) => setShopDescription(e.target.value)}
                placeholder="Tell nearby customers about your store, products, and specialties..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Categories Multi-Select (from Category seed data) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Categories (Select all that apply) *
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat._id);
                  return (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => toggleCategory(cat._id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border border-indigo-500 shadow-sm'
                          : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{cat.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Leaflet Map Picker */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Store Geolocation (Pin on OpenStreetMap) *
              </label>
              <LeafletMapPicker value={coordinates} onChange={setCoordinates} />
            </div>

            {/* Shop Images Upload (Cloudinary) */}
            <div className="pt-2">
              <ImageUploader
                images={shopImages}
                onChange={setShopImages}
                max={5}
                label="Storefront &amp; Interior Photos"
              />
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {profileSaving
                  ? 'Saving Profile...'
                  : 'Save & Update Shop Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MY OFFERS CRUD */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          {/* Header Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                Your Promotional Deals
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Create, monitor, and resubmit promotional offers for your store.
              </p>
            </div>

            <button
              onClick={() => {
                if (!profile?.location?.coordinates?.length) {
                  alert(
                    'Please set your shop location on your profile before creating offers.'
                  );
                  setActiveTab('profile');
                  return;
                }
                setEditingOffer(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New Offer
            </button>
          </div>

          {offersError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {offersError}
            </div>
          )}

          {/* Offers List */}
          {offersLoading ? (
            <div className="py-16 flex items-center justify-center text-indigo-400">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
          ) : offers.length === 0 ? (
            /* Empty State */
            <div className="border border-dashed border-slate-800 rounded-3xl p-12 text-center bg-slate-900/40">
              <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">
                No offers yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                Create your first promotional offer to attract customers to your
                store.
              </p>
              <button
                onClick={() => {
                  if (!profile?.location?.coordinates?.length) {
                    alert(
                      'Please set your shop location on your profile first.'
                    );
                    setActiveTab('profile');
                    return;
                  }
                  setEditingOffer(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Offer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map((offer) => {
                const isRejected = offer.status === 'rejected';
                return (
                  <div
                    key={offer._id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      {/* Status & Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {offer.category?.name || 'General'}
                          </span>
                          {offer.discountText && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              {offer.discountText}
                            </span>
                          )}
                        </div>
                        {renderStatusBadge(offer.status)}
                      </div>

                      <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                        {offer.title}
                      </h3>
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                        {offer.description}
                      </p>

                      {/* Dates */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mb-4">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {new Date(offer.validFrom).toLocaleDateString()}{' '}
                          &ndash;{' '}
                          {new Date(offer.validTill).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Image Thumbnail Preview */}
                      {offer.images && offer.images.length > 0 && (
                        <div className="flex gap-2 mb-4">
                          {offer.images.slice(0, 3).map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt="Offer thumbnail"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-800"
                            />
                          ))}
                        </div>
                      )}

                      {/* Plain Language Rejection Reasons (if rejected) */}
                      {isRejected &&
                        offer.rejectionReason &&
                        offer.rejectionReason.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-4 text-xs text-rose-300">
                            <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Rejection Reasons:
                            </div>
                            <ul className="list-disc list-inside space-y-0.5">
                              {offer.rejectionReason.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {isRejected ? (
                        <button
                          onClick={() => {
                            setEditingOffer(offer);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Edit &amp; Resubmit
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingOffer(offer);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteOffer(offer._id)}
                        disabled={deletingId === offer._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-600/80 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === offer._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PERFORMANCE & REPUTATION OVERVIEW */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Deals
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white font-display">
                {offers.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Total deals submitted by your store
              </p>
            </div>

            {/* Metric 2 */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Live Deals
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 font-display">
                {offers.filter((o) => o.status === 'approved').length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Currently visible in customer search feeds
              </p>
            </div>

            {/* Metric 3 */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Store Rating
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-extrabold text-white font-display">
                  {profile?.avgRating
                    ? Number(profile.avgRating).toFixed(1)
                    : '0.0'}
                </span>
                <StarRating
                  rating={profile?.avgRating}
                  showCount={false}
                  showNumber={false}
                  size="sm"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Based on {profile?.totalRatings || 0} customer reviews
              </p>
            </div>

            {/* Metric 4 */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Account Status
                </span>
                <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-1">
                <Badge status={profile?.status || 'pending'} size="md" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {profile?.isVerifiedShop
                  ? 'Official Verified Merchant Shop'
                  : 'Standard Merchant Storefront'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offer Create / Edit Modal */}
      <OfferModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOffer(null);
        }}
        offer={editingOffer}
        categories={categories}
        onSuccess={() => {
          fetchOffers();
        }}
      />
    </div>
  );
}
