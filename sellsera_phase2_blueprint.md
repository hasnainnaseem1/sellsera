# Sellsera — Phase 2 Architectural Blueprint (Source of Truth)

> **Status:** LOCKED & APPROVED — March 15, 2026
> **Author:** Founder + AI Architect
> **Scope:** Backend technical specification for all Phase 1/1.5/1.6 UI features

---

## 1. FOUR-TIER PRICING MATRIX (ALL HARD-CAPPED)

Every feature has a finite, enforced limit. There are zero "Unlimited" tiers at any level.

| Feature                  | FREE          | BASIC ($12/mo) | PRO ($29/mo)  | PRO PLUS ($59/mo) |
|--------------------------|---------------|----------------|---------------|--------------------|
| **Listing Audits**       | 3/mo          | 25/mo          | 100/mo        | 500/mo             |
| **Keyword Searches**     | 5/mo          | 30/mo          | 500/mo        | 1,000/mo           |
| **Deep Keyword Analysis**| ❌            | 10/mo          | 50/mo         | 500/mo             |
| **Bulk Rank Checks**     | ❌            | 5/mo           | 150/mo        | 400/mo             |
| **Tag Analysis**         | 3/mo          | 20/mo          | 80/mo         | 500/mo             |
| **Active Listings Sync** | 50 listings   | 500 listings   | 2,000 listings| 5,000 listings     |
| **Competitor Tracking**  | ❌            | 2 shops        | 10 shops      | 25 shops           |
| **Competitor Sales**     | ❌            | ❌             | 10 shops      | 25 shops           |
| **Delivery Tracking**    | ❌            | ✅             | ✅            | ✅                 |
| **Sales Map**            | ❌            | ✅             | ✅            | ✅                 |
| **Analysis History**     | 7 days        | 30 days        | 90 days       | 365 days           |
| **AI Analysis**          | 1 LIFETIME    | 5/mo           | 20/mo         | 100/mo             |
| **AI Tag Generator**     | 1 LIFETIME    | 5/mo           | 10/mo         | 50/mo              |
| **CSV Export**           | ❌            | ✅             | ✅            | ✅                 |
| **Priority Support**     | ❌            | ❌             | ✅            | ✅                 |
| **Connected Shops**      | 1             | 1              | 3             | 5                  |

**Yearly Discount:** 20% off — Basic $115/yr, Pro $278/yr, Pro Plus $566/yr

### Free-Tier AI: LIFETIME Cap (Not Monthly)
- Free users get **1 AI Analysis + 1 AI Tag Gen per account, ever.** This is a one-time PLG taste, not a recurring allowance.
- **Implementation:** `checkFeatureAccess` uses `periodType: 'lifetime'` for these two features on the Free plan — counts all-time `UsageLog` with no date filter.
- **Cost:** $0.155 one-time per signup. At 10K free signups = $1,550 total. Negligible CAC.

---

## 2. PROFITABILITY MODEL (SERP API + AI COSTS)

### Cost Inputs
| Cost Type | Unit Cost | Source |
|-----------|-----------|--------|
| B2B SERP API (DataForSEO) | ~$0.0025/request | Keyword searches, rank checks, competitor scrapes, tag analysis |
| Anthropic AI Analysis | ~$0.105/call | ~2K input + 1K output tokens per call |
| Anthropic AI Tag Gen | ~$0.05/call | ~500 tokens per call |
| Server (t3.small) | ~$15/mo fixed | Amortized across all users |

### Worst-Case COGS (User Maxes Every Cap)

| Tier       | Total COGS | Revenue | Margin          |
|------------|-----------|---------|-----------------|
| **FREE**   | $0.02     | $0      | N/A (freemium)  |
| **BASIC**  | $1.62     | $12     | **$10.38 (87%)** ✅ |
| **PRO**    | $9.18     | $29     | **$19.82 (68%)** ✅ |
| **PRO PLUS**| $48.63   | $59     | **$10.37 (18%)** ✅ |

### Realistic COGS (30% Utilization + Redis Cache Dedup)

