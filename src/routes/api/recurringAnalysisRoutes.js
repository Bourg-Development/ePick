const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { apiRateLimit } = require('../../middleware/rateLimit');
const { validateRequest } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');
const recurringAnalysisController = require('../../controllers/api/recurringAnalysisController');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Create recurring analysis
router.post('/',
    apiRateLimit,
    requirePermission(['recurring_analyses.create', 'analyses.create', 'write.all']),
    [
        body('analysisDate').isISO8601().withMessage('Valid analysis date is required'),
        body('patientId').isInt({ min: 1 }).withMessage('Valid patient ID is required'),
        body('doctorId').isInt({ min: 1 }).withMessage('Valid doctor ID is required'),
        body('roomId').isInt({ min: 1 }).withMessage('Valid room ID is required'),
        body('analysisType').isIn(['XY', 'YZ', 'ZG', 'HG']).withMessage('Valid analysis type is required'),
        body('recurrencePattern').isIn(['daily', 'weekly', 'monthly', 'custom']).withMessage('Valid recurrence pattern is required'),
        body('totalOccurrences').isInt({ min: 2, max: 100 }).withMessage('Total occurrences must be between 2 and 100'),
        body('intervalDays').optional().isInt({ min: 1, max: 365 }).withMessage('Interval days must be between 1 and 365'),
        body('calculatedDates').optional().isArray().withMessage('Calculated dates must be an array'),
        body('calculatedDates.*').optional().isISO8601().withMessage('Each calculated date must be a valid ISO8601 date'),
        body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
    ],
    validateRequest,
    recurringAnalysisController.createRecurringAnalysis
);

// Get recurring analysis details
router.get('/:id',
    apiRateLimit,
    requirePermission(['recurring_analyses.view', 'analyses.view', 'read.all']),
    [
        param('id').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required')
    ],
    validateRequest,
    recurringAnalysisController.getRecurringAnalysis
);

// Get analyses for recurring pattern
router.get('/:id/analyses',
    apiRateLimit,
    requirePermission(['recurring_analyses.view', 'analyses.view', 'read.all']),
    [
        param('id').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required')
    ],
    validateRequest,
    recurringAnalysisController.getAnalysesForPattern
);

// Deactivate recurring analysis
router.patch('/:id/deactivate',
    apiRateLimit,
    requirePermission(['recurring_analyses.deactivate', 'recurring_analyses.update', 'write.all']),
    [
        param('id').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required'),
        body('reason').notEmpty().withMessage('Deactivation reason is required')
            .isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
    ],
    validateRequest,
    recurringAnalysisController.deactivateRecurringAnalysis
);

// Process due recurring analyses (admin only)
router.post('/process-due',
    apiRateLimit,
    requirePermission(['write.all']),
    recurringAnalysisController.processDueAnalyses
);

// Get user's recurring analyses
router.get('/user/mine',
    apiRateLimit,
    requirePermission(['recurring_analyses.view', 'analyses.view', 'read.all']),
    [
        query('active').optional().isBoolean().withMessage('Active must be a boolean'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
    ],
    validateRequest,
    recurringAnalysisController.getUserRecurringAnalyses
);

module.exports = router;