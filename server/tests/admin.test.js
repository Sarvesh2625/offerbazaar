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
import {
  User,
  Vendor,
  Offer,
  Category,
  AdminReviewLog,
} from '../models/index.js';
import { generateToken } from '../utils/jwt.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_admin_test';

describe('Admin Dashboard Test Suite (Phase 5)', () => {
  let adminUser, vendorUser, customerUser;
  let adminToken, vendorToken, customerToken;
  let vendorDoc;
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
      AdminReviewLog.init(),
    ]);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Offer.deleteMany({});
    await Category.deleteMany({});
    await AdminReviewLog.deleteMany({});

    // Seed categories
    testCategory1 = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });
    testCategory2 = await Category.create({
      name: 'Fashion',
      slug: 'fashion',
      icon: 'shirt',
    });

    // Create Admin
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@offerbazaar.com',
      passwordHash: 'hash123',
      role: 'admin',
      city: 'Mumbai',
    });
    adminToken = generateToken(adminUser);

    // Create Vendor
    vendorUser = await User.create({
      name: 'Alice Merchant',
      email: 'alice@merchant.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Mumbai',
    });
    vendorDoc = await Vendor.create({
      userId: vendorUser._id,
      shopName: "Alice's Boutique",
      status: 'active',
      city: 'Mumbai',
      address: '12 Linking Road, Bandra',
      categories: [testCategory2._id],
      location: {
        type: 'Point',
        coordinates: [72.8347, 19.0596],
      },
    });
    vendorToken = generateToken(vendorUser);

    // Create Customer
    customerUser = await User.create({
      name: 'Charlie Customer',
      email: 'charlie@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
      city: 'Mumbai',
    });
    customerToken = generateToken(customerUser);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==============================================================
  // 1. ACCESS CONTROL
  // ==============================================================
  describe('Admin Access Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/admin/review-queue');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject customer accessing admin endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject vendor accessing admin endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow admin user with 200 OK', async () => {
      const res = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==============================================================
  // 2. REVIEW QUEUE
  // ==============================================================
  describe('GET /api/admin/review-queue', () => {
    it('should return only flagged_for_review and pending_review offers with populated vendor and audit log', async () => {
      // 1. Create flagged offer
      const flaggedOffer = await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Flagged Luxury Handbag Offer',
        description: 'Special weekend deal on designer handbags.',
        discountText: '40% Off',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        images: ['https://res.cloudinary.com/demo/image/upload/bag.jpg'],
        status: 'flagged_for_review',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });

      // Automated system audit log for flagged offer
      await AdminReviewLog.create({
        offerId: flaggedOffer._id,
        checkedBy: 'system',
        checksPerformed: {
          locationValid: true,
          dateValid: true,
          textValid: false,
          imageValid: true,
        },
        decision: 'flagged_for_review',
        reason: 'LLM text validation returned an unparseable response',
        timestamp: new Date(),
      });

      // 2. Create pending offer
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Pending Review Tech Deal',
        description: 'Brand new noise-cancelling headphones discount.',
        category: testCategory1._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'pending_review',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });

      // 3. Create approved offer (should NOT appear in review queue)
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Already Approved Deal',
        description: 'Live deal currently visible to shoppers.',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'approved',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });

      // 4. Create rejected offer (should NOT appear in review queue)
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Already Rejected Deal',
        description: 'Previously rejected scam offer.',
        category: testCategory1._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'rejected',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });

      const res = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offers.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(2);

      const flaggedItem = res.body.data.offers.find(
        (o) => o._id.toString() === flaggedOffer._id.toString()
      );
      expect(flaggedItem).toBeDefined();
      expect(flaggedItem.vendorId.shopName).toBe("Alice's Boutique");
      expect(flaggedItem.vendorId.city).toBe('Mumbai');
      expect(flaggedItem.category.name).toBe('Fashion');
      expect(flaggedItem.latestAuditLog).not.toBeNull();
      expect(flaggedItem.latestAuditLog.checkedBy).toBe('system');
      expect(flaggedItem.latestAuditLog.checksPerformed.textValid).toBe(false);
      expect(flaggedItem.latestAuditLog.reason).toMatch(
        /unparseable response/i
      );
    });
  });

  // ==============================================================
  // 3. REVIEW DECISIONS (APPROVE & REJECT)
  // ==============================================================
  describe('POST /api/admin/review-queue/:id/decision', () => {
    let flaggedOffer;

    beforeEach(async () => {
      flaggedOffer = await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Flash Sale: Handbags',
        description: 'Exclusive 50% discount on genuine leather handbags.',
        discountText: '50% OFF',
        category: testCategory2._id,
        images: ['https://res.cloudinary.com/demo/image/upload/handbag.jpg'],
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'flagged_for_review',
        rejectionReason: ['Automated text check warning: High discount margin'],
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });

      await AdminReviewLog.create({
        offerId: flaggedOffer._id,
        checkedBy: 'system',
        checksPerformed: {
          locationValid: true,
          dateValid: true,
          textValid: false,
          imageValid: true,
        },
        decision: 'flagged_for_review',
        reason: 'Automated text check warning: High discount margin',
        timestamp: new Date(),
      });
    });

    it('should approve an offer, clear rejection reasons, and record admin audit log', async () => {
      const res = await request(app)
        .post(`/api/admin/review-queue/${flaggedOffer._id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approved',
          reason: 'Verified genuine store promotion after checking invoice',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offer.status).toBe('approved');
      expect(res.body.data.offer.rejectionReason.length).toBe(0);

      // Verify Offer in DB
      const updatedOffer = await Offer.findById(flaggedOffer._id);
      expect(updatedOffer.status).toBe('approved');
      expect(updatedOffer.rejectionReason.length).toBe(0);

      // Verify AdminReviewLog in DB
      const latestLog = await AdminReviewLog.findOne({
        offerId: flaggedOffer._id,
        checkedBy: adminUser._id.toString(),
      });
      expect(latestLog).not.toBeNull();
      expect(latestLog.decision).toBe('approved');
      expect(latestLog.checkedBy).toBe(adminUser._id.toString());
      expect(latestLog.reason).toMatch(/Verified genuine store promotion/i);
    });

    it('should fail to reject an offer if no rejection reason is provided', async () => {
      const res = await request(app)
        .post(`/api/admin/review-queue/${flaggedOffer._id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'rejected',
          reason: '', // Empty reason
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/rejection reason is required/i);
    });

    it('should reject an offer, append admin reason alongside automated reasons, and record audit log', async () => {
      const adminCustomReason =
        'Image appears copied from a stock photo without proof of inventory';

      const res = await request(app)
        .post(`/api/admin/review-queue/${flaggedOffer._id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'rejected',
          reason: adminCustomReason,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedOffer = await Offer.findById(flaggedOffer._id);
      expect(updatedOffer.status).toBe('rejected');
      // Must contain both automated reason and admin reason
      expect(updatedOffer.rejectionReason).toContain(
        'Automated text check warning: High discount margin'
      );
      expect(updatedOffer.rejectionReason).toContain(
        `[Admin Review] ${adminCustomReason}`
      );

      // Verify AdminReviewLog in DB
      const latestLog = await AdminReviewLog.findOne({
        offerId: flaggedOffer._id,
        checkedBy: adminUser._id.toString(),
      });
      expect(latestLog).not.toBeNull();
      expect(latestLog.decision).toBe('rejected');
      expect(latestLog.reason).toBe(adminCustomReason);
    });
  });

  // ==============================================================
  // 4. VENDOR MANAGEMENT & STATUS TOGGLE
  // ==============================================================
  describe('Vendor Management & Status Toggle', () => {
    beforeEach(async () => {
      const bobUser = await User.create({
        name: 'Bob Grocer',
        email: 'bob@grocer.com',
        passwordHash: 'hash123',
        role: 'vendor',
        city: 'Pune',
      });
      await Vendor.create({
        userId: bobUser._id,
        shopName: "Bob's Organic Farm",
        status: 'pending',
        city: 'Pune',
        categories: [testCategory1._id],
        location: {
          type: 'Point',
          coordinates: [73.8567, 18.5204],
        },
      });
    });

    it('should list vendors with pagination, search, and filters', async () => {
      // 1. Get all vendors
      const resAll = await request(app)
        .get('/api/admin/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAll.status).toBe(200);
      expect(resAll.body.data.vendors.length).toBe(2);

      // 2. Filter by status: pending
      const resPending = await request(app)
        .get('/api/admin/vendors?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPending.body.data.vendors.length).toBe(1);
      expect(resPending.body.data.vendors[0].shopName).toBe(
        "Bob's Organic Farm"
      );

      // 3. Filter by city: Mumbai
      const resMumbai = await request(app)
        .get('/api/admin/vendors?city=Mumbai')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resMumbai.body.data.vendors.length).toBe(1);
      expect(resMumbai.body.data.vendors[0].shopName).toBe("Alice's Boutique");

      // 4. Search by shop name keyword
      const resSearch = await request(app)
        .get('/api/admin/vendors?search=organic')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resSearch.body.data.vendors.length).toBe(1);
      expect(resSearch.body.data.vendors[0].shopName).toBe(
        "Bob's Organic Farm"
      );
    });

    it('should update vendor status to suspended or active', async () => {
      const res = await request(app)
        .put(`/api/admin/vendors/${vendorDoc._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('suspended');

      const updatedVendor = await Vendor.findById(vendorDoc._id);
      expect(updatedVendor.status).toBe('suspended');
    });
  });

  // ==============================================================
  // 5. CUSTOMER QUERY SUPPRESSION (CRITICAL REQUIREMENT)
  // ==============================================================
  describe('Customer Offers Query Suppression on Vendor Suspension', () => {
    let aliceApprovedOffer;

    beforeEach(async () => {
      // Create approved offer for Vendor Alice
      aliceApprovedOffer = await Offer.create({
        vendorId: vendorDoc._id,
        title: "Alice's Famous 30% Off Footwear Deal",
        description: 'Brand new sneakers and formal shoes on clearance.',
        discountText: '30% OFF',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 10 * 86400000), // Active 10 days out
        status: 'approved',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.0596],
        },
      });
    });

    it('should immediately hide approved offers from customer search when vendor is suspended, and restore on reactivation', async () => {
      // Step 1: While Vendor Alice is active, customer query returns her approved offer
      const resActive = await request(app).get('/api/offers');
      expect(resActive.status).toBe(200);
      expect(resActive.body.data.offers.length).toBe(1);
      expect(resActive.body.data.offers[0]._id.toString()).toBe(
        aliceApprovedOffer._id.toString()
      );

      // Step 2: Admin suspends Vendor Alice
      const suspendRes = await request(app)
        .put(`/api/admin/vendors/${vendorDoc._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.status).toBe('suspended');

      // Offer in DB is STILL approved (does not mutate offer status)
      const offerInDb = await Offer.findById(aliceApprovedOffer._id);
      expect(offerInDb.status).toBe('approved');

      // Step 3: Customer query MUST NOT return the offer while vendor is suspended
      const resSuspended = await request(app).get('/api/offers');
      expect(resSuspended.status).toBe(200);
      expect(resSuspended.body.data.offers.length).toBe(0);

      // Step 4: Admin reactivates Vendor Alice
      const reactivateRes = await request(app)
        .put(`/api/admin/vendors/${vendorDoc._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.status).toBe('active');

      // Step 5: Customer query immediately returns the offer again without re-approval!
      const resReactivated = await request(app).get('/api/offers');
      expect(resReactivated.status).toBe(200);
      expect(resReactivated.body.data.offers.length).toBe(1);
      expect(resReactivated.body.data.offers[0]._id.toString()).toBe(
        aliceApprovedOffer._id.toString()
      );
    });
  });

  // ==============================================================
  // 6. ANALYTICS PANEL
  // ==============================================================
  describe('GET /api/admin/analytics', () => {
    it('should aggregate vendor counts, offer counts, category breakdown, and 30-day timeline', async () => {
      // 1. Create a second vendor (pending)
      const bobUser = await User.create({
        name: 'Bob Farmer',
        email: 'bob@farmer.com',
        passwordHash: 'hash123',
        role: 'vendor',
      });
      await Vendor.create({
        userId: bobUser._id,
        shopName: 'Green Produce',
        status: 'pending',
        city: 'Pune',
      });

      // 2. Create offers with different statuses
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Deal 1',
        description: 'Electronics discount deal',
        category: testCategory1._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'approved',
        location: { type: 'Point', coordinates: [72.8, 19.0] },
      });

      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Deal 2',
        description: 'Fashion clearance deal',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'flagged_for_review',
        location: { type: 'Point', coordinates: [72.8, 19.0] },
      });

      // 3. Create AdminReviewLog entries for 30-day timeline
      const today = new Date();
      await AdminReviewLog.create({
        offerId: new mongoose.Types.ObjectId(),
        checkedBy: 'system',
        decision: 'approved',
        reason: 'Automated pass',
        timestamp: today,
      });

      await AdminReviewLog.create({
        offerId: new mongoose.Types.ObjectId(),
        checkedBy: adminUser._id.toString(),
        decision: 'rejected',
        reason: 'Admin reject',
        timestamp: today,
      });

      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const {
        vendorsByStatus,
        offersByStatus,
        offersByCategory,
        dailyDecisionsLast30Days,
      } = res.body.data;

      // Vendors
      expect(vendorsByStatus.total).toBe(2);
      expect(vendorsByStatus.active).toBe(1);
      expect(vendorsByStatus.pending).toBe(1);

      // Offers
      expect(offersByStatus.total).toBe(2);
      expect(offersByStatus.approved).toBe(1);
      expect(offersByStatus.flagged_for_review).toBe(1);

      // Category breakdown
      expect(offersByCategory.length).toBe(2);

      // Daily decisions
      expect(Array.isArray(dailyDecisionsLast30Days)).toBe(true);
      expect(dailyDecisionsLast30Days.length).toBe(30);

      const todayKey = today.toISOString().split('T')[0];
      const todayEntry = dailyDecisionsLast30Days.find(
        (e) => e.date === todayKey
      );
      expect(todayEntry).toBeDefined();
      expect(todayEntry.approved).toBe(1);
      expect(todayEntry.rejected).toBe(1);
    });
  });

  // ==============================================================
  // 6. LIVE OFFERS & MANUAL POST-APPROVAL TAKEDOWN
  // ==============================================================
  describe('6. Live Offers & Manual Post-Approval Takedown', () => {
    let approvedOffer1;
    let vendorDocPune;

    beforeEach(async () => {
      const vendorUserPune = await User.create({
        name: 'Bob Pune',
        email: 'bob@pune.com',
        passwordHash: 'hash123',
        role: 'vendor',
        city: 'Pune',
      });

      vendorDocPune = await Vendor.create({
        userId: vendorUserPune._id,
        shopName: 'Pune Electronics Mart',
        status: 'active',
        city: 'Pune',
        address: 'MG Road, Pune',
        categories: [testCategory1._id],
        location: {
          type: 'Point',
          coordinates: [73.8567, 18.5204],
        },
      });

      // 1. Approved offer in Mumbai (Fashion)
      approvedOffer1 = await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Mumbai Handbag Flash Sale',
        description: '50% off on designer handbags in Mumbai store',
        discountText: '50% OFF',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 7 * 86400000),
        status: 'approved',
        location: vendorDoc.location,
        rejectionReason: [],
      });

      // 2. Approved offer in Pune (Electronics)
      await Offer.create({
        vendorId: vendorDocPune._id,
        title: 'Pune Smartphone Extravaganza',
        description: 'Special discounts on 5G flagship smartphones',
        discountText: 'Flat ₹5000 Off',
        category: testCategory1._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 5 * 86400000),
        status: 'approved',
        location: vendorDocPune.location,
        rejectionReason: [],
      });

      // 3. Flagged offer
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Flagged Watch Clearance',
        description: 'Unchecked watch deals',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 3 * 86400000),
        status: 'flagged_for_review',
        location: vendorDoc.location,
      });

      // 4. Rejected offer
      await Offer.create({
        vendorId: vendorDoc._id,
        title: 'Rejected Counterfeit Sneakers',
        description: 'Fake brand shoes',
        category: testCategory2._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 3 * 86400000),
        status: 'rejected',
        location: vendorDoc.location,
        rejectionReason: ['Counterfeit merchandise'],
      });
    });

    it('GET /api/admin/live-offers returns only approved offers and rejects unauthorized users', async () => {
      // Reject unauthenticated
      const resUnauth = await request(app).get('/api/admin/live-offers');
      expect(resUnauth.status).toBe(401);

      // Reject customer
      const resCustomer = await request(app)
        .get('/api/admin/live-offers')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustomer.status).toBe(403);

      // Reject vendor
      const resVendor = await request(app)
        .get('/api/admin/live-offers')
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(resVendor.status).toBe(403);

      // Admin access returns only approved offers
      const resAdmin = await request(app)
        .get('/api/admin/live-offers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
      expect(resAdmin.body.data.offers.length).toBe(2);

      const offerTitles = resAdmin.body.data.offers.map((o) => o.title);
      expect(offerTitles).toContain('Mumbai Handbag Flash Sale');
      expect(offerTitles).toContain('Pune Smartphone Extravaganza');
      expect(offerTitles).not.toContain('Flagged Watch Clearance');
      expect(offerTitles).not.toContain('Rejected Counterfeit Sneakers');
    });

    it('GET /api/admin/live-offers correctly filters by city, vendor, category, and search query', async () => {
      // Filter by city: Pune
      const resCity = await request(app)
        .get('/api/admin/live-offers?city=Pune')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resCity.status).toBe(200);
      expect(resCity.body.data.offers.length).toBe(1);
      expect(resCity.body.data.offers[0].title).toBe(
        'Pune Smartphone Extravaganza'
      );

      // Filter by category slug: fashion
      const resCat = await request(app)
        .get('/api/admin/live-offers?category=fashion')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resCat.status).toBe(200);
      expect(resCat.body.data.offers.length).toBe(1);
      expect(resCat.body.data.offers[0].title).toBe(
        'Mumbai Handbag Flash Sale'
      );

      // Filter by vendor shop name
      const resVendor = await request(app)
        .get('/api/admin/live-offers?vendor=Alice')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resVendor.status).toBe(200);
      expect(resVendor.body.data.offers.length).toBe(1);
      expect(resVendor.body.data.offers[0].title).toBe(
        'Mumbai Handbag Flash Sale'
      );

      // Free-text search
      const resSearch = await request(app)
        .get('/api/admin/live-offers?search=smartphone')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.offers.length).toBe(1);
      expect(resSearch.body.data.offers[0].title).toBe(
        'Pune Smartphone Extravaganza'
      );
    });

    it('POST /api/admin/live-offers/:id/takedown rejects takedown without a reason or unauthorized', async () => {
      // Reject unauthenticated
      const resUnauth = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .send({ reason: 'Some reason' });
      expect(resUnauth.status).toBe(401);

      // Reject vendor
      const resVendor = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ reason: 'Some reason' });
      expect(resVendor.status).toBe(403);

      // Reject missing reason
      const resNoReason = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(resNoReason.status).toBe(400);

      // Reject empty whitespace reason
      const resEmptyReason = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '   ' });
      expect(resEmptyReason.status).toBe(400);
    });

    it('POST /api/admin/live-offers/:id/takedown takes down an approved offer, updates status & rejectionReason, creates AdminReviewLog, and notifies vendor', async () => {
      const takedownReason =
        'Misleading pricing reported by multiple customers';

      const res = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: takedownReason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify updated offer in DB
      const updatedOffer = await Offer.findById(approvedOffer1._id);
      expect(updatedOffer.status).toBe('rejected');
      expect(updatedOffer.rejectionReason).toContain(takedownReason);

      // Verify AdminReviewLog created
      const reviewLog = await AdminReviewLog.findOne({
        offerId: approvedOffer1._id,
        decision: 'manual_takedown_post_approval',
      });
      expect(reviewLog).not.toBeNull();
      expect(reviewLog.checkedBy).toBe(adminUser._id.toString());
      expect(reviewLog.reason).toBe(takedownReason);
      expect(reviewLog.decision).toBe('manual_takedown_post_approval');
    });

    it('an approved offer, once taken down by an admin, no longer appears in GET /api/offers/search even if queried by direct ID', async () => {
      // 1. Confirm offer initially appears in customer search results
      const preSearch = await request(app).get(
        '/api/offers/search?city=Mumbai'
      );
      expect(preSearch.status).toBe(200);
      const preFound = preSearch.body.data.offers.some(
        (o) => o._id.toString() === approvedOffer1._id.toString()
      );
      expect(preFound).toBe(true);

      // 1b. Direct ID lookup in search
      const preDirectSearch = await request(app).get(
        `/api/offers/search?offerId=${approvedOffer1._id}`
      );
      expect(preDirectSearch.status).toBe(200);
      expect(preDirectSearch.body.data.offers.length).toBe(1);
      expect(preDirectSearch.body.data.offers[0]._id.toString()).toBe(
        approvedOffer1._id.toString()
      );

      // 1c. Direct single offer route GET /api/offers/:id
      const preDetail = await request(app).get(
        `/api/offers/${approvedOffer1._id}`
      );
      expect(preDetail.status).toBe(200);
      expect(preDetail.body.data._id.toString()).toBe(
        approvedOffer1._id.toString()
      );

      // 2. Admin takes down the offer
      const takedownRes = await request(app)
        .post(`/api/admin/live-offers/${approvedOffer1._id}/takedown`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Regulatory compliance failure: price terms deceptive',
        });
      expect(takedownRes.status).toBe(200);

      // 3. Confirm offer no longer appears in general search results
      const postSearch = await request(app).get(
        '/api/offers/search?city=Mumbai'
      );
      expect(postSearch.status).toBe(200);
      const postFound = postSearch.body.data.offers.some(
        (o) => o._id.toString() === approvedOffer1._id.toString()
      );
      expect(postFound).toBe(false);

      // 4. Confirm offer no longer appears even when queried by direct ID
      const postDirectSearch = await request(app).get(
        `/api/offers/search?offerId=${approvedOffer1._id}`
      );
      expect(postDirectSearch.status).toBe(200);
      expect(postDirectSearch.body.data.offers.length).toBe(0);

      // 5. Direct single offer route GET /api/offers/:id returns 404
      const postDetail = await request(app).get(
        `/api/offers/${approvedOffer1._id}`
      );
      expect(postDetail.status).toBe(404);
      expect(postDetail.body.success).toBe(false);
    });
  });
});
