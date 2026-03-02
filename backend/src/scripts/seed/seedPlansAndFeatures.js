/**
 * Seed default features and plans
 * Run: node src/scripts/seed/seedPlansAndFeatures.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Plan, Feature } = require('../../models/subscription');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agent1';

const defaultFeatures = [
  {
    name: 'Keyword Search',
    featureKey: 'keyword_search',
    description: 'Search and analyze keywords for listings',
    type: 'numeric',
    defaultValue: 0,
    unit: 'searches/month',
    category: 'Analysis',
    displayOrder: 1
  },
  {
    name: 'AI Image Analysis',
    featureKey: 'ai_image_analysis',
    description: 'AI-powered image quality and SEO analysis',
    type: 'boolean',
    defaultValue: false,
    unit: '',
    category: 'AI',
    displayOrder: 2
  },
  {
    name: 'Competitor Analysis',
    featureKey: 'competitor_analysis',
    description: 'Analyze competitor listings and strategies',
    type: 'boolean',
    defaultValue: false,
    unit: '',
    category: 'Analysis',
    displayOrder: 3
  },
  {
    name: 'Listing Audit',
    featureKey: 'listing_audit',
    description: 'Full SEO audit of listings',
    type: 'numeric',
    defaultValue: 0,
    unit: 'audits/month',
    category: 'Analysis',
    displayOrder: 4
  },
  {
    name: 'Export Data',
    featureKey: 'export_data',
    description: 'Export analysis results to CSV/PDF',
    type: 'boolean',
    defaultValue: false,
    unit: '',
    category: 'Export',
    displayOrder: 5
  },
  {
    name: 'Trend Tracking',
    featureKey: 'trend_tracking',
    description: 'Track keyword and market trends over time',
    type: 'boolean',
    defaultValue: false,
    unit: '',
    category: 'Analysis',
    displayOrder: 6
  }
];

const seedFeaturesAndPlans = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // --- Seed Features ---
    const featureMap = {};
    for (const feat of defaultFeatures) {
      let existing = await Feature.findOne({ featureKey: feat.featureKey });
      if (!existing) {
        existing = await Feature.create(feat);
        console.log(`  ✅ Created feature: ${feat.name}`);
      } else {
        console.log(`  ⏩ Feature exists: ${feat.name}`);
      }
      featureMap[feat.featureKey] = existing;
    }

    // --- Seed Plans ---
    const defaultPlans = [
      {
        name: 'Free',
        description: 'Get started with basic features',
        price: { monthly: 0, yearly: 0 },
        billingCycle: 'both',
        isActive: true,
        isDefault: true,
        displayOrder: 1,
        trialDays: 0,
        features: [
          { featureKey: 'keyword_search', enabled: true, limit: 5 },
          { featureKey: 'listing_audit', enabled: true, limit: 1 },
          { featureKey: 'ai_image_analysis', enabled: false, limit: null },
          { featureKey: 'competitor_analysis', enabled: false, limit: null },
          { featureKey: 'export_data', enabled: false, limit: null },
          { featureKey: 'trend_tracking', enabled: false, limit: null }
        ]
      },
      {
        name: 'Starter',
        description: 'Perfect for new users',
        price: { monthly: 19, yearly: 190 },
        billingCycle: 'both',
        isActive: true,
        isDefault: false,
        displayOrder: 2,
        trialDays: 7,
        features: [
          { featureKey: 'keyword_search', enabled: true, limit: 100 },
          { featureKey: 'listing_audit', enabled: true, limit: 50 },
          { featureKey: 'ai_image_analysis', enabled: true, limit: null },
          { featureKey: 'competitor_analysis', enabled: false, limit: null },
          { featureKey: 'export_data', enabled: true, limit: null },
          { featureKey: 'trend_tracking', enabled: false, limit: null }
        ]
      },
      {
        name: 'Pro',
        description: 'For growing businesses',
        price: { monthly: 49, yearly: 490 },
        billingCycle: 'both',
        isActive: true,
        isDefault: false,
        displayOrder: 3,
        trialDays: 14,
        features: [
          { featureKey: 'keyword_search', enabled: true, limit: 500 },
          { featureKey: 'listing_audit', enabled: true, limit: 250 },
          { featureKey: 'ai_image_analysis', enabled: true, limit: null },
          { featureKey: 'competitor_analysis', enabled: true, limit: null },
          { featureKey: 'export_data', enabled: true, limit: null },
          { featureKey: 'trend_tracking', enabled: true, limit: null }
        ]
      },
      {
        name: 'Elite',
        description: 'Unlimited access for power users',
        price: { monthly: 99, yearly: 990 },
        billingCycle: 'both',
        isActive: true,
        isDefault: false,
        displayOrder: 4,
        trialDays: 14,
        features: [
          { featureKey: 'keyword_search', enabled: true, limit: 999999 },
          { featureKey: 'listing_audit', enabled: true, limit: 999999 },
          { featureKey: 'ai_image_analysis', enabled: true, limit: null },
          { featureKey: 'competitor_analysis', enabled: true, limit: null },
          { featureKey: 'export_data', enabled: true, limit: null },
          { featureKey: 'trend_tracking', enabled: true, limit: null }
        ]
      }
    ];

    for (const planData of defaultPlans) {
      const existing = await Plan.findOne({ name: planData.name });
      if (existing) {
        console.log(`  ⏩ Plan exists: ${planData.name}`);
        continue;
      }

      // Resolve feature references
      const planFeatures = planData.features.map(pf => {
        const feat = featureMap[pf.featureKey];
        if (!feat) return null;
        return {
          featureId: feat._id,
          featureKey: feat.featureKey,
          featureName: feat.name,
          enabled: pf.enabled,
          limit: pf.limit,
          value: null
        };
      }).filter(Boolean);

      await Plan.create({
        name: planData.name,
        description: planData.description,
        price: planData.price,
        billingCycle: planData.billingCycle,
        isActive: planData.isActive,
        isDefault: planData.isDefault,
        displayOrder: planData.displayOrder,
        trialDays: planData.trialDays,
        features: planFeatures
      });

      console.log(`  ✅ Created plan: ${planData.name} ($${planData.price.monthly}/mo)`);
    }

    console.log('\n🎉 Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedFeaturesAndPlans();
