// routes/api/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/api/dashboardController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { generalRateLimit } = require('../../middleware/rateLimit');

/**
 * All dashboard routes require authentication
 */
router.use(authMiddleware.authenticate);

/**
 * Dashboard metrics and statistics
 */

// Get comprehensive dashboard metrics
router.get('/metrics',
    generalRateLimit,
    requirePermission(['read.all', 'analyses.view']),
    dashboardController.getDashboardMetrics
);

// Get today's schedule
router.get('/schedule/today',
    generalRateLimit,
    requirePermission(['read.all', 'analyses.view']),
    dashboardController.getTodaySchedule
);

// Get recent activity
router.get('/activity',
    generalRateLimit,
    requirePermission(['read.all', 'audit.view']),
    dashboardController.getRecentActivity
);

// Get performance chart data
router.get('/performance',
    generalRateLimit,
    requirePermission(['read.all', 'analyses.view']),
    dashboardController.getPerformanceData
);

// Get analysis types distribution
router.get('/analysis-types',
    generalRateLimit,
    requirePermission(['read.all', 'analyses.view']),
    dashboardController.getAnalysisTypesDistribution
);

module.exports = router;