import { Offer } from '../models/index.js';
import { runOfferValidation } from '../services/validation.service.js';

/**
 * Get all offers belonging strictly to the logged-in vendor
 * GET /api/vendor/offers
 */
export const getVendorOffers = async (req, res, next) => {
  try {
    const offers = await Offer.find({ vendorId: req.vendor._id })
      .populate('category')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: offers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single offer belonging strictly to the logged-in vendor
 * GET /api/vendor/offers/:id
 */
export const getVendorOfferById = async (req, res, next) => {
  try {
    const offer = await Offer.findOne({
      _id: req.params.id,
      vendorId: req.vendor._id,
    }).populate('category');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or you do not have permission to access it',
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

/**
 * Create a new offer for the logged-in vendor
 * POST /api/vendor/offers
 */
export const createOffer = async (req, res, next) => {
  try {
    const {
      title,
      description,
      discountText,
      category,
      validFrom,
      validTill,
      images,
    } = req.body;

    // Check that vendor has a location configured
    if (
      !req.vendor.location ||
      !Array.isArray(req.vendor.location.coordinates) ||
      req.vendor.location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please set your shop location on your profile before creating offers.',
      });
    }

    // Required fields check
    if (!title || !description || !category || !validFrom || !validTill) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: title, description, category, validFrom, and validTill are required.',
      });
    }

    // Server-side date validation: validTill must be strictly after validFrom
    const fromDate = new Date(validFrom);
    const tillDate = new Date(validTill);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(tillDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format provided.',
      });
    }

    if (tillDate <= fromDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid till date must be strictly after valid from date.',
      });
    }

    // Image count check (1 to 3 images)
    const imageList = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imageList.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'You can upload a maximum of 3 images per offer.',
      });
    }

    // Copy vendor's current location onto the offer for fast geospatial search
    const offer = await Offer.create({
      vendorId: req.vendor._id,
      title: title.trim(),
      description: description.trim(),
      discountText: discountText ? discountText.trim() : '',
      category,
      validFrom: fromDate,
      validTill: tillDate,
      images: imageList,
      location: {
        type: 'Point',
        coordinates: [...req.vendor.location.coordinates],
      },
      status: 'pending_review',
      rejectionReason: [],
    });

    // Run offer validation pipeline
    await runOfferValidation(offer._id);

    const populatedOffer = await Offer.findById(offer._id).populate('category');

    return res.status(201).json({
      success: true,
      message: 'Offer created and submitted for review',
      data: populatedOffer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing offer (ownership enforced)
 * PUT /api/vendor/offers/:id
 */
export const updateOffer = async (req, res, next) => {
  try {
    // Scoped strictly to logged-in vendor
    const offer = await Offer.findOne({
      _id: req.params.id,
      vendorId: req.vendor._id,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or you do not have permission to modify it',
      });
    }

    const {
      title,
      description,
      discountText,
      category,
      validFrom,
      validTill,
      images,
    } = req.body;

    if (title !== undefined) offer.title = title.trim();
    if (description !== undefined) offer.description = description.trim();
    if (discountText !== undefined) offer.discountText = discountText.trim();
    if (category !== undefined) offer.category = category;

    // Validate dates if either is updated
    const newFrom =
      validFrom !== undefined ? new Date(validFrom) : offer.validFrom;
    const newTill =
      validTill !== undefined ? new Date(validTill) : offer.validTill;

    if (newTill <= newFrom) {
      return res.status(400).json({
        success: false,
        message: 'Valid till date must be strictly after valid from date.',
      });
    }

    offer.validFrom = newFrom;
    offer.validTill = newTill;

    if (images !== undefined) {
      const imageList = Array.isArray(images) ? images.filter(Boolean) : [];
      if (imageList.length > 3) {
        return res.status(400).json({
          success: false,
          message: 'You can upload a maximum of 3 images per offer.',
        });
      }
      offer.images = imageList;
    }

    // Refresh vendor location on offer if vendor has a valid location
    if (
      req.vendor.location &&
      Array.isArray(req.vendor.location.coordinates) &&
      req.vendor.location.coordinates.length === 2
    ) {
      offer.location = {
        type: 'Point',
        coordinates: [...req.vendor.location.coordinates],
      };
    }

    // On edit, reset status to pending_review and clear prior rejection reasons
    offer.status = 'pending_review';
    offer.rejectionReason = [];

    await offer.save();

    // Run offer validation pipeline
    await runOfferValidation(offer._id);

    const populatedOffer = await Offer.findById(offer._id).populate('category');

    return res.status(200).json({
      success: true,
      message: 'Offer updated and resubmitted for review',
      data: populatedOffer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an offer (ownership enforced)
 * DELETE /api/vendor/offers/:id
 */
export const deleteOffer = async (req, res, next) => {
  try {
    // Scoped strictly to logged-in vendor
    const offer = await Offer.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendor._id,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or you do not have permission to delete it',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Offer deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
