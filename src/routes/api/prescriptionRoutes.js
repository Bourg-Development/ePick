const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { apiRateLimit } = require('../../middleware/rateLimit');
const { validateRequest } = require('../../middleware/validation');
const { body, param } = require('express-validator');
const prescriptionController = require('../../controllers/api/prescriptionController');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Get validation data for a recurring analysis
router.get('/validate/:recurringAnalysisId',
    apiRateLimit,
    requirePermission('analyses:create'), // Using existing permission for now
    [
        param('recurringAnalysisId').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required')
    ],
    validateRequest,
    prescriptionController.getValidationData
);

// Validate a prescription for a recurring analysis
router.post('/validate/:recurringAnalysisId',
    apiRateLimit,
    requirePermission('analyses:create'),
    [
        param('recurringAnalysisId').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required'),
        body('prescriptionNumber').notEmpty().withMessage('Prescription number is required'),
        body('validFrom').isISO8601().withMessage('Valid from date is required'),
        body('validUntil').isISO8601().withMessage('Valid until date is required'),
        body('totalAnalysesPrescribed').isInt({ min: 1 }).withMessage('Total analyses prescribed must be at least 1'),
        body('validationNotes').optional().isString()
    ],
    validateRequest,
    prescriptionController.validatePrescription
);

// Get all prescriptions for a recurring analysis
router.get('/recurring-analysis/:recurringAnalysisId',
    apiRateLimit,
    requirePermission('analyses:view'),
    [
        param('recurringAnalysisId').isInt({ min: 1 }).withMessage('Valid recurring analysis ID is required')
    ],
    validateRequest,
    prescriptionController.getPrescriptions
);

// Update prescription status
router.patch('/:prescriptionId/status',
    apiRateLimit,
    requirePermission('analyses:create'),
    [
        param('prescriptionId').isInt({ min: 1 }).withMessage('Valid prescription ID is required'),
        body('status').isIn(['Active', 'Expired', 'Cancelled']).withMessage('Invalid status'),
        body('reason').notEmpty().withMessage('Reason is required')
    ],
    validateRequest,
    prescriptionController.updatePrescriptionStatus
);

// Check prescription needs (admin/system use)
router.get('/check-needs',
    apiRateLimit,
    requirePermission('admin:system'), 
    prescriptionController.checkPrescriptionNeeds
);

module.exports = router;