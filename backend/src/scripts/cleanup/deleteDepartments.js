const mongoose = require('mongoose');
const Department = require('../../models/admin/Department');

// MongoDB connection string from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/agent1?authSource=admin';

const deleteDepartments = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const departmentValues = [
      'engineering',
      'finance',
      'hr',
      'legal',
      'marketing',
      'sales'
    ];

    console.log('🗑️  Deleting departments...\n');
    
    for (const value of departmentValues) {
      try {
        const result = await Department.deleteOne({ value });
        if (result.deletedCount > 0) {
          console.log(`✅ Deleted: ${value}`);
        } else {
          console.log(`⚠️  Not found: ${value}`);
        }
      } catch (err) {
        console.log(`❌ Error deleting ${value}: ${err.message}`);
      }
    }

    console.log('\n✅ Cleanup complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

deleteDepartments();
