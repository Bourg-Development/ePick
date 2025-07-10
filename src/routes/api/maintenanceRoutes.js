// routes/api/maintenanceRoutes.js
const express = require('express');
const router = express.Router();
const maintenanceController = require('../../controllers/api/maintenanceController');
const authMiddleware = require('../../middleware/authentication');
const authorizationMiddleware = require('../../middleware/authorization');
const { apiRateLimit } = require('../../middleware/rateLimit');

/**
 * All maintenance routes require authentication and admin privileges
 */
router.use(authMiddleware.authenticate);
router.use(authorizationMiddleware.requirePermission('system.maintenance.manage'));

/**
 * Maintenance scheduling routes
 */

// Schedule new maintenance
router.post('/schedule',
    apiRateLimit,
    maintenanceController.scheduleMaintenance
);

// Get all scheduled maintenance
router.get('/scheduled',
    apiRateLimit,
    maintenanceController.getScheduledMaintenance
);

// Get specific maintenance record
router.get('/scheduled/:maintenanceId',
    apiRateLimit,
    maintenanceController.getMaintenanceById
);

// Update maintenance status
router.put('/scheduled/:maintenanceId/status',
    apiRateLimit,
    maintenanceController.updateMaintenanceStatus
);

// Cancel maintenance
router.put('/scheduled/:maintenanceId/cancel',
    apiRateLimit,
    maintenanceController.cancelMaintenance
);

// Send maintenance notification manually
router.post('/scheduled/:maintenanceId/notify',
    apiRateLimit,
    maintenanceController.sendMaintenanceNotification
);

// Process maintenance jobs (for cron/scheduler)
router.post('/process-jobs',
    apiRateLimit,
    maintenanceController.processMaintenanceJobs
);

/**
 * Maintenance mode routes
 */

// Get maintenance mode status
router.get('/mode/status',
    apiRateLimit,
    maintenanceController.getMaintenanceModeStatus
);

// Enable maintenance mode manually
router.post('/mode/enable',
    apiRateLimit,
    maintenanceController.enableMaintenanceMode
);

// Disable maintenance mode manually
router.post('/mode/disable',
    apiRateLimit,
    maintenanceController.disableMaintenanceMode
);

// Update maintenance mode message
router.put('/mode/message',
    apiRateLimit,
    maintenanceController.updateMaintenanceMessage
);

module.exports = router;