#!/usr/bin/env node
/**
 * Assign a plan to a user by email.
 * Usage:  node src/scripts/assignPlan.js <email> [planName]
 * Example: node src/scripts/assignPlan.js test@example.com "Pro"
 *
 * If planName is omitted, defaults to "Pro" (all features unlocked).
 * Valid plan names: Free, Basic, Pro, Pro Plus
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user/User');
const Plan = require('../models/subscription/Plan');

async function main() {
  const email = process.argv[2];
  const planName = process.argv[3] || 'Pro';

  if (!email) {
    console.error('Usage: node src/scripts/assignPlan.js <email> [planName]');
    process.exit(1);
  }

  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('📦 Connected to MongoDB');

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✅ Found user: ${user.name || user.email} (${user._id})`);

  // Find plan
  const plan = await Plan.findOne({ name: { $regex: new RegExp(`^${planName}$`, 'i') } });
  if (!plan) {
    const available = await Plan.find({}, 'name').lean();
    console.error(`❌ Plan "${planName}" not found. Available: ${available.map(p => p.name).join(', ')}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✅ Found plan: ${plan.name} ($${plan.price?.monthly || 0}/mo)`);

  // Assign plan snapshot
  user.currentPlan = plan._id;
  user.planSnapshot = {
    planId: plan._id,
    planName: plan.name,
    features: plan.features.map(f => ({
      featureId: f.featureId,
      featureKey: f.featureKey,
      featureName: f.featureName,
      enabled: f.enabled,
      limit: f.limit,
      value: f.value,
    })),
    assignedAt: new Date(),
    assignedBy: null,
  };
  user.subscriptionStatus = 'active';
  user.trialEndsAt = null;
  user.trialWarningEmailSent = false;
  user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  user.monthlyResetDate = new Date();

  if (typeof user.updateAnalysisLimit === 'function') {
    user.updateAnalysisLimit();
  }
  user.analysisCount = 0;

  await user.save();

  console.log(`\n🎉 Assigned "${plan.name}" plan to ${email}`);
  console.log(`   Features: ${plan.features.filter(f => f.enabled).length} enabled`);
  console.log(`   Status: active`);
  console.log(`   Expires: ${user.subscriptionExpiresAt.toISOString().split('T')[0]}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
