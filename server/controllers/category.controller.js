import { Category, Offer, Vendor } from '../models/index.js';

/**
 * Get all seeded categories
 * GET /api/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active categories with at least one approved offer from an active vendor
 * GET /api/categories/active
 */
export const getActiveCategories = async (req, res, next) => {
  try {
    const activeVendors = await Vendor.find({ status: 'active' }).select('_id');
    const activeVendorIds = activeVendors.map((v) => v._id);

    if (activeVendorIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const now = new Date();
    const activeCategories = await Offer.aggregate([
      {
        $match: {
          status: 'approved',
          validTill: { $gte: now },
          vendorId: { $in: activeVendorIds },
        },
      },
      {
        $group: {
          _id: '$category',
          offerCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $unwind: '$categoryInfo',
      },
      {
        $project: {
          _id: '$categoryInfo._id',
          name: '$categoryInfo.name',
          slug: '$categoryInfo.slug',
          icon: '$categoryInfo.icon',
          offerCount: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: activeCategories,
    });
  } catch (error) {
    next(error);
  }
};
