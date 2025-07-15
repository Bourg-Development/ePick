// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/api/adminController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { apiRateLimit, refCodeRateLimit, settingsRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All admin routes require authentication
 */
router.use(authMiddleware.authenticate);

/**
 * User creation and management
 */

// Create a new user
router.post('/user',
    apiRateLimit,
    requirePermission(['write.users', 'admin']),
    validation.validateUserCreation,
    adminController.createUser
);

// List users
router.get('/users',
    apiRateLimit,
    requirePermission(['read.users']),
    adminController.listUsers
);

// Export users to JSON
router.post('/users/export/json',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['read.users', 'read.all']),
    validation.validateUserExport,
    adminController.exportUsersJson
);

// Export users to CSV
router.post('/users/export/csv',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['read.users', 'read.all']),
    validation.validateUserExport,
    adminController.exportUsersCsv
);

// Export users to Excel
router.post('/users/export/excel',
    settingsRateLimit, // More restrictive rate limit for exports
    requirePermission(['read.users', 'read.all']),
    validation.validateUserExport,
    adminController.exportUsersExcel
);

// Get specific user
router.get('/user/:userId',
    apiRateLimit,
    requirePermission(['read.users']),
    adminController.getUser
);

// Get user audit logs
router.get('/user/:userId/audit-logs',
    apiRateLimit,
    requirePermission(['read.logs', 'read.all']),
    adminController.getUserAuditLogs
);

// Update user full name
router.put('/user/:userId/full-name',
    apiRateLimit,
    requirePermission(['write.users', 'admin']),
    validation.validateFullNameUpdate,
    adminController.updateUserFullName
);

// Update user role
router.put('/user/:userId/role',
    apiRateLimit,
    requirePermission(['manage.roles']),
    validation.validateRoleUpdate,
    adminController.updateUserRole
);

// Update user service
router.put('/user/:userId/service',
    apiRateLimit,
    requirePermission(['write.users']),
    validation.validateServiceUpdate,
    adminController.updateUserService
);

// Manage 2FA for a user
router.put('/user/:userId/two-factor',
    apiRateLimit,
    requireRole(['admin', 'system_admin']), // Admin or system admin operation
    validation.validate2FAUpdate,
    adminController.manageTwoFactor
);

// Lock or unlock a user account
router.put('/user/:userId/lock-status',
    apiRateLimit,
    requireRole(['admin', 'system_admin']), // Admin or system admin operation
    validation.validateLockStatus,
    adminController.toggleAccountLock
);

/**
 * Reference code management
 */

// Generate reference code for existing user
router.post('/reference-code',
    refCodeRateLimit,
    requirePermission(['write.users']),
    validation.validateReferenceCodeGenerationForExistingUser,
    adminController.generateReferenceCode
);

// List active reference codes
router.get('/reference-codes',
    apiRateLimit,
    requirePermission(['read.users']),
    adminController.listReferenceCodes
);

// Revoke a reference code
router.delete('/reference-code/:code',
    apiRateLimit,
    requirePermission(['write.users']),
    adminController.revokeReferenceCode
);

// Generate password reset code
router.post('/password-reset',
    apiRateLimit,
    requirePermission(['write.users', 'admin']),
    validation.validatePasswordResetGeneration,
    adminController.generatePasswordResetCode
);

/**
 * Service Management
 */

// Get all services
router.get('/services',
    apiRateLimit,
    adminController.getServices
);

// Get service by ID
router.get('/service/:serviceId',
    apiRateLimit,
    requirePermission(['services.view', 'admin']),
    adminController.getService
);

// Update service analysis permissions
router.put('/service/:serviceId/analysis-permissions',
    apiRateLimit,
    requireRole('admin'), // Admin-only operation
    validation.validateServiceAnalysisPermissions,
    adminController.updateServiceAnalysisPermissions
);

// Create new service
router.post('/service',
    apiRateLimit,
    requirePermission(['services.create', 'admin']),
    validation.validateServiceCreation,
    adminController.createService
);

// Update service
router.put('/service/:serviceId',
    apiRateLimit,
    requirePermission(['services.update', 'admin']),
    validation.validateServiceManagementUpdate,
    adminController.updateService
);

// Deactivate service
router.delete('/service/:serviceId',
    apiRateLimit,
    requirePermission(['services.delete', 'admin']),
    adminController.deactivateService
);

// Reactivate service
router.post('/service/:serviceId/reactivate',
    apiRateLimit,
    requirePermission(['services.update', 'admin']),
    adminController.reactivateService
);

// Get service statistics
router.get('/service/:serviceId/statistics',
    apiRateLimit,
    requirePermission(['services.view', 'admin']),
    adminController.getServiceStatistics
);

// Transfer users between services
router.post('/service/:serviceId/transfer-users',
    settingsRateLimit, // More restrictive rate limit for this operation
    requirePermission(['services.manage_users', 'admin']),
    validation.validateUserTransfer,
    adminController.transferUsers
);

// Search services
router.get('/services/search/:term',
    apiRateLimit,
    requirePermission(['services.view', 'admin']),
    adminController.searchServices
);

// Export services (legacy CSV/JSON)
router.post('/services/export',
    settingsRateLimit,
    requirePermission(['services.view', 'admin']),
    validation.validateExportRequest,
    adminController.exportServices
);

