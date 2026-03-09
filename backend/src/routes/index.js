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
    version: '1.0.0',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'MISSING',
      MONGODB_URI: process.env.MONGODB_URI ? 'configured' : 'MISSING',
      BACKEND_URL: process.env.BACKEND_URL || 'not set',
    }
  });
});

module.exports = router;