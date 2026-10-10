import { Offer, Vendor, Category } from '../models/index.js';
import {
  forwardGeocodeCity,
  haversineDistanceKm,
} from '../services/geocoding.service.js';

/**
 * Helper to resolve active vendor IDs
 */
const getActiveVendorIds = async (extraVendorFilter = {}) => {
  const vendors = await Vendor.find({
    status: 'active',
    ...extraVendorFilter,
  })
    .select('_id')
    .lean();
  return vendors.map((v) => v._id);
};

/**
 * GET /api/offers/search
 * Comprehensive deal search with:
 * - Mandatory active-vendor + approved status filtering
 * - Forward geocoding for city searches with ~25km radius
 * - "Near Me" search with lat/lng + radius
 * - Free-text search on title and description
 * - Category filter
 * - Sorting by relevance, distance, or vendor rating
 * - Distance calculation in km
 */
export const searchOffers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 12)
    );
    const skip = (page - 1) * limit;

    const { q, city, category, lat, lng, radius, sort, offerId, id } =
      req.query;

    // 1. Mandatory base filter: Active vendors only
    const activeVendorIds = await getActiveVendorIds();
    if (activeVendorIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          offers: [],
          searchedLocation: null,
          pagination: { total: 0, page, limit, totalPages: 1 },
        },
      });
    }

    const now = new Date();
    const offerFilter = {
      status: 'approved',
      validTill: { $gte: now },
      vendorId: { $in: activeVendorIds },
    };

    // Direct query by offer ID filter
    const directId = offerId || id;
    if (directId && directId.trim().match(/^[0-9a-fA-F]{24}$/)) {
      offerFilter._id = directId.trim();
    }

    // 2. Category filtering (accepts either Category ObjectId or slug)
    if (category && category.trim()) {
      const catTrimmed = category.trim();
      if (catTrimmed.match(/^[0-9a-fA-F]{24}$/)) {
        offerFilter.category = catTrimmed;
      } else {
        const catDoc = await Category.findOne({ slug: catTrimmed }).select(
          '_id'
        );
        if (catDoc) {
          offerFilter.category = catDoc._id;
        }
      }
    }

    // 3. Free-text search (q)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      offerFilter.$or = [
        { title: new RegExp(searchTerm, 'i') },
        { description: new RegExp(searchTerm, 'i') },
        { discountText: new RegExp(searchTerm, 'i') },
      ];
    }

    // 4. Geospatial / City Location Resolution
    let searchLat = null;
    let searchLng = null;
    const resolvedCityName = city ? city.trim() : null;
    const radiusKm = Math.max(1, parseFloat(radius) || 25);

    if (
      lat &&
      lng &&
      !Number.isNaN(parseFloat(lat)) &&
      !Number.isNaN(parseFloat(lng))
    ) {
      searchLat = parseFloat(lat);
      searchLng = parseFloat(lng);
    } else if (resolvedCityName) {
      const geocoded = await forwardGeocodeCity(resolvedCityName);
      if (geocoded) {
        searchLat = geocoded.lat;
        searchLng = geocoded.lon;
      }
    }

    if (searchLat !== null && searchLng !== null) {
      // 2dsphere index radius filtering with $centerSphere ([lng, lat], radiusInRadians)
      const radiusRadians = radiusKm / 6371;
      offerFilter.location = {
        $geoWithin: {
          $centerSphere: [[searchLng, searchLat], radiusRadians],
        },
      };
    } else if (resolvedCityName) {
      // Fallback if city coordinates could not be geocoded: filter by vendor city
      const cityVendors = await Vendor.find({
        status: 'active',
        city: new RegExp(`^${resolvedCityName}$`, 'i'),
      }).select('_id');
      offerFilter.vendorId = {
        $in: cityVendors.map((v) => v._id),
      };
    }

    // 5. Query execution
    const rawOffers = await Offer.find(offerFilter)
      .populate('category', 'name slug icon')
      .populate(
        'vendorId',
        'shopName city address avgRating totalRatings isVerifiedShop shopImages'
      )
      .lean();

    // 6. Distance computation
    const processedOffers = rawOffers.map((offer) => {
      let distanceKm = null;
      if (
        searchLat !== null &&
        searchLng !== null &&
        offer.location &&
        Array.isArray(offer.location.coordinates) &&
        offer.location.coordinates.length === 2
      ) {
        const [oLng, oLat] = offer.location.coordinates;
        const dist = haversineDistanceKm(searchLat, searchLng, oLat, oLng);
        distanceKm = Math.round(dist * 10) / 10;
      }
      return {
        ...offer,
        distanceKm,
      };
    });

    // 7. Filter by minimum total ratings (e.g. for Top Rated discovery)
    let candidateOffers = processedOffers;
    const minRatingsThreshold = parseInt(req.query.minRatings, 10);
    if (!Number.isNaN(minRatingsThreshold) && minRatingsThreshold > 0) {
      candidateOffers = candidateOffers.filter(
        (offer) => (offer.vendorId?.totalRatings || 0) >= minRatingsThreshold
      );
    }

    // 8. Sorting
    const sortMode = (sort || 'relevance').toLowerCase();
    if (sortMode === 'distance' && searchLat !== null && searchLng !== null) {
      candidateOffers.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortMode === 'rating') {
      candidateOffers.sort((a, b) => {
        const ratingA = a.vendorId?.avgRating || 0;
        const ratingB = b.vendorId?.avgRating || 0;
        return ratingB - ratingA;
      });
    } else {
      // Default: relevance / newest first
      candidateOffers.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // 9. Pagination slice
    const total = candidateOffers.length;
    const paginatedOffers = candidateOffers.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      data: {
        offers: paginatedOffers,
        searchedLocation:
          searchLat !== null && searchLng !== null
            ? {
                city: resolvedCityName,
                lat: searchLat,
                lng: searchLng,
                radiusKm,
              }
            : null,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/offers
 * Customer-facing general offer listing (redirects or proxies to searchOffers)
 */
export const getCustomerOffers = async (req, res, next) => {
  return searchOffers(req, res, next);
};

/**
 * GET /api/offers/:id
 * Customer-facing single offer details
 * Strict visibility guardrails: Offer must be "approved", validTill >= now, and vendor must be "active"
 */
export const getPublicOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or no longer active',
      });
    }

    const activeVendorIds = await getActiveVendorIds();
    if (activeVendorIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or no longer active',
      });
    }

    const offer = await Offer.findOne({
      _id: id,
      status: 'approved',
      validTill: { $gte: new Date() },
      vendorId: { $in: activeVendorIds },
    })
      .populate('category', 'name slug icon')
      .populate(
        'vendorId',
        'shopName city address avgRating totalRatings isVerifiedShop shopImages'
      );

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or no longer active',
      });
    }

    return res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  searchOffers,
  getCustomerOffers,
  getPublicOfferById,
};
