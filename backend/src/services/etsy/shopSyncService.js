/**
 * Shop Sync Service
 * 
 * Handles syncing a user's Etsy shop data:
 * - Listings (active, sold, expired)
 * - Receipts (for delivery tracking + sales map)
 * 
 * Uses etsyApiService for all API calls (inherits key rotation + token refresh).
 * 
 * Usage:
 *   const shopSync = require('../../services/etsy/shopSyncService');
 *   await shopSync.syncListings(etsyShop);
 *   await shopSync.syncReceipts(etsyShop);
 *   await shopSync.fullSync(etsyShop);
 */

const { EtsyListing } = require('../../models/integrations');
const { ShopReceipt } = require('../../models/customer');
const { EtsyShop } = require('../../models/integrations');
const etsyApi = require('./etsyApiService');
const syncJobManager = require('./syncJobManager');

/**
 * Sync active listings for a shop.
 * Fetches all listings and upserts into EtsyListing collection.
 * 
 * @param {Object} etsyShop - EtsyShop Mongoose document
 * @param {string} [jobId] - Optional sync job ID for progress tracking
 * @returns {{ success: boolean, syncedCount: number, error?: string }}
 */
const syncListings = async (etsyShop, jobId = null) => {
  try {
    // Mark shop as syncing
    etsyShop.status = 'syncing';
    await etsyShop.save();

    let offset = 0;
    const limit = 100;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`[ShopSync] Fetching listings for shop ${etsyShop.shopId} (offset: ${offset})`);

      const result = await etsyApi.authenticatedRequest(
        etsyShop,
        'GET',
        `/v3/application/shops/${etsyShop.shopId}/listings`,
        { params: { limit, offset, state: 'active' } }
      );

      if (!result.success) {
        console.error(`[ShopSync] API call failed for shop ${etsyShop.shopId}:`, result.error, result.code);
        // If token was revoked during sync, stop
        if (result.code === 'SHOP_TOKEN_REVOKED') {
          return { success: false, syncedCount: totalSynced, error: 'Token revoked during sync' };
        }
        break;
      }

      console.log(`[ShopSync] Got ${result.data?.results?.length || 0} listings (count: ${result.data?.count})`);

      // Report total estimate on first page
      if (offset === 0 && jobId) {
        syncJobManager.updateProgress(jobId, {
          totalEstimate: result.data?.count || 0,
          phase: 'listings',
        });
      }

      const listings = result.data.results || [];

      for (const listing of listings) {
        await EtsyListing.findOneAndUpdate(
          { shopId: etsyShop._id, etsyListingId: String(listing.listing_id) },
          {
            shopId: etsyShop._id,
            etsyListingId: String(listing.listing_id),
            title: listing.title || '',
            description: listing.description || '',
            tags: listing.tags || [],
            materials: listing.materials || [],
            price: listing.price?.amount ? listing.price.amount / listing.price.divisor : 0,
            currencyCode: listing.price?.currency_code || 'USD',
            quantity: listing.quantity || 0,
            views: listing.views || 0,
            favorites: listing.num_favorers || 0,
            state: listing.state || 'active',
            taxonomyId: listing.taxonomy_id || null,
            taxonomyPath: listing.category_path || [],
            images: [], // Images fetched separately if needed
            shippingProfile: listing.shipping_profile_id ? String(listing.shipping_profile_id) : null,
            processingMin: listing.processing_min || null,
            processingMax: listing.processing_max || null,
            returnsAccepted: listing.has_variations || false,
            syncedAt: new Date(),
          },
          { upsert: true, new: true }
        );
        totalSynced++;
      }

      // Report progress after each page
      if (jobId) {
        syncJobManager.updateProgress(jobId, { syncedCount: totalSynced });
      }

      hasMore = listings.length === limit;
      offset += limit;
    }

    // Update shop metadata
    etsyShop.status = 'active';
    etsyShop.lastSyncAt = new Date();
    etsyShop.listingCount = totalSynced;
    await etsyShop.save();

    return { success: true, syncedCount: totalSynced };

  } catch (error) {
    console.error(`[ShopSync] Listing sync error for shop ${etsyShop.shopId}:`, error.message);
    // Don't leave shop in syncing state
    if (etsyShop.status === 'syncing') {
      etsyShop.status = 'active';
      await etsyShop.save();
    }
    return { success: false, syncedCount: 0, error: error.message };
  }
};

/**
 * Sync receipts (orders) for delivery tracking and sales map.
 * 
 * @param {Object} etsyShop - EtsyShop Mongoose document
 * @returns {{ success: boolean, syncedCount: number, error?: string }}
 */
