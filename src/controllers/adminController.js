// controllers/adminController.js
const userService = require('../services/userService');
const referenceCodeService = require('../services/referenceCodeService');
const logService = require('../services/logService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');

/**
 * Admin controller for managing users, roles, and reference codes
 */
class AdminController {
    /**
     * Generate a reference code for user creation
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generateReferenceCode(req, res) {
        try {
            // Only users with admin or write.users permission can generate reference codes
            const { userId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const {
                username,
                roleId,
                serviceId,
                email,
                require2FA = false
            } = req.body;

            // Validate request
            if (!username || !roleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and role ID are required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Generate reference code
            const result = await referenceCodeService.generateReferenceCode({
                username,
                roleId,
                serviceId,
                email,
                require2FA,
                createdBy: userId
            }, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Generate reference code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate reference code'
            });
        }
    }

    /**
     * List active reference codes
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async listReferenceCodes(req, res) {
        try {
            // Only users with admin, read.users, or manage.refcodes permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('read.users') &&
                !permissions.includes('admin') &&
                !permissions.includes('manage.refcodes')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Get filter by creator if param is provided
            const createdBy = req.query.createdBy ? parseInt(req.query.createdBy) : null;

            // For non-admin users, only show their own generated codes
            const filterCreator = !permissions.includes('admin') ? userId : createdBy;

            // List active reference codes
            const result = await referenceCodeService.listActiveCodes(filterCreator);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('List reference codes error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to list reference codes'
            });
        }
    }

    /**
     * Revoke a reference code
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async revokeReferenceCode(req, res) {
        try {
            // Only users with admin or manage.refcodes permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('manage.refcodes') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { code } = req.params;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: 'Reference code is required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Revoke reference code
            const result = await referenceCodeService.revokeReferenceCode(
                code,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Revoke reference code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to revoke reference code'
            });
        }
    }

    /**
     * Generate a password reset code for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generatePasswordResetCode(req, res) {
        try {
            // Only users with admin or write.users permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { targetUserId, require2FA = false } = req.body;

            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Target user ID is required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Generate password reset code
            const result = await referenceCodeService.generatePasswordResetCode(
                targetUserId,
                userId,
                require2FA,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Generate password reset code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate password reset code'
            });
        }
    }

    /**
     * Get list of users
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async listUsers(req, res) {
        try {
            // Only users with admin or read.users permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const filters = {
                username: req.query.username,
                roleId: req.query.roleId ? parseInt(req.query.roleId) : null,
                serviceId: req.query.serviceId ? parseInt(req.query.serviceId) : null
            };

            // Get users
            const result = await userService.getUsers(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('List users error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to list users'
            });
        }
    }

    /**
     * Get a specific user by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getUser(req, res) {
        try {
            // Only users with admin or read.users permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Get user
            const result = await userService.getUserById(parseInt(userId));

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get user error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get user'
            });
        }
    }

    /**
     * Update a user's role
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateUserRole(req, res) {
        try {
            // Only users with admin or manage.roles permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('manage.roles') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { roleId } = req.body;

            if (!userId || !roleId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and role ID are required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Update user role
            const result = await userService.updateUserRole(
                parseInt(userId),
                parseInt(roleId),
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update user role error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user role'
            });
        }
    }

    /**
     * Update a user's service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateUserService(req, res) {
        try {
            // Only users with admin or write.users permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { serviceId } = req.body;

            if (!userId || serviceId === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and service ID are required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Update user service
            const result = await userService.updateUserService(
                parseInt(userId),
                serviceId ? parseInt(serviceId) : null,
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update user service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user service'
            });
        }
    }

    /**
     * Enable or disable 2FA for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async manageTwoFactor(req, res) {
        try {
            // Only users with admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const {
                totpEnabled = false,
                webauthnEnabled = false,
                require2FA = false
            } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Update 2FA settings
            const result = await userService.updateTwoFactorSettings(
                parseInt(userId),
                {
                    totpEnabled,
                    webauthnEnabled,
                    require2FA
                },
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Manage 2FA error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to manage 2FA settings'
            });
        }
    }

    /**
     * Lock or unlock a user account
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async toggleAccountLock(req, res) {
        try {
            // Only users with admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { locked, reason } = req.body;

            if (!userId || locked === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and lock status are required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Lock or unlock account
            const result = await userService.setAccountLockStatus(
                parseInt(userId),
                locked,
                reason || 'Administrative action',
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Toggle account lock error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update account lock status'
            });
        }
    }

    /**
     * Get roles list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getRoles(req, res) {
        try {
            // All authenticated users can read roles
            const result = await userService.getRoles();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get roles error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get roles'
            });
        }
    }

    /**
     * Get audit logs
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAuditLogs(req, res) {
        try {
            // Only users with admin or read.logs permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.logs') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                userId: req.query.userId ? parseInt(req.query.userId) : null,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get audit logs
            const result = await logService.getAuditLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get audit logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve audit logs'
            });
        }
    }

    /**
     * Get security logs
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSecurityLogs(req, res) {
        try {
            // Only users with admin, read.logs, or access.security permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.logs') &&
                !permissions.includes('admin') &&
                !permissions.includes('access.security')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                severity: req.query.severity,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get security logs
            const result = await logService.getSecurityLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get security logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve security logs'
            });
        }
    }

    /**
     * Verify log integrity
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyLogIntegrity(req, res) {
        try {
            // Only users with admin or access.security permission
            const { permissions } = req.auth;

            if (!permissions.includes('access.security') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { logType = 'audit', startId, endId } = req.query;

            // Verify log integrity
            const result = await logService.verifyLogIntegrity(
                logType,
                startId ? parseInt(startId) : null,
                endId ? parseInt(endId) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Verify log integrity error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify log integrity'
            });
        }
    }

    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }
}

module.exports = new AdminController();