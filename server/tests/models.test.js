import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import mongoose from 'mongoose';
import {
  User,
  Vendor,
  Offer,
  Category,
  Rating,
  AdminReviewLog,
} from '../models/index.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/offerbazaar_test';

describe('OfferBazaar Mongoose Models Validation Test Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    // Ensure all model indexes are created (especially unique & 2dsphere indexes)
    await Promise.all([
      User.init(),
      Vendor.init(),
      Offer.init(),
      Category.init(),
      Rating.init(),
      AdminReviewLog.init(),
    ]);
  });

  beforeEach(async () => {
    // Clear collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    // Clean up and disconnect
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // 1. USER MODEL TESTS
  // ==========================================
  describe('User Model', () => {
    it('should reject when required fields (name, email, passwordHash) are missing', async () => {
      const user = new User({});
      const error = user.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.name.kind).toBe('required');
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.kind).toBe('required');
      expect(error.errors.passwordHash).toBeDefined();
      expect(error.errors.passwordHash.kind).toBe('required');
    });

    it('should reject invalid role enum values', async () => {
      const user = new User({
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed_password_123',
        role: 'super_admin', // Invalid role
      });

      const error = user.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
      expect(error.errors.role.kind).toBe('enum');
    });

    it('should accept valid roles (customer, vendor, admin)', async () => {
      for (const role of ['customer', 'vendor', 'admin']) {
        const user = new User({
          name: 'Valid User',
          email: `valid_${role}@example.com`,
          passwordHash: 'hash123',
          role,
        });
        const error = user.validateSync();
        expect(error).toBeUndefined();
      }
    });

    it('should reject invalid email format', async () => {
      const user = new User({
        name: 'John Doe',
        email: 'invalid-email-format',
        passwordHash: 'hash123',
      });
      const error = user.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });
  });

  // ==========================================
  // 2. VENDOR MODEL TESTS
  // ==========================================
  describe('Vendor Model', () => {
    const validUserId = new mongoose.Types.ObjectId();

    it('should reject when required fields are missing on active vendor', async () => {
      const vendor = new Vendor({ status: 'active' });
      const error = vendor.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.userId).toBeDefined();
      expect(error.errors.shopName).toBeDefined();
      expect(error.errors.location).toBeDefined();
      expect(error.errors.city).toBeDefined();
    });

    it('should allow creating a pending vendor with empty shopName and location during signup', async () => {
      const vendor = new Vendor({
        userId: validUserId,
        status: 'pending',
      });
      const error = vendor.validateSync();
      expect(error).toBeUndefined();
    });

    it('should reject invalid status enum values', async () => {
      const vendor = new Vendor({
        userId: validUserId,
        shopName: 'Super Store',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.076],
        },
        city: 'Mumbai',
        status: 'invalid_status', // Invalid status
      });

      const error = vendor.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
      expect(error.errors.status.kind).toBe('enum');
    });

    it('should reject malformed GeoJSON coordinates (out of range, wrong length, non-numeric)', async () => {
      const malformedCases = [
        { coords: [195, 19.076], desc: 'Longitude > 180' },
        { coords: [-190, 19.076], desc: 'Longitude < -180' },
        { coords: [72.8777, 95], desc: 'Latitude > 90' },
        { coords: [72.8777, -95], desc: 'Latitude < -90' },
        { coords: [72.8777], desc: 'Single coordinate instead of pair' },
        { coords: [72.8777, 19.076, 50], desc: '3 coordinates' },
        { coords: [], desc: 'Empty coordinate array' },
      ];

      for (const { coords } of malformedCases) {
        const vendor = new Vendor({
          userId: validUserId,
          shopName: 'Geo Test Shop',
          location: {
            type: 'Point',
            coordinates: coords,
          },
          city: 'Mumbai',
        });

        const error = vendor.validateSync();
        expect(error).toBeDefined();
        expect(error.errors['location.coordinates']).toBeDefined();
      }
    });

    it('should reject invalid GeoJSON type other than Point', async () => {
      const vendor = new Vendor({
        userId: validUserId,
        shopName: 'Type Test Shop',
        location: {
          type: 'Polygon', // Invalid type
          coordinates: [72.8777, 19.076],
        },
        city: 'Mumbai',
      });

      const error = vendor.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['location.type']).toBeDefined();
      expect(
        error.errors['location.type.kind'] || error.errors['location.type'].kind
      ).toBe('enum');
    });

    it('should successfully validate a correctly formed vendor with GeoJSON Point', async () => {
      const vendor = new Vendor({
        userId: validUserId,
        shopName: 'Authentic Indian Sweets',
        shopDescription: 'Fresh sweets and snacks',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.076], // Valid Mumbai coordinates
        },
        city: 'Mumbai',
        address: '123 MG Road, Fort',
        status: 'active',
      });

      const error = vendor.validateSync();
      expect(error).toBeUndefined();
    });
  });

  // ==========================================
  // 3. OFFER MODEL TESTS
  // ==========================================
  describe('Offer Model', () => {
    const validVendorId = new mongoose.Types.ObjectId();
    const validCategoryId = new mongoose.Types.ObjectId();

    it('should reject when required fields are missing', async () => {
      const offer = new Offer({});
      const error = offer.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.vendorId).toBeDefined();
      expect(error.errors.title).toBeDefined();
      expect(error.errors.description).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.validFrom).toBeDefined();
      expect(error.errors.validTill).toBeDefined();
      expect(error.errors.location).toBeDefined();
    });

    it('should reject invalid offer status enum values', async () => {
      const offer = new Offer({
        vendorId: validVendorId,
        title: '50% Off Electronics',
        description: 'Huge discounts on electronics this weekend',
        category: validCategoryId,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        location: {
          type: 'Point',
          coordinates: [77.209, 28.6139], // Delhi
        },
        status: 'published_live', // Invalid status
      });

      const error = offer.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
      expect(error.errors.status.kind).toBe('enum');
    });

    it('should accept valid offer status values', async () => {
      const validStatuses = [
        'pending_review',
        'approved',
        'rejected',
        'flagged_for_review',
      ];

      for (const status of validStatuses) {
        const offer = new Offer({
          vendorId: validVendorId,
          title: 'Diwali Special Offer',
          description: 'Special offers across all products',
          category: validCategoryId,
          validFrom: new Date(),
          validTill: new Date(Date.now() + 86400000),
          location: {
            type: 'Point',
            coordinates: [77.209, 28.6139],
          },
          status,
        });

        const error = offer.validateSync();
        expect(error).toBeUndefined();
      }
    });

    it('should reject malformed GeoJSON coordinates on Offer', async () => {
      const offer = new Offer({
        vendorId: validVendorId,
        title: 'Discount Sale',
        description: 'Sale description',
        category: validCategoryId,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        location: {
          type: 'Point',
          coordinates: [250, 45], // Longitude out of range
        },
      });

      const error = offer.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['location.coordinates']).toBeDefined();
    });
  });

  // ==========================================
  // 4. CATEGORY MODEL TESTS
  // ==========================================
  describe('Category Model', () => {
    it('should reject when required fields (name, slug, icon) are missing', async () => {
      const category = new Category({});
      const error = category.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.slug).toBeDefined();
      expect(error.errors.icon).toBeDefined();
    });

    it('should successfully validate valid category data', async () => {
      const category = new Category({
        name: 'Electronics',
        slug: 'electronics',
        icon: 'smartphone',
      });

      const error = category.validateSync();
      expect(error).toBeUndefined();
    });
  });

  // ==========================================
  // 5. RATING MODEL TESTS & COMPOUND UNIQUE INDEX
  // ==========================================
  describe('Rating Model', () => {
    const vendorId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();

    it('should reject when required fields (vendorId, customerId, stars) are missing', async () => {
      const rating = new Rating({});
      const error = rating.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.vendorId).toBeDefined();
      expect(error.errors.customerId).toBeDefined();
      expect(error.errors.stars).toBeDefined();
    });

    it('should reject star ratings outside 1 to 5 range or non-integers', async () => {
      const invalidStarValues = [0, -1, 6, 10, 3.5];

      for (const stars of invalidStarValues) {
        const rating = new Rating({
          vendorId,
          customerId,
          stars,
        });

        const error = rating.validateSync();
        expect(error).toBeDefined();
        expect(error.errors.stars).toBeDefined();
      }
    });

    it('should reject duplicate (vendorId, customerId) rating pairs via compound unique index', async () => {
      // 1. Insert first rating
      await Rating.create({
        vendorId,
        customerId,
        stars: 5,
        comment: 'Outstanding service and quality!',
      });

      // 2. Attempt to insert duplicate rating for same vendor and customer
      let duplicateError = null;
      try {
        await Rating.create({
          vendorId,
          customerId,
          stars: 4,
          comment: 'Another review attempt for same shop',
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000); // MongoDB Duplicate Key error code
    });

    it('should allow multiple ratings for same vendor by different customers', async () => {
      const customer2Id = new mongoose.Types.ObjectId();

      const rating1 = await Rating.create({
        vendorId,
        customerId,
        stars: 5,
      });

      const rating2 = await Rating.create({
        vendorId,
        customerId: customer2Id,
        stars: 4,
      });

      expect(rating1._id).toBeDefined();
      expect(rating2._id).toBeDefined();
    });
  });

  // ==========================================
  // 6. ADMIN REVIEW LOG MODEL TESTS
  // ==========================================
  describe('AdminReviewLog Model', () => {
    const validOfferId = new mongoose.Types.ObjectId();

    it('should reject when required fields (offerId, checkedBy, decision) are missing', async () => {
      const log = new AdminReviewLog({});
      const error = log.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.offerId).toBeDefined();
      expect(error.errors.checkedBy).toBeDefined();
      expect(error.errors.decision).toBeDefined();
    });

    it('should reject invalid decision enum values', async () => {
      const log = new AdminReviewLog({
        offerId: validOfferId,
        checkedBy: 'system',
        decision: 'invalid_decision', // Invalid decision
      });

      const error = log.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.decision).toBeDefined();
      expect(error.errors.decision.kind).toBe('enum');
    });

    it('should accept valid decisions (approved, rejected, flagged_for_review, manual_takedown_post_approval)', async () => {
      for (const decision of [
        'approved',
        'rejected',
        'flagged_for_review',
        'manual_takedown_post_approval',
      ]) {
        const log = new AdminReviewLog({
          offerId: validOfferId,
          checkedBy: 'admin_user_id_123',
          checksPerformed: {
            locationValid: true,
            dateValid: true,
            textValid: true,
            imageValid: true,
          },
          decision,
          reason: 'All automated and manual checks passed',
        });

        const error = log.validateSync();
        expect(error).toBeUndefined();
      }
    });
  });
});
