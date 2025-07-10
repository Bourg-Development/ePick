const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { apiRateLimit } = require('../../middleware/rateLimit');
const { validateRequest } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');
const notificationController = require('../../controllers/api/notificationController');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Get user notifications
router.get('/',
    apiRateLimit,
    [
        query('includeRead').optional().isBoolean().withMessage('includeRead must be a boolean'),
        query('includeDismissed').optional().isBoolean().withMessage('includeDismissed must be a boolean'),
        query('type').optional().isIn(['prescription_verification', 'recurring_analysis_due', 'analysis_cancelled', 'system_update', 'maintenance']).withMessage('Invalid notification type'),
        query('actionRequired').optional().isBoolean().withMessage('actionRequired must be a boolean'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
    ],
    validateRequest,
    notificationController.getUserNotifications
);

// Get notification counts
router.get('/counts',
    apiRateLimit,
    notificationController.getNotificationCounts
);

// Mark notification as read
router.patch('/:id/read',
    apiRateLimit,
    [
        param('id').isInt({ min: 1 }).withMessage('Valid notification ID is required')
    ],
    validateRequest,
    notificationController.markAsRead
);

// Mark multiple notifications as read
router.patch('/read-multiple',
    apiRateLimit,
    [
        body('notificationIds').isArray({ min: 1 }).withMessage('notificationIds must be a non-empty array'),
        body('notificationIds.*').isInt({ min: 1 }).withMessage('All notification IDs must be valid integers')
    ],
    validateRequest,
    notificationController.markMultipleAsRead
);

// Dismiss notification
router.patch('/:id/dismiss',
    apiRateLimit,
    [
        param('id').isInt({ min: 1 }).withMessage('Valid notification ID is required')
    ],
    validateRequest,
    notificationController.dismissNotification
);

// Get notification by ID
router.get('/:id',
    apiRateLimit,
    [
        param('id').isInt({ min: 1 }).withMessage('Valid notification ID is required')
    ],
    validateRequest,
    notificationController.getNotificationById
);

module.exports = router;