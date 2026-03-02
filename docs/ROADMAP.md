# SaaS Admin Panel — Build Roadmap

> **Current Date:** February 2026  
> **Status:** Core admin panel is 85% complete. Key gaps: Email service, Payments, Customer-facing pages.

---

## What's Already Built (DONE)

| Area | Status |
|------|--------|
| User Model + Auth (signup, login, email verify) | DONE |
| Admin Auth + RBAC (40 permissions, custom roles) | DONE |
| Customer CRUD (13 endpoints) | DONE |
| Admin User CRUD (10 endpoints) | DONE |
| Plans CRUD (9 endpoints, feature allocation per plan) | DONE |
| Features CRUD (7 endpoints, boolean/numeric/text) | DONE |
| Subscription Middleware (checkSubscription, checkFeatureAccess, trackFeatureUsage) | DONE |
| Usage Tracking (UsageLog model + usageService) | DONE |
| Notifications (model + routes + dropdown) | DONE |
| Activity Logs (model + routes + export) | DONE |
| Settings/Branding (theme, SMTP config, security, etc.) | DONE |
| Analytics Dashboard (10 endpoints + charts) | DONE |
| Admin Frontend (all pages: dashboard, users, customers, plans, features, roles, settings, analytics) | DONE |
| Marketing Site (landing, pricing, features, contact, terms, privacy) | DONE |
| Customer Signup + Login + Dashboard | DONE |

---

## How The Subscription System Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     SUBSCRIPTION FLOW                                   │
│                                                                         │
│  1. Admin creates FEATURES (e.g., keyword_search, csv_export)           │
│     → Type: boolean (on/off), numeric (has limit), text (config value)  │
│                                                                         │
│  2. Admin creates PLANS (e.g., Free, Pro, Pro Plus)                     │
│     → Attaches features with PER-PLAN LIMITS:                           │
│        Free:     keyword_search = 5/month,  csv_export = OFF            │
│        Pro:      keyword_search = 30/month, csv_export = ON             │
│        Pro Plus: keyword_search = 50/month, csv_export = ON             │
│     → Sets trial period (days) and pricing                              │
│                                                                         │
│  3. Customer signs up → auto-assigned DEFAULT PLAN                      │
│     → Plan features SNAPSHOT saved to user (frozen at assignment)        │
│     → subscriptionStatus = 'trial' (if trialDays > 0) or 'active'      │
│                                                                         │
│  4. Customer uses a feature → middleware chain:                          │
│     auth → checkSubscription → checkFeatureAccess('keyword_search')     │
│     → If subscription expired/none → 403 "upgrade required"            │
│     → If feature not in plan → 403 "not available in your plan"        │
│     → If limit reached (5/5 used) → 429 "limit reached, upgrade"      │
│     → If OK → trackFeatureUsage logs it → handler runs                 │
│                                                                         │
│  5. Usage resets monthly (monthlyResetDate)                             │
│  6. Admin can view per-customer feature usage in CustomerDetailPage     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Trial Period Logic

| Plan Type | Trial Days | What Happens |
|-----------|-----------|--------------|
| Free plan | 30 days | User gets 30 days. After that → expired. Must upgrade. |
| Free plan | 0 days | Always active. No expiry ever. |
| Paid plan | 7 days | User tries paid features FREE for 7 days. Then must pay. |
| Paid plan | 0 days | No trial. Active only after payment confirmed. |

---

## Roadmap — What To Build Next (In Order)

### Phase 1: Email Service (Priority: HIGH)
**Why first:** Email verification, password reset, trial expiry warnings all need this.

- [ ] Set up Nodemailer with SMTP config from AdminSettings
- [ ] Create email templates (verification, password reset, welcome, plan change, trial expiring, trial expired)
- [ ] Connect to signup flow (send verification email)
- [ ] Connect to password reset flow
- [ ] Add customer forgot-password / reset-password routes (currently only admin has this)

**Estimated effort:** 1–2 sessions

---

### Phase 2: Trial Expiry Cron Job (Priority: HIGH)
**Why:** Trials currently only expire when the user hits checkSubscription middleware. Need proactive expiry + email warnings.

