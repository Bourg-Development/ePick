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
            
            // Debug logging for permission issues
            console.log('Authorization check:', {
                userId,
                username, 
                role,
                userPermissions,
                requiredPermissions: permissions,
                path: req.path
            });

            // Check if any required permission is a system permission
            const hasSystemPermission = permissions.some(permission => 
                permission.startsWith('system.')
            );

            // If system permission is required, only system_admin can access
            if (hasSystemPermission && role !== 'system_admin') {
                // Log system permission denial
                await logService.securityLog({
                    eventType: 'authorization.system_permission_denied',
                    severity: 'high',
                    userId,
                    ipAddress: req.ip,
                    deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                    metadata: {
                        username,
                        role,
                        requiredPermissions: permissions,
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(403).json({
                    success: false,
                    message: 'System permission required'
                });
            }

            // System admin has full access to everything
            if (role === 'system_admin') {
                return next();
            }

            // Regular admin has access to non-system permissions
            if (role === 'admin' && !hasSystemPermission) {
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

            // Debug logging for role check
            console.log('Role check:', {
                userId,
                username,
                role,
                allowedRoles: roles,
                path: req.path
            });

            // System admin can access any role-restricted endpoint
            if (role === 'system_admin') {
                console.log('System admin access granted');
                return next();
            }

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