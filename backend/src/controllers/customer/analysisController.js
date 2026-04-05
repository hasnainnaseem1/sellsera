const { Analysis } = require('../../models/customer');
const { KeywordSearch } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const { safeSave } = require('../../utils/helpers/safeDbOps');
const log = require('../../utils/logger')('AnalysisCtrl');

// ========== SCORING FUNCTIONS ==========

function scoreTitleQuality(title, category) {
  let score = 0;
  const details = {};
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

  if (category && title.toLowerCase().includes(category.toLowerCase().split(/[\s\/&,>]+/)[0])) {
    score += 20;
    details.categoryKeyword = true;
  } else {
    details.categoryKeyword = false;
  }

  const firstPart = title.substring(0, 40);
  const wordCount = firstPart.split(/\s+/).filter(w => w.length > 3).length;
  if (wordCount >= 3) {
    score += 20;
    details.frontLoaded = true;
  } else {
    score += 5;
    details.frontLoaded = false;
  }

  details.charCount = len;
  return { score: Math.min(100, score), details };
}

function scoreTagsCompleteness(tags, title) {
  let score = 0;
  const details = {};
  const tagCount = tags.length;
  details.count = tagCount;
  score += Math.round((Math.min(tagCount, 13) / 13) * 50);

  const unique = new Set(tags.map(t => t.toLowerCase()));
  details.uniqueCount = unique.size;
  if (unique.size === tagCount) {
    score += 20;
    details.allUnique = true;
  } else {
    score += 5;
    details.allUnique = false;
  }

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
  const wordCount = description.split(/\s+/).filter(Boolean).length;
  details.wordCount = wordCount;

  if (wordCount >= 300) {
    score += 40;
  } else if (wordCount >= 150) {
    score += 25;
  } else {
    score += 10;
  }

  const descLower = description.toLowerCase();
  const tagMatches = tags.filter(t => descLower.includes(t.toLowerCase())).length;
  details.tagMatchCount = tagMatches;
  score += Math.min(30, Math.round((tagMatches / Math.max(tags.length, 1)) * 30));

  const hasStructure = /[\n\r]/.test(description) || /[•\-\*]/.test(description);
  details.hasStructure = hasStructure;
  score += hasStructure ? 30 : 5;

  return { score: Math.min(100, score), details };
}

function scoreImageQuality(imageCount) {
  const details = { imageCount };
  let score = 0;
  if (imageCount >= 10) score = 100;
  else if (imageCount >= 7) score = 75;
  else if (imageCount >= 5) score = 55;
  else if (imageCount >= 3) score = 35;
  else if (imageCount >= 1) score = 15;
  return { score, details };
}

function scorePriceCompetitiveness(price, competitorAvg) {
  const details = { price };
  if (!competitorAvg || competitorAvg <= 0) {
    details.note = 'No competitor data available';
    return { score: price > 0 ? 60 : 0, details };
  }

  details.competitorAvg = competitorAvg;
  const ratio = price / competitorAvg;

  let score;
  if (ratio >= 0.8 && ratio <= 1.2) {
    score = 90;
    details.position = 'Competitive';
  } else if (ratio >= 0.6 && ratio < 0.8) {
    score = 70;
    details.position = 'Below average — consider increasing';
  } else if (ratio > 1.2 && ratio <= 1.5) {
    score = 65;
    details.position = 'Above average — ensure quality justifies premium';
  } else if (ratio < 0.6) {
    score = 50;
    details.position = 'Significantly underpriced';
  } else {
    score = 40;
    details.position = 'Significantly overpriced';
  }

  return { score, details };
}

function scoreCategoryAccuracy(category, title, tags) {
  if (!category) return { score: 30, details: { note: 'No category provided' } };

  const catWords = category.toLowerCase().split(/[\s\/&,>]+/).filter(w => w.length > 2);
  const titleLower = title.toLowerCase();
  const tagText = tags.join(' ').toLowerCase();

  const matchedWords = catWords.filter(w => titleLower.includes(w) || tagText.includes(w));
  const matchRatio = matchedWords.length / Math.max(catWords.length, 1);

  return {
    score: Math.min(100, Math.max(30, Math.round(matchRatio * 100))),
    details: { categoryWords: catWords, matchedWords },
  };
}

