import { z } from 'zod';

/**
 * Validates a string that can be parsed into a valid Date
 */
const dateStringSchema = z
  .string({ required_error: 'Date is required' })
  .trim()
  .refine((val) => !Number.isNaN(new Date(val).getTime()), {
    message: 'Invalid date format provided',
  });

/**
 * Signup payload validation schema
 * Note: Admin accounts are strictly prohibited on public signup!
 */
export const signupSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional(),
  city: z
    .string()
    .trim()
    .max(100, 'City name cannot exceed 100 characters')
    .optional(),
  role: z
    .string({ required_error: 'Role is required' })
    .refine((val) => ['customer', 'vendor'].includes(val), {
      message:
        'Role must be either "customer" or "vendor". Admin accounts cannot be created via public signup.',
    }),
});

/**
 * Login payload validation schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password cannot exceed 128 characters'),
});

/**
 * Vendor Profile update payload schema
 * PUT /api/vendor/profile
 */
export const vendorProfileSchema = z.object({
  shopName: z
    .string()
    .trim()
    .max(150, 'Shop name cannot exceed 150 characters')
    .optional(),
  shopDescription: z
    .string()
    .trim()
    .max(2000, 'Shop description cannot exceed 2000 characters')
    .optional(),
  address: z
    .string()
    .trim()
    .max(300, 'Address cannot exceed 300 characters')
    .optional(),
  city: z
    .string()
    .trim()
    .max(100, 'City name cannot exceed 100 characters')
    .optional(),
  categories: z
    .array(z.string().trim().max(100))
    .max(20, 'Cannot select more than 20 categories')
    .optional(),
  shopImages: z
    .array(z.string().trim().max(1000))
    .max(10, 'Cannot upload more than 10 shop images')
    .optional(),
  location: z
    .object({
      type: z.literal('Point').optional().default('Point'),
      coordinates: z
        .array(z.number())
        .length(2, 'Coordinates must be [longitude, latitude]')
        .refine(
          ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
          {
            message:
              'Invalid location coordinates: longitude must be between -180 and 180, latitude between -90 and 90',
          }
        ),
    })
    .optional()
    .nullable(),
});

/**
 * Offer creation payload schema
 * POST /api/vendor/offers
 */
export const createOfferSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(150, 'Title cannot exceed 150 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(1, 'Description is required')
    .max(3000, 'Description cannot exceed 3000 characters'),
  discountText: z
    .string()
    .trim()
    .max(100, 'Discount text cannot exceed 100 characters')
    .optional()
    .default(''),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1, 'Category is required')
    .max(100, 'Category ID or slug is too long'),
  validFrom: dateStringSchema,
  validTill: dateStringSchema,
  images: z
    .array(z.string().trim().max(1000))
    .max(3, 'You can upload a maximum of 3 images per offer')
    .optional()
    .default([]),
});

/**
 * Offer edit payload schema
 * PUT /api/vendor/offers/:id
 */
export const updateOfferSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(150, 'Title cannot exceed 150 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty')
    .max(3000, 'Description cannot exceed 3000 characters')
    .optional(),
  discountText: z
    .string()
    .trim()
    .max(100, 'Discount text cannot exceed 100 characters')
    .optional(),
  category: z
    .string()
    .trim()
    .min(1, 'Category cannot be empty')
    .max(100, 'Category identifier is too long')
    .optional(),
  validFrom: dateStringSchema.optional(),
  validTill: dateStringSchema.optional(),
  images: z
    .array(z.string().trim().max(1000))
    .max(3, 'You can upload a maximum of 3 images per offer')
    .optional(),
});

/**
 * Customer Rating submission payload schema
 * POST /api/vendors/:vendorId/ratings
 */
export const ratingSchema = z.object({
  stars: z
    .number({ required_error: 'Stars rating is required' })
    .int('Stars must be an integer between 1 and 5')
    .min(1, 'Stars must be at least 1')
    .max(5, 'Stars cannot exceed 5'),
  comment: z
    .string()
    .trim()
    .max(300, 'Comment cannot exceed 300 characters')
    .optional()
    .default(''),
});

/**
 * Admin Review Decision payload schema
 * POST /api/admin/review-queue/:id/decision
 */
export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected'], {
      errorMap: () => ({
        message: 'Decision must be either "approved" or "rejected"',
      }),
    }),
    reason: z
      .string()
      .trim()
      .max(1000, 'Reason cannot exceed 1000 characters')
      .optional()
      .default(''),
  })
  .refine(
    (data) => {
      if (data.decision === 'rejected') {
        return !!(data.reason && data.reason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'A rejection reason is required when rejecting an offer',
      path: ['reason'],
    }
  );

/**
 * Admin Vendor Status update payload schema
 * PUT /api/admin/vendors/:id/status
 */
export const vendorStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended'], {
    errorMap: () => ({
      message: 'Status must be "pending", "active", or "suspended"',
    }),
  }),
});

/**
 * Admin Offer Takedown payload schema
 * POST /api/admin/live-offers/:id/takedown
 */
export const takedownSchema = z.object({
  reason: z
    .string({ required_error: 'A takedown reason is required' })
    .trim()
    .min(1, 'A takedown reason is required')
    .max(1000, 'Reason cannot exceed 1000 characters'),
});
