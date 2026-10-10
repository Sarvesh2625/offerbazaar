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
import { User, Vendor } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

import routes from '../routes/index.js';

const TEST_DB_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://localhost:27017/offerbazaar_auth_test';

// Mount auxiliary test routes to verify role authorization
routes.get('/test/admin-only', authenticate, authorize('admin'), (req, res) => {
  res.json({ success: true, message: 'Welcome Admin' });
});

routes.get(
  '/test/vendor-only',
  authenticate,
  authorize('vendor'),
  (req, res) => {
    res.json({ success: true, message: 'Welcome Vendor' });
  }
);

describe('OfferBazaar Authentication & Authorization Test Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    await Promise.all([User.init(), Vendor.init()]);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Vendor.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // 1. SIGNUP ENDPOINT TESTS
  // ==========================================
  describe('POST /api/auth/signup', () => {
    it('should successfully register a customer and not create a Vendor document', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        password: 'Password@123',
        phone: '+919876543210',
        city: 'Mumbai',
        role: 'customer',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('rahul@example.com');
      expect(res.body.user.role).toBe('customer');

      // Verify cookie was set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);

      // Verify DB state
      const userInDb = await User.findOne({ email: 'rahul@example.com' });
      expect(userInDb).toBeDefined();

      const vendorInDb = await Vendor.findOne({ userId: userInDb._id });
      expect(vendorInDb).toBeNull();
    });

    it('should successfully register a vendor and automatically create linked Vendor document with status "pending"', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Priya Patel',
        email: 'priya@kirana.com',
        password: 'Password@123',
        phone: '+919876543211',
        city: 'Ahmedabad',
        role: 'vendor',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('vendor');
      expect(res.body.user.vendor).toBeDefined();
      expect(res.body.user.vendor.status).toBe('pending');

      // Verify linked Vendor document exists in DB
      const userInDb = await User.findOne({ email: 'priya@kirana.com' });
      expect(userInDb).toBeDefined();

      const vendorInDb = await Vendor.findOne({ userId: userInDb._id });
      expect(vendorInDb).toBeDefined();
      expect(vendorInDb.status).toBe('pending');
      expect(vendorInDb.shopName).toBe('');
      expect(vendorInDb.city).toBe('Ahmedabad');
    });

    it('should reject signup attempts with role "admin"', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Hacker Admin',
        email: 'fakeadmin@offerbazaar.com',
        password: 'Password@123',
        role: 'admin',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin accounts cannot be created/i);
    });

    it('should reject signup when password is shorter than 8 characters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Short Pass',
        email: 'short@example.com',
        password: '123',
        role: 'customer',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    it('should reject signup with invalid email format', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'Password@123',
        role: 'customer',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/valid email/i);
    });

    it('should reject signup if email is already registered', async () => {
      // First signup
      await request(app).post('/api/auth/signup').send({
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'Password@123',
        role: 'customer',
      });

      // Second signup with same email
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Second User',
        email: 'duplicate@example.com',
        password: 'Password@456',
        role: 'customer',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  // ==========================================
  // 2. LOGIN ENDPOINT TESTS
  // ==========================================
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a customer and a vendor
      await request(app).post('/api/auth/signup').send({
        name: 'Login Test Customer',
        email: 'customer@login.com',
        password: 'Password@123',
        role: 'customer',
      });

      await request(app).post('/api/auth/signup').send({
        name: 'Login Test Vendor',
        email: 'vendor@login.com',
        password: 'Password@123',
        role: 'vendor',
      });
    });

    it('should successfully log in with correct email and password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'customer@login.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('customer@login.com');
      expect(res.body.user.role).toBe('customer');

      // Verify cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'customer@login.com',
        password: 'WrongPassword!99',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@nowhere.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });
  });

  // ==========================================
  // 3. GET /api/auth/me TESTS
  // ==========================================
  describe('GET /api/auth/me', () => {
    let customerToken;
    let customerCookie;

    beforeEach(async () => {
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'Password@123',
        role: 'customer',
      });

      customerToken = signupRes.body.token;
      customerCookie = signupRes.headers['set-cookie'][0];
    });

    it('should return profile when authenticated with Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('me@example.com');
      expect(res.body.user.passwordHash).toBeUndefined(); // Never expose password hash
    });

    it('should return profile when authenticated with httpOnly cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [customerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('me@example.com');
    });

    it('should return 401 when no token or cookie is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('should return 401 when invalid token is supplied', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_garbage_token_123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. LOGOUT ENDPOINT TESTS
  // ==========================================
  describe('POST /api/auth/logout', () => {
    it('should clear the cookie and return success message', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Logged out successfully/i);

      // Verify cleared cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=;/);
    });
  });

  // ==========================================
  // 5. ROLE AUTHORIZATION MIDDLEWARE TESTS
  // ==========================================
  describe('Role-Based Authorization (authorize middleware)', () => {
    let customerToken;
    let vendorToken;
    let adminToken;

    beforeEach(async () => {
      // 1. Customer
      const custRes = await request(app).post('/api/auth/signup').send({
        name: 'Role Customer',
        email: 'role_cust@example.com',
        password: 'Password@123',
        role: 'customer',
      });
      customerToken = custRes.body.token;

      // 2. Vendor
      const vendRes = await request(app).post('/api/auth/signup').send({
        name: 'Role Vendor',
        email: 'role_vend@example.com',
        password: 'Password@123',
        role: 'vendor',
      });
      vendorToken = vendRes.body.token;

      // 3. Admin (created directly or seeded, not via public signup)
      const adminUser = await User.create({
        name: 'System Admin',
        email: 'admin@system.com',
        passwordHash: 'hash123',
        role: 'admin',
      });
      const { generateToken } = await import('../utils/jwt.js');
      adminToken = generateToken(adminUser);
    });

    it('should reject customer accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/test/admin-only')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('should reject vendor accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/test/admin-only')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('should allow admin to access admin-only endpoint with 200 OK', async () => {
      const res = await request(app)
        .get('/api/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Welcome Admin');
    });

    it('should reject customer accessing vendor-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/test/vendor-only')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow vendor to access vendor-only endpoint with 200 OK', async () => {
      const res = await request(app)
        .get('/api/test/vendor-only')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Welcome Vendor');
    });
  });
});
