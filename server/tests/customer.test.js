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
  'mongodb://localhost:27017/offerbazaar_customer_test';

describe('Customer Deal Discovery & Search Test Suite (Phase 6)', () => {
  let customerUser, customerToken;
  let vendorJalgaon, vendorDhule, vendorMumbai;
  let categoryElectronics, categoryClothing;
  let jalgaonOffer, dhuleOffer;

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

    // 1. Seed categories
    categoryElectronics = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      icon: 'smartphone',
    });
    categoryClothing = await Category.create({
      name: 'Clothing',
      slug: 'clothing',
      icon: 'shirt',
    });
    await Category.create({
      name: 'Food & Dining',
      slug: 'food-dining',
      icon: 'utensils',
    });

    // 2. Customer based in Dhule
    customerUser = await User.create({
      name: 'Deepak Customer',
      email: 'deepak@customer.com',
      passwordHash: 'hash123',
      role: 'customer',
      city: 'Dhule',
    });
    customerToken = generateToken(customerUser);

    // 3. Vendors
    // Vendor A in Jalgaon [75.5626, 21.0077]
    const userJalgaon = await User.create({
      name: 'Kisan Merchant',
      email: 'kisan@jalgaon.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Jalgaon',
    });
    vendorJalgaon = await Vendor.create({
      userId: userJalgaon._id,
      shopName: 'Jalgaon Mobile Hub',
      status: 'active',
      city: 'Jalgaon',
      address: 'Station Road, Jalgaon',
      categories: [categoryElectronics._id],
      avgRating: 4.8,
      totalRatings: 120,
      isVerifiedShop: true,
      location: {
        type: 'Point',
        coordinates: [75.5626, 21.0077], // Jalgaon center
      },
    });

    // Vendor B in Dhule [74.7749, 20.9042] (~85km from Jalgaon)
    const userDhule = await User.create({
      name: 'Ramesh Clothier',
      email: 'ramesh@dhule.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Dhule',
    });
    vendorDhule = await Vendor.create({
      userId: userDhule._id,
      shopName: 'Dhule Fashion Hub',
      status: 'active',
      city: 'Dhule',
      address: 'Agra Road, Dhule',
      categories: [categoryClothing._id],
      avgRating: 4.2,
      totalRatings: 45,
      isVerifiedShop: true,
      location: {
        type: 'Point',
        coordinates: [74.7749, 20.9042], // Dhule center
      },
    });

    // Vendor C in Mumbai [72.8777, 19.0760]
    const userMumbai = await User.create({
      name: 'Metro Tech',
      email: 'metro@mumbai.com',
      passwordHash: 'hash123',
      role: 'vendor',
      city: 'Mumbai',
    });
    vendorMumbai = await Vendor.create({
      userId: userMumbai._id,
      shopName: 'Mumbai Gadget Palace',
      status: 'active',
      city: 'Mumbai',
      address: 'Lamington Road, Mumbai',
      categories: [categoryElectronics._id],
      avgRating: 3.9,
      totalRatings: 80,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
    });

    // 4. Approved active offers
    const now = new Date();
    const tenDaysLater = new Date(Date.now() + 10 * 86400000);

    jalgaonOffer = await Offer.create({
      vendorId: vendorJalgaon._id,
      title: '50% Off Smart LED Televisions',
      description:
        'Exclusive weekend electronics discount on 4K Smart TVs in Jalgaon.',
      discountText: 'Flat 50% Off',
      category: categoryElectronics._id,
      validFrom: now,
      validTill: tenDaysLater,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [75.5626, 21.0077],
      },
      images: ['https://res.cloudinary.com/demo/image/upload/tv.jpg'],
    });

    dhuleOffer = await Offer.create({
      vendorId: vendorDhule._id,
      title: 'Buy 1 Get 1 Free Denim Jeans',
      description: 'Festive clothing sale for men and women on branded denim.',
      discountText: 'BOGO Denim',
      category: categoryClothing._id,
      validFrom: now,
      validTill: tenDaysLater,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [74.7749, 20.9042],
      },
      images: ['https://res.cloudinary.com/demo/image/upload/jeans.jpg'],
    });

    await Offer.create({
      vendorId: vendorMumbai._id,
      title: '20% Off Wireless Bluetooth Speakers',
      description: 'Premium sound systems and soundbars on offer.',
      discountText: '20% OFF',
      category: categoryElectronics._id,
      validFrom: now,
      validTill: tenDaysLater,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
      images: ['https://res.cloudinary.com/demo/image/upload/speaker.jpg'],
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==============================================================
  // 1. ACTIVE VENDOR ENFORCEMENT & SUSPENSION
  // ==============================================================
  describe('Active Vendor Enforcement in Search', () => {
    it('should return approved offers for active vendors', async () => {
      const res = await request(app)
        .get('/api/offers/search')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offers.length).toBe(3);
    });

    it('should immediately exclude offers from suspended vendors, and restore when reactivated', async () => {
      // 1. Suspend Vendor Jalgaon
      await Vendor.findByIdAndUpdate(vendorJalgaon._id, {
        status: 'suspended',
      });

      // Offer in DB is still approved
      const offerDoc = await Offer.findById(jalgaonOffer._id);
      expect(offerDoc.status).toBe('approved');

      // 2. Search query MUST NOT include Jalgaon offer
      const resSuspended = await request(app)
        .get('/api/offers/search')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(resSuspended.status).toBe(200);
      expect(resSuspended.body.data.offers.length).toBe(2);
      const offerIds = resSuspended.body.data.offers.map((o) =>
        o._id.toString()
      );
      expect(offerIds).not.toContain(jalgaonOffer._id.toString());

      // 3. Reactivate Vendor Jalgaon
      await Vendor.findByIdAndUpdate(vendorJalgaon._id, { status: 'active' });

      // 4. Search query immediately includes Jalgaon offer again
      const resReactivated = await request(app)
        .get('/api/offers/search')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(resReactivated.status).toBe(200);
      expect(resReactivated.body.data.offers.length).toBe(3);
      const restoredIds = resReactivated.body.data.offers.map((o) =>
        o._id.toString()
      );
      expect(restoredIds).toContain(jalgaonOffer._id.toString());
    });
  });

  // ==============================================================
  // 2. CITY SEARCH & 25KM GEOSPATIAL RADIUS
  // ==============================================================
  describe('City Geocoded Search & Distance Calculation', () => {
    it('should search for "Jalgaon" by name, resolve coordinates, and return only Jalgaon offers within 25km', async () => {
      // Customer is based in Dhule, but explicitly searches for "Jalgaon"
      const res = await request(app)
        .get('/api/offers/search?city=Jalgaon')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offers.length).toBe(1);

      const item = res.body.data.offers[0];
      expect(item._id.toString()).toBe(jalgaonOffer._id.toString());
      expect(item.vendorId.shopName).toBe('Jalgaon Mobile Hub');
      expect(item.distanceKm).toBeDefined();
      expect(item.distanceKm).toBeLessThanOrEqual(25);

      // Verify Dhule (~85km away) and Mumbai (>350km away) are excluded
      const titles = res.body.data.offers.map((o) => o.title);
      expect(titles).not.toContain('Buy 1 Get 1 Free Denim Jeans');
      expect(titles).not.toContain('20% Off Wireless Bluetooth Speakers');
    });

    it('should support "Near Me" search with lat/lng and custom radius', async () => {
      // Coordinates of Dhule [74.7749, 20.9042] with 20km radius
      const res = await request(app)
        .get('/api/offers/search?lat=20.9042&lng=74.7749&radius=20')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(1);
      expect(res.body.data.offers[0]._id.toString()).toBe(
        dhuleOffer._id.toString()
      );
      expect(res.body.data.offers[0].distanceKm).toBeCloseTo(0, 0);
    });
  });

  // ==============================================================
  // 3. FREE-TEXT SEARCH (q) & CATEGORY FILTERING
  // ==============================================================
  describe('Free-text Search (q) & Category Filtering', () => {
    it('should find offers matching keyword in title or description', async () => {
      const res = await request(app)
        .get('/api/offers/search?q=bluetooth')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(1);
      expect(res.body.data.offers[0].title).toMatch(/Bluetooth/i);
    });

    it('should filter offers by category ID or slug', async () => {
      const resById = await request(app)
        .get(`/api/offers/search?category=${categoryClothing._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(resById.status).toBe(200);
      expect(resById.body.data.offers.length).toBe(1);
      expect(resById.body.data.offers[0].title).toBe(
        'Buy 1 Get 1 Free Denim Jeans'
      );

      const resBySlug = await request(app)
        .get('/api/offers/search?category=clothing')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(resBySlug.status).toBe(200);
      expect(resBySlug.body.data.offers.length).toBe(1);
      expect(resBySlug.body.data.offers[0].title).toBe(
        'Buy 1 Get 1 Free Denim Jeans'
      );
    });
  });

  // ==============================================================
  // 4. SORTING
  // ==============================================================
  describe('Search Result Sorting', () => {
    it('should sort by vendor rating descending when sort=rating', async () => {
      // Jalgaon: 4.8, Dhule: 4.2, Mumbai: 3.9
      const res = await request(app)
        .get('/api/offers/search?sort=rating')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(3);
      expect(res.body.data.offers[0].vendorId.avgRating).toBe(4.8);
      expect(res.body.data.offers[1].vendorId.avgRating).toBe(4.2);
      expect(res.body.data.offers[2].vendorId.avgRating).toBe(3.9);
    });

    it('should sort by distance ascending when sort=distance with location', async () => {
      // From Dhule [20.9042, 74.7749] with radius=500km
      const res = await request(app)
        .get(
          '/api/offers/search?lat=20.9042&lng=74.7749&radius=500&sort=distance'
        )
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(3);
      // Nearest is Dhule (~0km), then Jalgaon (~85km), then Mumbai (~310km)
      expect(res.body.data.offers[0].distanceKm).toBeLessThan(
        res.body.data.offers[1].distanceKm
      );
      expect(res.body.data.offers[1].distanceKm).toBeLessThan(
        res.body.data.offers[2].distanceKm
      );
    });
  });

  // ==============================================================
  // 5. ACTIVE CATEGORIES AGGREGATION
  // ==============================================================
  describe('GET /api/categories/active', () => {
    it('should only return categories that currently have at least one approved offer from an active vendor', async () => {
      const res = await request(app).get('/api/categories/active');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const categoryNames = res.body.data.map((c) => c.name);
      // Electronics (2 offers) and Clothing (1 offer) have live offers
      expect(categoryNames).toContain('Electronics');
      expect(categoryNames).toContain('Clothing');

      // Food & Dining has 0 offers, so it MUST NOT appear!
      expect(categoryNames).not.toContain('Food & Dining');

      const electronicsItem = res.body.data.find(
        (c) => c.name === 'Electronics'
      );
      expect(electronicsItem.offerCount).toBe(2);
    });

    it('should omit category if its only offer belongs to a suspended vendor', async () => {
      // Clothing category currently only has an offer from Dhule
      // Suspend Vendor Dhule
      await Vendor.findByIdAndUpdate(vendorDhule._id, { status: 'suspended' });

      const res = await request(app).get('/api/categories/active');
      expect(res.status).toBe(200);

      const categoryNames = res.body.data.map((c) => c.name);
      // Electronics is still active
      expect(categoryNames).toContain('Electronics');
      // Clothing now has 0 offers from active vendors, so it must NOT appear
      expect(categoryNames).not.toContain('Clothing');
    });
  });

  // ==============================================================
  // 6. PUBLIC SHOP DETAIL PAGE
  // ==============================================================
  describe('GET /api/vendor/:id/public', () => {
    it('should return shop profile and all approved offers for active vendor', async () => {
      const res = await request(app).get(
        `/api/vendor/${vendorJalgaon._id}/public`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.shopName).toBe('Jalgaon Mobile Hub');
      expect(res.body.data.vendor.city).toBe('Jalgaon');
      expect(res.body.data.offers.length).toBe(1);
      expect(res.body.data.offers[0]._id.toString()).toBe(
        jalgaonOffer._id.toString()
      );
    });

    it('should return 404 for suspended or inactive vendor', async () => {
      await Vendor.findByIdAndUpdate(vendorDhule._id, { status: 'suspended' });

      const res = await request(app).get(
        `/api/vendor/${vendorDhule._id}/public`
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not active/i);
    });
  });
});
