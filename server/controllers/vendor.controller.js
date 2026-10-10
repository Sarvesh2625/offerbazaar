import { Vendor, Offer } from '../models/index.js';

/**
 * Compute profile completeness checklist
 * @param {Object} vendor - Vendor document
 */
export const computeChecklist = (vendor) => {
  const hasShopName = !!(vendor.shopName && vendor.shopName.trim().length > 0);
  const hasLocation = !!(
    vendor.location &&
    vendor.location.type === 'Point' &&
    Array.isArray(vendor.location.coordinates) &&
    vendor.location.coordinates.length === 2 &&
    typeof vendor.location.coordinates[0] === 'number' &&
    typeof vendor.location.coordinates[1] === 'number' &&
    !Number.isNaN(vendor.location.coordinates[0]) &&
    !Number.isNaN(vendor.location.coordinates[1])
  );
  const hasCategories = !!(vendor.categories && vendor.categories.length > 0);

  const isComplete = hasShopName && hasLocation && hasCategories;

  return {
    hasShopName,
    hasLocation,
    hasCategories,
    isComplete,
    missing: [
      !hasShopName && 'Shop Name',
      !hasLocation && 'Shop Location (Coordinates)',
      !hasCategories && 'At least one Category',
    ].filter(Boolean),
  };
};

/**
 * Get current vendor profile and onboarding checklist
 * GET /api/vendor/profile
 */
export const getVendorProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id).populate('categories');
    const checklist = computeChecklist(vendor);

    return res.status(200).json({
      success: true,
      data: vendor,
      checklist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor profile and transition status to 'active' if complete
 * PUT /api/vendor/profile
 */
export const updateVendorProfile = async (req, res, next) => {
  try {
    const {
      shopName,
      shopDescription,
      address,
      city,
      categories,
      location,
      shopImages,
    } = req.body;

    const vendor = req.vendor;

    if (shopName !== undefined) vendor.shopName = shopName.trim();
    if (shopDescription !== undefined)
      vendor.shopDescription = shopDescription.trim();
    if (address !== undefined) vendor.address = address.trim();
    if (city !== undefined) vendor.city = city.trim();
    if (categories !== undefined) vendor.categories = categories;
    if (shopImages !== undefined) vendor.shopImages = shopImages;

    // Validate location GeoJSON if provided
    if (location !== undefined) {
      if (location && location.coordinates) {
        const [lng, lat] = location.coordinates;
        if (
          typeof lng !== 'number' ||
          typeof lat !== 'number' ||
          Number.isNaN(lng) ||
          Number.isNaN(lat) ||
          lng < -180 ||
          lng > 180 ||
          lat < -90 ||
          lat > 90
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Invalid location coordinates. Longitude must be between -180 and 180, latitude between -90 and 90.',
          });
        }
        vendor.location = {
          type: 'Point',
          coordinates: [lng, lat],
        };
      } else {
        vendor.location = undefined;
      }
    }

    // Evaluate completeness
    const checklist = computeChecklist(vendor);

    // Set Vendor.status to "active" only once shopName, location, and at least one category are filled in; keep "pending" otherwise
    if (checklist.isComplete) {
      vendor.status = 'active';
    } else {
      vendor.status = 'pending';
    }

    await vendor.save();
    const populatedVendor = await Vendor.findById(vendor._id).populate(
      'categories'
    );

    return res.status(200).json({
      success: true,
      message: checklist.isComplete
        ? 'Shop profile completed and activated!'
        : 'Shop profile saved. Complete remaining items to activate.',
      data: populatedVendor,
      checklist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public shop profile and active approved offers for customers
 * GET /api/vendor/:id/public
 */
export const getPublicVendorShop = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id).populate('categories');

    if (!vendor || vendor.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Shop not found or is currently not active.',
      });
    }

    const now = new Date();
    const offers = await Offer.find({
      vendorId: vendor._id,
      status: 'approved',
      validTill: { $gte: now },
    })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        vendor,
        offers,
      },
    });
  } catch (error) {
    next(error);
  }
};
