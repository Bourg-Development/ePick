// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/authentication');
const { requirePermission, requireRole } = require('../middleware/authorization');
const { apiRateLimit, refCodeRateLimit } = require('../middleware/rateLimit');
const validation = require('../middleware/validation');

/**
 * All admin routes require authentication
 */
router.use(authenticate);

/**
 * Reference code management
 */

// Generate reference code for user creation
router.post('/reference-code',
    refCodeRateLimit,
    requirePermission(['write.users', 'admin']),
    validation.validateReferenceCodeGeneration,
    adminController.generateReferenceCode
);

// List active reference codes
router.get('/reference-codes',
    apiRateLimit,
    requirePermission(['read.users', 'manage.refcodes', 'admin']),
    adminController.listReferenceCodes
);

// Revoke a reference code
router.delete('/reference-code/:code',
    apiRateLimit,
    requirePermission(['manage.refcodes', 'admin']),
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
 * User management
 */

// List users
router.get('/users',
    apiRateLimit,
    requirePermission(['read.users', 'admin']),
    adminController.listUsers
);

// Get specific user
router.get('/user/:userId',
    apiRateLimit,
    requirePermission(['read.users', 'admin']),
    adminController.getUser
);

// Update user role
router.put('/user/:userId/role',
    apiRateLimit,
    requirePermission(['manage.roles', 'admin']),
    validation.validateRoleUpdate,
    adminController.updateUserRole
);

// Update user service
router.put('/user/:userId/service',
    apiRateLimit,
    requirePermission(['write.users', 'admin']),
    validation.validateServiceUpdate,
    adminController.updateUserService
);

// Manage 2FA for a user
router.put('/user/:userId/two-factor',
    apiRateLimit,
    requireRole('admin'), // Admin-only operation
    validation.validate2FAUpdate,
    adminController.manageTwoFactor
);

// Lock or unlock a user account
router.put('/user/:userId/lock-status',
    apiRateLimit,
    requireRole('admin'), // Admin-only operation
    validation.validateLockStatus,
    adminController.toggleAccountLock
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

module.exports = router;