function scoreShopAttributes(freeShipping, processingDays, returnsAccepted) {
  let score = 0;
  const details = {};

  if (freeShipping) { score += 30; details.freeShipping = true; }
  else { details.freeShipping = false; }

  if (processingDays && processingDays <= 3) { score += 30; details.fastProcessing = true; }
  else if (processingDays && processingDays <= 7) { score += 15; details.fastProcessing = false; }

  if (returnsAccepted) { score += 40; details.returnsAccepted = true; }
  else { details.returnsAccepted = false; }

  return { score: Math.min(100, score), details };
}

// ========== COMPETITOR FETCHING ==========

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

async function fetchCompetitors(title, category, price) {
  // Build search keywords from title (first 5 meaningful words)
  const keywords = title
    .replace(/[|,\-–—]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5)
    .join(' ');

  const cacheKey = `analysis:competitors:${hashKey(keywords + ':' + category)}`;
  let cached;
  try { cached = await redis.get(cacheKey); } catch (_) { /* ignore */ }

  if (cached) {
    log.info('Competitor data from cache');
    return cached;
  }

  try {
    const params = { keywords, limit: 12, sort_on: 'score' };
    const result = await etsyApi.publicRequest('GET', '/v3/application/listings/active', { params });

    if (!result.success || !result.data?.results?.length) {
      return [];
    }

    const competitors = result.data.results
      .filter(l => {
        const lPrice = parseFloat(l.price?.amount || l.price) / (l.price?.divisor || 100);
        return lPrice > 0;
      })
      .slice(0, 8)
      .map((l, idx) => {
        const lPrice = parseFloat(l.price?.amount || l.price) / (l.price?.divisor || 100);
        return {
          title: l.title || 'Untitled',
          price: Math.round(lPrice * 100) / 100,
          sales: l.num_favorers || 0,
          ranking: idx + 1,
        };
      });

    try { await redis.set(cacheKey, competitors, 3600); } catch (_) { /* ignore */ }
    return competitors;
  } catch (error) {
    log.warn('Competitor fetch failed:', error.message);
    return [];
  }
}

// ========== TAG CATEGORIZATION ==========

async function categorizeTags(tags, userId) {
  const tagResults = [];

  // Pull user's keyword research history for volume data
  let researchMap = new Map();
  try {
    const searches = await KeywordSearch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('results');

    for (const s of searches) {
      for (const kw of (s.results || [])) {
        const key = kw.keyword.toLowerCase();
        if (!researchMap.has(key)) {
          researchMap.set(key, {
            estimatedVolume: kw.estimatedVolume || 0,
            volumeTier: kw.volumeTier || 'low',
            competitionLevel: kw.competitionLevel || 'unknown',
          });
        }
      }
    }
  } catch (_) { /* ignore */ }

  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    const wordCount = tag.trim().split(/\s+/).length;
    const research = researchMap.get(tagLower);

    let category = 'analyzing';
    let reasoning = '';

    if (research) {
      if (research.volumeTier === 'very_high' || research.volumeTier === 'high') {
        category = 'high_volume';
        reasoning = `High search volume (${research.estimatedVolume.toLocaleString()} results), ${research.competitionLevel} competition`;
      } else if (wordCount >= 3) {
        category = 'long_tail';
        reasoning = `Long-tail phrase (${wordCount} words), ${research.volumeTier} volume, good for niche targeting`;
      } else {
        category = 'moderate';
        reasoning = `${research.volumeTier} volume (${research.estimatedVolume.toLocaleString()} results)`;
      }
    } else {
      if (wordCount >= 3) {
        category = 'long_tail';
        reasoning = 'Multi-word long-tail phrase — typically lower competition, higher conversion';
      } else if (wordCount === 2) {
        category = 'moderate';
        reasoning = 'Two-word phrase — moderate specificity';
      } else {
        category = 'high_volume';
        reasoning = 'Single-word tag — likely high volume but high competition';
      }
    }

    tagResults.push({ tag, reasoning, category });
  }

  return tagResults;
}

