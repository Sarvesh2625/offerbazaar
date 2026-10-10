import mongoose from 'mongoose';
import { Rating, Vendor } from '../models/index.js';

/**
 * Recalculates and updates avgRating and totalRatings denormalized on a Vendor document.
 *
 * @param {string|mongoose.Types.ObjectId} vendorId
 * @returns {Promise<{ avgRating: number, totalRatings: number }>}
 */
export async function recalculateVendorRating(vendorId) {
  const vId = new mongoose.Types.ObjectId(vendorId);

  const stats = await Rating.aggregate([
    { $match: { vendorId: vId } },
    {
      $group: {
        _id: '$vendorId',
        totalRatings: { $sum: 1 },
        avgRating: { $avg: '$stars' },
      },
    },
  ]);

  let totalRatings = 0;
  let avgRating = 0;

  if (stats.length > 0) {
    totalRatings = stats[0].totalRatings;
    // Round to 1 decimal place, e.g. 4.333 -> 4.3
    avgRating = Math.round(stats[0].avgRating * 10) / 10;
  }

  await Vendor.findByIdAndUpdate(vendorId, {
    avgRating,
    totalRatings,
  });

  return { avgRating, totalRatings };
}
