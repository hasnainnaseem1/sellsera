# 🏗️ Backend Restructuring Guide

## 📋 Overview

This guide explains how to restructure your backend from the current flat structure to a scalable, feature-based architecture.

---

## 🎯 Benefits of New Structure

1. **Feature-Based Organization** - Easy to find related files
2. **Scalability** - Add new features without clutter
3. **Separation of Concerns** - Models, Routes, Controllers, Services
4. **Easy Testing** - Clear structure for unit/integration tests
5. **Team Collaboration** - Multiple devs can work on different features
6. **API Versioning** - Support v1, v2 in future

---

## 📁 File Mapping: Old → New

### **Models**

```
OLD                             NEW
─────────────────────────────────────────────────────────
src/models/User.js          →  src/models/user/User.js
src/models/CustomRole.js    →  src/models/user/CustomRole.js
src/models/Analysis.js      →  src/models/seller/Analysis.js
src/models/AdminSettings.js →  src/models/admin/AdminSettings.js
src/models/ActivityLog.js   →  src/models/admin/ActivityLog.js
src/models/Notification.js  →  src/models/notification/Notification.js
```

### **Middleware**

```
OLD                                NEW
──────────────────────────────────────────────────────────────
src/middleware/auth.js         →  src/middleware/auth/auth.js
src/middleware/adminAuth.js    →  src/middleware/auth/adminAuth.js
src/middleware/rbac.js         →  src/middleware/security/rbac.js
src/middleware/emailValidator.js → src/middleware/validation/emailValidator.js
```

### **Routes**

```
OLD                              NEW
────────────────────────────────────────────────────────────────────
src/routes/auth.js           →  src/routes/v1/auth/seller.routes.js
src/routes/analyze.js        →  src/routes/v1/seller/analysis.routes.js
src/routes/history.js        →  src/routes/v1/seller/history.routes.js

src/routes/admin/authAdmin.js    →  src/routes/v1/auth/admin.routes.js
src/routes/admin/users.js        →  src/routes/v1/admin/users.routes.js
src/routes/admin/sellers.js      →  src/routes/v1/admin/sellers.routes.js
src/routes/admin/roles.js        →  src/routes/v1/admin/roles.routes.js
src/routes/admin/analytics.js    →  src/routes/v1/admin/analytics.routes.js
src/routes/admin/activityLogs.js →  src/routes/v1/admin/logs.routes.js
src/routes/admin/settings.js     →  src/routes/v1/admin/settings.routes.js
```

### **Scripts**

```
OLD                                  NEW
──────────────────────────────────────────────────────────────
src/scripts/seedSuperAdmin.js    →  src/scripts/seed/seedSuperAdmin.js
(future scripts)                  →  src/scripts/migration/
                                  →  src/scripts/maintenance/
```

---

## 🔧 Step-by-Step Restructuring

### **Phase 1: Create New Folder Structure**

```bash
cd backend/src

# Create new directories
mkdir -p config
mkdir -p models/{user,seller,admin,notification}
mkdir -p middleware/{auth,validation,security,logger}
mkdir -p routes/v1/{auth,seller,admin,notification}
mkdir -p controllers/{auth,seller,admin}
mkdir -p services/{email,analytics,subscription,notification}
mkdir -p utils/{helpers,validators,constants}
mkdir -p scripts/{seed,migration,maintenance}
mkdir -p jobs
```

---

### **Phase 2: Move & Update Model Files**

#### **2.1 User Models**

```bash
# Move files
mv models/User.js models/user/User.js
mv models/CustomRole.js models/user/CustomRole.js
```

Create `src/models/user/index.js`:
```javascript
const User = require('./User');
const CustomRole = require('./CustomRole');

module.exports = {
  User,
  CustomRole
};
```

#### **2.2 Seller Models**

```bash
mv models/Analysis.js models/seller/Analysis.js
```

Create `src/models/seller/index.js`:
```javascript
const Analysis = require('./Analysis');

module.exports = {
  Analysis
};
```

#### **2.3 Admin Models**

```bash
mv models/AdminSettings.js models/admin/AdminSettings.js
mv models/ActivityLog.js models/admin/ActivityLog.js
```

Create `src/models/admin/index.js`:
```javascript
const AdminSettings = require('./AdminSettings');
const ActivityLog = require('./ActivityLog');

module.exports = {
  AdminSettings,
  ActivityLog
};
```

#### **2.4 Notification Models**

```bash
mv models/Notification.js models/notification/Notification.js
```

Create `src/models/notification/index.js`:
```javascript
const Notification = require('./Notification');

module.exports = {
  Notification
};
```

---

### **Phase 3: Move & Update Middleware**

#### **3.1 Auth Middleware**

```bash
mv middleware/auth.js middleware/auth/auth.js
mv middleware/adminAuth.js middleware/auth/adminAuth.js
```

