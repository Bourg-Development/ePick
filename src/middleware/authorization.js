// middleware/authorization.js
const logService = require('../services/logService');

/**
 * Factory function to create permission-based authorization middleware
 * @param {string|string[]} requiredPermissions - Permission(s) required to access the route
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermissions) => {
    // Normalize to array
    const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

    // Return middleware function
    return async (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.auth || !req.auth.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { userId, username, role, permissions: userPermissions } = req.auth;

            // Admin role has full access to everything
            if (role === 'admin') {
                return next();
            }

            // Check if user has any of the required permissions
            const hasPermission = permissions.some(permission =>
                userPermissions.includes(permission)
            );

            if (!hasPermission) {
                // Log authorization failure
                await logService.securityLog({
                    eventType: 'authorization.denied',
                    severity: 'medium',
                    userId,
                    ipAddress: req.ip,
                    deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                    metadata: {
                        username,
                        role,
                        requiredPermissions: permissions,
                        userPermissions,
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            return next();
        } catch (error) {
            console.error('Authorization middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
};

/**
 * Factory function to create role-based authorization middleware
 * @param {string|string[]} allowedRoles - Role(s) allowed to access the route
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
    // Normalize to array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Return middleware function
    return async (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.auth || !req.auth.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const { userId, username, role } = req.auth;

            // Check if user's role is allowed
            if (!roles.includes(role)) {
                // Log authorization failure
                await logService.securityLog({
                    eventType: 'authorization.role_denied',
                    severity: 'medium',
                    userId,
                    ipAddress: req.ip,
                    deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                    metadata: {
                        username,
                        role,
                        allowedRoles: roles,
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            return next();
        } catch (error) {
            console.error('Role authorization middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
};

module.exports = {
    requirePermission,
    requireRole
};