import { Offer, Vendor, Category, AdminReviewLog } from '../models/index.js';
import { notifyVendorOfReviewDecision } from '../services/notification.service.js';

/**
 * 1. GET /api/admin/review-queue
 * Paginated list of offers waiting for administrative review (flagged_for_review & pending_review)
 * Populates vendor, category, and attaches the latest AdminReviewLog entry for each offer.
 */
export const getReviewQueue = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 10)
    );
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ['flagged_for_review', 'pending_review'] },
    };

    const total = await Offer.countDocuments(filter);
    const offers = await Offer.find(filter)
      .populate({
        path: 'vendorId',
        select: 'shopName city address status userId',
        populate: {
          path: 'userId',
          select: 'name email phone',
        },
      })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach latest AdminReviewLog for each offer in the queue
    const offerIds = offers.map((o) => o._id);
    const logs = await AdminReviewLog.find({ offerId: { $in: offerIds } })
      .sort({ timestamp: -1 })
      .lean();

    const logsByOfferId = new Map();
    for (const log of logs) {
      const idStr = log.offerId.toString();
      if (!logsByOfferId.has(idStr)) {
        logsByOfferId.set(idStr, log);
      }
    }

    const enrichedOffers = offers.map((offer) => ({
      ...offer,
      latestAuditLog: logsByOfferId.get(offer._id.toString()) || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        offers: enrichedOffers,
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
 * 2. POST /api/admin/review-queue/:id/decision
 * Approve or reject an offer in the review queue.
 * Requires reason when rejecting (stored alongside automated reasons).
 * Writes new AdminReviewLog entry with checkedBy: adminUserId.
 * Notifies vendor.
 */
export const submitReviewDecision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid decision. Decision must be either "approved" or "rejected".',
      });
    }

    if (decision === 'rejected' && (!reason || !reason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required when rejecting an offer.',
      });
    }

    const offer = await Offer.findById(id).populate({
      path: 'vendorId',
      populate: { path: 'userId', select: 'name email' },
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.',
      });
    }

    // Retrieve previous log to preserve automated checksPerformed record
    const previousLog = await AdminReviewLog.findOne({
      offerId: offer._id,
    }).sort({
      timestamp: -1,
    });

    const checksPerformed = previousLog
      ? { ...previousLog.checksPerformed }
      : {
          locationValid: true,
          dateValid: true,
          textValid: true,
          imageValid: true,
        };

    const trimmedReason = reason ? reason.trim() : '';

    if (decision === 'approved') {
      offer.status = 'approved';
      offer.rejectionReason = [];
    } else {
      // Rejection: Store admin reason alongside automated reasons
      const existingReasons = Array.isArray(offer.rejectionReason)
        ? [...offer.rejectionReason]
        : [];
      const adminFormattedReason = `[Admin Review] ${trimmedReason}`;
      if (!existingReasons.includes(adminFormattedReason)) {
        existingReasons.push(adminFormattedReason);
      }
      offer.status = 'rejected';
      offer.rejectionReason = existingReasons;
    }

    await offer.save();

    // Create audit log with checkedBy: <adminUserId>
    const auditLog = await AdminReviewLog.create({
      offerId: offer._id,
      checkedBy: req.user.userId.toString(),
      checksPerformed,
      decision,
      reason:
        trimmedReason ||
        (decision === 'approved'
          ? 'Approved by administrator'
          : 'Rejected by administrator'),
      timestamp: new Date(),
    });

    // Notify vendor
    const vendorDoc = offer.vendorId;
    const vendorUser = vendorDoc?.userId;
    if (vendorUser?.email) {
      await notifyVendorOfReviewDecision({
        vendorEmail: vendorUser.email,
        vendorName: vendorUser.name,
        shopName: vendorDoc.shopName,
        offerTitle: offer.title,
        decision,
        reason: trimmedReason,
      }).catch((err) => {
        console.error('[Notification Error]:', err.message);
      });
    }

    const populatedOffer = await Offer.findById(offer._id)
      .populate('category')
      .populate('vendorId', 'shopName city address');

    return res.status(200).json({
      success: true,
      message: `Offer ${decision} successfully.`,
      data: {
        offer: populatedOffer,
        log: auditLog,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. GET /api/admin/vendors
 * Searchable/filterable list of all vendors:
 * Filter by city, category, and status (pending, active, suspended).
 * Search by shopName.
 * Paginated.
 */
export const getVendors = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 10)
    );
    const skip = (page - 1) * limit;

    const { city, category, status, search } = req.query;
    const filter = {};

    if (status && ['pending', 'active', 'suspended'].includes(status)) {
      filter.status = status;
    }

    if (city && city.trim()) {
      filter.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    if (category && category.trim()) {
      filter.categories = category.trim();
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { shopName: new RegExp(term, 'i') },
        { city: new RegExp(term, 'i') },
        { address: new RegExp(term, 'i') },
      ];
    }

    const total = await Vendor.countDocuments(filter);
    const vendors = await Vendor.find(filter)
      .populate('categories', 'name slug icon')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        vendors,
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
 * 4. PUT /api/admin/vendors/:id/status
 * Suspend or reactivate a vendor.
 * Setting status to "suspended" hides approved offers from customer queries immediately.
 * Reactivating restores them without needing re-approval.
 */
export const updateVendorStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "pending", "active", or "suspended".',
      });
    }

    const vendor = await Vendor.findByIdAndUpdate(id, { status }, { new: true })
      .populate('categories', 'name slug icon')
      .populate('userId', 'name email phone');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Vendor status updated to "${status}".`,
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. GET /api/admin/analytics
 * Dashboard metrics:
 * - Total vendors by status (pending, active, suspended)
 * - Total offers by status (pending_review, approved, rejected, flagged_for_review)
 * - Offers per category
 * - Line/bar chart data of offers approved vs. rejected per day over the last 30 days
 */
export const getAnalytics = async (req, res, next) => {
  try {
    // 1. Vendors by status
    const [pendingVendors, activeVendors, suspendedVendors, totalVendors] =
      await Promise.all([
        Vendor.countDocuments({ status: 'pending' }),
        Vendor.countDocuments({ status: 'active' }),
        Vendor.countDocuments({ status: 'suspended' }),
        Vendor.countDocuments({}),
      ]);

    const vendorsByStatus = {
      total: totalVendors,
      pending: pendingVendors,
      active: activeVendors,
      suspended: suspendedVendors,
    };

    // 2. Offers by status
    const [
      pendingReviewOffers,
      approvedOffers,
      rejectedOffers,
      flaggedReviewOffers,
      totalOffers,
    ] = await Promise.all([
      Offer.countDocuments({ status: 'pending_review' }),
      Offer.countDocuments({ status: 'approved' }),
      Offer.countDocuments({ status: 'rejected' }),
      Offer.countDocuments({ status: 'flagged_for_review' }),
      Offer.countDocuments({}),
    ]);

    const offersByStatus = {
      total: totalOffers,
      pending_review: pendingReviewOffers,
      approved: approvedOffers,
      rejected: rejectedOffers,
      flagged_for_review: flaggedReviewOffers,
    };

    // 3. Offers per category
    const categoryAggregation = await Offer.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
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
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
          slug: { $ifNull: ['$categoryInfo.slug', ''] },
          icon: { $ifNull: ['$categoryInfo.icon', 'tag'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // 4. Daily approved vs rejected over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyLogs = await AdminReviewLog.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          decision: { $in: ['approved', 'rejected'] },
        },
      },
      {
        $project: {
          decision: 1,
          dateStr: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp',
            },
          },
        },
      },
      {
        $group: {
          _id: {
            date: '$dateStr',
            decision: '$decision',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build continuous 30-day timeline
    const dateMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dateMap.set(key, { date: key, approved: 0, rejected: 0 });
    }

    for (const item of dailyLogs) {
      const date = item._id.date;
      const decision = item._id.decision;
      if (dateMap.has(date)) {
        const entry = dateMap.get(date);
        if (decision === 'approved') entry.approved = item.count;
        if (decision === 'rejected') entry.rejected = item.count;
      } else {
        dateMap.set(date, {
          date,
          approved: decision === 'approved' ? item.count : 0,
          rejected: decision === 'rejected' ? item.count : 0,
        });
      }
    }

    const dailyDecisionsLast30Days = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return res.status(200).json({
      success: true,
      data: {
        vendorsByStatus,
        offersByStatus,
        offersByCategory: categoryAggregation,
        dailyDecisionsLast30Days,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. GET /api/admin/live-offers
 * Paginated list of already-approved offers currently live on the marketplace.
 * Searchable and filterable by vendor, city, category, and free-text search term.
 */
export const getLiveOffers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 10)
    );
    const skip = (page - 1) * limit;

    const { search, vendor, city, category } = req.query;
    const filter = {
      status: 'approved',
    };

    // 1. Vendor & City filtering
    const vendorQuery = {};
    if (city && city.trim()) {
      vendorQuery.city = new RegExp(`^${city.trim()}$`, 'i');
    }
    if (vendor && vendor.trim()) {
      const vTerm = vendor.trim();
      if (vTerm.match(/^[0-9a-fA-F]{24}$/)) {
        vendorQuery._id = vTerm;
      } else {
        vendorQuery.shopName = new RegExp(vTerm, 'i');
      }
    }

    if (Object.keys(vendorQuery).length > 0) {
      const matchingVendors = await Vendor.find(vendorQuery)
        .select('_id')
        .lean();
      const matchingVendorIds = matchingVendors.map((v) => v._id);
      filter.vendorId = { $in: matchingVendorIds };
    }

    // 2. Category filtering
    if (category && category.trim()) {
      const catTerm = category.trim();
      if (catTerm.match(/^[0-9a-fA-F]{24}$/)) {
        filter.category = catTerm;
      } else {
        const catDoc = await Category.findOne({
          $or: [{ slug: catTerm }, { name: new RegExp(`^${catTerm}$`, 'i') }],
        })
          .select('_id')
          .lean();
        if (catDoc) {
          filter.category = catDoc._id;
        } else {
          filter.category = null;
        }
      }
    }

    // 3. Free-text search (q or search) on title, description, discountText
    const searchTerm = search || req.query.q;
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      filter.$or = [
        { title: new RegExp(term, 'i') },
        { description: new RegExp(term, 'i') },
        { discountText: new RegExp(term, 'i') },
      ];
    }

    const total = await Offer.countDocuments(filter);
    const offers = await Offer.find(filter)
      .populate({
        path: 'vendorId',
        select:
          'shopName city address status userId avgRating totalRatings isVerifiedShop',
        populate: {
          path: 'userId',
          select: 'name email phone',
        },
      })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        offers,
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
 * 7. POST /api/admin/live-offers/:id/takedown (or /api/admin/offers/:id/takedown)
 * Take down an approved offer:
 * - Sets status to "rejected"
 * - Requires the admin to enter a reason (stored in rejectionReason)
 * - Writes a new AdminReviewLog entry with checkedBy: <adminUserId>, decision: "manual_takedown_post_approval"
 * - Dispatches notification to vendor with takedown reason
 */
export const takeDownOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A takedown reason is required when taking down an offer.',
      });
    }

    const offer = await Offer.findById(id).populate({
      path: 'vendorId',
      populate: { path: 'userId', select: 'name email' },
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.',
      });
    }

    const trimmedReason = reason.trim();

    // Retrieve previous log to preserve automated checksPerformed record if available
    const previousLog = await AdminReviewLog.findOne({
      offerId: offer._id,
    }).sort({ timestamp: -1 });

    const checksPerformed = previousLog
      ? { ...previousLog.checksPerformed }
      : {
          locationValid: true,
          dateValid: true,
          textValid: true,
          imageValid: true,
        };

    // Update offer status to "rejected" and store reason in rejectionReason
    offer.status = 'rejected';
    const existingReasons = Array.isArray(offer.rejectionReason)
      ? [...offer.rejectionReason]
      : [];
    if (!existingReasons.includes(trimmedReason)) {
      existingReasons.push(trimmedReason);
    }
    offer.rejectionReason = existingReasons;

    await offer.save();

    // Create AdminReviewLog entry with checkedBy: <adminUserId> and decision: "manual_takedown_post_approval"
    const auditLog = await AdminReviewLog.create({
      offerId: offer._id,
      checkedBy: req.user.userId.toString(),
      checksPerformed,
      decision: 'manual_takedown_post_approval',
      reason: trimmedReason,
      timestamp: new Date(),
    });

    // Notify vendor of takedown
    const vendorDoc = offer.vendorId;
    const vendorUser = vendorDoc?.userId;
    if (vendorUser?.email) {
      await notifyVendorOfReviewDecision({
        vendorEmail: vendorUser.email,
        vendorName: vendorUser.name,
        shopName: vendorDoc.shopName,
        offerTitle: offer.title,
        decision: 'manual_takedown_post_approval',
        reason: trimmedReason,
      }).catch((err) => {
        console.error('[Notification Error]:', err.message);
      });
    }

    const populatedOffer = await Offer.findById(offer._id)
      .populate('category')
      .populate('vendorId', 'shopName city address');

    return res.status(200).json({
      success: true,
      message: 'Offer taken down successfully.',
      data: {
        offer: populatedOffer,
        log: auditLog,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getReviewQueue,
  submitReviewDecision,
  getVendors,
  updateVendorStatus,
  getAnalytics,
  getLiveOffers,
  takeDownOffer,
};