// Export services to Excel (Professional Format)
router.post('/services/export/excel',
    settingsRateLimit,
    requirePermission(['services.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportServicesExcel
);

/**
 * Room Management
 */

// Get all rooms
router.get('/rooms',
    apiRateLimit,
    validation.validateRoomFilters,
    adminController.getRooms
);

// Get room by ID
router.get('/rooms/:roomId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    adminController.getRoom
);

// Create new room
router.post('/rooms',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    validation.validateRoomCreate,
    adminController.createRoom
);

// Update room
router.put('/rooms/:roomId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    validation.validateRoomUpdate,
    adminController.updateRoom
);

// Delete room
router.delete('/rooms/:roomId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    adminController.deleteRoom
);

// Export rooms (legacy CSV/JSON)
router.post('/rooms/export',
    settingsRateLimit,
    requirePermission(['rooms.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportRooms
);

// Export rooms to Excel (Professional Format)
router.post('/rooms/export/excel',
    settingsRateLimit,
    requirePermission(['rooms.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportRoomsExcel
);

// Search rooms
router.get('/rooms/search/:term',
    apiRateLimit,
    validation.validateSearchTerm,
    requirePermission(['read.all', 'read.users']),
    adminController.searchRooms
);

/**
 * Patient Management
 */

// Get all patients
router.get('/patients',
    apiRateLimit,
    adminController.getPatients
);

// Get patient by ID
router.get('/patients/:patientId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    adminController.getPatient
);

// Create new patient
router.post('/patients',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    validation.validatePatientCreate,
    adminController.createPatient
);

// Update patient
router.put('/patients/:patientId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    validation.validatePatientUpdate,
    adminController.updatePatient
);

// Delete patient
router.delete('/patients/:patientId',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    adminController.deletePatient
);

// Get patient analysis history
router.get('/patients/:patientId/analyses',
    apiRateLimit,
    requireRole(['admin', 'system_admin']),
    adminController.getPatientAnalyses
);

// Export patients to JSON
router.post('/patients/export/json',
    settingsRateLimit,
    requirePermission(['patients.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportPatientsJson
);

// Export patients to CSV
router.post('/patients/export/csv',
    settingsRateLimit,
    requirePermission(['patients.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportPatientsCsv
);

// Export patients to Excel
router.post('/patients/export/excel',
    settingsRateLimit,
    requirePermission(['patients.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportPatientsExcel
);

/**
 * Doctor Management
 */

// Get all doctors
router.get('/doctors',
    apiRateLimit,
    adminController.getDoctors
);

// Export doctors to Excel
router.post('/doctors/export/excel',
    settingsRateLimit,
    requirePermission(['doctors.export', 'export.all']),
    validation.validateExportRequest,
    adminController.exportDoctorsExcel
);

// Get service users and rooms
router.get('/services/:serviceId/users',
    apiRateLimit,
    requirePermission(['services.view', 'admin']),
    adminController.getServiceUsers
);

router.get('/services/:serviceId/rooms',
    apiRateLimit,
    requirePermission(['services.view', 'admin']),
    adminController.getServiceRooms
);

/**
 * System information
 */

// Get roles list
router.get('/roles',
    apiRateLimit,
    adminController.getRoles
);

/**
 * Logs and monitoring
 */

// Get audit logs
router.get('/logs/audit',
    apiRateLimit,
    requirePermission(['read.logs', 'admin']),
    adminController.getAuditLogs
);

// Get security logs
router.get('/logs/security',
    apiRateLimit,
    requirePermission(['read.logs', 'access.security', 'admin']),
    adminController.getSecurityLogs
);

// Verify log integrity
router.get('/logs/verify-integrity',
    apiRateLimit,
    requirePermission(['access.security', 'admin']),
    adminController.verifyLogIntegrity
);

/**
 * System Administration (System Admin only)
 */
const systemController = require('../../controllers/api/systemController');

// System Statistics
router.get('/system/stats',
    apiRateLimit,
    requireRole('system_admin'),
    systemController.getSystemStats
);

// System Control
router.post('/system/maintenance',
    settingsRateLimit,
    requireRole('system_admin'),
    systemController.toggleMaintenanceMode
);

router.post('/system/clear-cache',
    settingsRateLimit,
    requireRole('system_admin'),
    systemController.clearCache
);

router.post('/system/shutdown',
    settingsRateLimit,
    requireRole('system_admin'),
    systemController.shutdownSystem
);

// System Logs
router.get('/system/logs/download',
    settingsRateLimit,
    requireRole('system_admin'),
    systemController.downloadLogs
);

router.get('/system/logs/:type',
    apiRateLimit,
    requireRole('system_admin'),
    systemController.getLogs
);

// Activity Monitoring
router.get('/system/events',
    apiRateLimit,
    requireRole('system_admin'),
    systemController.getSystemEvents
);

router.get('/system/user-activity',
    apiRateLimit,
    requireRole('system_admin'),
    systemController.getUserActivity
);

router.get('/system/error-logs',
    apiRateLimit,
    requireRole('system_admin'),
    systemController.getErrorLogs
);

module.exports = router;