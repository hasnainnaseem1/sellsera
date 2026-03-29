/**
 * Listing Audit Controller
 * 
 * POST /api/v1/customer/listing-audit      → Audit a listing (compute health score)
 * GET  /api/v1/customer/listing-audit/history → Get audit history
 * 
 * Feature key: listing_audit
 * Weighted score calculation (0-100):
 *   Title Quality: 20%, Tags: 20%, Description SEO: 15%, Images: 15%,
 *   Price: 10%, Category: 10%, Shop Attributes: 10%
 */

const { ListingAudit } = require('../../models/customer');
const { KeywordSearch } = require('../../models/customer');
const { EtsyListing } = require('../../models/integrations');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('ListingAudit');

/**
 * POST /api/v1/customer/listing-audit
 * Compute a health score for a listing.
 */
const auditListing = async (req, res) => {
  try {
    const {
      etsyListingId,
      title,
      description,
      tags,
      price,
      category,
      imageCount,
      processingDays,
      returnsAccepted,
      freeShipping,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      });
    }

    const listingTags = tags || [];
    const listingPrice = parseFloat(price) || 0;
    const images = parseInt(imageCount) || 0;

    // --- Score each factor ---
    const titleScore = scoreTitleQuality(title, category);
    const tagsScore = scoreTagsCompleteness(listingTags, title);
    const descScore = scoreDescriptionSeo(description, listingTags);
    const imageScore = scoreImageQuality(images);
    const priceScore = scorePriceCompetitiveness(listingPrice);
    const categoryScore = scoreCategoryAccuracy(category, title, listingTags);
    const shopAttrScore = scoreShopAttributes(freeShipping, processingDays, returnsAccepted);

    // --- Weighted total ---
    const totalScore = Math.round(
      titleScore.score * 0.20 +
      tagsScore.score * 0.20 +
      descScore.score * 0.15 +
      imageScore.score * 0.15 +
      priceScore.score * 0.10 +
      categoryScore.score * 0.10 +
      shopAttrScore.score * 0.10
    );

    // --- Generate recommendations ---
    const recommendations = generateRecommendations(
      titleScore, tagsScore, descScore, imageScore,
      priceScore, categoryScore, shopAttrScore
    );

    // --- Save audit ---
    const audit = await ListingAudit.create({
      userId: req.userId,
      etsyListingId: etsyListingId || null,
      listingSnapshot: {
        title, description, tags: listingTags, price: listingPrice,
        category: category || '', imageCount: images,
        processingDays: processingDays || null,
        returnsAccepted: !!returnsAccepted, freeShipping: !!freeShipping,
      },
      score: totalScore,
      breakdown: {
        titleQuality: { score: titleScore.score, weight: 20, details: titleScore.details },
        tagsCompleteness: { score: tagsScore.score, weight: 20, details: tagsScore.details },
        descriptionSeo: { score: descScore.score, weight: 15, details: descScore.details },
        imageQuality: { score: imageScore.score, weight: 15, details: imageScore.details },
        priceCompetitiveness: { score: priceScore.score, weight: 10, details: priceScore.details },
        categoryAccuracy: { score: categoryScore.score, weight: 10, details: categoryScore.details },
        shopAttributes: { score: shopAttrScore.score, weight: 10, details: shopAttrScore.details },
      },
      recommendations,
    });

    return res.json({
      success: true,
      data: {
        auditId: audit._id,
        score: totalScore,
        breakdown: audit.breakdown,
        recommendations,
      },
    });
  } catch (error) {
    log.error('Listing audit error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to audit listing',
    });
  }
};

/**
 * GET /api/v1/customer/listing-audit/history
 */
const getAuditHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [audits, total] = await Promise.all([
      ListingAudit.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('score listingSnapshot.title etsyListingId recommendations createdAt'),
      ListingAudit.countDocuments({ userId: req.userId }),
    ]);

    return res.json({
      success: true,
      data: {
        audits,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    log.error('Audit history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit history',
    });
  }
};

// ========== SCORING FUNCTIONS ==========

function scoreTitleQuality(title, category) {
  let score = 0;
  const details = {};

  // Length: 80-140 chars ideal
  const len = title.length;
  if (len >= 80 && len <= 140) {
    score += 60;
    details.length = 'Optimal length';
  } else if (len >= 50 && len < 80) {
    score += 40;
    details.length = 'Could be longer for better SEO';
  } else if (len > 140) {
    score += 30;
    details.length = 'Too long — may be truncated in search';
  } else {
    score += 15;
    details.length = 'Too short — add more keywords';
  }

  // Contains category keyword
  if (category && title.toLowerCase().includes(category.toLowerCase())) {
    score += 20;
    details.categoryKeyword = true;
  } else {
    details.categoryKeyword = false;
  }

  // Front-loaded keywords (first 40 chars have meaningful words)
  const firstPart = title.substring(0, 40);
  const wordCount = firstPart.split(/\s+/).filter(w => w.length > 3).length;
  if (wordCount >= 3) {
    score += 20;
    details.frontLoaded = true;
  } else {
    score += 5;
    details.frontLoaded = false;
  }

  return { score: Math.min(100, score), details };
}