Create `src/middleware/auth/index.js`:
```javascript
const auth = require('./auth');
const adminAuth = require('./adminAuth');

module.exports = {
  auth,
  adminAuth
};
```

#### **3.2 Validation Middleware**

```bash
mv middleware/emailValidator.js middleware/validation/emailValidator.js
```

Create `src/middleware/validation/index.js`:
```javascript
const { validateEmail } = require('./emailValidator');

module.exports = {
  validateEmail
};
```

#### **3.3 Security Middleware**

```bash
mv middleware/rbac.js middleware/security/rbac.js
```

Create `src/middleware/security/index.js`:
```javascript
const { checkPermission, checkRole, superAdminOnly, adminOnly } = require('./rbac');

module.exports = {
  checkPermission,
  checkRole,
  superAdminOnly,
  adminOnly
};
```

---

### **Phase 4: Restructure Routes**

#### **4.1 Create Route Structure**

```bash
# Create v1 structure
mkdir -p routes/v1/{auth,seller,admin,notification}
```

#### **4.2 Move Auth Routes**

**Seller Auth:**
```bash
# Rename and move
cp routes/auth.js routes/v1/auth/seller.routes.js
```

Update imports in `seller.routes.js`:
```javascript
// OLD
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');

// NEW
const { User } = require('../../../models/user');
const { ActivityLog } = require('../../../models/admin');
const { auth } = require('../../../middleware/auth');
const { validateEmail } = require('../../../middleware/validation');
```
**Admin Auth:**
```bash
cp routes/admin/authAdmin.js routes/v1/auth/admin.routes.js
```

Update imports in `admin.routes.js`:
```javascript
// OLD
const User = require('../models/User');
const adminAuth = require('../middleware/adminAuth');

// NEW
const { User } = require('../../../models/user');
const { ActivityLog } = require('../../../models/admin');
const { adminAuth } = require('../../../middleware/auth');
```

#### **4.3 Create Auth Index**

Create `src/routes/v1/auth/index.js`:
```javascript
const express = require('express');
const router = express.Router();

const sellerAuthRoutes = require('./seller.routes');
const adminAuthRoutes = require('./admin.routes');

router.use('/seller', sellerAuthRoutes);
router.use('/admin', adminAuthRoutes);

module.exports = router;
```

#### **4.4 Move Seller Routes**

```bash
cp routes/analyze.js routes/v1/seller/analysis.routes.js
cp routes/history.js routes/v1/seller/history.routes.js
```

Update imports in both files:
```javascript
// OLD
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const auth = require('../middleware/auth');

// NEW
const { Analysis } = require('../../../models/seller');
const { User } = require('../../../models/user');
const { auth } = require('../../../middleware/auth');
```

Create `src/routes/v1/seller/index.js`:
```javascript
const express = require('express');
const router = express.Router();

const analysisRoutes = require('./analysis.routes');
const historyRoutes = require('./history.routes');

// All seller routes require authentication
const { auth } = require('../../../middleware/auth');

router.use('/analysis', auth, analysisRoutes);
router.use('/history', auth, historyRoutes);

module.exports = router;
```
// ############################ YAHA TAK KRLIA HA NEECHE SE SHURU KRNA HA AB ###########
#### **4.5 Move Admin Routes**

```bash
cp routes/admin/users.js routes/v1/admin/users.routes.js
cp routes/admin/sellers.js routes/v1/admin/sellers.routes.js
cp routes/admin/roles.js routes/v1/admin/roles.routes.js
cp routes/admin/analytics.js routes/v1/admin/analytics.routes.js
cp routes/admin/activityLogs.js routes/v1/admin/logs.routes.js
cp routes/admin/settings.js routes/v1/admin/settings.routes.js
```

Update imports in ALL admin route files:
```javascript
// OLD
const User = require('../models/User');
const CustomRole = require('../models/CustomRole');
const ActivityLog = require('../models/ActivityLog');
const adminAuth = require('../middleware/adminAuth');
const { checkPermission } = require('../middleware/rbac');

// NEW
const { User, CustomRole } = require('../../../models/user');
const { ActivityLog, AdminSettings } = require('../../../models/admin');
const { Analysis } = require('../../../models/seller');
const { Notification } = require('../../../models/notification');
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission, checkRole } = require('../../../middleware/security');
```

Create `src/routes/v1/admin/index.js`:
```javascript
const express = require('express');
const router = express.Router();

// Import admin routes
const usersRoutes = require('./users.routes');
const sellersRoutes = require('./sellers.routes');
const rolesRoutes = require('./roles.routes');
const analyticsRoutes = require('./analytics.routes');
const logsRoutes = require('./logs.routes');
const settingsRoutes = require('./settings.routes');

// All admin routes require admin authentication
const { adminAuth } = require('../../../middleware/auth');

router.use('/users', adminAuth, usersRoutes);
router.use('/sellers', adminAuth, sellersRoutes);
router.use('/roles', adminAuth, rolesRoutes);
router.use('/analytics', adminAuth, analyticsRoutes);
router.use('/logs', adminAuth, logsRoutes);
router.use('/settings', adminAuth, settingsRoutes);

module.exports = router;
```

