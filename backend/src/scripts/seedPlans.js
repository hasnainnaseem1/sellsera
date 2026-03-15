/**
 * Seed Plans & Features
 * 
 * Creates the 4 pricing plans (Free, Basic, Pro, Pro Plus) and all features
 * as defined in the Phase 2 blueprint. Idempotent — runs upserts.
 * 
 * Usage: node src/scripts/seedPlans.js
 */
const mongoose = require('mongoose');
const path = require('path');

// Load env vars
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Feature = require('../models/subscription/Feature');
const Plan = require('../models/subscription/Plan');

/* ─── Feature Definitions ─── */
const FEATURES = [
  { featureKey: 'listing_audit', name: 'Listing Audits', type: 'numeric', unit: 'audits/month', category: 'Analysis', displayOrder: 1 },
  { featureKey: 'keyword_search', name: 'Keyword Searches', type: 'numeric', unit: 'searches/month', category: 'Keywords', displayOrder: 2 },
  { featureKey: 'keyword_deep_analysis', name: 'Deep Keyword Analysis', type: 'numeric', unit: 'analyses/month', category: 'Keywords', displayOrder: 3 },
  { featureKey: 'bulk_rank_check', name: 'Bulk Rank Checks', type: 'numeric', unit: 'checks/month', category: 'Keywords', displayOrder: 4 },
  { featureKey: 'tag_analysis', name: 'Tag Analysis', type: 'numeric', unit: 'analyses/month', category: 'Analysis', displayOrder: 5 },
  { featureKey: 'listing_sync', name: 'Active Listings Sync', type: 'numeric', unit: 'listings', category: 'Sync', displayOrder: 6 },
  { featureKey: 'competitor_tracking', name: 'Competitor Tracking', type: 'numeric', unit: 'shops', category: 'Competitors', displayOrder: 7 },
  { featureKey: 'competitor_sales', name: 'Competitor Sales', type: 'numeric', unit: 'shops', category: 'Competitors', displayOrder: 8 },
  { featureKey: 'delivery_tracking', name: 'Delivery Tracking', type: 'boolean', category: 'Logistics', displayOrder: 9 },
  { featureKey: 'sales_map', name: 'Sales Map', type: 'boolean', category: 'Logistics', displayOrder: 10 },
  { featureKey: 'analysis_history', name: 'Analysis History', type: 'numeric', unit: 'days', category: 'General', displayOrder: 11 },
  { featureKey: 'ai_listing_optimizer', name: 'AI Analysis', type: 'numeric', unit: 'analyses/month', category: 'AI', displayOrder: 12 },
  { featureKey: 'ai_tag_generator', name: 'AI Tag Generator', type: 'numeric', unit: 'generations/month', category: 'AI', displayOrder: 13 },
  { featureKey: 'csv_export', name: 'CSV Export', type: 'boolean', category: 'Export', displayOrder: 14 },
  { featureKey: 'priority_support', name: 'Priority Support', type: 'boolean', category: 'Support', displayOrder: 15 },
  { featureKey: 'connect_shops', name: 'Connect Shops', type: 'numeric', unit: 'shops', category: 'General', displayOrder: 16 },
];

/* ─── Plan Definitions with feature limits ─── */
// Key: featureKey → { enabled, limit, periodType (optional) }
// enabled=false means the feature is not available on that plan
// limit=null for boolean features
const FREE_FEATURES = {
  listing_audit:        { enabled: true, limit: 3 },
  keyword_search:       { enabled: true, limit: 5 },
  keyword_deep_analysis:{ enabled: false, limit: 0 },
  bulk_rank_check:      { enabled: false, limit: 0 },
  tag_analysis:         { enabled: true, limit: 3 },
  listing_sync:         { enabled: true, limit: 50 },
  competitor_tracking:  { enabled: false, limit: 0 },
  competitor_sales:     { enabled: false, limit: 0 },
  delivery_tracking:    { enabled: false, limit: null },
  sales_map:            { enabled: false, limit: null },
  analysis_history:     { enabled: true, limit: 7 },
  ai_listing_optimizer: { enabled: true, limit: 1, periodType: 'lifetime' },
  ai_tag_generator:     { enabled: true, limit: 1, periodType: 'lifetime' },
  csv_export:           { enabled: false, limit: null },
  priority_support:     { enabled: false, limit: null },
  connect_shops:        { enabled: true, limit: 1 },
};

const BASIC_FEATURES = {
  listing_audit:        { enabled: true, limit: 25 },
  keyword_search:       { enabled: true, limit: 30 },
  keyword_deep_analysis:{ enabled: true, limit: 10 },
  bulk_rank_check:      { enabled: true, limit: 5 },
  tag_analysis:         { enabled: true, limit: 20 },
  listing_sync:         { enabled: true, limit: 500 },
  competitor_tracking:  { enabled: true, limit: 2 },
  competitor_sales:     { enabled: false, limit: 0 },
  delivery_tracking:    { enabled: true, limit: null },
  sales_map:            { enabled: true, limit: null },
  analysis_history:     { enabled: true, limit: 30 },
  ai_listing_optimizer: { enabled: true, limit: 5 },
  ai_tag_generator:     { enabled: true, limit: 5 },
  csv_export:           { enabled: true, limit: null },
  priority_support:     { enabled: false, limit: null },
  connect_shops:        { enabled: true, limit: 1 },
};

