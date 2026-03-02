const express = require('express');
const router = express.Router();
const historyController = require('../../../controllers/customer/historyController');

// GET /api/v1/customer/history
router.get('/', historyController.getHistory);

// GET /api/v1/customer/history/:id
router.get('/:id', historyController.getAnalysisById);

// DELETE /api/v1/customer/history/:id
router.delete('/:id', historyController.deleteAnalysis);

// DELETE /api/v1/customer/history
router.delete('/', historyController.deleteAllAnalyses);

module.exports = router;