// ========== TITLE & DESCRIPTION SUGGESTIONS ==========

function generateTitleSuggestion(title, category, titleScore) {
  const len = title.length;
  const parts = [];

  if (len < 80) {
    const catWords = (category || '').split(/[\s\/&,>]+/).filter(w => w.length > 2);
    const titleLower = title.toLowerCase();
    const missingCatWords = catWords.filter(w => !titleLower.includes(w.toLowerCase()));
    if (missingCatWords.length > 0) {
      parts.push(`Consider adding category terms: "${missingCatWords.slice(0, 3).join('", "')}"`);
    }
    parts.push(`Your title is ${len} characters — aim for 80-140 characters for optimal Etsy SEO`);
  } else if (len > 140) {
    parts.push(`Your title is ${len} characters — consider trimming to under 140 to avoid truncation in search`);
  }

  if (!titleScore.details.frontLoaded) {
    parts.push('Front-load your most important keywords in the first 40 characters');
  }

  if (!titleScore.details.categoryKeyword) {
    parts.push('Include your main category keyword in the title for better search matching');
  }

  if (parts.length === 0) {
    return { optimized: title, reasoning: 'Your title is well-optimized — good length, front-loaded keywords, and category relevance.' };
  }

  return {
    optimized: title,
    reasoning: parts.join('. ') + '.',
  };
}

function generateDescriptionSuggestion(description, tags, descScore) {
  const parts = [];
  const wordCount = descScore.details.wordCount;

  if (wordCount < 150) {
    parts.push(`Your description is only ${wordCount} words — aim for 300+ words. Etsy indexes description text for search`);
  } else if (wordCount < 300) {
    parts.push(`Your description has ${wordCount} words — expanding to 300+ words can improve search ranking`);
  }

  if (!descScore.details.hasStructure) {
    parts.push('Add line breaks, bullet points, or sections to improve readability and conversion');
  }

  if (descScore.details.tagMatchCount < Math.ceil(tags.length / 2)) {
    parts.push(`Only ${descScore.details.tagMatchCount} of your ${tags.length} tags appear in your description — naturally weave more tag keywords into the text`);
  }

  if (parts.length === 0) {
    return {
      optimized: description,
      reasoning: 'Your description is well-structured with good length and keyword integration.',
    };
  }

  return {
    optimized: description,
    reasoning: parts.join('. ') + '.',
  };
}

// ========== ACTION ITEMS ==========

function generateActionItems(titleScore, tagsScore, descScore, imageScore, priceScore, categoryScore, shopAttrScore) {
  const items = [];

  if (titleScore.score < 70) {
    items.push({
      priority: 'high',
      action: titleScore.details.charCount < 80
        ? `Expand title from ${titleScore.details.charCount} to 80-140 characters with relevant keywords`
        : 'Optimize title with front-loaded keywords and category terms',
      impact: 'Expected 25-35% increase in search visibility',
    });
  }

  if (tagsScore.score < 70) {
    items.push({
      priority: 'high',
      action: `Fill all 13 tag slots (currently ${tagsScore.details.count}/13) with multi-word long-tail phrases`,
      impact: 'Tags are the #1 ranking factor on Etsy',
    });
  }

  if (descScore.score < 60) {
    items.push({
      priority: 'high',
      action: descScore.details.wordCount < 150
        ? `Expand description from ${descScore.details.wordCount} to 300+ words`
        : 'Add bullet points and naturally include tag keywords in description',
      impact: 'Better descriptions improve conversion rate by 20%',
    });
  }

  if (imageScore.score < 70) {
    items.push({
      priority: 'high',
      action: `Add more images (currently ${imageScore.details.imageCount}/10). Include lifestyle, detail, and scale shots`,
      impact: 'Listings with 10 images get 2x more views',
    });
  }

  if (priceScore.score < 70 && priceScore.details.competitorAvg) {
    const pos = priceScore.details.position;
    items.push({
      priority: 'medium',
      action: pos.includes('under') || pos.includes('Below')
        ? `Consider increasing price toward competitor average ($${priceScore.details.competitorAvg.toFixed(2)})`
        : `Review pricing — competitor average is $${priceScore.details.competitorAvg.toFixed(2)}`,
      impact: 'Competitive pricing improves both revenue and perceived value',
    });
  }

  if (categoryScore.score < 60) {
    items.push({
      priority: 'medium',
      action: 'Ensure your category matches your listing — add category keywords to title and tags',
      impact: 'Accurate categorization improves search placement',
    });
  }

  if (!shopAttrScore.details.freeShipping) {
    items.push({
      priority: 'medium',
      action: 'Enable free shipping — Etsy boosts listings with free shipping in search results',
      impact: 'Etsy prioritizes free shipping in rankings',
    });
  }

  if (!shopAttrScore.details.returnsAccepted) {
    items.push({
      priority: 'low',
      action: 'Accept returns to build buyer confidence and improve conversion',
      impact: 'Reduces purchase anxiety, increases conversions',
    });
  }

  if (items.length === 0) {
    items.push({
      priority: 'low',
      action: 'Your listing is well-optimized — keep monitoring competitor pricing and trends',
      impact: 'Maintaining rankings requires periodic review',
    });
  }

  return items;
}

