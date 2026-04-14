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

/**
 * Robust Etsy price parser.
 * Handles: Money object {amount, divisor}, raw number (dollars), string.
 */
function parseEtsyPrice(priceField) {
  if (!priceField) return 0;
  // Money object: { amount: 1399, divisor: 100 } → $13.99
  if (typeof priceField === 'object' && priceField.amount != null) {
    const divisor = priceField.divisor || 100;
    return parseFloat(priceField.amount) / divisor;
  }
  // Already a number (raw dollars from some API formats)
  const num = parseFloat(priceField);
  return isNaN(num) ? 0 : num;
}

/**
 * Remove price outliers using IQR method.
 * Returns prices within 1.5× IQR of Q1–Q3 range.
 */
function removeOutliers(prices) {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return prices.filter(p => p >= lowerBound && p <= upperBound);
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
    const params = { keywords, limit: 12, sort_on: 'score', includes: 'Images' };
    const result = await etsyApi.publicRequest('GET', '/v3/application/listings/active', { params });

    if (!result.success || !result.data?.results?.length) {
      return [];
    }

    const competitors = result.data.results
      .map((l) => {
        const lPrice = parseEtsyPrice(l.price);
        return { raw: l, price: lPrice };
      })
      .filter(item => item.price > 0)
      .slice(0, 10); // take more initially for outlier filtering

    // Remove price outliers before ranking
    const validPrices = removeOutliers(competitors.map(c => c.price));
    const maxValidPrice = validPrices.length > 0 ? Math.max(...validPrices) * 2 : Infinity;

    const cleaned = competitors
      .filter(c => c.price <= maxValidPrice)
      .slice(0, 8)
      .map((item, idx) => ({
        listing_id: item.raw.listing_id || null,
        title: item.raw.title || 'Untitled',
        price: Math.round(item.price * 100) / 100,
        sales: item.raw.num_favorers || 0,
        ranking: idx + 1,
        tags: item.raw.tags || [],
        description: item.raw.description || '',
      }));

    try { await redis.set(cacheKey, cleaned, 3600); } catch (_) { /* ignore */ }
    return cleaned;
  } catch (error) {
    log.warn('Competitor fetch failed:', error.message);
    return [];
  }
}

// ========== COMPETITOR ANALYSIS HELPERS ==========

/**
 * Extract high-frequency keywords from top competitor titles.
 * Returns words that appear in >= threshold% of competitor titles.
 */
function extractCompetitorTitleKeywords(competitors, threshold = 0.6) {
  if (!competitors.length) return [];

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'has',
    'have', 'had', 'not', 'but', 'all', 'can', 'her', 'his', 'our', 'your',
    'will', 'one', 'two', 'new', 'now', 'you', 'get', 'set', 'per', 'use',
  ]);

  const wordCounts = new Map();
  const total = competitors.length;

  for (const c of competitors) {
    const words = new Set(
      c.title.toLowerCase()
        .replace(/[|,\-–—()[\]{}]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    );
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .filter(([, count]) => count / total >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, frequency: Math.round((count / total) * 100) }));
}

/**
 * Find tags used by competitors that the user is missing.
 */
