const mongoose = require('mongoose');
const { User } = require('../../models/user');
const { AdminSettings } = require('../../models/admin');
require('dotenv').config();

/**
 * Seed Script to create first Super Admin
 * Run this once during initial setup: node src/scripts/seedSuperAdmin.js
 */

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin already exists!');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log('   If you want to create another super admin, use the admin panel.');
      process.exit(0);
    }

    // Super Admin credentials (CHANGE THESE!)
    const superAdminData = {
      name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
      accountType: 'admin',
      role: 'super_admin',
      status: 'active',
      isEmailVerified: true
    };

    // Validate
    if (superAdminData.email === 'admin@example.com' || 
        superAdminData.password === 'SuperAdmin@123') {
      console.log('⚠️  WARNING: Using default credentials!');
      console.log('   Please set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env file');
      console.log('   Or change them after first login for security.');
    }

    // Create super admin
    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log('✅ Super Admin created successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   SUPER ADMIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${superAdmin.email}`);
    console.log(`   Password: ${superAdminData.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change the password immediately after first login');
    console.log('   2. Store credentials securely');
    console.log('   3. Never commit .env file to version control');
    console.log('');

    // Initialize default settings
    const settings = await AdminSettings.getSettings();
    console.log(`Welcome to ${process.env.APP_NAME || 'Admin Panel'}`);

    console.log('');
    console.log('🎉 Setup complete! You can now:');
    console.log(`   1. Login at: ${process.env.ADMIN_FRONTEND_URL || 'http://localhost:3003'}/login`);
    console.log('   2. Create additional admin users');
    console.log('   3. Configure system settings');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
};

// Run the seed script
createSuperAdmin();

/**
 * Usage:
 * 
 * 1. Add to .env file:
 *    SUPER_ADMIN_NAME=Your Name
 *    SUPER_ADMIN_EMAIL=your.email@example.com
 *    SUPER_ADMIN_PASSWORD=YourSecurePassword123!
 * 
 * 2. Run: node src/scripts/seedSuperAdmin.js
 * 
 * 3. Login with the credentials
 * 
 * 4. Change password immediately
 */