function scoreTagsCompleteness(tags, title) {
  let score = 0;
  const details = {};

  // Count: 13/13 = full marks
  const tagCount = tags.length;
  details.count = tagCount;
  score += Math.round((Math.min(tagCount, 13) / 13) * 50);

  // Unique tags
  const unique = new Set(tags.map(t => t.toLowerCase()));
  details.uniqueCount = unique.size;
  if (unique.size === tagCount) {
    score += 20;
    details.allUnique = true;
  } else {
    score += 5;
    details.allUnique = false;
  }

  // Multi-word long-tail tags
  const multiWord = tags.filter(t => t.trim().split(/\s+/).length >= 2).length;
  details.multiWordCount = multiWord;
  if (multiWord >= 8) {
    score += 30;
  } else if (multiWord >= 5) {
    score += 20;
  } else {
    score += 5;
  }

  return { score: Math.min(100, score), details };
}

function scoreDescriptionSeo(description, tags) {
  let score = 0;
  const details = {};

  // Word count: >=300 = full
  const wordCount = description.split(/\s+/).filter(Boolean).length;
  details.wordCount = wordCount;
  if (wordCount >= 300) {
    score += 40;
  } else if (wordCount >= 150) {
    score += 25;
  } else {
    score += 10;
  }

  // Contains keywords from tags
  const descLower = description.toLowerCase();
  const tagMatches = tags.filter(t => descLower.includes(t.toLowerCase())).length;
  details.tagMatchCount = tagMatches;
  score += Math.min(30, Math.round((tagMatches / Math.max(tags.length, 1)) * 30));

  // Has structure (line breaks, bullets)
  const hasStructure = /[\n\r]/.test(description) || /[•\-\*]/.test(description);
  details.hasStructure = hasStructure;
  score += hasStructure ? 30 : 5;

  return { score: Math.min(100, score), details };
}

function scoreImageQuality(imageCount) {
  let score = 0;
  const details = { imageCount };

  if (imageCount >= 10) {
    score = 100;
  } else if (imageCount >= 7) {
    score = 75;
  } else if (imageCount >= 5) {
    score = 55;
  } else if (imageCount >= 3) {
    score = 35;
  } else if (imageCount >= 1) {
    score = 15;
  }

  return { score, details };
}

function scorePriceCompetitiveness(price) {
  // Without actual competitor data, give a neutral score
  // Real implementation would compare to category median via SERP
  const details = { price, note: 'Competitor comparison available with connected shop' };
  const score = price > 0 ? 60 : 0;
  return { score, details };
}

function scoreCategoryAccuracy(category, title, tags) {
  let score = 0;
  const details = {};

  if (!category) {
    return { score: 30, details: { note: 'No category provided' } };
  }

  // Heuristic: check if category words appear in title/tags
  const catWords = category.toLowerCase().split(/[\s\/&,]+/).filter(w => w.length > 2);
  const titleLower = title.toLowerCase();
  const tagText = tags.join(' ').toLowerCase();

  const matchedWords = catWords.filter(w => titleLower.includes(w) || tagText.includes(w));
  const matchRatio = matchedWords.length / Math.max(catWords.length, 1);

  details.categoryWords = catWords;
  details.matchedWords = matchedWords;
  score = Math.round(matchRatio * 100);

  return { score: Math.min(100, Math.max(30, score)), details };
}

function scoreShopAttributes(freeShipping, processingDays, returnsAccepted) {
  let score = 0;
  const details = {};

  if (freeShipping) {
    score += 30;
    details.freeShipping = true;
  } else {
    details.freeShipping = false;
  }

  if (processingDays && processingDays <= 3) {
    score += 30;
    details.fastProcessing = true;
  } else if (processingDays && processingDays <= 7) {
    score += 15;
    details.fastProcessing = false;
  }

  if (returnsAccepted) {
    score += 40;
    details.returnsAccepted = true;
  } else {
    details.returnsAccepted = false;
  }

  return { score: Math.min(100, score), details };
}

