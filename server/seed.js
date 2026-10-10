import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Category, User } from './models/index.js';

const categoriesToSeed = [
  { name: 'Groceries', slug: 'groceries', icon: 'shopping-basket' },
  { name: 'Electronics', slug: 'electronics', icon: 'smartphone' },
  { name: 'Clothing', slug: 'clothing', icon: 'shirt' },
  { name: 'Toys', slug: 'toys', icon: 'gamepad-2' },
  { name: 'Restaurants', slug: 'restaurants', icon: 'utensils' },
  { name: 'Stationery', slug: 'stationery', icon: 'book-open' },
  { name: 'Footwear', slug: 'footwear', icon: 'footprints' },
  { name: 'Home Decor', slug: 'home-decor', icon: 'home' },
];

export const seedDatabase = async () => {
  const mongoUri =
    process.env.MONGO_URI || 'mongodb://localhost:27017/offerbazaar';

  console.log('----------------------------------------------------');
  console.log('[Seed] Starting database seeding...');
  console.log(`[Seed] Connecting to MongoDB: ${mongoUri}`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // 1. Seed Categories (Idempotent)
  console.log(`[Seed] Seeding ${categoriesToSeed.length} categories...`);
  const seededCategories = [];
  for (const cat of categoriesToSeed) {
    const categoryDoc = await Category.findOneAndUpdate(
      { slug: cat.slug },
      { $set: cat },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seededCategories.push(categoryDoc);
    console.log(
      `  ✓ Category: ${categoryDoc.name} (${categoryDoc.slug}) [icon: ${categoryDoc.icon}]`
    );
  }

  // 2. Seed Admin User from Environment Variables
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'OfferBazaar Admin';
  const adminPhone = process.env.ADMIN_PHONE || '+919876543210';
  const adminCity = process.env.ADMIN_CITY || 'Mumbai';

  if (!adminEmail || !adminPassword) {
    console.error(
      '[Seed] Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env'
    );
    throw new Error('Missing admin seed credentials in environment variables');
  }

  console.log(`[Seed] Seeding admin user: ${adminEmail}...`);
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  // Check if admin already exists by current email or previous default email
  const existingAdmin = await User.findOne({
    $or: [
      { email: adminEmail.toLowerCase().trim() },
      { email: 'admin@offerbazaar.com' },
    ],
  });

  let adminUser;
  if (existingAdmin) {
    existingAdmin.name = adminName;
    existingAdmin.email = adminEmail.toLowerCase().trim();
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.role = 'admin';
    existingAdmin.phone = adminPhone;
    existingAdmin.city = adminCity;
    adminUser = await existingAdmin.save();
  } else {
    adminUser = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase().trim(),
      passwordHash,
      role: 'admin',
      phone: adminPhone,
      city: adminCity,
    });
  }

  console.log(
    `  ✓ Admin user verified: ${adminUser.name} <${adminUser.email}> (Role: ${adminUser.role})`
  );
  console.log('[Seed] Database seeding completed successfully!');
  console.log('----------------------------------------------------');

  return {
    categories: seededCategories,
    admin: adminUser,
  };
};

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[Seed] Fatal error:', error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