function findMissingCompetitorTags(userTags, competitors) {
  if (!competitors.length) return [];

  const userTagSet = new Set(userTags.map(t => t.toLowerCase()));
  const tagCounts = new Map();
  const total = competitors.length;

  for (const c of competitors) {
    const seen = new Set();
    for (const tag of (c.tags || [])) {
      const tLower = tag.toLowerCase();
      if (!seen.has(tLower)) {
        seen.add(tLower);
        tagCounts.set(tLower, (tagCounts.get(tLower) || { tag, count: 0 }));
        tagCounts.get(tLower).count += 1;
      }
    }
  }

  return Array.from(tagCounts.values())
    .filter(t => !userTagSet.has(t.tag.toLowerCase()) && t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(t => ({
      tag: t.tag,
      usedByCount: t.count,
      usedByPercent: Math.round((t.count / total) * 100),
    }));
}

/**
 * Analyze competitor description patterns.
 */
function analyzeCompetitorDescriptions(competitors) {
  if (!competitors.length) return { avgWordCount: 0, withBullets: 0, withSections: 0, total: 0 };

  let totalWords = 0;
  let withBullets = 0;
  let withSections = 0;

  for (const c of competitors) {
    const desc = c.description || '';
    totalWords += desc.split(/\s+/).filter(Boolean).length;
    if (/[•\-\*]/.test(desc)) withBullets++;
    if (/[\n\r]/.test(desc) && desc.split(/[\n\r]+/).filter(Boolean).length >= 3) withSections++;
  }

  return {
    avgWordCount: Math.round(totalWords / competitors.length),
    withBullets,
    withSections,
    total: competitors.length,
  };
}

// ========== TAG CATEGORIZATION ==========

/**
 * Look up estimated volume for a single tag via Etsy API.
 * Checks Redis cache first (6h TTL), then does live lookup.
 */
async function lookupTagVolume(tag) {
  const cacheKey = `kw:insight:${hashKey(tag.toLowerCase())}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch (_) { /* ignore */ }

  try {
    const result = await etsyApi.publicRequest('GET', '/v3/application/listings/active', {
      params: { keywords: tag, limit: 5 },
    });
    if (result.success) {
      const totalResults = result.data?.count || 0;
      const data = {
        estimatedVolume: totalResults,
        competitionLevel: totalResults > 100000 ? 'high' : totalResults > 10000 ? 'medium' : 'low',
        volumeTier: totalResults > 100000 ? 'very_high' : totalResults > 50000 ? 'high' : totalResults > 10000 ? 'medium' : 'low',
      };
      try { await redis.set(cacheKey, data, 21600); } catch (_) { /* ignore */ }
      return data;
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function categorizeTags(tags, userId, missingCompetitorTags = []) {
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

  // Live-lookup tags that have no research data or 0 volume (parallel, max 13 tags)
  const tagsNeedingLookup = tags.filter(tag => {
    const research = researchMap.get(tag.toLowerCase());
    return !research || research.estimatedVolume === 0;
  });

  if (tagsNeedingLookup.length > 0) {
    const lookupResults = await Promise.allSettled(
      tagsNeedingLookup.map(tag => lookupTagVolume(tag))
    );

    for (let i = 0; i < tagsNeedingLookup.length; i++) {
      const result = lookupResults[i];
      if (result.status === 'fulfilled' && result.value) {
        const key = tagsNeedingLookup[i].toLowerCase();
        // Only overwrite if live data has actual volume or no research existed
        const existing = researchMap.get(key);
        if (!existing || existing.estimatedVolume === 0) {
          researchMap.set(key, result.value);
        }
      }
    }
  }

  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    const wordCount = tag.trim().split(/\s+/).length;
    const research = researchMap.get(tagLower);

    let category = 'analyzing';
    let reasoning = '';

    if (research && research.estimatedVolume > 0) {
      if (research.volumeTier === 'very_high' || research.volumeTier === 'high') {
        category = 'high_volume';
        reasoning = `High search volume (${research.estimatedVolume.toLocaleString()} results), ${research.competitionLevel} competition`;
      } else if (wordCount >= 3) {
        category = 'long_tail';
        reasoning = `Long-tail phrase (${wordCount} words), ${research.estimatedVolume.toLocaleString()} results, good for niche targeting`;
      } else if (research.volumeTier === 'medium') {
        category = 'moderate';
        reasoning = `${research.estimatedVolume.toLocaleString()} results, ${research.competitionLevel} competition`;
      } else {
        // Low volume — suggest swap if applicable
        const swap = missingCompetitorTags.find(mt => !tags.some(t => t.toLowerCase() === mt.tag.toLowerCase()));
        if (swap && wordCount === 1) {
          category = 'moderate';
          reasoning = `${research.estimatedVolume.toLocaleString()} results — consider replacing with "${swap.tag}" (used by ${swap.usedByPercent}% of top competitors)`;
        } else {
          category = wordCount >= 2 ? 'moderate' : 'high_volume';
          reasoning = `${research.estimatedVolume.toLocaleString()} results, ${research.competitionLevel} competition`;
        }
      }
    } else {
      // No volume data available even after live lookup
      if (wordCount >= 3) {
        category = 'long_tail';
        reasoning = 'Multi-word long-tail phrase — typically lower competition, higher conversion';
      } else if (wordCount === 2) {
        category = 'moderate';
        reasoning = 'Two-word phrase — moderate specificity';
      } else {
        const swap = missingCompetitorTags.find(mt => !tags.some(t => t.toLowerCase() === mt.tag.toLowerCase()));
        if (swap) {
          category = 'high_volume';
          reasoning = `Single-word tag — high competition. Consider replacing with "${swap.tag}" (used by ${swap.usedByPercent}% of top competitors)`;
        } else {
          category = 'high_volume';
          reasoning = 'Single-word tag — likely high volume but high competition';
        }
      }
    }

    tagResults.push({ tag, reasoning, category });
  }

  return tagResults;
}

// ========== TITLE & DESCRIPTION SUGGESTIONS (COMPETITOR-DRIVEN) ==========

function generateTitleSuggestion(title, category, titleScore, competitors) {
  const len = title.length;
  const titleLower = title.toLowerCase();

  // Extract high-frequency keywords from competitor titles
  const compKeywords = extractCompetitorTitleKeywords(competitors, 0.6);
  const missingKeywords = compKeywords.filter(k => !titleLower.includes(k.word));

  const parts = [];

  // Suggest missing high-frequency competitor keywords
  if (missingKeywords.length > 0) {
    const top = missingKeywords.slice(0, 3);
    const kwList = top.map(k => `"${k.word}" (in ${k.frequency}% of top listings)`).join(', ');
    parts.push(`Top-ranking competitors commonly use: ${kwList}. Consider adding these to your title`);
  }

  if (len < 80) {
    if (missingKeywords.length > 0) {
      const suggestions = missingKeywords.slice(0, 4).map(k => k.word).join(', ');
      parts.push(`Your title is ${len} characters (aim for 80-140). Fill the space with competitor keywords: ${suggestions}`);
    } else {
      parts.push(`Your title is ${len} characters — aim for 80-140 characters for optimal Etsy SEO`);
    }
  } else if (len > 140) {
    parts.push(`Your title is ${len} characters — consider trimming to under 140 to avoid truncation in search`);
  }

  if (!titleScore.details.frontLoaded) {
    parts.push('Front-load your most important keywords in the first 40 characters');
  }

  if (!titleScore.details.categoryKeyword) {
    parts.push('Include your main category keyword in the title for better search matching');
  }

  // ── Build an intelligently optimized title ──
  let optimized = title;

  if (competitors.length > 0) {
    // Analyze the top-performing competitor titles for structural patterns
    const topTitles = competitors.slice(0, 5).map(c => c.title);

    // Parse the original title into semantic segments (split on common separators)
    const segments = title
      .split(/\s*[|–—,]\s*/)
      .map(s => s.trim())
      .filter(Boolean);

    // Identify the primary product descriptor (usually the longest/first segment)
    const primarySegment = segments[0] || title;

    // Extract the category-relevant core from competitor titles
    // Find multi-word phrases from competitors (2-3 word combos) not in our title
    const competitorPhrases = extractCompetitorPhrases(topTitles, titleLower);

    // Gather additional useful descriptors from competitors
    const descriptorPatterns = extractDescriptorPatterns(topTitles);

    // Build the optimized title by weaving in missing elements naturally
    const optimizedParts = [primarySegment];

    // Add remaining user segments that aren't redundant
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].length > 2) optimizedParts.push(segments[i]);
    }

    // Weave in the most relevant competitor phrases (not just single words)
    const addedWords = new Set(titleLower.split(/\s+/));
    let currentLen = optimizedParts.join(' – ').length;

    for (const phrase of competitorPhrases) {
      if (currentLen >= 130) break;
      // Skip if most words in this phrase are already in the title
      const phraseWords = phrase.toLowerCase().split(/\s+/);
      const newWords = phraseWords.filter(w => !addedWords.has(w) && w.length > 2);
      if (newWords.length === 0) continue;

      optimizedParts.push(phrase);
      phraseWords.forEach(w => addedWords.add(w));
      currentLen = optimizedParts.join(' – ').length;
    }

    // If still short, add high-value single descriptors from competitors
    if (currentLen < 80 && missingKeywords.length > 0) {
      // Filter out generic filler words that don't add search value
      const fillerWords = new Set(['file', 'item', 'product', 'listing', 'lot', 'pcs', 'piece']);
      const valuableKeywords = missingKeywords.filter(k => !fillerWords.has(k.word));
      // Fall back to original list if all were filtered
      const kwPool = valuableKeywords.length > 0 ? valuableKeywords : missingKeywords;

      for (const kw of kwPool) {
        if (currentLen >= 130) break;
        if (addedWords.has(kw.word)) continue;

        // Try to find a natural descriptor pattern for this keyword
        const pattern = descriptorPatterns.find(p =>
          p.toLowerCase().includes(kw.word) && !titleLower.includes(p.toLowerCase())
        );
        if (pattern && currentLen + pattern.length + 3 <= 140) {
          optimizedParts.push(pattern);
          pattern.toLowerCase().split(/\s+/).forEach(w => addedWords.add(w));
        } else {
          optimizedParts.push(capitalize(kw.word));
          addedWords.add(kw.word);
        }
        currentLen = optimizedParts.join(' – ').length;
      }
    }

    // Join with a natural separator that matches Etsy conventions
    // Analyze what separator the top competitors use most
    const sepCounts = { comma: 0, pipe: 0, dash: 0, ndash: 0 };
    for (const t of topTitles) {
      if (t.includes(',')) sepCounts.comma++;
      if (t.includes('|')) sepCounts.pipe++;
      if (t.includes(' - ')) sepCounts.dash++;
      if (/[–—]/.test(t)) sepCounts.ndash++;
    }

    let sep = ', ';
    const maxSep = Math.max(sepCounts.comma, sepCounts.pipe, sepCounts.dash, sepCounts.ndash);
    if (maxSep === sepCounts.pipe && sepCounts.pipe > 0) sep = ' | ';
    else if (maxSep === sepCounts.ndash && sepCounts.ndash > 0) sep = ' – ';
    else if (maxSep === sepCounts.dash && sepCounts.dash > 0) sep = ' - ';

    // Reconstruct using the detected separator
    const proposed = optimizedParts.join(sep);

    if (proposed.length <= 140 && proposed !== title) {
      optimized = proposed;
    } else if (proposed.length > 140) {
      // Trim gracefully at the last complete segment that fits
      let trimmed = optimizedParts[0];
      for (let i = 1; i < optimizedParts.length; i++) {
        const candidate = trimmed + sep + optimizedParts[i];
        if (candidate.length > 138) break;
        trimmed = candidate;
      }
      optimized = trimmed;
    }
  }

  if (parts.length === 0) {
    return { optimized: title, reasoning: 'Your title is well-optimized — good length, keywords match top competitors, and category relevance is strong.' };
  }

  return { optimized, reasoning: parts.join('. ') + '.' };
}

/**
 * Extract meaningful multi-word phrases from competitor titles
 * that are not present in the user's title.
 */
function extractCompetitorPhrases(competitorTitles, userTitleLower) {
  const phraseCounts = new Map();
  const total = competitorTitles.length;

  for (const ct of competitorTitles) {
    const words = ct.replace(/[|,\-–—()[\]{}]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const seen = new Set();

    // Extract 2-word and 3-word phrases
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ');
        const phraseLower = phrase.toLowerCase();
        if (!seen.has(phraseLower) && !userTitleLower.includes(phraseLower)) {
          seen.add(phraseLower);
          const entry = phraseCounts.get(phraseLower) || { phrase, count: 0 };
          entry.count++;
          phraseCounts.set(phraseLower, entry);
        }
      }
    }
  }

  // Only keep phrases used by 40%+ of competitors
  return Array.from(phraseCounts.values())
    .filter(p => p.count / total >= 0.4)
    .sort((a, b) => b.count - a.count || b.phrase.length - a.phrase.length)
    .slice(0, 5)
    .map(p => p.phrase.split(' ').map(w => capitalize(w)).join(' '));
}

/**
 * Extract natural descriptor patterns from competitor titles.
 * Returns phrases like "3 Sizes", "Instant Download", "Digital File", etc.
 */
function extractDescriptorPatterns(competitorTitles) {
  const patterns = new Map();
  const total = competitorTitles.length;

  for (const ct of competitorTitles) {
    // Split on separators to get natural segments
    const segments = ct.split(/\s*[|,\-–—]\s*/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
    const seen = new Set();
    for (const seg of segments) {
      const segLower = seg.toLowerCase();
      if (!seen.has(segLower)) {
        seen.add(segLower);
        const entry = patterns.get(segLower) || { text: seg, count: 0 };
        entry.count++;
        patterns.set(segLower, entry);
      }
    }
  }

  return Array.from(patterns.values())
    .filter(p => p.count >= 2 && p.count / total >= 0.3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(p => p.text);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateDescriptionSuggestion(description, tags, descScore, competitors) {
  const parts = [];
  const wordCount = descScore.details.wordCount;
  const compDesc = analyzeCompetitorDescriptions(competitors);

  if (compDesc.total > 0 && compDesc.avgWordCount > wordCount) {
    parts.push(`Your description has ${wordCount} words — top competitors average ${compDesc.avgWordCount} words. Expanding will improve search ranking`);
  } else if (wordCount < 150) {
    parts.push(`Your description is only ${wordCount} words — aim for 300+ words. Etsy indexes description text for search`);
  } else if (wordCount < 300) {
    parts.push(`Your description has ${wordCount} words — expanding to 300+ words can improve search ranking`);
  }

  // Compare structural patterns against competitors
  if (!descScore.details.hasStructure && compDesc.withBullets > 0) {
    const pct = Math.round((compDesc.withBullets / compDesc.total) * 100);
    parts.push(`${pct}% of top-ranking competitors use bullet points in their descriptions. Add bullet points for features, sizing, and materials to match market standards`);
  } else if (!descScore.details.hasStructure) {
    parts.push('Add line breaks, bullet points, or sections to improve readability and conversion');
  }

  if (compDesc.total > 0 && compDesc.withSections > compDesc.total / 2) {
    const pct = Math.round((compDesc.withSections / compDesc.total) * 100);
    if (wordCount < 200) {
      parts.push(`${pct}% of competitors use structured sections (e.g., Features, Shipping, Care Instructions). Add similar sections to build trust`);
    }
  }

  if (descScore.details.tagMatchCount < Math.ceil(tags.length / 2)) {
    const missingTags = tags.filter(t => !description.toLowerCase().includes(t.toLowerCase())).slice(0, 5);
    const missingList = missingTags.map(t => `"${t}"`).join(', ');
    parts.push(`Only ${descScore.details.tagMatchCount} of your ${tags.length} tags appear in your description. Missing tags to weave in: ${missingList}`);
  }

  // Build specific structural recommendations
  const recommendations = [];
  if (wordCount < 300) {
    recommendations.push(`Expand from ${wordCount} to 300+ words — add product details, use cases, and specifications`);
  }
  if (!descScore.details.hasStructure) {
    recommendations.push('Add sections with headers (e.g., "✨ Features", "📦 What\'s Included", "💝 Perfect For")');
  }
  if (descScore.details.tagMatchCount < tags.length) {
    const missing = tags.filter(t => !description.toLowerCase().includes(t.toLowerCase())).slice(0, 3);
    if (missing.length > 0) {
      recommendations.push(`Naturally include these tags in your text: ${missing.join(', ')}`);
    }
  }
  if (compDesc.total > 0 && compDesc.avgWordCount > 0) {
    recommendations.push(`Competitor benchmark: avg ${compDesc.avgWordCount} words, ${compDesc.withBullets}/${compDesc.total} use bullet points`);
  }

  if (parts.length === 0 && recommendations.length === 0) {
    return {
      optimized: description,
      descriptionRecommendations: [],
      reasoning: 'Your description is well-structured with good length and keyword integration — on par with top competitors.',
    };
  }

  return { optimized: description, descriptionRecommendations: recommendations, reasoning: parts.join('. ') + '.' };
}

// ========== ACTION ITEMS (COMPETITOR-DRIVEN) ==========

function generateActionItems(titleScore, tagsScore, descScore, imageScore, priceScore, categoryScore, shopAttrScore, competitors, userTags, competitorAvg, userPrice, isDigital, category) {
  const items = [];
  const compKeywords = extractCompetitorTitleKeywords(competitors, 0.6);
  const missingTags = findMissingCompetitorTags(userTags, competitors);
  const compDesc = analyzeCompetitorDescriptions(competitors);

  // Title action
  if (titleScore.score < 70) {
    if (compKeywords.length > 0) {
      const top = compKeywords.slice(0, 3).map(k => `"${k.word}"`).join(', ');
      items.push({
        priority: 'high',
        action: titleScore.details.charCount < 80
          ? `Expand title from ${titleScore.details.charCount} to 80-140 characters. Add top competitor keywords: ${top}`
          : `Optimize title with competitor keywords: ${top} — found in ${compKeywords[0].frequency}%+ of top listings`,
        impact: 'Expected 25-35% increase in search visibility based on competitor keyword patterns',
      });
    } else {
      items.push({
        priority: 'high',
        action: titleScore.details.charCount < 80
          ? `Expand title from ${titleScore.details.charCount} to 80-140 characters with relevant keywords`
          : 'Optimize title with front-loaded keywords and category terms',
        impact: 'Expected 25-35% increase in search visibility',
      });
    }
  }

  // Tags action — with specific swap suggestions
  if (tagsScore.score < 70 || missingTags.length > 0) {
    if (missingTags.length > 0) {
      // Find user's weakest tags (single-word or very short)
      const weakTags = userTags.filter(t => t.trim().split(/\s+/).length === 1).slice(0, 3);
      const topMissing = missingTags.slice(0, 3);

      if (weakTags.length > 0 && topMissing.length > 0) {
        const swaps = topMissing.map((m, i) => {
          const weak = weakTags[i] || weakTags[0];
          return `Replace "${weak}" with "${m.tag}" (used by ${m.usedByPercent}% of competitors)`;
        });
        items.push({
          priority: 'high',
          action: swaps.join('. '),
          impact: `Align your tags with market leaders — these tags appear in ${topMissing[0].usedByPercent}%+ of top listings`,
        });
      } else {
        const tagList = topMissing.map(m => `"${m.tag}" (${m.usedByPercent}%)`).join(', ');
        items.push({
          priority: 'high',
          action: `Add competitor tags you're missing: ${tagList}`,
          impact: 'Tags are the #1 ranking factor on Etsy — align with top competitors',
        });
      }
    } else {
      items.push({
        priority: 'high',
        action: `Fill all 13 tag slots (currently ${tagsScore.details.count}/13) with multi-word long-tail phrases`,
        impact: 'Tags are the #1 ranking factor on Etsy',
      });
    }
  }

  // Description action — with competitor comparison
  if (descScore.score < 60) {
    if (compDesc.total > 0 && compDesc.withBullets > compDesc.total / 2) {
      items.push({
        priority: 'high',
        action: descScore.details.wordCount < 150
          ? `Expand description from ${descScore.details.wordCount} to ${Math.max(300, compDesc.avgWordCount)}+ words with bullet points for features — ${Math.round((compDesc.withBullets / compDesc.total) * 100)}% of top competitors use this format`
          : `Add structured bullet points for Features, Sizing, and Materials — ${Math.round((compDesc.withBullets / compDesc.total) * 100)}% of top-ranking competitors use this format`,
        impact: `Competitors average ${compDesc.avgWordCount} words — match or exceed this for better ranking`,
      });
    } else {
      items.push({
        priority: 'high',
        action: descScore.details.wordCount < 150
          ? `Expand description from ${descScore.details.wordCount} to 300+ words`
          : 'Add bullet points and naturally include tag keywords in description',
        impact: 'Better descriptions improve conversion rate by 20%',
      });
    }
  }

  // Image action
  if (imageScore.score < 70) {
    if (isDigital) {
      items.push({
        priority: imageScore.details.imageCount === 0 ? 'high' : 'medium',
        action: imageScore.details.imageCount === 0
          ? 'Add preview images showing what buyers will receive — mockups, sample pages, or screenshots'
          : `Add more preview images (currently ${imageScore.details.imageCount}/10). Show mockups, sample pages, and what the digital file looks like`,
        impact: 'Listings with 10 images get 2x more views — preview images build buyer confidence for digital products',
      });
    } else {
      items.push({
        priority: 'high',
        action: `Add more images (currently ${imageScore.details.imageCount}/10). Include lifestyle, detail, and scale shots`,
        impact: 'Listings with 10 images get 2x more views',
      });
    }
  }

  // Price action — calculative with specific dollar amounts
  if (priceScore.score < 70 && competitorAvg > 0) {
    const diff = Math.abs(competitorAvg - userPrice);
    const pctBelow = Math.round(((competitorAvg - userPrice) / competitorAvg) * 100);
    const pctAbove = Math.round(((userPrice - competitorAvg) / competitorAvg) * 100);

    if (userPrice < competitorAvg * 0.8) {
      // Suggest a premium-competitive price: 10% below competitor avg
      const suggested = Math.round(competitorAvg * 0.9 * 100) / 100;
      const increase = Math.round((suggested - userPrice) * 100) / 100;
      items.push({
        priority: 'medium',
        action: `Your price is ${pctBelow}% below the market average ($${competitorAvg.toFixed(2)}). Increase by $${increase.toFixed(2)} to $${suggested.toFixed(2)} to align with premium competitors while maintaining a 10% competitive edge`,
        impact: `$${increase.toFixed(2)} more revenue per sale while staying below average`,
      });
    } else if (userPrice > competitorAvg * 1.2) {
      items.push({
        priority: 'medium',
        action: `Your price is ${pctAbove}% above the market average ($${competitorAvg.toFixed(2)}). Ensure premium quality justifies the $${diff.toFixed(2)} premium, or consider reducing to $${(competitorAvg * 1.1).toFixed(2)} for a 10% premium positioning`,
        impact: 'Overpriced listings lose sales velocity and search ranking',
      });
    }
  }

  // Category action — specific feedback
  if (categoryScore.score < 60) {
    const catDetails = categoryScore.details || {};
    const catWords = catDetails.categoryWords || [];
    const matchedWords = catDetails.matchedWords || [];
    const unmatchedWords = catWords.filter(w => !matchedWords.includes(w));

    if (unmatchedWords.length > 0 && matchedWords.length > 0) {
      items.push({
        priority: 'medium',
        action: `Your category ("${category}") partially matches your listing. Add these category keywords to your title or tags: ${unmatchedWords.slice(0, 4).map(w => `"${w}"`).join(', ')}`,
        impact: 'Accurate categorization improves search placement — matching keywords help Etsy rank you correctly',
      });
    } else if (matchedWords.length === 0) {
      items.push({
        priority: 'high',
        action: `Your category ("${category}") doesn't match your listing keywords. Either add category-related terms to your title/tags, or recategorize into a category that better fits your product`,
        impact: 'Mismatched category means Etsy may show your listing to the wrong audience — this hurts both ranking and conversion',
      });
    } else {
      items.push({
        priority: 'medium',
        action: 'Ensure your category matches your listing — add category keywords to title and tags',
        impact: 'Accurate categorization improves search placement',
      });
    }
  }

  // Shop attribute actions — skip shipping for digital products
  if (!isDigital && !shopAttrScore.details.freeShipping) {
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
      imageCount, freeShipping, processingDays, returnsAccepted, isDigital,
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
    const digital = !!isDigital;

    // Digital products always have "free shipping" (no physical shipping needed)
    const effectiveFreeShipping = digital ? true : !!freeShipping;

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
    const shopAttrResult = scoreShopAttributes(effectiveFreeShipping, processingDays || null, !!returnsAccepted);

    // --- Weighted total (Title 20, Tags 20, Desc 20, Images 15, Price 15, Category 10, Shop 0 if no data) ---
    const hasShopData = freeShipping !== undefined || processingDays !== undefined || returnsAccepted !== undefined || digital;
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

    // --- Categorize tags (with competitor tag analysis) ---
    const missingCompetitorTags = findMissingCompetitorTags(listingTags, competitors);
    const categorizedTags = await categorizeTags(listingTags, req.userId, missingCompetitorTags);

    // --- Generate competitor-driven suggestions ---
    const titleSuggestion = generateTitleSuggestion(title, category, titleResult, competitors);
    const descSuggestion  = generateDescriptionSuggestion(description, listingTags, descResult, competitors);
    const actionItems     = generateActionItems(
      titleResult, tagsResult, descResult, imageResult, priceResult, catResult, shopAttrResult,
      competitors, listingTags, competitorAvg, listingPrice, digital, category
    );

    // --- Calculative Pricing Recommendation ---
    let pricingReasoning;
    let suggestedPrice = listingPrice;
    if (competitorAvg > 0) {
      const ratio = listingPrice / competitorAvg;
      const pctBelow = Math.round(((competitorAvg - listingPrice) / competitorAvg) * 100);
      const pctAbove = Math.round(((listingPrice - competitorAvg) / competitorAvg) * 100);

      if (ratio < 0.8) {
        // Suggest 10% below competitor avg for competitive edge
        suggestedPrice = Math.round(competitorAvg * 0.9 * 100) / 100;
        const increase = Math.round((suggestedPrice - listingPrice) * 100) / 100;
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is ${pctBelow}% below the competitor average of $${competitorAvg.toFixed(2)}. You can increase your price by $${increase.toFixed(2)} to $${suggestedPrice.toFixed(2)} to align with premium competitors while maintaining a 10% competitive edge.`;
      } else if (ratio > 1.2) {
        suggestedPrice = Math.round(competitorAvg * 1.1 * 100) / 100;
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is ${pctAbove}% above the competitor average of $${competitorAvg.toFixed(2)}. Consider reducing by $${(listingPrice - suggestedPrice).toFixed(2)} to $${suggestedPrice.toFixed(2)} for a 10% premium positioning that balances revenue with competitiveness.`;
      } else {
        suggestedPrice = competitorAvg;
        pricingReasoning = `Your price of $${listingPrice.toFixed(2)} is competitive — within range of the market average ($${competitorAvg.toFixed(2)}). You're well-positioned against ${competitors.length} competitors (range: $${competitorMin.toFixed(2)} – $${competitorMax.toFixed(2)}).`;
      }
    } else {
      pricingReasoning = 'Competitor pricing data unavailable. Your price was scored neutrally.';
    }

    const recommendations = {
      optimizedTitle: titleSuggestion.optimized,
      titleReasoning: titleSuggestion.reasoning,
      optimizedDescription: descSuggestion.optimized,
      descriptionReasoning: descSuggestion.reasoning,
      descriptionRecommendations: descSuggestion.descriptionRecommendations || [],
      optimizedTags: categorizedTags,
      pricingRecommendation: {
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
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

    // --- Create analysis record (store full competitor data for history) ---
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
      competitors: competitors.map(c => ({
        listing_id: c.listing_id, title: c.title, price: c.price, sales: c.sales, ranking: c.ranking,
      })),
      score: totalScore,
      status: 'completed',
      processingTime: Date.now() - startTime,
    });

    await safeSave(analysis);

    log.info(`Analysis completed: score=${totalScore}, competitors=${competitors.length}, time=${Date.now() - startTime}ms`);

    // Lean competitor array for frontend (no description/tags bulk data)
    const leanCompetitors = competitors.map(c => ({
      listing_id: c.listing_id, title: c.title, price: c.price, sales: c.sales, ranking: c.ranking,
    }));

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
        competitors: leanCompetitors,
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
