import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { User, Vendor, Offer, Category } from '../models/index.js';
import { generateToken } from '../utils/jwt.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_vendor_test';

describe('OfferBazaar Vendor Dashboard & Offer Management Test Suite', () => {
  let vendorAUser, vendorBUser, customerUser;
  let vendorAToken, vendorBToken, customerToken;
  let vendorADoc;
  let testCategory1, testCategory2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await Promise.all([
      User.init(),
      Vendor.init(),
      Offer.init(),
      Category.init(),
    ]);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Offer.deleteMany({});
    await Category.deleteMany({});

    // Seed test categories
    testCategory1 = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });
    testCategory2 = await Category.create({
      name: 'Clothing',
      slug: 'clothing',
      icon: 'shirt',
    });

    // 1. Create Vendor A
    vendorAUser = await User.create({
      name: 'Vendor Alice',
      email: 'alice@store.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Mumbai',
    });
    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      status: 'pending',
      shopName: '',
      city: 'Mumbai',
    });
    vendorAToken = generateToken(vendorAUser);

    // 2. Create Vendor B
    vendorBUser = await User.create({
      name: 'Vendor Bob',
      email: 'bob@store.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Pune',
    });
    await Vendor.create({
      userId: vendorBUser._id,
      status: 'pending',
      shopName: '',
      city: 'Pune',
    });
    vendorBToken = generateToken(vendorBUser);

    // 3. Create Customer
    customerUser = await User.create({
      name: 'Customer Charlie',
      email: 'charlie@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
    });
    customerToken = generateToken(customerUser);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // 1. CATEGORIES ENDPOINT
  // ==========================================
  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  // ==========================================
  // 2. VENDOR ACCESS RESTRICTIONS
  // ==========================================
  describe('Vendor Route Access Control', () => {
    it('should reject unauthenticated access with 401', async () => {
      const res = await request(app).get('/api/vendor/profile');
      expect(res.status).toBe(401);
    });

    it('should reject non-vendor (customer) with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/vendor/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 3. SHOP PROFILE & COMPLETION CHECKLIST
  // ==========================================
  describe('Shop Profile Management', () => {
    it('should retrieve fresh vendor profile with incomplete checklist', async () => {
      const res = await request(app)
        .get('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.checklist.isComplete).toBe(false);
      expect(res.body.checklist.hasShopName).toBe(false);
      expect(res.body.checklist.hasLocation).toBe(false);
      expect(res.body.checklist.hasCategories).toBe(false);
      expect(res.body.checklist.missing.length).toBe(3);
    });

    it('should update profile partially and keep status "pending" if checklist is incomplete', async () => {
      const res = await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          shopName: "Alice's Bakery",
          shopDescription: 'Fresh bread and cakes',
          address: '42 Main Street',
          city: 'Mumbai',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.shopName).toBe("Alice's Bakery");
      expect(res.body.data.status).toBe('pending');
      expect(res.body.checklist.hasShopName).toBe(true);
      expect(res.body.checklist.hasLocation).toBe(false);
      expect(res.body.checklist.isComplete).toBe(false);
    });

    it('should transition status to "active" once shopName, location, and >=1 category are provided', async () => {
      const res = await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          shopName: "Alice's Tech Zone",
          shopDescription: 'Quality electronics and gadgets',
          address: '101 Cyber Hub',
          city: 'Mumbai',
          categories: [testCategory1._id],
          location: {
            type: 'Point',
            coordinates: [72.8777, 19.076], // Valid Mumbai coords [lng, lat]
          },
          shopImages: [
            'https://res.cloudinary.com/demo/image/upload/shop1.jpg',
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
      expect(res.body.checklist.isComplete).toBe(true);
      expect(res.body.checklist.missing.length).toBe(0);
      expect(res.body.data.location.coordinates).toEqual([72.8777, 19.076]);
    });

    it('should reject invalid location coordinates', async () => {
      const res = await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          location: {
            type: 'Point',
            coordinates: [200, 19.076], // Longitude > 180
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid location coordinates/i);
    });
  });

  // ==========================================
  // 4. OFFER CRUD & STRICT OWNERSHIP
  // ==========================================
  describe('Offer CRUD & Strict Ownership Scoping', () => {
    beforeEach(async () => {
      // Activate Vendor A with valid location
      await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          shopName: "Alice's Electronics",
          categories: [testCategory1._id],
          location: {
            type: 'Point',
            coordinates: [72.8777, 19.076],
          },
        });

      // Activate Vendor B with valid location
      await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorBToken}`)
        .send({
          shopName: "Bob's Apparel",
          categories: [testCategory2._id],
          location: {
            type: 'Point',
            coordinates: [73.8567, 18.5204],
          },
        });
    });

    it('should create an offer, copy vendor location, and submit for review', async () => {
      const fromDate = new Date();
      const tillDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: '30% Off Laptops',
          description: 'Great weekend deal on student laptops',
          discountText: '30% OFF',
          category: testCategory1._id,
          validFrom: fromDate.toISOString(),
          validTill: tillDate.toISOString(),
          images: ['https://res.cloudinary.com/demo/image/upload/laptop.jpg'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(['pending_review', 'flagged_for_review', 'approved']).toContain(
        res.body.data.status
      );
      expect(res.body.data.location.coordinates).toEqual([72.8777, 19.076]); // Copied from Vendor A
      expect(res.body.data.vendorId.toString()).toBe(vendorADoc._id.toString());
    });

    it('should reject offer creation if validTill is before or equal to validFrom', async () => {
      const fromDate = new Date();
      const invalidTillDate = new Date(Date.now() - 1000); // In the past

      const res = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: 'Invalid Date Deal',
          description: 'This should fail',
          category: testCategory1._id,
          validFrom: fromDate.toISOString(),
          validTill: invalidTillDate.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/strictly after/i);
    });

    it('should enforce strict ownership: Vendor B cannot fetch, update, or delete Vendor A’s offer', async () => {
      // 1. Vendor A creates an offer
      const createRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: "Alice's Exclusive Deal",
          description: 'Protected deal description',
          category: testCategory1._id,
          validFrom: new Date().toISOString(),
          validTill: new Date(Date.now() + 86400000).toISOString(),
        });

      const offerAId = createRes.body.data._id;

      // 2. Vendor B attempts to GET Vendor A's offer
      const getRes = await request(app)
        .get(`/api/vendor/offers/${offerAId}`)
        .set('Authorization', `Bearer ${vendorBToken}`);

      expect(getRes.status).toBe(404);

      // 3. Vendor B attempts to UPDATE Vendor A's offer
      const putRes = await request(app)
        .put(`/api/vendor/offers/${offerAId}`)
        .set('Authorization', `Bearer ${vendorBToken}`)
        .send({
          title: 'Hacked Title By Bob',
        });

      expect(putRes.status).toBe(404);

      // 4. Vendor B attempts to DELETE Vendor A's offer
      const delRes = await request(app)
        .delete(`/api/vendor/offers/${offerAId}`)
        .set('Authorization', `Bearer ${vendorBToken}`);

      expect(delRes.status).toBe(404);

      // 5. Verify offer still exists and was not altered
      const verifyRes = await request(app)
        .get(`/api/vendor/offers/${offerAId}`)
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.title).toBe("Alice's Exclusive Deal");
    });

    it('should allow editing a rejected offer and reset status for review', async () => {
      // 1. Vendor A creates offer
      const createRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: 'Flash Deal',
          description: 'Special weekend sale deal',
          category: testCategory1._id,
          validFrom: new Date().toISOString(),
          validTill: new Date(Date.now() + 86400000).toISOString(),
          images: ['https://res.cloudinary.com/demo/image/upload/flash.jpg'],
        });

      const offerId = createRes.body.data._id;

      // 2. Simulate rejection by admin/system
      await Offer.findByIdAndUpdate(offerId, {
        status: 'rejected',
        rejectionReason: ['Discount text is unclear', 'Image quality too low'],
      });

      const rejectedDoc = await Offer.findById(offerId);
      expect(rejectedDoc.status).toBe('rejected');
      expect(rejectedDoc.rejectionReason.length).toBe(2);

      // 3. Vendor edits & resubmits the offer
      const editRes = await request(app)
        .put(`/api/vendor/offers/${offerId}`)
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: 'Flash Deal - Updated & Clear',
          discountText: 'Flat 20% Off',
          images: ['https://res.cloudinary.com/demo/image/upload/flash2.jpg'],
        });

      expect(editRes.status).toBe(200);
      expect(['pending_review', 'flagged_for_review', 'approved']).toContain(
        editRes.body.data.status
      );
      expect(editRes.body.data.title).toBe('Flash Deal - Updated & Clear');
    });

    it('should delete an offer successfully by its owner', async () => {
      const createRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          title: 'Offer to Delete',
          description: 'Temporary offer',
          category: testCategory1._id,
          validFrom: new Date().toISOString(),
          validTill: new Date(Date.now() + 86400000).toISOString(),
        });

      const offerId = createRes.body.data._id;

      const delRes = await request(app)
        .delete(`/api/vendor/offers/${offerId}`)
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Confirm deleted
      const checkRes = await request(app)
        .get(`/api/vendor/offers/${offerId}`)
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});
