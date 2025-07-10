const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { apiRateLimit } = require('../../middleware/rateLimit');
const { validateRequest } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');
const statusController = require('../../controllers/api/statusController');

// Public routes (no authentication required)

// Get public status data
router.get('/public',
    apiRateLimit,
    statusController.getPublicStatus
);

// Get health metrics (public)
router.get('/health',
    apiRateLimit,
    statusController.getHealthMetrics
);

// Admin-only routes (require authentication and permissions)
router.use(authMiddleware.authenticate);

// Check all system components
router.post('/check-all',
    apiRateLimit,
    requirePermission('admin:system'),
    statusController.checkAllComponents
);

// Check specific component
router.post('/check/:component',
    apiRateLimit,
    requirePermission('admin:system'),
    [
        param('component').notEmpty().withMessage('Component name is required')
    ],
    validateRequest,
    statusController.checkComponent
);

// Update component status
router.patch('/components/:component',
    apiRateLimit,
    requirePermission('admin:system'),
    [
        param('component').notEmpty().withMessage('Component name is required'),
        body('status').isIn(['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'])
            .withMessage('Invalid status value'),
        body('error_message').optional().isString(),
        body('response_time').optional().isNumeric(),
        body('metadata').optional().isObject()
    ],
    validateRequest,
    statusController.updateComponentStatus
);

// Get all incidents (admin only)
router.get('/incidents',
    apiRateLimit,
    requirePermission('admin:system'),
    [
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
        query('status').optional().isIn(['investigating', 'identified', 'monitoring', 'resolved', 'postmortem'])
    ],
    validateRequest,
    statusController.getAllIncidents
);

// Create new incident
router.post('/incidents',
    apiRateLimit,
    requirePermission('admin:system'),
    [
        body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }),
        body('description').notEmpty().withMessage('Description is required'),
        body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
        body('impact').optional().isIn(['none', 'minor', 'major', 'critical']),
        body('affected_components').optional().isArray(),
        body('is_public').optional().isBoolean()
    ],
    validateRequest,
    statusController.createIncident
);

// Update incident
router.patch('/incidents/:incidentId',
    apiRateLimit,
    requirePermission('admin:system'),
    [
        param('incidentId').isInt({ min: 1 }).withMessage('Valid incident ID is required'),
        body('status').optional().isIn(['investigating', 'identified', 'monitoring', 'resolved', 'postmortem']),
        body('message').optional().notEmpty().withMessage('Message cannot be empty'),
        body('is_public').optional().isBoolean()
    ],
    validateRequest,
    statusController.updateIncident
);

module.exports = router;