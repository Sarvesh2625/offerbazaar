import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { User, Vendor, Offer, Category, Rating } from '../models/index.js';
import { generateToken } from '../utils/jwt.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_rating_test';

describe('Vendor Rating & Reputation Test Suite (Phase 7)', () => {
  let customerUser1, customerToken1;
  let customerUser2, customerToken2;
  let customerUser3, customerToken3;
  let vendorOwnerUser, vendorOwnerToken;
  let adminUser, adminToken;
  let vendorShopA, vendorShopB;
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
      Rating.init(),
    ]);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Offer.deleteMany({});
    await Category.deleteMany({});
    await Rating.deleteMany({});

    // 1. Seed Category
    testCategory = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });

    // 2. Seed Users
    customerUser1 = await User.create({
      name: 'Rohan Customer',
      email: 'rohan@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
      city: 'Pune',
    });
    customerToken1 = generateToken(customerUser1);

    customerUser2 = await User.create({
      name: 'Pooja Customer',
      email: 'pooja@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
      city: 'Pune',
    });
    customerToken2 = generateToken(customerUser2);

    customerUser3 = await User.create({
      name: 'Amit Customer',
      email: 'amit@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
      city: 'Pune',
    });
    customerToken3 = generateToken(customerUser3);

    vendorOwnerUser = await User.create({
      name: 'Suresh Vendor',
      email: 'suresh@vendor.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Pune',
    });
    vendorOwnerToken = generateToken(vendorOwnerUser);

    adminUser = await User.create({
      name: 'Admin Boss',
      email: 'admin@bazaar.com',
      passwordHash: 'hash123',
      role: 'admin',
      city: 'Mumbai',
    });
    adminToken = generateToken(adminUser);

    // 3. Seed Vendors
    vendorShopA = await Vendor.create({
      userId: vendorOwnerUser._id,
      shopName: 'Suresh Tech Hub',
      shopDescription: 'Best gadgets in town',
      categories: [testCategory._id],
      status: 'active',
      city: 'Pune',
      address: 'FC Road, Pune',
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
      avgRating: 0,
      totalRatings: 0,
    });

    const userB = await User.create({
      name: 'Ganesh Merchant',
      email: 'ganesh@merchant.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Pune',
    });
    vendorShopB = await Vendor.create({
      userId: userB._id,
      shopName: 'Ganesh Appliances',
      shopDescription: 'Quality home appliances',
      categories: [testCategory._id],
      status: 'active',
      city: 'Pune',
      address: 'JM Road, Pune',
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
      avgRating: 0,
      totalRatings: 0,
    });

    // 4. Seed Offers
    const now = new Date();
    const future = new Date(Date.now() + 10 * 86400000);

    await Offer.create({
      vendorId: vendorShopA._id,
      title: 'Mega Laptop Discount',
      description: 'Laptops with flat 30% discount this week only.',
      discountText: '30% OFF',
      category: testCategory._id,
      validFrom: now,
      validTill: future,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
    });

    await Offer.create({
      vendorId: vendorShopB._id,
      title: 'Kitchen Appliance Sale',
      description: 'Mixers and blenders at wholesale rates.',
      discountText: '40% OFF',
      category: testCategory._id,
      validFrom: now,
      validTill: future,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==============================================================
  // 1. ACCESS CONTROL & ROLE AUTHORIZATION
  // ==============================================================
  describe('Authorization & Access Control', () => {
    it('should reject rating submission without auth token with 401', async () => {
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .send({ stars: 5, comment: 'Great shop!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject vendor role from submitting ratings with 403', async () => {
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${vendorOwnerToken}`)
        .send({ stars: 5, comment: 'I am a vendor trying to rate' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject admin role from submitting customer ratings with 403', async () => {
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stars: 5, comment: 'Admin review' });

      expect(res.status).toBe(403);
    });

    it('should allow customer role to submit rating with 200', async () => {
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5, comment: 'Super fast service!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating.stars).toBe(5);
      expect(res.body.data.rating.comment).toBe('Super fast service!');
    });

    it('should return 404 if vendor shop does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/vendors/${fakeId}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 4 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Vendor shop not found');
    });
  });

  // ==============================================================
  // 2. ABUSE GUARDS & VALIDATION
  // ==============================================================
  describe('Abuse Guards & Field Validation', () => {
    it('should prevent a customer linked to the vendor from rating their own shop', async () => {
      // Create customer token for vendor owner user if they were a customer
      const ownerAsCustomer = await User.create({
        name: 'Suresh Alternate',
        email: 'suresh_cust@test.com',
        passwordHash: 'hash123',
        role: 'customer',
        city: 'Pune',
      });
      // Link vendorShopA to this userId
      vendorShopA.userId = ownerAsCustomer._id;
      await vendorShopA.save();

      const ownerToken = generateToken(ownerAsCustomer);
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ stars: 5, comment: 'Best shop in Pune!' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot rate their own shop');
    });

    it('should reject stars outside 1-5 range', async () => {
      const resZero = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 0 });
      expect(resZero.status).toBe(400);

      const resSix = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 6 });
      expect(resSix.status).toBe(400);
    });

    it('should reject non-integer stars', async () => {
      const resFloat = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 3.5 });
      expect(resFloat.status).toBe(400);
      expect(resFloat.body.message).toContain('integer between 1 and 5');
    });

    it('should reject comments exceeding 300 characters', async () => {
      const longComment = 'a'.repeat(301);
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 4, comment: longComment });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot exceed 300 characters');
    });

    it('should accept empty or omitted comments', async () => {
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data.rating.stars).toBe(4);
      expect(res.body.data.rating.comment).toBe('');
    });
  });

  // ==============================================================
  // 3. UPSERT BEHAVIOR (ONE RATING PER CUSTOMER-VENDOR PAIR)
  // ==============================================================
  describe('Rating Upsert Semantics', () => {
    it('should update in place when customer rates the same shop again without creating duplicates', async () => {
      // 1st rating: 2 stars
      const res1 = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 2, comment: 'Average customer experience' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.vendorStats.totalRatings).toBe(1);
      expect(res1.body.data.vendorStats.avgRating).toBe(2);

      let count = await Rating.countDocuments({ vendorId: vendorShopA._id });
      expect(count).toBe(1);

      // 2nd rating from same customer: changes mind to 5 stars
      const res2 = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5, comment: 'Staff resolved my issue, 5 stars!' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.vendorStats.totalRatings).toBe(1); // Still 1!
      expect(res2.body.data.vendorStats.avgRating).toBe(5);

      count = await Rating.countDocuments({ vendorId: vendorShopA._id });
      expect(count).toBe(1);

      const ratingInDb = await Rating.findOne({
        vendorId: vendorShopA._id,
        customerId: customerUser1._id,
      });
      expect(ratingInDb.stars).toBe(5);
      expect(ratingInDb.comment).toBe('Staff resolved my issue, 5 stars!');
    });
  });

  // ==============================================================
  // 4. DENORMALIZED RECALCULATION
  // ==============================================================
  describe('Denormalized Recalculation of avgRating & totalRatings', () => {
    it('should calculate accurate average and total count across multiple distinct customers', async () => {
      // Customer 1 rates 5 stars
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5, comment: 'Excellent' });

      // Customer 2 rates 3 stars
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .send({ stars: 3, comment: 'Satisfactory' });

      // Customer 3 rates 4 stars
      const res3 = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken3}`)
        .send({ stars: 4, comment: 'Good quality' });

      expect(res3.status).toBe(200);
      // (5 + 3 + 4) / 3 = 12 / 3 = 4.0
      expect(res3.body.data.vendorStats.totalRatings).toBe(3);
      expect(res3.body.data.vendorStats.avgRating).toBe(4);

      // Verify denormalized on Vendor document directly
      const refreshedVendor = await Vendor.findById(vendorShopA._id);
      expect(refreshedVendor.totalRatings).toBe(3);
      expect(refreshedVendor.avgRating).toBe(4);
    });

    it('should round average rating to 1 decimal place', async () => {
      // Customer 1: 5 stars
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5 });

      // Customer 2: 4 stars
      const res = await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .send({ stars: 4 });

      // (5 + 4) / 2 = 4.5
      expect(res.body.data.vendorStats.avgRating).toBe(4.5);
      expect(res.body.data.vendorStats.totalRatings).toBe(2);
    });
  });

  // ==============================================================
  // 5. GET RATINGS LIST & MY-RATING ENDPOINT
  // ==============================================================
  describe('GET /api/vendors/:vendorId/ratings', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5, comment: 'First review' });

      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .send({ stars: 3, comment: 'Second review' });

      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken3}`)
        .send({ stars: 4, comment: 'Third review' });
    });

    it('should return paginated list of ratings with customer info, most recent first', async () => {
      const res = await request(app)
        .get(`/api/vendors/${vendorShopA._id}/ratings?page=1&limit=2`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ratings.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.ratings[0].customerId.name).toBeDefined();
      expect(res.body.data.avgRating).toBe(4);
      expect(res.body.data.totalRatings).toBe(3);
    });

    it('should allow any logged-in user (customer, vendor, admin) to read ratings', async () => {
      const resVendor = await request(app)
        .get(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${vendorOwnerToken}`);
      expect(resVendor.status).toBe(200);

      const resAdmin = await request(app)
        .get(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });

    it('should return the customer existing rating via /my-rating', async () => {
      const res = await request(app)
        .get(`/api/vendors/${vendorShopA._id}/ratings/my-rating`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBeDefined();
      expect(res.body.data.rating.stars).toBe(5);
      expect(res.body.data.rating.comment).toBe('First review');
    });

    it('should return null rating for a customer who has not rated yet', async () => {
      const newCustomer = await User.create({
        name: 'Newbie',
        email: 'newbie@test.com',
        passwordHash: 'hash123',
        role: 'customer',
        city: 'Pune',
      });
      const newToken = generateToken(newCustomer);

      const res = await request(app)
        .get(`/api/vendors/${vendorShopA._id}/ratings/my-rating`)
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBeNull();
    });
  });

  // ==============================================================
  // 6. TOP RATED NEAR YOU FILTER INTEGRATION
  // ==============================================================
  describe('Top Rated Near You Search Filter Integration', () => {
    it('should filter offers by minRatings threshold (e.g. minRatings=3)', async () => {
      // vendorShopA has 3 ratings (avgRating 4.0, totalRatings 3)
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5 });
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken2}`)
        .send({ stars: 4 });
      await request(app)
        .post(`/api/vendors/${vendorShopA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken3}`)
        .send({ stars: 4 });

      // vendorShopB has only 1 rating (a single 5-star rating)
      await request(app)
        .post(`/api/vendors/${vendorShopB._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({ stars: 5 });

      // Query without minRatings threshold: both offers should show
      const resAll = await request(app).get('/api/offers/search?city=Pune');
      expect(resAll.status).toBe(200);
      expect(resAll.body.data.offers.length).toBe(2);

      // Query with minRatings=3 threshold: only vendorShopA offer should show
      const resTopRated = await request(app).get(
        '/api/offers/search?city=Pune&sort=rating&minRatings=3'
      );
      expect(resTopRated.status).toBe(200);
      expect(resTopRated.body.data.offers.length).toBe(1);
      expect(resTopRated.body.data.offers[0].vendorId.shopName).toBe(
        'Suresh Tech Hub'
      );
      expect(resTopRated.body.data.offers[0].vendorId.totalRatings).toBe(3);
    });
  });
});
