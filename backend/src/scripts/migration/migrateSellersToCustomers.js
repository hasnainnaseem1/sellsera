const mongoose = require('mongoose');
require('dotenv').config();

async function migrateSellersToCustomers() {
  try {
    console.log('🔄 Starting database migration: seller → customer...');
    console.log('');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // ==========================================
    // UPDATE USERS COLLECTION
    // ==========================================
    console.log('');
    console.log('📊 Updating users collection...');
    
    // Update accountType from 'seller' to 'customer'
    const usersAccountType = await db.collection('users').updateMany(
      { accountType: 'seller' },
      { $set: { accountType: 'customer' } }
    );
    console.log(`  ✅ Updated accountType: ${usersAccountType.modifiedCount} users`);
    
    // Update role from 'seller' to 'customer'
    const usersRole = await db.collection('users').updateMany(
      { role: 'seller' },
      { $set: { role: 'customer' } }
    );
    console.log(`  ✅ Updated role: ${usersRole.modifiedCount} users`);
    
    // ==========================================
    // UPDATE ACTIVITY LOGS
    // ==========================================
    console.log('');
    console.log('📊 Updating activity logs...');
    
    // Update action field values
    const actions = {
      'seller_created': 'customer_created',
      'seller_updated': 'customer_updated',
      'seller_deleted': 'customer_deleted',
      'seller_suspended': 'customer_suspended',
      'seller_activated': 'customer_activated',
      'seller_plan_changed': 'customer_plan_changed',
      'seller_verified': 'customer_verified'
    };
    
    let totalLogsUpdated = 0;
    for (const [oldAction, newAction] of Object.entries(actions)) {
      const result = await db.collection('activitylogs').updateMany(
        { action: oldAction },
        { $set: { action: newAction } }
      );
      totalLogsUpdated += result.modifiedCount;
    }
    console.log(`  ✅ Updated action fields: ${totalLogsUpdated} logs`);
    
    // Update userRole field
    const logsUserRole = await db.collection('activitylogs').updateMany(
      { userRole: 'seller' },
      { $set: { userRole: 'customer' } }
    );
    console.log(`  ✅ Updated userRole: ${logsUserRole.modifiedCount} logs`);
    
    // ==========================================
    // UPDATE ADMIN SETTINGS
    // ==========================================
    console.log('');
    console.log('📊 Updating admin settings...');
    
    // Rename sellerSettings to customerSettings
    const settingsResult = await db.collection('adminsettings').updateMany(
      { sellerSettings: { $exists: true } },
      { $rename: { sellerSettings: 'customerSettings' } }
    );
    console.log(`  ✅ Renamed sellerSettings to customerSettings: ${settingsResult.modifiedCount} documents`);
    
    // ==========================================
    // COMPLETE
    // ==========================================
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DATABASE MIGRATION COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Summary:');
    console.log(`  • Users accountType updated: ${usersAccountType.modifiedCount}`);
    console.log(`  • Users role updated: ${usersRole.modifiedCount}`);
    console.log(`  • Activity logs updated: ${totalLogsUpdated + logsUserRole.modifiedCount}`);
    console.log(`  • Admin settings updated: ${settingsResult.modifiedCount}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Restart your server for changes to take effect!');
    console.log('');
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateSellersToCustomers();