| Tier       | COGS   | Revenue | Margin          |
|------------|--------|---------|-----------------|
| **BASIC**  | ~$0.49 | $12     | **$11.51 (96%)** ✅ |
| **PRO**    | ~$2.75 | $29     | **$26.25 (91%)** ✅ |
| **PRO PLUS**| ~$14.59| $59    | **$44.41 (75%)** ✅ |

**All tiers are margin-positive even at 100% cap utilization.**

### Safety Net
- Track per-user SERP spend in `SerpCostLog` model
- Admin alert if any single user exceeds $30/mo in SERP costs
- Redis caching (6hr TTL) reduces actual SERP calls by 3-5×

---

## 3. ETSY API KEY ROTATION POOL

### EtsyApiKey Model
Stored at `backend/src/models/integrations/EtsyApiKey.js`

| Field            | Type   | Description |
|------------------|--------|-------------|
| label            | String | Human-readable label (e.g., "Key-Alpha") |
| apiKey           | String | AES-256-GCM encrypted at rest |
| sharedSecret     | String | AES-256-GCM encrypted at rest |
| status           | Enum   | `active`, `rate_limited`, `disabled`, `revoked` |
| rateLimitResetAt | Date   | When a rate-limited key becomes available again |
| requestCount24h  | Number | Rolling 24-hour request counter |
| lastUsedAt       | Date   | Timestamp of last API call using this key |
| errorCount       | Number | Consecutive error counter (resets on success) |
| createdBy        | ObjectId | Admin user who added the key |

### Rotation Algorithm (Weighted Round-Robin)
1. Fetch all keys where `status = 'active'`
2. Sort by `requestCount24h` ascending (prefer least-used)
3. Select first key, increment `requestCount24h`, set `lastUsedAt`
4. On **HTTP 429**: mark `status = 'rate_limited'`, set `rateLimitResetAt = now + Retry-After header`
5. On **3× consecutive 5xx**: mark `status = 'disabled'`, fire admin notification
6. Lazy un-rate-limit: before fetching pool, check `rateLimitResetAt < now` → flip back to `active`

### Admin UI
New "Etsy API Keys" tab in Admin Center `IntegrationsPage.js`:
- Table: label, status badge, requests/24h, last used, error count
- Add/Edit modal with masked key fields

---

## 4. ETSY OAUTH & TOKEN REVOCATION

### OAuth Flow
1. `GET /api/v1/etsy/auth` → redirect to Etsy OAuth2 consent screen
2. `GET /api/v1/etsy/callback` → exchange code → encrypt & store tokens in `EtsyShop`
3. Token refresh via background cron or on-request lazy refresh

### Token Revocation Handling
**Problem:** User can revoke Sellsera's access from Etsy settings at any time.

**Detection (in `etsyApiService.js`):**
1. On HTTP 401 from Etsy → attempt one token refresh
2. If refresh also fails (401/invalid_grant):
   - Set `EtsyShop.status = 'token_revoked'`
   - Set `EtsyShop.tokenRevokedAt = Date.now()`
   - Clear encrypted tokens (dead tokens are useless)
   - Log event for admin visibility
   - Return `{ success: false, error: 'SHOP_TOKEN_REVOKED' }`

**Middleware: `checkShopConnection`:**
- Applied to all shop-dependent endpoints
- No shop → 403 `SHOP_NOT_CONNECTED`
- Revoked → 403 `SHOP_REQUIRES_REAUTH`
- Active → `next()`

**Frontend:** Persistent amber banner "Your Etsy connection expired. [Re-authorize now →]"

---

## 5. DATABASE SCHEMA OVERVIEW (ERD)
User ──┬── EtsyShop ──┬── EtsyListing ── ListingAudit
│ └── ShopReceipt ── SalesGeoSnapshot
├── CompetitorWatch ── CompetitorSnapshot
├── KeywordSearch ── KeywordResult
├── RankCheck
├── AiUsageLog
├── SerpCostLog
├── UsageLog
└── Payment

EtsyApiKey (admin-managed, no user FK)


### New Phase 2 Models

