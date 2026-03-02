const { Analysis } = require('../../models/customer');
const { User } = require('../../models/user');

/**
 * POST /api/v1/customer/analyze
 * Analyze listing
 */
const analyzeListing = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { title, description, tags, price, category } = req.body;

    // Validation
    if (!title || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, price, category'
      });
    }

    // User info (subscription + feature access already verified by middleware)
    const user = await User.findById(req.userId);

    // HARDCODED AI RESPONSE (will be replaced with Claude API later)
    const aiRecommendations = {
      optimizedTitle: `${title.substring(0, 30)} | Premium Quality | Fast Shipping | Gift Ready`,
      titleReasoning: 'Your original title was good but missing key buyer triggers. Added "Premium Quality" to increase perceived value, "Fast Shipping" to reduce purchase anxiety, and "Gift Ready" to capture gift-buyers. Limited to 140 characters for SEO.',
      
      optimizedDescription: `🌟 PRODUCT HIGHLIGHTS
${description.substring(0, 100)}... crafted with premium materials for lasting quality.

✨ WHY CHOOSE US?
• Fast shipping - ships within 24 hours
• Premium packaging included
• 100% satisfaction guarantee
• Perfect gift option

📦 SHIPPING & RETURNS
Ships from our studio within 1 business day. Free returns within 30 days.

💝 PERFECT FOR
Gifts, home decor, special occasions, or treating yourself!

ORDER NOW and get FREE gift wrapping with your purchase!`,
      
      descriptionReasoning: 'Restructured your description with clear sections, added emojis for visual appeal, included trust signals (shipping time, guarantee), and ended with urgency CTA. This format increases conversions by 40% based on competitor analysis.',
      
      optimizedTags: [
        { tag: 'premium gift', reasoning: 'High search volume (12K/month), low competition, matches buyer intent' },
        { tag: 'handmade quality', reasoning: 'Shoppers specifically search this, 8K monthly searches' },
        { tag: 'fast shipping', reasoning: 'Reduces cart abandonment, 15K searches/month' },
        { tag: category.toLowerCase(), reasoning: 'Your category as a tag increases discoverability by 25%' },
        { tag: 'unique present', reasoning: 'Gift-buyers use this term, 6K searches' },
        { tag: 'artisan made', reasoning: 'Premium positioning keyword, 4K searches' },
        { tag: 'ready to ship', reasoning: 'Urgency keyword, converts 30% higher' },
        { tag: 'home decor', reasoning: 'Broad category, 50K+ searches' },
        { tag: 'birthday gift', reasoning: 'Occasion-based, 18K searches' },
        { tag: 'gift for her', reasoning: 'Gender-targeted, 22K searches' },
        { tag: 'gift for him', reasoning: 'Gender-targeted, 19K searches' },
        { tag: 'anniversary gift', reasoning: 'Occasion-based, 9K searches' },
        { tag: 'custom order', reasoning: 'Personalization angle, 7K searches' }
      ],
      
      pricingRecommendation: {
        suggestedPrice: Math.round(price * 1.25 * 100) / 100,
        reasoning: `Your current price of $${price} is undervalued. Top competitors charge $${Math.round(price * 1.15)}-$${Math.round(price * 1.35)}. Recommended 25% increase to $${Math.round(price * 1.25 * 100) / 100} positions you as premium without losing sales. This sweet spot maximizes revenue.`,
        competitorRange: {
          min: Math.round(price * 0.9 * 100) / 100,
          max: Math.round(price * 1.5 * 100) / 100,
          average: Math.round(price * 1.25 * 100) / 100
        }
      },
      
      actionItems: [
        {
          priority: 'high',
          action: 'Update title with optimized version',
          impact: 'Expected 35% increase in search visibility'
        },
        {
          priority: 'high',
          action: 'Replace all 13 tags with recommended tags',
          impact: 'Reach 50K+ more monthly searches'
        },
        {
          priority: 'high',
          action: 'Implement new description format',
          impact: '40% higher conversion rate based on competitor data'
        },
        {
          priority: 'medium',
          action: 'Increase price to recommended amount',
          impact: '25% revenue increase per sale'
        },
        {
          priority: 'medium',
          action: 'Add "Fast Shipping" badge if not already active',
          impact: 'Reduces cart abandonment by 15%'
        },
        {
          priority: 'low',
          action: 'Consider adding product video',
          impact: 'Listings with videos get 2x more sales'
        }
      ]
    };

    // Mock competitor data (will be from marketplace API later)
    const competitors = [
      { title: 'Similar Premium Product | Fast Ship', price: price * 1.2, sales: 450, ranking: 2 },
      { title: 'Handmade Quality Item | Gift Ready', price: price * 1.3, sales: 320, ranking: 5 },
      { title: 'Top Rated Customer | Premium Gift', price: price * 1.15, sales: 580, ranking: 1 },
      { title: 'Artisan Made | Custom Orders', price: price * 1.4, sales: 210, ranking: 8 },
      { title: 'Best Customer | Fast Shipping', price: price * 1.25, sales: 390, ranking: 3 }
    ];

    // Calculate score (0-100)
    const score = Math.floor(Math.random() * 20) + 70; // 70-90 range for now

    // Create analysis record
    const analysis = new Analysis({
      userId: req.userId,
      originalListing: {
        title,
        description,
        tags: tags || [],
        price,
        category
      },
      recommendations: aiRecommendations,
      competitors,
      score,
      status: 'completed',
      processingTime: Date.now() - startTime
    });

    await analysis.save();

    // Update legacy analysis count (kept for backward compatibility)
    user.analysisCount += 1;
    await user.save();

    // Feature usage info from middleware
    const featureAccess = req.featureAccess || {};

    res.json({
      success: true,
      message: 'Analysis completed successfully',
      analysis: {
        id: analysis._id,
        score,
        recommendations: aiRecommendations,
        competitors,
        processingTime: analysis.processingTime,
        createdAt: analysis.createdAt
      },
      usage: {
        featureKey: featureAccess.featureKey || 'listing_audit',
        used: (featureAccess.used || 0) + 1,
        limit: featureAccess.limit,
        remaining: featureAccess.remaining !== null ? Math.max(0, (featureAccess.remaining || 0) - 1) : null,
        unlimited: featureAccess.unlimited || false,
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing listing'
    });
  }
};

module.exports = {
  analyzeListing,
};
