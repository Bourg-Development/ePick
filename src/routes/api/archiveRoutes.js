// routes/archiveRoutes.js
const express = require('express');
const router = express.Router();
const archiveController = require('../../controllers/api/archiveController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All archive routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get archived analyses with filtering and pagination
router.get('/',
    generalRateLimit,
    validation.validateArchiveFilters,
    requirePermission('archived_analyses.view'),
    archiveController.getArchivedAnalyses
);

// Get specific archived analysis by ID
router.get('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('archived_analyses.view'),
    archiveController.getArchivedAnalysisById
);

// Search archived analyses
router.get('/search/:term',
    generalRateLimit,
    validation.validateSearchTerm,
    requirePermission('archived_analyses.view'),
    archiveController.searchArchivedAnalyses
);

// Get patient's archived analysis history
router.get('/patient/:patientId',
    generalRateLimit,
    validation.validateId,
    validation.validatePagination,
    requirePermission('archived_analyses.view'),
    archiveController.getPatientArchivedHistory
);

// Get doctor's archived analysis history
router.get('/doctor/:doctorId',
    generalRateLimit,
    validation.validateId,
    validation.validatePagination,
    requirePermission('archived_analyses.view'),
    archiveController.getDoctorArchivedHistory
);

// Export archived analyses
router.post('/export',
    generalRateLimit,
    validation.validateExportRequest,
    requirePermission('archived_analyses.export'),
    archiveController.exportArchivedAnalyses
);

// Clean up old archived analyses (admin only)
router.delete('/cleanup',
    generalRateLimit,
    validation.validateCleanupRequest,
    requirePermission('archived_analyses.cleanup'),
    archiveController.cleanupOldArchives
);

module.exports = router;