// routes/orgRoutes.js - Enhanced with export endpoints
const express = require('express');
const router = express.Router();
const organizationSettingsController = require('../../controllers/api/orgController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit, exportRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All organization settings routes require authentication
 */
router.use(authMiddleware.authenticate);

// ===== ANALYSIS TYPES ROUTES =====

// Get analysis types
router.get('/analysis-types',
    generalRateLimit,
    requirePermission(['analyses.view', 'organization_settings.view']),
    organizationSettingsController.getAnalysisTypes
);

// Update analysis types
router.put('/analysis-types',
    generalRateLimit,
    requirePermission('organization_settings.update'),
    organizationSettingsController.updateAnalysisTypes
);

// ===== EXISTING ROUTES =====

// Get all organization settings
router.get('/',
    generalRateLimit,
    requirePermission('organization_settings.view'),
    organizationSettingsController.getAllSettings
);

// Get specific setting by key
router.get('/:key',
    generalRateLimit,
    validation.validateSettingKey,
    requirePermission('organization_settings.view'),
    organizationSettingsController.getSetting
);

// Create new setting
router.post('/',
    generalRateLimit,
    validation.validateSettingCreate,
    requirePermission('organization_settings.create'),
    organizationSettingsController.createSetting
);

// Update specific setting
router.put('/:key',
    generalRateLimit,
    validation.validateSettingKey,
    validation.validateSettingUpdate,
    requirePermission('organization_settings.update'),
    organizationSettingsController.updateSetting
);

// Delete specific setting
router.delete('/:key',
    generalRateLimit,
    validation.validateSettingKey,
    requirePermission('organization_settings.delete'),
    organizationSettingsController.deleteSetting
);

// Get system configuration
router.get('/system/configuration',
    generalRateLimit,
    requirePermission('organization_settings.view'),
    organizationSettingsController.getSystemConfiguration
);

// Update multiple settings at once
router.put('/bulk/update',
    generalRateLimit,
    validation.validateBulkSettingsUpdate,
    requirePermission('organization_settings.update'),
    organizationSettingsController.updateMultipleSettings
);

// ===== NEW EXPORT ROUTES =====

// Export organization settings to JSON format
router.post('/export/json',
    exportRateLimit || generalRateLimit,
    requirePermission('organization_settings.view'),
    validation.validateExportRequest || ((req, res, next) => next()), // Optional validation
    organizationSettingsController.exportSettingsJson
);

// Export organization settings to CSV format
router.post('/export/csv',
    exportRateLimit || generalRateLimit,
    requirePermission('organization_settings.view'),
    validation.validateExportRequest || ((req, res, next) => next()), // Optional validation
    organizationSettingsController.exportSettingsCsv
);

// Export organization settings to Excel format
router.post('/export/excel',
    exportRateLimit || generalRateLimit,
    requirePermission('organization_settings.view'),
    validation.validateExportRequest || ((req, res, next) => next()), // Optional validation
    organizationSettingsController.exportSettingsExcel
);

// Unified export endpoint (supports all formats)
router.post('/export',
    exportRateLimit || generalRateLimit,
    requirePermission('organization_settings.view'),
    validation.validateExportRequest || ((req, res, next) => next()), // Optional validation
    organizationSettingsController.exportSettings
);

module.exports = router;