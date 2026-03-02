// backend/src/scripts/migrateExistingCustomers.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const migrateCustomers = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await User.updateMany(
    { accountType: { $exists: false } },
    { 
      $set: { 
        accountType: 'customer',
        role: 'customer',
        status: 'active', // Or 'pending_verification' if you want them to verify
        isEmailVerified: true // Set to false to require verification
      }
    }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} customers`);
  process.exit(0);
};

migrateCustomers();