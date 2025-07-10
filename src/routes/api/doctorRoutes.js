// routes/doctorRoutes.js
const express = require('express');
const router = express.Router();
const doctorController = require('../../controllers/api/doctorController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All doctor routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get doctors with filtering and pagination
router.get('/',
    generalRateLimit,
    validation.validateDoctorFilters,
    requirePermission('doctors.view'),
    doctorController.getDoctors
);

// Get specific doctor by ID
router.get('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('doctors.view'),
    doctorController.getDoctorById
);

// Create new doctor
router.post('/',
    generalRateLimit,
    validation.validateDoctorCreate,
    requirePermission('doctors.create'),
    doctorController.createDoctor
);

// Update doctor
router.put('/:id',
    generalRateLimit,
    validation.validateId,
    validation.validateDoctorUpdate,
    requirePermission('doctors.update'),
    doctorController.updateDoctor
);

// Deactivate doctor (soft delete)
router.delete('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('doctors.delete'),
    doctorController.deactivateDoctor
);

// Reactivate doctor
router.post('/:id/reactivate',
    generalRateLimit,
    validation.validateId,
    requirePermission('doctors.update'),
    doctorController.reactivateDoctor
);

// Get doctor's schedule
router.get('/:id/schedule',
    generalRateLimit,
    validation.validateId,
    validation.validateDateRange,
    requirePermission('doctors.view'),
    doctorController.getDoctorSchedule
);

// Get doctor statistics
router.get('/:id/statistics',
    generalRateLimit,
    validation.validateId,
    validation.validateDateRange,
    requirePermission('doctors.view'),
    doctorController.getDoctorStatistics
);

// Search doctors
router.get('/search/:term',
    generalRateLimit,
    validation.validateSearchTerm,
    requirePermission('doctors.view'),
    doctorController.searchDoctors
);

module.exports = router;