#### **4.6 Create Notification Routes (Future)**

Create `src/routes/v1/notification/index.js`:
```javascript
const express = require('express');
const router = express.Router();

// Future notification routes will go here

module.exports = router;
```

#### **4.7 Create Main Route Files**

Create `src/routes/v1/index.js`:
```javascript
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const sellerRoutes = require('./seller');
const adminRoutes = require('./admin');
const notificationRoutes = require('./notification');

router.use('/auth', authRoutes);
router.use('/seller', sellerRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
```

Create `src/routes/index.js`:
```javascript
const express = require('express');
const router = express.Router();

const v1Routes = require('./v1');

router.use('/v1', v1Routes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
```

---

### **Phase 5: Move Scripts**

```bash
mv scripts/seedSuperAdmin.js scripts/seed/seedSuperAdmin.js
```

Update imports in `seedSuperAdmin.js`:
```javascript
// OLD
const User = require('../models/User');
const AdminSettings = require('../models/AdminSettings');

// NEW
const { User } = require('../../models/user');
const { AdminSettings } = require('../../models/admin');
```

---

### **Phase 6: Update server.js**

Create `src/app.js` (separating app config from server):
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const routes = require('./routes');

// Mount routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

module.exports = app;
```

Update `src/server.js`:
```javascript
const mongoose = require('mongoose');
const app = require('./app');
require('dotenv').config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
});
```

---

## 📡 New API Endpoint Structure

### **Before:**
```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

POST   /api/analyze
GET    /api/history

POST   /api/admin/auth/login
GET    /api/admin/users
GET    /api/admin/sellers
```

### **After:**
```
# Seller Auth
POST   /api/v1/auth/seller/signup
POST   /api/v1/auth/seller/login
GET    /api/v1/auth/seller/verify-email/:token
GET    /api/v1/auth/seller/me

# Admin Auth
POST   /api/v1/auth/admin/login
GET    /api/v1/auth/admin/me

# Seller Features
POST   /api/v1/seller/analysis
GET    /api/v1/seller/history

# Admin Features
GET    /api/v1/admin/users
GET    /api/v1/admin/sellers
GET    /api/v1/admin/analytics/overview
```

---

## 🔄 Frontend Changes Required

### **Old Frontend API Calls:**
```javascript
// Seller
axios.post('/api/auth/signup', data)
axios.post('/api/auth/login', data)
axios.post('/api/analyze', data)

// Admin
axios.post('/api/admin/auth/login', data)
axios.get('/api/admin/users')
```

### **New Frontend API Calls:**
```javascript
// Seller
axios.post('/api/v1/auth/seller/signup', data)
axios.post('/api/v1/auth/seller/login', data)
axios.post('/api/v1/seller/analysis', data)

// Admin
axios.post('/api/v1/auth/admin/login', data)
axios.get('/api/v1/admin/users')
```

**Solution:** Create a base URL constant:
```javascript
// frontend/src/config/api.js
export const API_BASE_URL = '/api/v1';
export const SELLER_API = `${API_BASE_URL}/seller`;
export const ADMIN_API = `${API_BASE_URL}/admin`;
export const AUTH_API = `${API_BASE_URL}/auth`;
```

---

## ✅ Verification Checklist

After restructuring, verify:

- [ ] All models moved to feature folders
- [ ] All middleware organized by type
- [ ] All routes use v1 structure
- [ ] All imports updated with correct paths
- [ ] server.js uses new route structure
- [ ] Scripts moved to appropriate folders
- [ ] Old folders deleted
- [ ] API endpoints tested
- [ ] Frontend updated to use new endpoints

---

## 🧪 Testing After Restructuring

```bash
# Test Health Check
curl http://localhost:5000/api/health

# Test Seller Signup
curl -X POST http://localhost:5000/api/v1/auth/seller/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'

# Test Admin Login
curl -X POST http://localhost:5000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

---

## 🎯 Benefits Summary

✅ **Organized**: Easy to navigate
✅ **Scalable**: Add features without mess
✅ **Maintainable**: Clear responsibility
✅ **Testable**: Isolated modules
✅ **Professional**: Industry standard
✅ **Future-proof**: Support API versioning

---

## 📞 Next Steps

1. **Backup** current codebase
2. Follow this guide step-by-step
3. Update imports gradually
4. Test each module after moving
5. Update frontend API calls
6. Delete old folders after verification

Agar koi confusion ho, check the folder structure diagram at the top!