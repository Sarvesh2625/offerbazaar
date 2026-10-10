import { Vendor } from '../models/index.js';

/**
 * Middleware to resolve and attach the logged-in user's Vendor document to req.vendor
 */
export const requireVendor = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const vendor = await Vendor.findOne({ userId: req.user.userId });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found for this user account',
      });
    }

    req.vendor = vendor;
    next();
  } catch (error) {
    next(error);
  }
};
