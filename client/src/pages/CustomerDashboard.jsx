import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import {
  Search,
  MapPin,
  Navigation,
  Tag,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Store,
  CheckCircle2,
  X,
  Award,
} from 'lucide-react';
import StarRating from '../components/StarRating';
import OfferCardSkeleton from '../components/OfferCardSkeleton';
import ShopDetailModal from '../components/ShopDetailModal';

export default function CustomerDashboard() {
  const { user } = useAuth();

  // Search & Filter State
  const [browsingCity, setBrowsingCity] = useState(user?.city || 'Mumbai');
  const [cityInput, setCityInput] = useState(user?.city || 'Mumbai');
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [geoCoordinates, setGeoCoordinates] = useState(null); // { lat, lng } | null
  const [geoLocating, setGeoLocating] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'distance' | 'rating'

  // Data State
  const [offers, setOffers] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  // Top Rated Near You State (minRatings >= 3)
  const [topRatedOffers, setTopRatedOffers] = useState([]);
  const [topRatedLoading, setTopRatedLoading] = useState(false);

  // Shop Detail Modal
  const [selectedVendorId, setSelectedVendorId] = useState(null);

  // Common quick cities list
  const POPULAR_CITIES = [
    'Mumbai',
    'Pune',
    'Jalgaon',
    'Dhule',
    'Nashik',
    'Nagpur',
    'Bengaluru',
    'Delhi',
  ];

  // ========================================================
  // 1. FETCH ACTIVE CATEGORIES
  // ========================================================
  const fetchActiveCategories = async () => {
    try {
      const res = await fetch('/api/categories/active');
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveCategories(data.data || []);
      }
    } catch {
      // Fallback empty
    }
  };

  useEffect(() => {
    fetchActiveCategories();
  }, []);

  // ========================================================
  // 1b. FETCH TOP RATED OFFERS (minRatings >= 3)
  // ========================================================
  const fetchTopRatedOffers = useCallback(async () => {
    setTopRatedLoading(true);
    try {
      const params = new URLSearchParams();
      if (geoCoordinates) {
        params.append('lat', geoCoordinates.lat);
        params.append('lng', geoCoordinates.lng);
        params.append('radius', '35');
      } else if (browsingCity) {
        params.append('city', browsingCity);
      }
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('sort', 'rating');
      params.append('minRatings', '3');
      params.append('limit', '3');

      const res = await fetch(`/api/offers/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTopRatedOffers(data.data.offers || []);
      } else {
        setTopRatedOffers([]);
      }
    } catch {
      setTopRatedOffers([]);
    } finally {
      setTopRatedLoading(false);
    }
  }, [browsingCity, geoCoordinates, selectedCategory]);

  useEffect(() => {
    fetchTopRatedOffers();
  }, [fetchTopRatedOffers]);

  // ========================================================
  // 2. FETCH OFFERS SEARCH
  // ========================================================
  const fetchOffers = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
          sort: sortBy,
        });

        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        }

        if (selectedCategory && selectedCategory !== 'all') {
          params.set('category', selectedCategory);
        }

        // If customer opted for "Near Me" GPS coordinates
        if (geoCoordinates) {
          params.set('lat', geoCoordinates.lat.toString());
          params.set('lng', geoCoordinates.lng.toString());
          params.set('radius', '35'); // 35km radius
        } else if (browsingCity.trim()) {
          params.set('city', browsingCity.trim());
          params.set('radius', '25'); // 25km city radius
        }

        const res = await fetch(`/api/offers/search?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch offers');
        }

        setOffers(data.data.offers || []);
        setPagination(data.data.pagination);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [
      browsingCity,
      geoCoordinates,
      pagination.limit,
      searchQuery,
      selectedCategory,
      sortBy,
    ]
  );

  useEffect(() => {
    fetchOffers(pagination.page);
  }, [fetchOffers, pagination.page]);

  // Handle GPS Current Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeoCoordinates({ lat: latitude, lng: longitude });
        setBrowsingCity('Current Location');
        setCityModalOpen(false);
        setGeoLocating(false);
      },
      (err) => {
        setGeoLocating(false);
        alert(
          `Could not retrieve location: ${err.message}. Please enter a city manually.`
        );
      },
      { timeout: 10000 }
    );
  };

  // Switch City
  const handleSelectCity = (city) => {
    setBrowsingCity(city);
    setCityInput(city);
    setGeoCoordinates(null);
    setCityModalOpen(false);
  };

  const handleCitySubmit = (e) => {
    e.preventDefault();
    if (cityInput.trim()) {
      handleSelectCity(cityInput.trim());
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ======================================================== */}
      {/* 1. HERO & CITY SWITCHER BAR                              */}
      {/* ======================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-[#0b0f19] border border-amber-500/20 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Verified Local Deals &amp; Store Promotions
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              Explore Offers Near You
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Discover genuine retail promotions, seasonal sales, and
              neighborhood deals from verified local merchants.
            </p>
          </div>

          {/* City Switcher Pill */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-950/80 p-2 sm:p-2.5 rounded-2xl border border-slate-800/90 shadow-xl">
            <div className="flex items-center gap-2 px-3 py-1 text-xs">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Browsing City
                </span>
                <span className="font-bold text-white text-sm">
                  {browsingCity}
                  {geoCoordinates ? ' (GPS)' : ' (~25km)'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCityModalOpen(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Change City
              </button>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={geoLocating}
                title="Search near my current location"
                aria-label="Use current GPS location"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Navigation
                  className={`w-3.5 h-3.5 text-amber-400 ${geoLocating ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Near Me</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DYNAMIC ACTIVE CATEGORY BAR                           */}
      {/* ======================================================== */}
      {activeCategories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Active Categories with Live Offers
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {activeCategories.length} live verticals
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {/* All Offers Pill */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-amber-500 ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>All Deals</span>
            </button>

            {/* Dynamic Active Category Pills */}
            {activeCategories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat._id)}
                className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  selectedCategory === cat._id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold'
                    : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedCategory === cat._id
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cat.offerCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SEARCH INPUT & SORT CONTROLS TOOLBAR                  */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
        {/* Free text search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals (e.g. 50% off, electronics, denim jeans, coffee)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <span className="text-xs text-slate-400 hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="relevance">Relevance &amp; Newest</option>
            <option value="distance">Distance (Nearest First)</option>
            <option value="rating">Top Rated Stores</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP RATED NEAR YOU SECTION                               */}
      {/* ======================================================== */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-950/20 via-slate-900/60 to-slate-950 border border-amber-500/20 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Top Rated Near You
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Verified Reputation (3+ Reviews)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Highest customer-rated local merchants in {browsingCity}
              </p>
            </div>
          </div>
        </div>

        {topRatedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <OfferCardSkeleton count={3} />
          </div>
        ) : topRatedOffers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topRatedOffers.map((offer) => (
              <div
                key={`top-${offer._id}`}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                      onClick={() => setSelectedVendorId(offer.vendorId?._id)}
                      className="text-xs font-bold text-white hover:text-amber-400 flex items-center gap-1.5 truncate text-left cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">
                        {offer.vendorId?.shopName}
                      </span>
                    </button>
                    {offer.discountText && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
                        {offer.discountText}
                      </span>
                    )}
                  </div>

                  <div className="mb-2">
                    <StarRating
                      rating={offer.vendorId?.avgRating}
                      totalRatings={offer.vendorId?.totalRatings}
                      size="sm"
                    />
                  </div>

                  <h4 className="text-sm font-semibold text-slate-200 line-clamp-1 group-hover:text-white transition-colors">
                    {offer.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {offer.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  {offer.distanceKm !== null ? (
                    <span className="text-amber-300/80 font-medium">
                      {offer.distanceKm} km away
                    </span>
                  ) : (
                    <span>{offer.vendorId?.city}</span>
                  )}
                  <button
                    onClick={() => setSelectedVendorId(offer.vendorId?._id)}
                    className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    View Shop &amp; Deals &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center">
            <p className="text-xs text-slate-400">
              Stores in {browsingCity} are actively building their review
              history. Rate your favorite local shops to help them get featured!
            </p>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. DEALS FEED GRID                                       */}
      {/* ======================================================== */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <OfferCardSkeleton key={i} />
          ))}
        </div>
      ) : offers.length === 0 ? (
        /* Empty State */
        <div className="p-16 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
            <Tag className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              No offers found in {browsingCity}
              {selectedCategory !== 'all' ? ' for this category' : ''}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              We couldn&apos;t find active deals matching your filters. Try
              selecting a nearby city, expanding the category, or clearing your
              search term.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
              >
                Clear Category Filter
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
              >
                Clear Search Text
              </button>
            )}
            <button
              onClick={() => handleSelectCity('Mumbai')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
            >
              Browse Mumbai Deals
            </button>
          </div>
        </div>
      ) : (
        /* Offers Grid */
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => {
              const vendor = offer.vendorId || {};
              const images =
                offer.images && offer.images.length > 0 ? offer.images : [];
              const mainImage = images[0] || vendor.shopImages?.[0];

              return (
                <div
                  key={offer._id}
                  className="rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 transition-all overflow-hidden flex flex-col justify-between group shadow-xl shadow-black/20 backdrop-blur-sm"
                >
                  <div>
                    {/* Image & Discount Badge */}
                    <div className="h-48 w-full bg-slate-950 relative overflow-hidden">
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={`${offer.title} deal at ${vendor.shopName || 'local shop'}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                          <Tag className="w-10 h-10" />
                        </div>
                      )}

                      {/* Discount Badge */}
                      {offer.discountText && (
                        <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20">
                          {offer.discountText}
                        </div>
                      )}

                      {/* Distance Badge */}
                      {offer.distanceKm !== null &&
                        offer.distanceKm !== undefined && (
                          <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-950/90 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                            {offer.distanceKm} km away
                          </div>
                        )}
                    </div>

                    {/* Offer Content */}
                    <div className="p-5 space-y-3">
                      {/* Shop Name & Rating Header */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVendorId(vendor._id)}
                          className="font-bold text-white hover:text-amber-400 text-sm truncate flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">
                            {vendor.shopName || 'Local Shop'}
                          </span>
                          {vendor.isVerifiedShop && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                        </button>

                        <StarRating
                          rating={vendor.avgRating}
                          totalRatings={vendor.totalRatings}
                          size="sm"
                        />
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-base font-bold text-white leading-snug line-clamp-1 group-hover:text-amber-300 transition-colors font-display">
                          {offer.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {offer.description}
                        </p>
                      </div>

                      {/* Location & Category Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {offer.category?.name && (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {offer.category.name}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {vendor.city ||
                            offer.location?.coordinates?.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3.5 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Valid till{' '}
                        {new Date(offer.validTill).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedVendorId(vendor._id)}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      View Deals &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} (
                {pagination.total} total offers)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchOffers(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={() => fetchOffers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CITY SWITCHER MODAL                                   */}
      {/* ======================================================== */}
      {cityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-white text-base font-display">
                <MapPin className="w-5 h-5 text-amber-400" />
                Select Browsing City
              </div>
              <button
                type="button"
                onClick={() => setCityModalOpen(false)}
                aria-label="Close city selector"
                className="text-slate-400 hover:text-white p-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCitySubmit} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Enter City or Town Name
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="e.g. Jalgaon, Dhule, Pune, Mumbai..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Popular Hubs:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_CITIES.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCity(city)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        browsingCity === city && !geoCoordinates
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCityModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Browse City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. STORE DETAIL MODAL                                    */}
      {/* ======================================================== */}
      {selectedVendorId && (
        <ShopDetailModal
          vendorId={selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
        />
      )}
    </div>
  );
}
