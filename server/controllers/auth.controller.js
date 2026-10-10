import bcrypt from 'bcryptjs';
import { User, Vendor } from '../models/index.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/jwt.js';

/**
 * Register a new customer or vendor
 * POST /api/auth/signup
 */
export const signup = async (req, res, next) => {
  try {
    const { name, email, password, phone, city, role } = req.body;

    // Check if user with given email already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    // Hash password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user document
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      phone: phone || '',
      city: city || '',
    });

    let vendor = null;
    // When role is vendor, automatically create linked Vendor document with status: 'pending'
    if (role === 'vendor') {
      vendor = await Vendor.create({
        userId: user._id,
        status: 'pending',
        shopName: '',
        city: user.city || '',
      });
    }

    // Generate JWT and set httpOnly cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        city: user.city,
        createdAt: user.createdAt,
        vendor: vendor
          ? {
              id: vendor._id,
              status: vendor.status,
              shopName: vendor.shopName,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user and issue JWT
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare passwords securely with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Fetch linked vendor profile if role is vendor
    let vendor = null;
    if (user.role === 'vendor') {
      vendor = await Vendor.findOne({ userId: user._id });
    }

    // Generate JWT and set httpOnly cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        city: user.city,
        createdAt: user.createdAt,
        vendor: vendor
          ? {
              id: vendor._id,
              status: vendor.status,
              shopName: vendor.shopName,
              isVerifiedShop: vendor.isVerifiedShop,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current logged in user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    let vendor = null;
    if (user.role === 'vendor') {
      vendor = await Vendor.findOne({ userId: user._id });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        city: user.city,
        createdAt: user.createdAt,
        vendor: vendor
          ? {
              id: vendor._id,
              status: vendor.status,
              shopName: vendor.shopName,
              isVerifiedShop: vendor.isVerifiedShop,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear authentication session
 * POST /api/auth/logout
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};
