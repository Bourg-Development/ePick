// routes/analysisRoutes.js - Enhanced with export endpoints
const express = require('express');
const router = express.Router();
const analysisController = require('../../controllers/api/analysisController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit, settingsRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All analysis routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get analyses with filtering and pagination
router.get('/',
    generalRateLimit,
    validation.validateAnalysisFilters,
    requirePermission(['analyses.view', 'read.all']),
    analysisController.getAnalyses
);

// Create new analysis
router.post('/',
    generalRateLimit,
    validation.validateAnalysisCreate,
    requirePermission(['analyses.create', 'write.all']),
    analysisController.createAnalysis
);

// Get analysis audit logs (must come before /:id route)
router.get('/:id/audit-logs',
    generalRateLimit,
    validation.validateId,
    requirePermission(['analyses.view_audit_logs', 'analyses.view_all_audit_logs', 'admin']),
    analysisController.getAnalysisAuditLogs
);

// Get specific analysis by ID (moved after other specific routes)
router.get('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission(['analyses.view', 'read.all']),
    analysisController.getAnalysisById
);

// ===== EXPORT ENDPOINTS =====

// Export analyses to JSON
router.post('/export/json',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['analyses.view', 'analyses.export', 'read.all']),
    validation.validateExportRequest,
    analysisController.exportAnalysesJson
);

// Export analyses to CSV
router.post('/export/csv',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['analyses.view', 'analyses.export', 'read.all']),
    validation.validateExportRequest,
    analysisController.exportAnalysesCsv
);

// Export analyses to Excel
router.post('/export/excel',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['analyses.view', 'analyses.export', 'read.all']),
    validation.validateExportRequest,
    analysisController.exportAnalysesExcel
);

// ===== END EXPORT ENDPOINTS =====

// Update analysis status
router.put('/:id/status',
    generalRateLimit,
    validation.validateId,
    validation.validateAnalysisStatusUpdate,
    requirePermission(['analyses.update', 'write.all']),
    analysisController.updateAnalysisStatus
);

// Postpone analysis
router.post('/:id/postpone',
    generalRateLimit,
    validation.validateId,
    requirePermission(['analyses.update', 'write.all']),
    analysisController.postponeAnalysis
);

// Cancel analysis
router.post('/:id/cancel',
    generalRateLimit,
    validation.validateId,
    validation.validateAnalysisCancel,
    requirePermission(['analyses.cancel', 'write.all']),
    analysisController.cancelAnalysis
);

// Get analysis statistics
router.get('/reports/statistics',
    generalRateLimit,
    validation.validateDateRange,
    requirePermission(['analyses.view', 'read.all']),
    analysisController.getAnalysisStatistics
);

// Get dashboard data
router.get('/reports/dashboard',
    generalRateLimit,
    requirePermission('analyses.view'),
    analysisController.getDashboard
);

// Get next available date
router.get('/scheduling/next-available',
    generalRateLimit,
    validation.validateOptionalDate,
    requirePermission('analyses.create'),
    analysisController.getNextAvailableDate
);

module.exports = router;