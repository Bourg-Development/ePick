const express = require('express');
const router = express.Router();
const systemUpdateController = require('../../controllers/api/systemUpdateController');
const { requirePermission } = require('../../middleware/authorization');
const { validateRequest } = require('../../middleware/validation');
const authMiddleware = require('../../middleware/authentication');
const { body, param, query } = require('express-validator');

/**
 * All system update routes require authentication
 */
router.use(authMiddleware.authenticate);

// Validation rules
const createUpdateValidation = [
    body('version')
        .trim()
        .notEmpty()
        .withMessage('Version is required')
        .isLength({ max: 50 })
        .withMessage('Version must be at most 50 characters'),
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 255 })
        .withMessage('Title must be at most 255 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must be at most 2000 characters'),
    body('changes')
        .optional()
        .isArray()
        .withMessage('Changes must be an array'),
    body('release_type')
        .optional()
        .isIn(['major', 'minor', 'patch', 'hotfix'])
        .withMessage('Invalid release type'),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid priority'),
    body('requires_acknowledgment')
        .optional()
        .isBoolean()
        .withMessage('Requires acknowledgment must be a boolean'),
    body('show_popup')
        .optional()
        .isBoolean()
        .withMessage('Show popup must be a boolean'),
    body('popup_duration_days')
        .optional()
        .isInt({ min: 1, max: 30 })
        .withMessage('Popup duration must be between 1 and 30 days')
];

const updateValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid update ID'),
    body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Title cannot be empty')
        .isLength({ max: 255 })
        .withMessage('Title must be at most 255 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must be at most 2000 characters'),
    body('changes')
        .optional()
        .isArray()
        .withMessage('Changes must be an array')
];

const idValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid update ID')
];

const filterValidation = [
    query('status')
        .optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Invalid status filter'),
    query('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid priority filter')
];

// Admin routes - require admin permissions  
router.post('/',
    requirePermission('write.all'),
    createUpdateValidation,
    validateRequest,
    systemUpdateController.createUpdate
);

router.get('/',
    systemUpdateController.getUpdates
);

router.get('/:id',
    requirePermission('read.all'),
    idValidation,
    validateRequest,
    systemUpdateController.getUpdateById
);

router.put('/:id',
    requirePermission('write.all'),
    updateValidation,
    validateRequest,
    systemUpdateController.updateUpdate
);

router.post('/:id/publish',
    requirePermission('write.all'),
    idValidation,
    validateRequest,
    systemUpdateController.publishUpdate
);

router.delete('/:id',
    requirePermission('write.all'),
    idValidation,
    validateRequest,
    systemUpdateController.deleteUpdate
);

router.get('/:id/stats',
    requirePermission('read.all'),
    idValidation,
    validateRequest,
    systemUpdateController.getAcknowledmentStats
);

router.post('/:id/resend-notifications',
    requirePermission('write.all'),
    idValidation,
    validateRequest,
    systemUpdateController.resendNotifications
);

// User routes - available to all authenticated users
router.get('/user/pending',
    systemUpdateController.getPendingUpdates
);

router.post('/:id/acknowledge',
    idValidation,
    validateRequest,
    systemUpdateController.acknowledgeUpdate
);

router.post('/:id/popup-shown',
    idValidation,
    validateRequest,
    systemUpdateController.markPopupShown
);

// GitHub Integration routes - require admin permissions
router.post('/sync-github',
    requirePermission('write.all'),
    systemUpdateController.syncGitHub
);

router.get('/github-status',
    systemUpdateController.getGitHubStatus
);

router.post('/import-github/:tag',
    requirePermission('write.all'),
    param('tag').trim().notEmpty().withMessage('Release tag is required'),
    validateRequest,
    systemUpdateController.importGitHubRelease
);

router.post('/auto-publish-github',
    requirePermission('write.all'),
    systemUpdateController.autoPublishGitHubReleases
);

module.exports = router;