function generateRecommendations(title, tags, desc, image, price, category, shopAttr) {
  const recs = [];

  if (title.score < 70) {
    recs.push({
      priority: 'high',
      factor: 'Title Quality',
      message: 'Optimize your title — aim for 80-140 characters with front-loaded keywords and category terms.',
      impact: 'Expected 25-35% increase in search visibility',
    });
  }

  if (tags.score < 70) {
    recs.push({
      priority: 'high',
      factor: 'Tags',
      message: `Use all 13 tags with multi-word long-tail phrases. Currently using ${tags.details.count}/13.`,
      impact: 'Tags are the #1 ranking factor on Etsy',
    });
  }

  if (desc.score < 60) {
    recs.push({
      priority: 'medium',
      factor: 'Description',
      message: 'Expand description to 300+ words with bullet points and keywords from your tags.',
      impact: 'Better descriptions improve conversion rate by 20%',
    });
  }

  if (image.score < 70) {
    recs.push({
      priority: 'high',
      factor: 'Images',
      message: `Add more images (currently ${image.details.imageCount}/10). Include lifestyle, detail, and scale shots.`,
      impact: 'Listings with 10 images get 2x more views',
    });
  }

  if (!shopAttr.details.freeShipping) {
    recs.push({
      priority: 'medium',
      factor: 'Shipping',
      message: 'Enable free shipping — Etsy boosts listings with free shipping in search results.',
      impact: 'Etsy prioritizes free shipping in rankings',
    });
  }

  if (!shopAttr.details.returnsAccepted) {
    recs.push({
      priority: 'low',
      factor: 'Returns Policy',
      message: 'Accept returns to build buyer confidence and improve conversion.',
      impact: 'Reduces purchase anxiety, increases conversions',
    });
  }

  return recs;
}

/**
 * POST /api/v1/customer/listing-audit/keyword-insights
 * Cross-app integration: fetch keyword insights for a listing's tags and title.
 * Pulls data from existing keyword research history + live Etsy search data.
 * Does NOT count as a keyword_search usage — it's part of the audit flow.
 */
const getKeywordInsights = async (req, res) => {
  try {
    const { title, tags, category } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Listing title is required',
      });
    }

    const listingTags = (tags || []).map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);

    // 1. Check user's existing keyword research for relevant data
    const existingResearch = await KeywordSearch.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('seedKeyword results createdAt');

    const researchKeywords = new Map();
    for (const search of existingResearch) {
      for (const kw of (search.results || [])) {
        const kwLower = kw.keyword.toLowerCase();
        if (!researchKeywords.has(kwLower)) {
          researchKeywords.set(kwLower, {
            keyword: kw.keyword,
            estimatedVolume: kw.estimatedVolume || 0,
            competitionLevel: kw.competitionLevel || 'unknown',
            demandScore: kw.demandScore || kw.opportunityScore || 0,
            source: 'research_history',
          });
        }
      }
    }

    // 2. Cross-reference current tags with research data
    const tagInsights = [];
    const missingInsights = [];

    for (const tag of listingTags) {
      const tagLower = tag.toLowerCase();
      const fromResearch = researchKeywords.get(tagLower);

      if (fromResearch) {
        tagInsights.push({
          tag,
          hasResearchData: true,
          ...fromResearch,
        });
      } else {
        // Quick check: get competition data from cache or a lightweight API call
        const cacheKey = `kw:insight:${hashKeyInsight(tagLower)}`;
        let cached = await redis.get(cacheKey);

        if (!cached) {
          const searchResult = await etsyApi.publicRequest(
            'GET',
            '/v3/application/listings/active',
            { params: { keywords: tag, limit: 5 } }
          );

          if (searchResult.success) {
            const totalResults = searchResult.data.count || 0;
            cached = {
              estimatedVolume: totalResults,
              competitionLevel: totalResults > 100000 ? 'high' : totalResults > 10000 ? 'medium' : 'low',
            };
            await redis.set(cacheKey, cached, 21600);
          }
        }

        tagInsights.push({
          tag,
          hasResearchData: false,
          estimatedVolume: cached?.estimatedVolume || 0,
          competitionLevel: cached?.competitionLevel || 'unknown',
          demandScore: null,
          source: 'live_lookup',
        });
      }
    }

    // 3. Find high-value keywords from research that are NOT in current tags
    const currentTagSet = new Set(listingTags.map(t => t.toLowerCase()));
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    for (const [kwLower, kwData] of researchKeywords) {
      if (currentTagSet.has(kwLower)) continue;

      // Only suggest keywords relevant to this listing
      const kwWords = kwLower.split(/\s+/);
      const isRelevant = kwWords.some(w => titleWords.includes(w));
      if (!isRelevant && (kwData.demandScore || 0) < 60) continue;

      missingInsights.push({
        keyword: kwData.keyword,
        estimatedVolume: kwData.estimatedVolume,
        competitionLevel: kwData.competitionLevel,
        demandScore: kwData.demandScore,
        reason: isRelevant ? 'Relevant to your title — high potential tag' : 'High-demand keyword from your research',
      });
    }

    missingInsights.sort((a, b) => (b.demandScore || 0) - (a.demandScore || 0));

    return res.json({
      success: true,
      data: {
        tagInsights,
        suggestedKeywords: missingInsights.slice(0, 10),
        researchCoverage: {
          tagsWithData: tagInsights.filter(t => t.hasResearchData).length,
          totalTags: tagInsights.length,
          recommendation: tagInsights.filter(t => t.hasResearchData).length < listingTags.length / 2
            ? 'Run a keyword search for your listing\'s niche to unlock better insights'
            : null,
        },
      },
    });
  } catch (error) {
    log.error('Keyword insights error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch keyword insights',
    });
  }
};

function hashKeyInsight(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

module.exports = { auditListing, getAuditHistory, getKeywordInsights };
