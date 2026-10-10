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
import jwt from 'jsonwebtoken';
import app from '../app.js';
import {
  User,
  Vendor,
  Offer,
  Category,
  Rating,
  AdminReviewLog,
} from '../models/index.js';
import { generateToken } from '../utils/jwt.js';
import { getPostLoginRedirect } from '../../client/src/utils/redirect.js';
import bcrypt from 'bcryptjs';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_security_test';

const JWT_SECRET =
  process.env.JWT_SECRET || 'offerbazaar_super_secret_jwt_key_2026!';

describe('Phase 9: End-to-End Security, Authorization & Input Hardening Test Suite', () => {
  let customerUser, vendorUserA, vendorUserB, adminUser;
  let customerToken, vendorTokenA, vendorTokenB, adminToken;
  let vendorDocA, vendorDocB;
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
      AdminReviewLog.init(),
    ]);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Offer.deleteMany({});
    await Category.deleteMany({});
    await Rating.deleteMany({});
    await AdminReviewLog.deleteMany({});

    // Seed test category
    testCategory = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });

    // Generate realistic bcrypt hash for password authentication tests
    const defaultHash = await bcrypt.hash('Password123!', 10);

    // Seed customer
    customerUser = await User.create({
      name: 'Charlie Customer',
      email: 'charlie@customer.com',
      passwordHash: defaultHash,
      role: 'customer',
      city: 'Pune',
    });
    customerToken = generateToken(customerUser);

    // Seed Vendor A
    vendorUserA = await User.create({
      name: 'Alice Vendor',
      email: 'alice@store.com',
      passwordHash: defaultHash,
      role: 'vendor',
      city: 'Pune',
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      shopName: "Alice's Tech",
      shopDescription: 'Quality electronics in Pune',
      categories: [testCategory._id],
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
      city: 'Pune',
      address: 'FC Road, Pune',
      status: 'active',
      isVerifiedShop: true,
    });
    vendorTokenA = generateToken(vendorUserA);

    // Seed Vendor B
    vendorUserB = await User.create({
      name: 'Bob Vendor',
      email: 'bob@store.com',
      passwordHash: defaultHash,
      role: 'vendor',
      city: 'Pune',
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      shopName: "Bob's Gizmos",
      shopDescription: 'Cool gadgets and accessories',
      categories: [testCategory._id],
      location: {
        type: 'Point',
        coordinates: [73.8567, 18.5204],
      },
      city: 'Pune',
      address: 'MG Road, Pune',
      status: 'active',
      isVerifiedShop: true,
    });
    vendorTokenB = generateToken(vendorUserB);

    // Seed Admin
    adminUser = await User.create({
      name: 'Sarvesh Admin',
      email: 'admin@offerbazaar.com',
      passwordHash: defaultHash,
      role: 'admin',
      city: 'Mumbai',
    });
    adminToken = generateToken(adminUser);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // 1. ROLE & OWNERSHIP TESTS
  // =========================================================================
  describe('Role & Ownership Security', () => {
    it('should strictly isolate vendor offers: Vendor B cannot view, edit, or delete Vendor A’s offer via the API', async () => {
      // 1. Create an offer belonging to Vendor A
      const offerA = await Offer.create({
        vendorId: vendorDocA._id,
        title: "Alice's 50% Off Headphones",
        description: 'Noise cancelling premium headphones',
        discountText: '50% OFF',
        category: testCategory._id,
        validFrom: new Date(Date.now() - 10000),
        validTill: new Date(Date.now() + 86400000 * 7),
        status: 'approved',
        location: vendorDocA.location,
      });

      // Attempt 1: Vendor B attempts to GET Vendor A's offer
      const getRes = await request(app)
        .get(`/api/vendor/offers/${offerA._id}`)
        .set('Authorization', `Bearer ${vendorTokenB}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.success).toBe(false);

      // Attempt 2: Vendor B attempts to PUT/edit Vendor A's offer
      const putRes = await request(app)
        .put(`/api/vendor/offers/${offerA._id}`)
        .set('Authorization', `Bearer ${vendorTokenB}`)
        .send({
          title: "Hacked by Bob's Gizmos",
          description: 'Malicious title change attempt',
        });
      expect(putRes.status).toBe(404);
      expect(putRes.body.success).toBe(false);

      // Verify offer in DB was NOT modified
      const uneditedOffer = await Offer.findById(offerA._id);
      expect(uneditedOffer.title).toBe("Alice's 50% Off Headphones");

      // Attempt 3: Vendor B attempts to DELETE Vendor A's offer
      const delRes = await request(app)
        .delete(`/api/vendor/offers/${offerA._id}`)
        .set('Authorization', `Bearer ${vendorTokenB}`);
      expect(delRes.status).toBe(404);
      expect(delRes.body.success).toBe(false);

      // Verify offer still exists in DB
      const existingOffer = await Offer.findById(offerA._id);
      expect(existingOffer).not.toBeNull();
      expect(existingOffer.title).toBe("Alice's 50% Off Headphones");
    });

    it('should prevent privilege escalation: customer cannot access /api/vendor/* or /api/admin/* routes', async () => {
      // Customer tries to access vendor profile
      const vendorProfileRes = await request(app)
        .get('/api/vendor/profile')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(vendorProfileRes.status).toBe(403);
      expect(vendorProfileRes.body.message).toMatch(/Forbidden/i);

      // Customer tries to access vendor offers
      const vendorOffersRes = await request(app)
        .get('/api/vendor/offers')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(vendorOffersRes.status).toBe(403);
      expect(vendorOffersRes.body.message).toMatch(/Forbidden/i);

      // Customer tries to access admin review queue
      const adminQueueRes = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(adminQueueRes.status).toBe(403);
      expect(adminQueueRes.body.message).toMatch(/Forbidden/i);

      // Customer tries to access admin vendor list
      const adminVendorsRes = await request(app)
        .get('/api/admin/vendors')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(adminVendorsRes.status).toBe(403);
      expect(adminVendorsRes.body.message).toMatch(/Forbidden/i);
    });

    it('should prevent privilege escalation: vendor cannot access /api/admin/* routes', async () => {
      // Vendor tries to access admin review queue
      const queueRes = await request(app)
        .get('/api/admin/review-queue')
        .set('Authorization', `Bearer ${vendorTokenA}`);
      expect(queueRes.status).toBe(403);
      expect(queueRes.body.message).toMatch(/Forbidden/i);

      // Vendor tries to access admin analytics
      const analyticsRes = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${vendorTokenA}`);
      expect(analyticsRes.status).toBe(403);
      expect(analyticsRes.body.message).toMatch(/Forbidden/i);

      // Vendor tries to suspend another vendor
      const suspendRes = await request(app)
        .put(`/api/admin/vendors/${vendorDocB._id}/status`)
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({ status: 'suspended' });
      expect(suspendRes.status).toBe(403);
      expect(suspendRes.body.message).toMatch(/Forbidden/i);
    });

    it('should immediately suppress approved offers of a suspended vendor from GET /api/offers/search', async () => {
      // Create approved offer for Vendor A
      const offer = await Offer.create({
        vendorId: vendorDocA._id,
        title: 'Flash Deal: Smart TV 4K',
        description: 'Super high definition television offer',
        discountText: '30% OFF',
        category: testCategory._id,
        validFrom: new Date(Date.now() - 10000),
        validTill: new Date(Date.now() + 86400000 * 5),
        status: 'approved',
        location: vendorDocA.location,
      });

      // 1. When vendor is active, offer must appear in search results
      const searchResBefore = await request(app).get(
        '/api/offers/search?city=Pune'
      );
      expect(searchResBefore.status).toBe(200);
      expect(
        searchResBefore.body.data.offers.some(
          (o) => o._id === offer._id.toString()
        )
      ).toBe(true);

      // 2. Suspend vendor via Admin endpoint
      const suspendRes = await request(app)
        .put(`/api/admin/vendors/${vendorDocA._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.status).toBe('suspended');

      // 3. Confirm offer is immediately absent from customer search results
      const searchResAfter = await request(app).get(
        '/api/offers/search?city=Pune'
      );
      expect(searchResAfter.status).toBe(200);
      expect(
        searchResAfter.body.data.offers.some(
          (o) => o._id === offer._id.toString()
        )
      ).toBe(false);

      // 4. Confirm direct query for offer also returns 404
      const directRes = await request(app).get(`/api/offers/${offer._id}`);
      expect(directRes.status).toBe(404);
      expect(directRes.body.success).toBe(false);
    });

    it('should never expose rejected or flagged_for_review offers in customer search, even when queried directly by ID', async () => {
      // 1. Create a rejected offer
      const rejectedOffer = await Offer.create({
        vendorId: vendorDocA._id,
        title: 'Rejected Counterfeit Item',
        description: 'This offer was flagged and rejected',
        discountText: '90% OFF',
        category: testCategory._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'rejected',
        rejectionReason: ['Profanity or counterfeit detected'],
        location: vendorDocA.location,
      });

      // 2. Create a flagged_for_review offer
      const flaggedOffer = await Offer.create({
        vendorId: vendorDocA._id,
        title: 'Flagged Ambiguous Promotion',
        description: 'Pending human moderator review',
        discountText: 'Special Price',
        category: testCategory._id,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 86400000),
        status: 'flagged_for_review',
        location: vendorDocA.location,
      });

      // Check search with q matching rejected title
      const searchRejected = await request(app).get(
        '/api/offers/search?q=Counterfeit'
      );
      expect(searchRejected.status).toBe(200);
      expect(searchRejected.body.data.offers.length).toBe(0);

      // Check search by offerId query param directly
      const queryParamSearch = await request(app).get(
        `/api/offers/search?offerId=${rejectedOffer._id}`
      );
      expect(queryParamSearch.status).toBe(200);
      expect(queryParamSearch.body.data.offers.length).toBe(0);

      // Direct endpoint GET /api/offers/:id for rejected offer
      const directRejectedRes = await request(app).get(
        `/api/offers/${rejectedOffer._id}`
      );
      expect(directRejectedRes.status).toBe(404);
      expect(directRejectedRes.body.success).toBe(false);

      // Direct endpoint GET /api/offers/:id for flagged offer
      const directFlaggedRes = await request(app).get(
        `/api/offers/${flaggedOffer._id}`
      );
      expect(directFlaggedRes.status).toBe(404);
      expect(directFlaggedRes.body.success).toBe(false);
    });

    it('should enforce rating uniqueness: a customer submitting a second rating for the same vendor upserts instead of duplicating', async () => {
      // First rating
      const firstRes = await request(app)
        .post(`/api/vendors/${vendorDocA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          stars: 4,
          comment: 'Good service and quick delivery',
        });
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.data.rating.stars).toBe(4);

      // Verify 1 rating document in DB
      let ratingCount = await Rating.countDocuments({
        vendorId: vendorDocA._id,
        customerId: customerUser._id,
      });
      expect(ratingCount).toBe(1);

      // Second rating from same customer with updated stars
      const secondRes = await request(app)
        .post(`/api/vendors/${vendorDocA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          stars: 5,
          comment: 'Updated review: Excellent experience overall!',
        });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.rating.stars).toBe(5);
      expect(secondRes.body.data.rating.comment).toBe(
        'Updated review: Excellent experience overall!'
      );

      // Verify still exactly 1 rating document in DB (no duplicates created)
      ratingCount = await Rating.countDocuments({
        vendorId: vendorDocA._id,
        customerId: customerUser._id,
      });
      expect(ratingCount).toBe(1);

      // Verify vendor avgRating recalculated properly
      const vendorAfter = await Vendor.findById(vendorDocA._id);
      expect(vendorAfter.totalRatings).toBe(1);
      expect(vendorAfter.avgRating).toBe(5);
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & TOKEN INTEGRITY TESTS
  // =========================================================================
  describe('Authentication & Token Integrity', () => {
    it('should reject expired JWTs with 401 on protected routes', async () => {
      const expiredToken = jwt.sign(
        { userId: customerUser._id.toString(), role: 'customer' },
        JWT_SECRET,
        { expiresIn: '-5s' }
      );

      // Protected route 1: GET /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(meRes.status).toBe(401);
      expect(meRes.body.message).toMatch(/Invalid or expired token/i);

      // Protected route 2: GET /api/vendor/profile
      const vendorRes = await request(app)
        .get('/api/vendor/profile')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(vendorRes.status).toBe(401);
      expect(vendorRes.body.message).toMatch(/Invalid or expired token/i);

      // Protected route 3: GET /api/admin/vendors
      const adminRes = await request(app)
        .get('/api/admin/vendors')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(adminRes.status).toBe(401);
      expect(adminRes.body.message).toMatch(/Invalid or expired token/i);
    });

    it('should reject malformed or tampered JWT signatures with 401', async () => {
      // 1. Signed with wrong secret
      const rogueToken = jwt.sign(
        { userId: customerUser._id.toString(), role: 'admin' },
        'rogue_attacker_secret_key'
      );
      const rogueRes = await request(app)
        .get('/api/admin/vendors')
        .set('Authorization', `Bearer ${rogueToken}`);
      expect(rogueRes.status).toBe(401);
      expect(rogueRes.body.message).toMatch(/Invalid or expired token/i);

      // 2. Tampered signature payload
      const tamperedToken = customerToken.slice(0, -6) + 'xxxxxx';
      const tamperedRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(tamperedRes.status).toBe(401);
      expect(tamperedRes.body.message).toMatch(/Invalid or expired token/i);

      // 3. Completely bogus string
      const bogusRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-even-a-jwt');
      expect(bogusRes.status).toBe(401);
      expect(bogusRes.body.message).toMatch(/Invalid or expired token/i);
    });

    it('should reject signup with duplicate email, weak password (< 8 chars), or invalid email', async () => {
      // 1. Duplicate email
      const dupRes = await request(app).post('/api/auth/signup').send({
        name: 'Another Charlie',
        email: 'charlie@customer.com', // Already registered in beforeEach
        password: 'StrongPassword123!',
        role: 'customer',
      });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.message).toMatch(/already exists/i);

      // 2. Weak password (< 8 chars)
      const weakRes = await request(app).post('/api/auth/signup').send({
        name: 'Weak Pass User',
        email: 'weakpass@example.com',
        password: 'pass',
        role: 'customer',
      });
      expect(weakRes.status).toBe(400);
      expect(weakRes.body.message).toMatch(/at least 8 characters/i);

      // 3. Invalid email format
      const badEmailRes = await request(app).post('/api/auth/signup').send({
        name: 'Bad Email User',
        email: 'not-an-email',
        password: 'StrongPassword123!',
        role: 'customer',
      });
      expect(badEmailRes.status).toBe(400);
      expect(badEmailRes.body.message).toMatch(/valid email/i);
    });

    it('should strictly block creating admin accounts via public signup endpoint', async () => {
      const adminSignupRes = await request(app).post('/api/auth/signup').send({
        name: 'Hacker Admin',
        email: 'infiltrator@hacker.com',
        password: 'SuperSecretPassword2026!',
        role: 'admin',
      });
      expect(adminSignupRes.status).toBe(400);
      expect(adminSignupRes.body.message).toMatch(
        /Admin accounts cannot be created/i
      );

      // Confirm user was not saved in DB
      const userInDb = await User.findOne({ email: 'infiltrator@hacker.com' });
      expect(userInDb).toBeNull();
    });

    it('should maintain strict role isolation across sequential logins in the same browser session without refreshing', async () => {
      // Simulate persistent browser session with Supertest agent
      const session = request.agent(app);

      // 1. Log in as Vendor A
      const vendorLoginRes = await session.post('/api/auth/login').send({
        email: 'alice@store.com',
        password: 'Password123!',
      });
      expect(vendorLoginRes.status).toBe(200);
      expect(vendorLoginRes.body.user.role).toBe('vendor');

      // Confirm JWT payload role
      const vendorTokenPayload = jwt.decode(vendorLoginRes.body.token);
      expect(vendorTokenPayload.role).toBe('vendor');

      // Confirm session /me returns vendor profile
      const vendorMeRes = await session.get('/api/auth/me');
      expect(vendorMeRes.status).toBe(200);
      expect(vendorMeRes.body.user.role).toBe('vendor');

      // Confirm vendor can access vendor profile but NOT admin endpoints
      const vendorProfileRes = await session.get('/api/vendor/profile');
      expect(vendorProfileRes.status).toBe(200);
      const vendorAdminRes = await session.get('/api/admin/vendors');
      expect(vendorAdminRes.status).toBe(403);

      // 2. Log out
      const logoutRes = await session.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);

      // Confirm auth state cleared (session /me returns 401)
      const loggedOutMeRes = await session.get('/api/auth/me');
      expect(loggedOutMeRes.status).toBe(401);

      // 3. Log in as Admin in the same session without refreshing
      const adminLoginRes = await session.post('/api/auth/login').send({
        email: 'admin@offerbazaar.com',
        password: 'Password123!',
      });
      expect(adminLoginRes.status).toBe(200);
      expect(adminLoginRes.body.user.role).toBe('admin');

      // Confirm JWT payload role
      const adminTokenPayload = jwt.decode(adminLoginRes.body.token);
      expect(adminTokenPayload.role).toBe('admin');

      // Confirm session /me returns admin profile
      const adminMeRes = await session.get('/api/auth/me');
      expect(adminMeRes.status).toBe(200);
      expect(adminMeRes.body.user.role).toBe('admin');

      // Confirm admin can access admin dashboard but NOT vendor profile
      const adminVendorsRes = await session.get('/api/admin/vendors');
      expect(adminVendorsRes.status).toBe(200);
      const adminVendorProfileRes = await session.get('/api/vendor/profile');
      expect(adminVendorProfileRes.status).toBe(403);
    });

    it('should calculate post-login destination safely without cross-role redirect poisoning', () => {
      // Admin logging in when locationState had stale vendor route
      const adminRedirect = getPostLoginRedirect(
        { role: 'admin' },
        { from: { pathname: '/vendor' } }
      );
      expect(adminRedirect).toBe('/admin');

      // Vendor logging in when locationState had stale admin route
      const vendorRedirect = getPostLoginRedirect(
        { role: 'vendor' },
        { from: { pathname: '/admin' } }
      );
      expect(vendorRedirect).toBe('/vendor');

      // Customer logging in when locationState had stale admin or vendor route
      const customerAdminRedirect = getPostLoginRedirect(
        { role: 'customer' },
        { from: { pathname: '/admin' } }
      );
      expect(customerAdminRedirect).toBe('/customer');
      const customerVendorRedirect = getPostLoginRedirect(
        { role: 'customer' },
        { from: { pathname: '/vendor' } }
      );
      expect(customerVendorRedirect).toBe('/customer');

      // Admin logging in with valid admin sub-route
      const adminDeepRedirect = getPostLoginRedirect(
        { role: 'admin' },
        { from: { pathname: '/admin/review-queue' } }
      );
      expect(adminDeepRedirect).toBe('/admin/review-queue');

      // Vendor logging in with valid vendor sub-route
      const vendorDeepRedirect = getPostLoginRedirect(
        { role: 'vendor' },
        { from: { pathname: '/vendor/offers' } }
      );
      expect(vendorDeepRedirect).toBe('/vendor/offers');
    });
  });

  // =========================================================================
  // 3. INPUT VALIDATION & PAYLOAD SANITIZATION TESTS
  // =========================================================================
  describe('Input Validation & Payload Sanitization (Zod Schemas)', () => {
    it('should reject malformed or oversized payload on vendor profile update with 400', async () => {
      // Coordinates out of bounds (lng > 180)
      const badCoordsRes = await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({
          location: {
            type: 'Point',
            coordinates: [250, 18.5204],
          },
        });
      expect(badCoordsRes.status).toBe(400);
      expect(badCoordsRes.body.success).toBe(false);

      // Oversized shopName (> 150 characters)
      const oversizedRes = await request(app)
        .put('/api/vendor/profile')
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({
          shopName: 'A'.repeat(200),
        });
      expect(oversizedRes.status).toBe(400);
      expect(oversizedRes.body.message).toMatch(/cannot exceed 150/i);
    });

    it('should reject malformed or missing fields on offer creation with 400', async () => {
      // Missing title and description
      const missingFieldsRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({
          category: testCategory._id.toString(),
          validFrom: new Date().toISOString(),
          validTill: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(missingFieldsRes.status).toBe(400);
      expect(missingFieldsRes.body.success).toBe(false);

      // Invalid date format
      const badDateRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({
          title: 'Special Deal',
          description: 'Valid description text',
          category: testCategory._id.toString(),
          validFrom: 'not-a-valid-date',
          validTill: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(badDateRes.status).toBe(400);
      expect(badDateRes.body.message).toMatch(/Invalid date/i);

      // Too many images (> 3)
      const tooManyImagesRes = await request(app)
        .post('/api/vendor/offers')
        .set('Authorization', `Bearer ${vendorTokenA}`)
        .send({
          title: 'Special Deal',
          description: 'Valid description text',
          category: testCategory._id.toString(),
          validFrom: new Date().toISOString(),
          validTill: new Date(Date.now() + 86400000).toISOString(),
          images: [
            'http://img1.jpg',
            'http://img2.jpg',
            'http://img3.jpg',
            'http://img4.jpg',
          ],
        });
      expect(tooManyImagesRes.status).toBe(400);
      expect(tooManyImagesRes.body.message).toMatch(/maximum of 3 images/i);
    });

    it('should reject malformed ratings (stars out of bounds or non-integer) with 400', async () => {
      // Stars > 5
      const tooHighRes = await request(app)
        .post(`/api/vendors/${vendorDocA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          stars: 6,
        });
      expect(tooHighRes.status).toBe(400);
      expect(tooHighRes.body.message).toMatch(/cannot exceed 5/i);

      // Stars float instead of integer
      const floatRes = await request(app)
        .post(`/api/vendors/${vendorDocA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          stars: 3.5,
        });
      expect(floatRes.status).toBe(400);
      expect(floatRes.body.message).toMatch(/integer/i);

      // Comment oversized (> 300 chars)
      const longCommentRes = await request(app)
        .post(`/api/vendors/${vendorDocA._id}/ratings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          stars: 4,
          comment: 'x'.repeat(350),
        });
      expect(longCommentRes.status).toBe(400);
      expect(longCommentRes.body.message).toMatch(/cannot exceed 300/i);
    });

    it('should reject invalid admin moderation decision with 400', async () => {
      const dummyOfferId = new mongoose.Types.ObjectId();

      // Decision not approved or rejected
      const invalidDecisionRes = await request(app)
        .post(`/api/admin/review-queue/${dummyOfferId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'maybe',
        });
      expect(invalidDecisionRes.status).toBe(400);
      expect(invalidDecisionRes.body.message).toMatch(/(approved|rejected)/i);

      // Rejection without required reason
      const noReasonRes = await request(app)
        .post(`/api/admin/review-queue/${dummyOfferId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'rejected',
          reason: '',
        });
      expect(noReasonRes.status).toBe(400);
      expect(noReasonRes.body.message).toMatch(/rejection reason is required/i);
    });
  });

  // =========================================================================
  // 4. RATE LIMITING & SECURITY HEADERS TESTS
  // =========================================================================
  describe('Rate Limiting & Security Headers', () => {
    it('should include Helmet security headers on HTTP responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    });

    it('should enforce rate limiting on auth endpoints when limit exceeded', async () => {
      // Send requests exceeding the test rate limit threshold (3 attempts) from an isolated test IP
      const isolatedIp = '198.51.100.99';
      const responses = [];
      for (let i = 0; i < 5; i++) {
        responses.push(
          await request(app)
            .post('/api/auth/login')
            .set('x-test-rate-limit', 'true')
            .set('x-test-client-ip', isolatedIp)
            .send({
              email: 'nonexistent@test.com',
              password: 'wrongpassword',
            })
        );
      }

      // First 3 should fail with 401 (auth failure)
      expect(responses[0].status).toBe(401);
      expect(responses[1].status).toBe(401);
      expect(responses[2].status).toBe(401);

      // 4th and 5th should be blocked by rate limiter with 429 Too Many Requests
      expect(responses[3].status).toBe(429);
      expect(responses[3].body.message).toMatch(
        /Too many authentication attempts/i
      );
      expect(responses[4].status).toBe(429);
    });
  });
});
