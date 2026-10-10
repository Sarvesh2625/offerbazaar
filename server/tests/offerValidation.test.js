import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import mongoose from 'mongoose';
import {
  User,
  Vendor,
  Offer,
  Category,
  AdminReviewLog,
} from '../models/index.js';
import {
  checkLocation,
  checkDates,
  checkText,
  checkImages,
  runOfferValidation,
  isFuzzyCityMatch,
  haversineDistanceKm,
} from '../services/offerValidation.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_validation_test';

describe('Offer Validation Pipeline Test Suite (Phase 4)', () => {
  let originalFetch;
  let originalEnv;
  let testVendorUser;
  let testVendor;
  let testCategory;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await Promise.all([
      User.init(),
      Vendor.init(),
      Offer.init(),
      Category.init(),
      AdminReviewLog.init(),
    ]);

    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Offer.deleteMany({});
    await Category.deleteMany({});
    await AdminReviewLog.deleteMany({});

    process.env.VALIDATION_MODE = 'auto';
    process.env.GEOCODING_PROVIDER = 'nominatim';
    process.env.LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    process.env.LLM_API_KEY = 'test-llm-key-123';
    process.env.LLM_MODEL = 'gpt-4o-mini';

    testCategory = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });

    testVendorUser = await User.create({
      name: 'Test Merchant',
      email: 'merchant@bazaar.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Mumbai',
    });

    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      shopName: 'Metro Electronics',
      status: 'active',
      city: 'Mumbai',
      address: '12 Linking Road, Bandra',
      categories: [testCategory._id],
      location: {
        type: 'Point',
        coordinates: [72.8347, 19.0596], // Bandra, Mumbai [lng, lat]
      },
    });

    // Default mock fetch
    global.fetch = jest.fn((url) => {
      const urlStr = url.toString();

      // OpenStreetMap Nominatim reverse geocode
      if (urlStr.includes('nominatim.openstreetmap.org/reverse')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            address: {
              city: 'Mumbai',
              suburb: 'Bandra',
              state: 'Maharashtra',
            },
            display_name: 'Bandra, Mumbai, Maharashtra, India',
            lat: '19.0596',
            lon: '72.8347',
          }),
        });
      }

      // OpenStreetMap Nominatim forward search
      if (urlStr.includes('nominatim.openstreetmap.org/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              lat: '19.0760',
              lon: '72.8777',
              display_name: 'Mumbai, Maharashtra, India',
            },
          ],
        });
      }

      // LLM endpoint
      if (
        urlStr.includes('api.openai.com') ||
        urlStr.includes('/chat/completions')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    valid: true,
                    reason: '',
                  }),
                },
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled mock URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==============================================================
  // 1. CHECK LOCATION
  // ==============================================================
  describe('checkLocation(vendor)', () => {
    it('should pass when resolved locality matches declared city', async () => {
      const result = await checkLocation(testVendor);
      expect(result.passed).toBe(true);
      expect(result.reason).toBe('');
    });

    it('should pass with fuzzy city name matching (e.g. Bombay / Navi Mumbai)', async () => {
      expect(isFuzzyCityMatch('Mumbai', 'Navi Mumbai')).toBe(true);
      expect(isFuzzyCityMatch('Mumbai', 'Bombay')).toBe(true);
      expect(isFuzzyCityMatch('Bengaluru', 'Bangalore')).toBe(true);
      expect(isFuzzyCityMatch('Delhi', 'New Delhi')).toBe(true);

      const vendorFuzzy = {
        city: 'Bombay',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      };

      const result = await checkLocation(vendorFuzzy);
      expect(result.passed).toBe(true);
    });

    it('should pass if location is within ~50km of declared city', async () => {
      // Thane coords (~25km from central Mumbai)
      const dist = haversineDistanceKm(19.076, 72.8777, 19.2183, 72.9781);
      expect(dist).toBeLessThanOrEqual(50);

      const vendorNearby = {
        city: 'Mumbai',
        location: {
          type: 'Point',
          coordinates: [72.9781, 19.2183], // Thane coords
        },
      };

      global.fetch = jest.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('nominatim.openstreetmap.org/reverse')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              address: { city: 'Thane' },
              display_name: 'Thane, Maharashtra, India',
              lat: '19.2183',
              lon: '72.9781',
            }),
          });
        }
        if (urlStr.includes('nominatim.openstreetmap.org/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              { lat: '19.0760', lon: '72.8777', display_name: 'Mumbai' },
            ],
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
      });

      const result = await checkLocation(vendorNearby);
      expect(result.passed).toBe(true);
    });

    it('should fail when shop coordinates resolve to a distant city (>50km away and not matching)', async () => {
      global.fetch = jest.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('nominatim.openstreetmap.org/reverse')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              address: { city: 'New Delhi' },
              display_name: 'Connaught Place, New Delhi, India',
              lat: '28.6315',
              lon: '77.2167',
            }),
          });
        }
        if (urlStr.includes('nominatim.openstreetmap.org/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              { lat: '19.0760', lon: '72.8777', display_name: 'Mumbai' },
            ],
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
      });

      const vendorFar = {
        city: 'Mumbai',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.6315], // Delhi coords
        },
      };

      const result = await checkLocation(vendorFar);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        "Shop coordinates don't match the declared city"
      );
    });

    it('should support swappable Google Geocoding API via GEOCODING_PROVIDER=google', async () => {
      process.env.GEOCODING_PROVIDER = 'google';
      process.env.GOOGLE_MAPS_API_KEY = 'google-key-abc';

      global.fetch = jest.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('maps.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: 'OK',
              results: [
                {
                  formatted_address:
                    'Bandra West, Mumbai, Maharashtra 400050, India',
                  address_components: [
                    { long_name: 'Mumbai', types: ['locality'] },
                  ],
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
      });

      const result = await checkLocation(testVendor);
      expect(result.passed).toBe(true);
    });

    it('should return uncertain: true if geocoding provider fails or throws network error', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('DNS lookup failed'))
      );

      const result = await checkLocation(testVendor);
      expect(result.passed).toBe(false);
      expect(result.uncertain).toBe(true);
      expect(result.reason).toMatch(/could not be completed/i);
    });
  });

  // ==============================================================
  // 2. CHECK DATES
  // ==============================================================
  describe('checkDates(offer)', () => {
    it('should pass for clean valid date range', () => {
      const now = new Date();
      const validTill = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days out

      const result = checkDates({
        validFrom: now,
        validTill,
      });

      expect(result.passed).toBe(true);
      expect(result.reason).toBe('');
    });

    it('should fail if validTill <= validFrom', () => {
      const date = new Date();
      const result = checkDates({
        validFrom: date,
        validTill: date,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Valid till date must be strictly after valid from date'
      );
    });

    it('should fail if validFrom is more than 3 days in the past', () => {
      const pastFrom = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
      const futureTill = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = checkDates({
        validFrom: pastFrom,
        validTill: futureTill,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Valid from date cannot be more than 3 days in the past'
      );
    });

    it('should fail if validTill is more than 1 year from validFrom', () => {
      const from = new Date();
      const farFuture = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000); // > 1 year

      const result = checkDates({
        validFrom: from,
        validTill: farFuture,
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('Offer validity period cannot exceed 1 year');
    });
  });

  // ==============================================================
  // 3. CHECK TEXT
  // ==============================================================
  describe('checkText(offer)', () => {
    it('should pass for clean, plausible retail offer text', async () => {
      const offer = {
        title: 'Diwali Special Electronics Sale',
        description:
          'Get flat discounts on premium wireless earbuds and smartphones this festive week.',
        discountText: 'Flat 20% Off',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(true);
      expect(result.reason).toBe('');
    });

    it('should fail if description is under 10 characters', async () => {
      const offer = {
        title: 'Laptop Sale',
        description: 'Cheap PC', // 8 chars
        discountText: '10% Off',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Offer description must be between 10 and 500 characters'
      );
    });

    it('should fail if description exceeds 500 characters', async () => {
      const offer = {
        title: 'Long Offer',
        description: 'A'.repeat(501),
        discountText: '10% Off',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Offer description must be between 10 and 500 characters'
      );
    });

    it('should fail on blanket-scam pattern: >= 90% combined with "all products"', async () => {
      const offer = {
        title: 'Mega Clearance Event',
        description: 'Huge 90% off all products for 24 hours only!',
        discountText: '90% OFF',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toMatch(/suspicious blanket discount claim/i);
    });

    it('should fail on blanket-scam pattern: >= 90% combined with "everything" or "entire store"', async () => {
      const offer1 = {
        title: 'Store Closing',
        description: 'Take 95% discount on everything in our inventory!',
        discountText: '95% off',
      };
      const result1 = await checkText(offer1);
      expect(result1.passed).toBe(false);

      const offer2 = {
        title: 'Crazy Deal',
        description: 'Flat 100% off entire store items today!',
        discountText: '100% OFF',
      };
      const result2 = await checkText(offer2);
      expect(result2.passed).toBe(false);
    });

    it('should fail on profanity in offer text', async () => {
      const offer = {
        title: 'Fuck this discount deal',
        description: 'Best deals available right here in store.',
        discountText: '15% Off',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Offer contains inappropriate or profane language'
      );
    });

    it('should fail if LLM replies valid: false with reason', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    valid: false,
                    reason:
                      'Contradictory discount terms and incoherent gibberish',
                  }),
                },
              },
            ],
          }),
        })
      );

      const offer = {
        title: 'Free gold with water bottle',
        description:
          'Buy water bottle and get pure 24k gold necklace worth one lakh.',
        discountText: '100% Free Gold',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Contradictory discount terms and incoherent gibberish'
      );
    });

    it('should defensively treat unparseable LLM output as uncertain: true (flagged_for_review)', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    'Sorry, as an AI language model I cannot parse this offer.',
                },
              },
            ],
          }),
        })
      );

      const offer = {
        title: 'Spring Electronics Sale',
        description:
          'Valid discount on soundbars and smart speakers this month.',
        discountText: '25% Off',
      };

      const result = await checkText(offer);
      expect(result.passed).toBe(false);
      expect(result.uncertain).toBe(true);
      expect(result.reason).toMatch(/unparseable response/i);
    });
  });

  // ==============================================================
  // 4. CHECK IMAGES
  // ==============================================================
  describe('checkImages(offer)', () => {
    it('should fail immediately if no images are provided', async () => {
      const result = await checkImages({ images: [] });
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('At least one offer image is required');
    });

    it('should pass when vision LLM confirms image shows shop or product', async () => {
      const offer = {
        images: ['https://res.cloudinary.com/demo/image/upload/laptop.jpg'],
      };

      const result = await checkImages(offer);
      expect(result.passed).toBe(true);
      expect(result.reason).toBe('');
    });

    it('should fail if Cloudinary moderation rejected tag is present', async () => {
      process.env.CLOUDINARY_MODERATION_ENABLED = 'true';

      const offer = {
        images: [
          'https://res.cloudinary.com/demo/image/upload/v1/moderation_rejected/bad.jpg',
        ],
      };

      const result = await checkImages(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toMatch(/failed automated moderation checks/i);
    });

    it('should fail if vision LLM rejects image with valid: false', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    valid: false,
                    reason:
                      'Image contains a landscape with no retail product or storefront',
                  }),
                },
              },
            ],
          }),
        })
      );

      const offer = {
        images: ['https://res.cloudinary.com/demo/image/upload/mountain.jpg'],
      };

      const result = await checkImages(offer);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe(
        'Image contains a landscape with no retail product or storefront'
      );
    });

    it('should defensively treat unparseable vision LLM output as uncertain: true', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Error: Rate limit exceeded or invalid format',
                },
              },
            ],
          }),
        })
      );

      const offer = {
        images: ['https://res.cloudinary.com/demo/image/upload/phone.jpg'],
      };

      const result = await checkImages(offer);
      expect(result.passed).toBe(false);
      expect(result.uncertain).toBe(true);
      expect(result.reason).toMatch(/unparseable response/i);
    });
  });

  // ==============================================================
  // 5. AGGREGATION PIPELINE (runOfferValidation)
  // ==============================================================
  describe('runOfferValidation(offerId)', () => {
    it('should approve a clean valid offer and log approved in AdminReviewLog', async () => {
      const offer = await Offer.create({
        vendorId: testVendor._id,
        title: '30% Off Winter Jackets',
        description:
          'High quality warm winter jackets on discount for the season.',
        discountText: '30% OFF',
        category: testCategory._id,
        images: ['https://res.cloudinary.com/demo/image/upload/jacket.jpg'],
        validFrom: new Date(),
        validTill: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
        status: 'pending_review',
      });

      const outcome = await runOfferValidation(offer._id);

      expect(outcome.status).toBe('approved');
      expect(outcome.decision).toBe('approved');
      expect(outcome.checksPerformed.locationValid).toBe(true);
      expect(outcome.checksPerformed.dateValid).toBe(true);
      expect(outcome.checksPerformed.textValid).toBe(true);
      expect(outcome.checksPerformed.imageValid).toBe(true);

      const updatedOffer = await Offer.findById(offer._id);
      expect(updatedOffer.status).toBe('approved');
      expect(updatedOffer.rejectionReason.length).toBe(0);

      // Verify AdminReviewLog audit entry
      const log = await AdminReviewLog.findOne({ offerId: offer._id });
      expect(log).not.toBeNull();
      expect(log.checkedBy).toBe('system');
      expect(log.decision).toBe('approved');
      expect(log.checksPerformed.locationValid).toBe(true);
      expect(log.checksPerformed.textValid).toBe(true);
    });

    it('should reject an offer on explicit failure and record rejectionReason in Offer & AdminReviewLog', async () => {
      const scamOffer = await Offer.create({
        vendorId: testVendor._id,
        title: 'Clearance Blitz',
        description: 'Flat 95% off everything in our store!',
        discountText: '95% OFF',
        category: testCategory._id,
        images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
        validFrom: new Date(),
        validTill: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
        status: 'pending_review',
      });

      const outcome = await runOfferValidation(scamOffer._id);

      expect(outcome.status).toBe('rejected');
      expect(outcome.decision).toBe('rejected');
      expect(outcome.checksPerformed.textValid).toBe(false);
      expect(outcome.rejectionReason.length).toBeGreaterThanOrEqual(1);

      const updatedOffer = await Offer.findById(scamOffer._id);
      expect(updatedOffer.status).toBe('rejected');
      expect(updatedOffer.rejectionReason[0]).toMatch(/blanket discount/i);

      const log = await AdminReviewLog.findOne({ offerId: scamOffer._id });
      expect(log).not.toBeNull();
      expect(log.checkedBy).toBe('system');
      expect(log.decision).toBe('rejected');
      expect(log.reason).toMatch(/blanket discount/i);
    });

    it('should flag for review when LLM response is unparseable', async () => {
      // Mock LLM to return unparseable string
      global.fetch = jest.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              address: { city: 'Mumbai' },
              lat: '19.0596',
              lon: '72.8347',
            }),
          });
        }
        // LLM returns bad JSON
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    'Not a JSON output: I am thinking about this offer...',
                },
              },
            ],
          }),
        });
      });

      const offer = await Offer.create({
        vendorId: testVendor._id,
        title: 'Unparseable LLM Test Deal',
        description: 'Standard discount on soundbars and headphones.',
        discountText: '10% OFF',
        category: testCategory._id,
        images: ['https://res.cloudinary.com/demo/image/upload/audio.jpg'],
        validFrom: new Date(),
        validTill: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
        status: 'pending_review',
      });

      const outcome = await runOfferValidation(offer._id);

      expect(outcome.status).toBe('flagged_for_review');
      expect(outcome.decision).toBe('flagged_for_review');

      const updatedOffer = await Offer.findById(offer._id);
      expect(updatedOffer.status).toBe('flagged_for_review');

      const log = await AdminReviewLog.findOne({ offerId: offer._id });
      expect(log.decision).toBe('flagged_for_review');
      expect(log.reason).toMatch(/unparseable response/i);
    });

    it('should bypass to flagged_for_review when VALIDATION_MODE=manual kill switch is active', async () => {
      process.env.VALIDATION_MODE = 'manual';

      const offer = await Offer.create({
        vendorId: testVendor._id,
        title: 'Manual Review Test Deal',
        description: 'High quality electronics promotion for festive season.',
        discountText: '15% OFF',
        category: testCategory._id,
        images: ['https://res.cloudinary.com/demo/image/upload/tv.jpg'],
        validFrom: new Date(),
        validTill: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
        status: 'pending_review',
      });

      const outcome = await runOfferValidation(offer._id);

      expect(outcome.status).toBe('flagged_for_review');
      expect(outcome.decision).toBe('flagged_for_review');

      const updatedOffer = await Offer.findById(offer._id);
      expect(updatedOffer.status).toBe('flagged_for_review');

      const log = await AdminReviewLog.findOne({ offerId: offer._id });
      expect(log.checkedBy).toBe('system');
      expect(log.decision).toBe('flagged_for_review');
      expect(log.reason).toMatch(/VALIDATION_MODE is set to manual review/i);
    });
  });
});
