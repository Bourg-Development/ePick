// routes/logRoutes.js
const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const authenticate = require('../middleware/authentication');
const { requirePermission } = require('../middleware/authorization');
const { apiRateLimit } = require('../middleware/rateLimit');

/**
 * All log routes require authentication
 */
router.use(authenticate);

/**
 * Personal log routes (available to all authenticated users)
 */

// Get personal audit logs
router.get('/personal',
    apiRateLimit,
    logController.getPersonalLogs
);

/**
 * Admin log routes (require special permissions)
 */

// Get all audit logs
router.get('/audit',
    apiRateLimit,
    requirePermission(['read.logs', 'admin']),
    logController.getAuditLogs
);

// Get security logs
router.get('/security',
    apiRateLimit,
    requirePermission(['read.logs', 'access.security', 'admin']),
    logController.getSecurityLogs
);

// Verify log integrity
router.get('/verify-integrity',
    apiRateLimit,
    requirePermission(['access.security', 'admin']),
    logController.verifyLogIntegrity
);

// Get event statistics
router.get('/stats',
    apiRateLimit,
    requirePermission(['read.logs', 'admin']),
    logController.getEventStats
);

// Get security alert status
router.get('/security-alerts',
    apiRateLimit,
    requirePermission(['access.security', 'admin']),
    logController.getSecurityAlertStatus
);

module.exports = router;