| Model | File Path | Key Indexes |
|-------|-----------|-------------|
| EtsyShop | `models/integrations/EtsyShop.js` | `userId` (unique) |
| EtsyListing | `models/integrations/EtsyListing.js` | `shopId + etsyListingId` (unique), `shopId + syncedAt` |
| EtsyApiKey | `models/integrations/EtsyApiKey.js` | `status + requestCount24h`, `status` |
| AiUsageLog | `models/customer/AiUsageLog.js` | `userId + createdAt`, `userId + featureKey + createdAt` |
| SerpCostLog | `models/customer/SerpCostLog.js` | `userId + createdAt`, `userId + featureKey` |

### Existing Models (Unchanged)
- `User`, `Plan`, `Feature`, `UsageLog`, `Payment`, `Analysis`, `AdminSettings`, `Notification`

---

## 6. LIFETIME AI QUOTA IMPLEMENTATION

The existing `checkFeatureAccess` middleware counts `UsageLog` documents in the current billing period. For Free-tier AI, we add a `periodType` field:

| Plan | Feature | periodType | Behavior |
|------|---------|------------|----------|
| FREE | `ai_listing_optimizer` | `lifetime` | Count ALL UsageLog records (no date filter). Limit = 1. |
| FREE | `ai_tag_generator` | `lifetime` | Count ALL UsageLog records (no date filter). Limit = 1. |
| BASIC+ | All AI features | `monthly` | Count UsageLog in current billing period (standard). |
| ALL | All non-AI features | `monthly` | Standard monthly billing period. |

**Frontend:** Free AI shows "1 of 1 used (lifetime)" → permanently locked with "Upgrade to Basic for 5/mo" CTA.

---

## 7. REDIS CACHING LAYER

| Cache Key Pattern | TTL | Purpose |
|---|---|---|
| `dash:{userId}` | 5 min | Dashboard aggregated stats |
| `usage:{userId}` | 2 min | Feature usage counts |
| `kw:{hash(keyword)}` | 6 hr | Keyword search results |
| `rank:{listingId}:{hash(keyword)}` | 6 hr | Rank check results |
| `competitor:{shopName}` | 1 hr | Competitor shop data |
| `etsy:key:pool` | 1 min | Active API keys list |

**Implementation:** `backend/src/services/cache/redisService.js` — getOrSet pattern.

---

## 8. IMPLEMENTATION ROADMAP

### Phase 2A — Foundation (Week 1-2)
1. Create new Mongoose models (EtsyShop, EtsyListing, EtsyApiKey, AiUsageLog, SerpCostLog)
2. Build `keyPoolService.js` (key rotation)
3. Build `encryption.js` (AES-256-GCM)
4. Add Redis service + ioredis
5. Build `oauthService.js` (Etsy OAuth2)
6. Add Etsy OAuth routes + controller
7. Build shop sync service
8. Wire ConnectShopPrompt to real OAuth
9. Build `checkShopConnection` middleware (token revocation)
10. Build token revocation handler in etsyApiService
11. Admin UI: Etsy API Keys tab
12. Frontend: Re-authorize banner

### Phase 2B — Core Features (Week 3-4)
13-18. Listing audit, keyword, deep keyword, tag analysis, rank checker controllers + route wiring

### Phase 2C — Competitive Intelligence (Week 5)
19-23. Competitor watch/snapshot, delivery status, sales map controllers

### Phase 2D — Pricing & Polish (Week 6)
24-30. Seed plans, Redis cache integration, SerpCostLog tracking, E2E testing

---

## 9. SECURITY STANDARDS

- **Middleware chain:** `auth → checkSubscription → checkShopConnection → checkFeatureAccess → trackFeatureUsage → controller`
- **IDOR prevention:** Every query scopes to `req.user._id`
- **Input validation:** `express-validator` on all endpoints
- **Encryption at rest:** AES-256-GCM for API keys and OAuth tokens
- **Rate limiting:** 60 req/min per user, 10 keyword searches/min per user
- **Data isolation:** All shop data queries scoped to owner via `userId`

---

*This document is the single source of truth for Phase 2 development. All implementation must conform to the specifications above.*