// ========== MAIN HANDLER ==========

/**
 * POST /api/v1/customer/analysis
 * Analyze a listing with real weighted scoring + live Etsy competitor data
 */
const analyzeListing = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      title, description, tags, price, category,
      imageCount, freeShipping, processingDays, returnsAccepted,
    } = req.body;

    // Validation
    if (!title || !description || !price || !category || typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, price, category',
      });
    }

    const listingTags = (tags || []).map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean);
    const listingPrice = parseFloat(price) || 0;
    const images = parseInt(imageCount) || 0;

    // --- Fetch live competitors from Etsy API ---
    const competitors = await fetchCompetitors(title, category, listingPrice);

    // --- Compute competitor price stats ---
    let competitorAvg = 0;
    let competitorMin = 0;
    let competitorMax = 0;
    if (competitors.length > 0) {
      const prices = competitors.map(c => c.price).filter(p => p > 0);
      if (prices.length > 0) {
        competitorMin = Math.min(...prices);
        competitorMax = Math.max(...prices);
        competitorAvg = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
      }
    }

    // --- Score each factor ---
    const titleResult   = scoreTitleQuality(title, category);
    const tagsResult    = scoreTagsCompleteness(listingTags, title);
    const descResult    = scoreDescriptionSeo(description, listingTags);
    const imageResult   = scoreImageQuality(images);
    const priceResult   = scorePriceCompetitiveness(listingPrice, competitorAvg);
    const catResult     = scoreCategoryAccuracy(category, title, listingTags);
    const shopAttrResult = scoreShopAttributes(!!freeShipping, processingDays || null, !!returnsAccepted);

    // --- Weighted total (Title 20, Tags 20, Desc 20, Images 15, Price 15, Category 10, Shop 0 if no data) ---
    const hasShopData = freeShipping !== undefined || processingDays !== undefined || returnsAccepted !== undefined;
    const weights = {
      title: 0.20, tags: 0.20, desc: 0.20, images: 0.15,
      price: 0.15, category: 0.10, shopAttr: hasShopData ? 0.00 : 0.00,
    };

    // When shop attributes are provided, redistribute: Title 18, Tags 18, Desc 17, Images 13, Price 13, Category 9, Shop 12
    if (hasShopData) {
      weights.title = 0.18; weights.tags = 0.18; weights.desc = 0.17;
      weights.images = 0.13; weights.price = 0.13; weights.category = 0.09;
      weights.shopAttr = 0.12;
    }

    const totalScore = Math.round(
      titleResult.score   * weights.title +
      tagsResult.score    * weights.tags +
      descResult.score    * weights.desc +
      imageResult.score   * weights.images +
      priceResult.score   * weights.price +
      catResult.score     * weights.category +
      shopAttrResult.score * weights.shopAttr
    );

    // --- Categorize tags ---
    const categorizedTags = await categorizeTags(listingTags, req.userId);

    // --- Generate rule-based suggestions ---
    const titleSuggestion = generateTitleSuggestion(title, category, titleResult);
    const descSuggestion  = generateDescriptionSuggestion(description, listingTags, descResult);
    const actionItems     = generateActionItems(titleResult, tagsResult, descResult, imageResult, priceResult, catResult, shopAttrResult);

    // --- Pricing recommendation ---
    let pricingReasoning;
    if (competitorAvg > 0) {
      const ratio = listingPrice / competitorAvg;
      if (ratio < 0.8) {
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is ${Math.round((1 - ratio) * 100)}% below the competitor average of $${competitorAvg.toFixed(2)}. Consider increasing to capture more revenue.`;
      } else if (ratio > 1.2) {
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is ${Math.round((ratio - 1) * 100)}% above the competitor average of $${competitorAvg.toFixed(2)}. Ensure your quality and branding justify the premium.`;
      } else {
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is competitive — within range of the competitor average ($${competitorAvg.toFixed(2)}).`;
      }
    } else {
      pricingReasoning = 'Competitor pricing data unavailable. Your price was scored neutrally.';
    }

    const recommendations = {
      optimizedTitle: titleSuggestion.optimized,
      titleReasoning: titleSuggestion.reasoning,
      optimizedDescription: descSuggestion.optimized,
      descriptionReasoning: descSuggestion.reasoning,
      optimizedTags: categorizedTags,
      pricingRecommendation: {
        suggestedPrice: competitorAvg > 0 ? Math.round(competitorAvg * 100) / 100 : listingPrice,
        reasoning: pricingReasoning,
        competitorRange: {
          min: competitorMin,
          max: competitorMax,
          average: competitorAvg,
        },
      },
      actionItems,
    };

    // --- Build breakdown ---
    const breakdown = {
      titleQuality:         { score: titleResult.score,    weight: Math.round(weights.title * 100),    details: titleResult.details },
      tagsCompleteness:     { score: tagsResult.score,     weight: Math.round(weights.tags * 100),     details: tagsResult.details },
      descriptionSeo:       { score: descResult.score,     weight: Math.round(weights.desc * 100),     details: descResult.details },
      imageQuality:         { score: imageResult.score,    weight: Math.round(weights.images * 100),   details: imageResult.details },
      priceCompetitiveness: { score: priceResult.score,    weight: Math.round(weights.price * 100),    details: priceResult.details },
      categoryAccuracy:     { score: catResult.score,      weight: Math.round(weights.category * 100), details: catResult.details },
      shopAttributes:       { score: shopAttrResult.score, weight: Math.round(weights.shopAttr * 100), details: shopAttrResult.details },
    };

    // --- Create analysis record ---
    const analysis = new Analysis({
      userId: req.userId,
      originalListing: {
        title, description, tags: listingTags, price: listingPrice,
        category, imageCount: images,
        freeShipping: !!freeShipping,
        processingDays: processingDays || null,
        returnsAccepted: !!returnsAccepted,
      },
      recommendations,
      breakdown,
      competitors,
      score: totalScore,
      status: 'completed',
      processingTime: Date.now() - startTime,
    });

    await safeSave(analysis);

    log.info(`Analysis completed: score=${totalScore}, competitors=${competitors.length}, time=${Date.now() - startTime}ms`);

    // Feature usage info from middleware
    const featureAccess = req.featureAccess || {};

    res.json({
      success: true,
      message: 'Analysis completed successfully',
      analysis: {
        id: analysis._id,
        score: totalScore,
        breakdown,
        recommendations,
        competitors,
        processingTime: analysis.processingTime,
        createdAt: analysis.createdAt,
      },
      usage: {
        featureKey: featureAccess.featureKey || 'listing_audit',
        used: (featureAccess.used || 0) + 1,
        limit: featureAccess.limit,
        remaining: featureAccess.remaining !== null ? Math.max(0, (featureAccess.remaining || 0) - 1) : null,
        unlimited: featureAccess.unlimited || false,
      },
    });

  } catch (error) {
    log.error('Analysis error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Error analyzing listing',
    });
  }
};

module.exports = {
  analyzeListing,
};
