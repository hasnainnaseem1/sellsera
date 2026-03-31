const mongoose = require('mongoose');

/**
 * KeywordSnapshot — daily snapshot of keyword metrics.
 *
 * The keywordSnapshot cron job captures stats for the top historically
 * searched keywords once per day.  After 30+ days of data, real trend
 * comparisons (week-over-week, month-over-month) become possible.
 */
const keywordSnapshotSchema = new mongoose.Schema({
  // The keyword being tracked
  keyword: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  // Country filter used (null = Global)
  country: {
    type: String,
    default: null,
  },
  // Etsy's reported total active listings for this keyword
  totalResults: {
    type: Number,
    default: 0,
  },
  // Average views across sampled listings
  avgViews: {
    type: Number,
    default: 0,
  },
  // Average favorites across sampled listings
  avgFavorites: {
    type: Number,
    default: 0,
  },
  // Competition: % of sampled listings using this exact tag
  competitionPct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Favorites-to-views ratio (trend signal)
  favViewRatio: {
    type: Number,
    default: 0,
  },
  // Number of listings sampled to produce these stats
  sampleSize: {
    type: Number,
    default: 0,
  },
  // How many Etsy API calls this snapshot consumed
  serpCalls: {
    type: Number,
    default: 0,
  },
  // Date of the snapshot (midnight UTC, one per keyword per day)
  snapshotDate: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for efficient trend queries
keywordSnapshotSchema.index({ keyword: 1, snapshotDate: -1 });
keywordSnapshotSchema.index({ keyword: 1, country: 1, snapshotDate: -1 });
// Prevent duplicate snapshots for the same keyword+country+date
keywordSnapshotSchema.index(
  { keyword: 1, country: 1, snapshotDate: 1 },
  { unique: true }
);

/**
 * Get trend data for a keyword over N days.
 */
keywordSnapshotSchema.statics.getTrend = async function (keyword, days = 30, country = null) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const match = { keyword: keyword.toLowerCase(), snapshotDate: { $gte: startDate } };
  if (country) match.country = country;

  return this.find(match)
    .sort({ snapshotDate: 1 })
    .select('snapshotDate totalResults avgViews avgFavorites competitionPct favViewRatio')
    .lean();
};

/**
 * Calculate week-over-week volume change for a keyword.
 */
keywordSnapshotSchema.statics.getWeekOverWeekChange = async function (keyword, country = null) {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const match = { keyword: keyword.toLowerCase() };
  if (country) match.country = country;

  const [thisWeek, lastWeek] = await Promise.all([
    this.find({ ...match, snapshotDate: { $gte: oneWeekAgo } })
      .select('totalResults').lean(),
    this.find({ ...match, snapshotDate: { $gte: twoWeeksAgo, $lt: oneWeekAgo } })
      .select('totalResults').lean(),
  ]);

  const avgThis = thisWeek.length > 0
    ? thisWeek.reduce((s, d) => s + d.totalResults, 0) / thisWeek.length
    : null;
  const avgLast = lastWeek.length > 0
    ? lastWeek.reduce((s, d) => s + d.totalResults, 0) / lastWeek.length
    : null;

  if (avgThis === null || avgLast === null || avgLast === 0) {
    return { changePct: null, insufficient: true };
  }

  return {
    changePct: Math.round(((avgThis - avgLast) / avgLast) * 10000) / 100,
    thisWeekAvg: Math.round(avgThis),
    lastWeekAvg: Math.round(avgLast),
    insufficient: false,
  };
};

const KeywordSnapshot = mongoose.model('KeywordSnapshot', keywordSnapshotSchema);
module.exports = KeywordSnapshot;