const PRO_FEATURES = {
  listing_audit:        { enabled: true, limit: 100 },
  keyword_search:       { enabled: true, limit: 500 },
  keyword_deep_analysis:{ enabled: true, limit: 50 },
  bulk_rank_check:      { enabled: true, limit: 150 },
  tag_analysis:         { enabled: true, limit: 80 },
  listing_sync:         { enabled: true, limit: 2000 },
  competitor_tracking:  { enabled: true, limit: 10 },
  competitor_sales:     { enabled: true, limit: 10 },
  delivery_tracking:    { enabled: true, limit: null },
  sales_map:            { enabled: true, limit: null },
  analysis_history:     { enabled: true, limit: 90 },
  ai_listing_optimizer: { enabled: true, limit: 20 },
  ai_tag_generator:     { enabled: true, limit: 10 },
  csv_export:           { enabled: true, limit: null },
  priority_support:     { enabled: true, limit: null },
  connect_shops:        { enabled: true, limit: 3 },
};

const PRO_PLUS_FEATURES = {
  listing_audit:        { enabled: true, limit: 500 },
  keyword_search:       { enabled: true, limit: 1000 },
  keyword_deep_analysis:{ enabled: true, limit: 500 },
  bulk_rank_check:      { enabled: true, limit: 400 },
  tag_analysis:         { enabled: true, limit: 500 },
  listing_sync:         { enabled: true, limit: 5000 },
  competitor_tracking:  { enabled: true, limit: 25 },
  competitor_sales:     { enabled: true, limit: 25 },
  delivery_tracking:    { enabled: true, limit: null },
  sales_map:            { enabled: true, limit: null },
  analysis_history:     { enabled: true, limit: 365 },
  ai_listing_optimizer: { enabled: true, limit: 100 },
  ai_tag_generator:     { enabled: true, limit: 50 },
  csv_export:           { enabled: true, limit: null },
  priority_support:     { enabled: true, limit: null },
  connect_shops:        { enabled: true, limit: 5 },
};

const PLANS = [
  {
    name: 'Free',
    description: 'Get started with basic Etsy seller tools',
    price: { monthly: 0, yearly: 0 },
    isDefault: true,
    displayOrder: 1,
    trialDays: 0,
    featuresMap: FREE_FEATURES,
  },
  {
    name: 'Basic',
    description: 'Essential tools for growing Etsy sellers',
    price: { monthly: 12, yearly: 115 },
    isDefault: false,
    displayOrder: 2,
    trialDays: 7,
    featuresMap: BASIC_FEATURES,
  },
  {
    name: 'Pro',
    description: 'Advanced analytics and competitor intelligence',
    price: { monthly: 29, yearly: 278 },
    isDefault: false,
    displayOrder: 3,
    trialDays: 7,
    featuresMap: PRO_FEATURES,
  },
  {
    name: 'Pro Plus',
    description: 'Maximum power for professional Etsy businesses',
    price: { monthly: 59, yearly: 566 },
    isDefault: false,
    displayOrder: 4,
    trialDays: 7,
    featuresMap: PRO_PLUS_FEATURES,
  },
];

/* ─── Main Seed Function ─── */
async function seed() {
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('❌ MONGODB_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('📦 Connected to MongoDB');

  // 1. Upsert all features
  const featureIdMap = {}; // featureKey → _id
  for (const def of FEATURES) {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const feature = await Feature.findOneAndUpdate(
      { featureKey: def.featureKey },
      {
        name: def.name,
        slug,
        featureKey: def.featureKey,
        type: def.type,
        unit: def.unit || '',
        category: def.category || 'General',
        displayOrder: def.displayOrder || 0,
        isActive: true,
      },
      { new: true, upsert: true }
    );
    featureIdMap[def.featureKey] = feature._id;
    console.log(`  ✅ Feature: ${def.name} (${def.featureKey})`);
  }

  // 2. Upsert all plans with features
  for (const planDef of PLANS) {
    const features = [];
    for (const [featureKey, config] of Object.entries(planDef.featuresMap)) {
      const featureDoc = FEATURES.find(f => f.featureKey === featureKey);
      if (!featureDoc) continue;
      features.push({
        featureId: featureIdMap[featureKey],
        featureKey,
        featureName: featureDoc.name,
        enabled: config.enabled,
        limit: config.limit,
        periodType: config.periodType || 'monthly',
      });
    }

    await Plan.findOneAndUpdate(
      { name: planDef.name },
      {
        name: planDef.name,
        description: planDef.description,
        price: planDef.price,
        isDefault: planDef.isDefault,
        displayOrder: planDef.displayOrder,
        trialDays: planDef.trialDays,
        features,
        isActive: true,
      },
      { new: true, upsert: true }
    );
    console.log(`  ✅ Plan: ${planDef.name} ($${planDef.price.monthly}/mo) — ${features.length} features`);
  }

  console.log('\n🎉 Seeding complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