const syncReceipts = async (etsyShop) => {
  try {
    let offset = 0;
    const limit = 100;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await etsyApi.authenticatedRequest(
        etsyShop,
        'GET',
        `/v3/application/shops/${etsyShop.shopId}/receipts`,
        { params: { limit, offset } }
      );

      if (!result.success) {
        if (result.code === 'SHOP_TOKEN_REVOKED') {
          return { success: false, syncedCount: totalSynced, error: 'Token revoked during sync' };
        }
        break;
      }

      const receipts = result.data.results || [];

      for (const receipt of receipts) {
        const shipment = receipt.shipments?.[0] || {};

        await ShopReceipt.findOneAndUpdate(
          { shopId: etsyShop._id, etsyReceiptId: String(receipt.receipt_id) },
          {
            shopId: etsyShop._id,
            etsyReceiptId: String(receipt.receipt_id),
            status: mapReceiptStatus(receipt, shipment),
            countryIso: receipt.country_iso || null,
            city: receipt.city || null,
            state: receipt.state || null,
            grandTotal: receipt.grandtotal?.amount
              ? receipt.grandtotal.amount / receipt.grandtotal.divisor
              : 0,
            currencyCode: receipt.grandtotal?.currency_code || 'USD',
            shipment: {
              carrier: shipment.carrier_name || null,
              trackingCode: shipment.tracking_code || null,
              shippedAt: shipment.mail_date ? new Date(shipment.mail_date * 1000) : null,
              estimatedDelivery: shipment.estimated_delivery
                ? new Date(shipment.estimated_delivery * 1000) : null,
              deliveredAt: shipment.delivered_date
                ? new Date(shipment.delivered_date * 1000) : null,
            },
            items: (receipt.transactions || []).map(t => ({
              listingId: String(t.listing_id),
              title: t.title || '',
              quantity: t.quantity || 1,
              price: t.price?.amount ? t.price.amount / t.price.divisor : 0,
            })),
            createdTstamp: receipt.create_timestamp
              ? new Date(receipt.create_timestamp * 1000) : new Date(),
            updatedTstamp: receipt.update_timestamp
              ? new Date(receipt.update_timestamp * 1000) : null,
            syncedAt: new Date(),
          },
          { upsert: true, new: true }
        );
        totalSynced++;
      }

      hasMore = receipts.length === limit;
      offset += limit;
    }

    return { success: true, syncedCount: totalSynced };

  } catch (error) {
    console.error(`[ShopSync] Receipt sync error for shop ${etsyShop.shopId}:`, error.message);
    return { success: false, syncedCount: 0, error: error.message };
  }
};

/**
 * Full sync — listings + receipts.
 * 
 * @param {Object} etsyShop - EtsyShop Mongoose document
 * @param {string} [jobId] - Optional sync job ID for progress tracking
 * @returns {{ listings: Object, receipts: Object }}
 */
const fullSync = async (etsyShop, jobId = null) => {
  const listings = await syncListings(etsyShop, jobId);

  if (jobId) {
    syncJobManager.updateProgress(jobId, { phase: 'receipts' });
  }

  const receipts = await syncReceipts(etsyShop);
  return { listings, receipts };
};

/**
 * Async full sync — runs in the background, tracks progress via syncJobManager.
 * Returns the jobId immediately so the caller can poll for status.
 * 
 * @param {Object} etsyShop - EtsyShop Mongoose document
 * @returns {string} jobId
 */
const asyncFullSync = (etsyShop) => {
  // Prevent duplicate sync jobs for the same shop
  if (syncJobManager.isShopSyncing(etsyShop._id)) {
    const existing = syncJobManager.getLatestJobForShop(etsyShop._id);
    if (existing) return existing.id;
  }

  const jobId = syncJobManager.startJob(etsyShop._id, etsyShop.userId);

  // Fire-and-forget — runs in the background
  (async () => {
    try {
      const result = await fullSync(etsyShop, jobId);
      const syncedCount = result.listings.syncedCount || 0;
      syncJobManager.completeJob(jobId, { syncedCount });
      console.log(`[ShopSync] Async sync completed for shop ${etsyShop.shopId}: ${syncedCount} listings`);
    } catch (err) {
      syncJobManager.failJob(jobId, err.message);
      console.error(`[ShopSync] Async sync failed for shop ${etsyShop.shopId}:`, err.message);
    }
  })();

  return jobId;
};

/**
 * Sync all active shops (called by cron).
 * @returns {{ total: number, succeeded: number, failed: number }}
 */
const syncAllShops = async () => {
  const shops = await EtsyShop.find({ status: { $in: ['active', 'syncing'] } });
  let succeeded = 0;
  let failed = 0;

  for (const shop of shops) {
    const result = await fullSync(shop);
    if (result.listings.success && result.receipts.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { total: shops.length, succeeded, failed };
};

// --- Helpers ---

const mapReceiptStatus = (receipt, shipment) => {
  if (receipt.status === 'Canceled') return 'cancelled';
  if (shipment.delivered_date) return 'delivered';
  if (shipment.tracking_code) return 'in_transit';
  if (shipment.mail_date) return 'shipped';
  if (receipt.is_paid) return 'paid';
  return 'paid';
};

module.exports = { syncListings, syncReceipts, fullSync, asyncFullSync, syncAllShops };