- [ ] Install node-cron or agenda
- [ ] Create job: check all users with subscriptionStatus='trial' + trialEndsAt < now → set to 'expired'
- [ ] Create job: send warning email 3 days before trial expires
- [ ] Create job: send "trial expired" email when trial ends
- [ ] Create job: monthly usage reset (reset UsageLog counts at monthlyResetDate)

**Estimated effort:** 1 session

---

### Phase 3: Stripe Payment Integration (Priority: HIGH)
**Why:** This is how you collect money. Everything else is free until this works.

- [ ] Install stripe SDK
- [ ] Create Stripe checkout session endpoint (customer picks plan → redirect to Stripe)
- [ ] Create Stripe webhook handler (payment_intent.succeeded, subscription.created, subscription.cancelled, etc.)
- [ ] On successful payment → update subscriptionStatus to 'active', set subscriptionId
- [ ] On subscription cancelled → update status to 'cancelled'
- [ ] On payment failed → handle gracefully (downgrade? grace period?)
- [ ] Admin can view Stripe customer ID + subscription status

**Estimated effort:** 2–3 sessions

---

### Phase 4: Customer Center Pages (Priority: MEDIUM)
**Why:** Customers need to see their plan, usage, billing, and manage their account.

- [ ] **Profile/Settings page** — name, email, password change, timezone
- [ ] **Subscription page** — current plan, usage bars per feature, upgrade button
- [ ] **Pricing/Plans page** — show all plans with feature comparison, "Current Plan" badge, upgrade/downgrade buttons
- [ ] **Billing History page** — list of payments from Stripe (requires Phase 3)
- [ ] **Usage Dashboard** — visual feature usage (progress bars, monthly trend)

**Estimated effort:** 2–3 sessions

---

### Phase 5: Marketing Site — Dynamic Pricing (Priority: MEDIUM)
**Why:** Currently pricing page is hardcoded. Should pull from database.

- [ ] Create public API endpoint: GET /api/v1/public/plans (no auth required)
- [ ] Update PricingPage.js to fetch plans dynamically
- [ ] Show features per plan with limits
- [ ] "Get Started" button → links to signup or Stripe checkout

**Estimated effort:** 1 session

---

### Phase 6: Admin Notifications Page (Priority: LOW)
**Why:** Currently only a dropdown. Need full page with filters, search, mark read/unread.

- [ ] Create NotificationsPage.js with table, filters, bulk actions
- [ ] Add notification preferences in admin settings

**Estimated effort:** 1 session

---

### Phase 7: Admin Profile Page (Priority: LOW)
**Why:** Admin can change password via API, but there's no dedicated page.

- [ ] Create ProfilePage.js — avatar upload, name, email, timezone, change password
- [ ] Add to sidebar navigation

**Estimated effort:** 1 session

---

### Phase 8: Polish & Production (Priority: LOW)
- [ ] Rate limiting on auth routes
- [ ] Input sanitization audit
- [ ] Error boundary components in frontend
- [ ] Loading skeletons for all pages
- [ ] Docker compose for deployment
- [ ] Environment configuration guide
- [ ] API documentation (Swagger/OpenAPI)

---

## Quick Reference: How To Protect Any Feature

When you build a new customer-facing feature, here's the exact pattern:

```javascript
const { auth } = require('../../middleware/auth');
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../middleware/subscription');

// Example: Protect a "keyword search" endpoint
router.post('/keyword-search',
  auth,                                    // 1. Must be logged in
  checkSubscription,                       // 2. Must have active/trial subscription
  checkFeatureAccess('keyword_search'),    // 3. Feature must be enabled + within limit
  trackFeatureUsage('keyword_search'),     // 4. Auto-logs usage on success
  async (req, res) => {
    // Your feature logic here
    // req.featureAccess has: { featureKey, limit, used, remaining, unlimited }
    
    res.json({ success: true, data: result });
  }
);
```

The `featureKey` (e.g., `'keyword_search'`) must match what you created in the Features page and configured in the Plan.

---

## Quick Reference: Feature Types

| Type | Feature Example | What it controls |
|------|----------------|-----------------|
| **Boolean** | "CSV Export", "API Access" | ON or OFF per plan. No counting. |
| **Numeric** | "Keyword Searches", "Reports" | Has a monthly usage limit. Tracked and enforced. |
| **Text** | "Support Level", "Storage Tier" | Text config value per plan (e.g., "basic", "priority"). |
