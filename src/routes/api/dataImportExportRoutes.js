// routes/api/dataImportExportRoutes.js
const express = require('express');
const dataImportExportController = require('../../controllers/api/dataImportExportController');
const authMiddleware = require('../../middleware/authentication');
const authorizationMiddleware = require('../../middleware/authorization');
const rateLimitMiddleware = require('../../middleware/rateLimit');

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Apply rate limiting for import/export operations
const importExportRateLimit = rateLimitMiddleware.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // Limit to 10 import/export operations per 15 minutes
    errorMessage: 'Too many import/export requests. Please try again later.',
    logType: 'data_import_export'
});

/**
 * @route POST /api/data/:entityType/import
 * @desc Import data from uploaded file
 * @access Requires specific import permissions
 */
router.post('/:entityType/import',
    importExportRateLimit,
    dataImportExportController.importData
);

/**
 * @route GET /api/data/:entityType/export
 * @desc Export data to file
 * @access Requires specific export permissions
 */
router.get('/:entityType/export',
    importExportRateLimit,
    dataImportExportController.exportData
);

/**
 * @route GET /api/data/:entityType/template
 * @desc Get import template for entity type
 * @access Authenticated users
 */
router.get('/:entityType/template',
    dataImportExportController.getImportTemplate
);

/**
 * @route GET /api/data/history
 * @desc Get import/export history
 * @access Authenticated users (filtered by user unless admin)
 */
router.get('/history',
    dataImportExportController.getHistory
);

module.exports = router;