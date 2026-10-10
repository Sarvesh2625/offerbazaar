import mongoose from 'mongoose';
import { Rating, Vendor } from '../models/index.js';
import { recalculateVendorRating } from '../services/rating.service.js';

/**
 * Upsert a customer's rating for a specific vendor.
 * Enforces one rating per (vendorId, customerId) pair using compound index upsert.
 * Recalculates vendor avgRating and totalRatings denormalized on Vendor.
 *
 * POST /api/vendors/:vendorId/ratings
 */
export async function upsertVendorRating(req, res, next) {
  try {
    const { vendorId } = req.params;
    const { stars, comment } = req.body;
    const customerId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID',
      });
    }

    // 1. Check vendor existence
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor shop not found',
      });
    }

    // 2. Abuse guard: Customer cannot rate their own shop
    if (vendor.userId && vendor.userId.toString() === customerId) {
      return res.status(400).json({
        success: false,
        message: 'Vendors cannot rate their own shop',
      });
    }

    // 3. Validate stars (1 to 5 integer)
    const numStars = Number(stars);
    if (
      stars === undefined ||
      stars === null ||
      !Number.isInteger(numStars) ||
      numStars < 1 ||
      numStars > 5
    ) {
      return res.status(400).json({
        success: false,
        message: 'Stars must be an integer between 1 and 5',
      });
    }

    // 4. Validate comment length (max 300 chars)
    const cleanComment = typeof comment === 'string' ? comment.trim() : '';
    if (cleanComment.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 300 characters',
      });
    }

    // 5. Upsert rating document
    const rating = await Rating.findOneAndUpdate(
      { vendorId, customerId },
      {
        stars: numStars,
        comment: cleanComment,
        updatedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // 6. Recalculate denormalized vendor rating stats
    const vendorStats = await recalculateVendorRating(vendorId);

    return res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating,
        vendorStats,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get paginated ratings and reviews for a specific vendor shop.
 * Publicly readable to any logged-in user.
 *
 * GET /api/vendors/:vendorId/ratings
 */
export async function getVendorRatings(req, res, next) {
  try {
    const { vendorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID',
      });
    }

    const vendor = await Vendor.findById(vendorId).select(
      'shopName avgRating totalRatings'
    );
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor shop not found',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );
    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      Rating.find({ vendorId })
        .populate('customerId', 'name city')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ vendorId }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Ratings fetched successfully',
      data: {
        ratings,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        avgRating: vendor.avgRating,
        totalRatings: vendor.totalRatings,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get the current customer's existing rating for a vendor shop (if any).
 * Used by frontend to pre-fill the review form.
 *
 * GET /api/vendors/:vendorId/ratings/my-rating
 */
export async function getCustomerRatingForVendor(req, res, next) {
  try {
    const { vendorId } = req.params;
    const customerId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID',
      });
    }

    const rating = await Rating.findOne({ vendorId, customerId }).lean();

    return res.status(200).json({
      success: true,
      message: 'Customer rating retrieved',
      data: {
        rating: rating || null,
      },
    });
  } catch (error) {
    next(error);
  }
}
