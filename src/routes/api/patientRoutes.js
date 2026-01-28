// routes/patientRoutes.js
const express = require('express');
const router = express.Router();
const patientController = require('../../controllers/api/patientController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All patient routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get patients with filtering and pagination
router.get('/',
    generalRateLimit,
    validation.validatePatientFilters,
    requirePermission('patients.view'),
    patientController.getPatients
);

// Search patients (must come before /:id route)
router.get('/search/:term',
    generalRateLimit,
    validation.validateSearchTerm,
    requirePermission('patients.view'),
    patientController.searchPatients
);

// Sync residents from external API (admin only)
router.post('/sync',
    generalRateLimit,
    requireRole(['admin', 'super_admin']),
    patientController.syncResidents
);

// Check resident API health status
router.get('/sync/health',
    generalRateLimit,
    requireRole(['admin', 'super_admin']),
    patientController.checkResidentApiHealth
);

// Get specific patient by ID
router.get('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('patients.view'),
    patientController.getPatientById
);

// Create new patient
router.post('/',
    generalRateLimit,
    validation.validatePatientCreate,
    requirePermission('patients.create'),
    patientController.createPatient
);

// Update patient
router.put('/:id',
    generalRateLimit,
    validation.validateId,
    validation.validatePatientUpdate,
    requirePermission('patients.update'),
    patientController.updatePatient
);

// Deactivate patient (soft delete)
router.delete('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('patients.delete'),
    patientController.deactivatePatient
);

// Reactivate patient
router.post('/:id/reactivate',
    generalRateLimit,
    validation.validateId,
    requirePermission('patients.update'),
    patientController.reactivatePatient
);

// Get patient's analysis history
router.get('/:id/analysis-history',
    generalRateLimit,
    validation.validateId,
    validation.validatePagination,
    requirePermission('patients.view'),
    patientController.getPatientAnalysisHistory
);


module.exports = router;