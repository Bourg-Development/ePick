// services/userService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const cryptoService = require('./cryptoService');

/**
 * Service for user management operations
 */
class UserService {
    /**
     * Get user by ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} User data or error
     */
    async getUserById(userId) {
        try {
            const user = await db.User.findByPk(userId, {
                include: [
                    { model: db.Role, include: [db.Permission] },
                    { model: db.Service }
                ]
            });

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            return {
                success: true,
                data: user
            };
        } catch (error) {
            console.error('Get user error:', error);
            return {
                success: false,
                message: 'Failed to retrieve user'
            };
        }
    }

    /**
     * Get user by username
     * @param {string} username - Username (6 digits)
     * @returns {Promise<Object>} User data or error
     */
    async getUserByUsername(username) {
        try {
            const user = await db.User.findOne({
                where: { username },
                include: [
                    { model: db.Role, include: [db.Permission] },
                    { model: db.Service }
                ]
            });

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            return {
                success: true,
                data: user
            };
        } catch (error) {
            console.error('Get user by username error:', error);
            return {
                success: false,
                message: 'Failed to retrieve user'
            };
        }
    }

    /**
     * Get users with optional filtering
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.username] - Filter by username
     * @param {number} [filters.roleId] - Filter by role ID
     * @param {number} [filters.serviceId] - Filter by service ID
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated users
     */
    async getUsers(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            // Apply filters
            if (filters.username) {
                whereClause.username = { [Op.like]: `%${filters.username}%` };
            }

            if (filters.roleId) {
                whereClause.role_id = filters.roleId;
            }

            if (filters.serviceId) {
                whereClause.service_id = filters.serviceId;
            }

            const offset = (page - 1) * limit;

            // Get users with pagination
            const { count, rows } = await db.User.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: db.Role,
                        attributes: ['id', 'name']
                    },
                    {
                        model: db.Service,
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        model: db.User,
                        as: 'Creator',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset,
                // Exclude sensitive data
                attributes: {
                    exclude: ['password_hash', 'salt', 'totp_secret', 'webauthn_credentials']
                }
            });

            return {
                success: true,
                users: rows,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get users error:', error);
            return {
                success: false,
                message: 'Failed to retrieve users'
            };
        }
    }

    /**
     * Update user's role
     * @param {number} userId - User ID
     * @param {number} roleId - New role ID
     * @param {number} adminId - Admin performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateUserRole(userId, roleId, adminId, context) {
        try {
            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Find role
            const role = await db.Role.findByPk(roleId);

            if (!role) {
                return {
                    success: false,
                    message: 'Role not found'
                };
            }

            // Store old role for logging
            const oldRoleId = user.role_id;

            // Update role
            user.role_id = roleId;
            await user.save();

            // Log the change
            await logService.auditLog({
                eventType: 'user.role_updated',
                userId: adminId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    oldRoleId,
                    newRoleId: roleId,
                    roleName: role.name,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'User role updated successfully'
            };
        } catch (error) {
            console.error('Update role error:', error);
            return {
                success: false,
                message: 'Failed to update user role'
            };
        }
    }

    /**
     * Update user's service
     * @param {number} userId - User ID
     * @param {number|null} serviceId - New service ID or null
     * @param {number} adminId - Admin performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateUserService(userId, serviceId, adminId, context) {
        try {
            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // If serviceId is provided, verify it exists
            let serviceName = null;
            if (serviceId !== null) {
                const service = await db.Service.findByPk(serviceId);

                if (!service) {
                    return {
                        success: false,
                        message: 'Service not found'
                    };
                }

                serviceName = service.name;
            }

            // Store old service for logging
            const oldServiceId = user.service_id;

            // Update service
            user.service_id = serviceId;
            await user.save();

            // Log the change
            await logService.auditLog({
                eventType: 'user.service_updated',
                userId: adminId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    oldServiceId,
                    newServiceId: serviceId,
                    serviceName,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'User service updated successfully'
            };
        } catch (error) {
            console.error('Update service error:', error);
            return {
                success: false,
                message: 'Failed to update user service'
            };
        }
    }

    /**
     * Update user's email
     * @param {number} userId - User ID
     * @param {string} email - New email
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateUserEmail(userId, email, context) {
        try {
            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Validate email format
            if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return {
                    success: false,
                    message: 'Invalid email format'
                };
            }

            // Store old email for logging
            const oldEmail = user.email;

            // Update email
            user.email = email;
            await user.save();

            // Log the change
            await logService.auditLog({
                eventType: 'user.email_updated',
                userId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    oldEmail,
                    newEmail: email,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Email updated successfully'
            };
        } catch (error) {
            console.error('Update email error:', error);
            return {
                success: false,
                message: 'Failed to update email'
            };
        }
    }

    /**
     * Update two-factor authentication settings
     * @param {number} userId - User ID
     * @param {Object} settings - 2FA settings
     * @param {boolean} [settings.totpEnabled] - Enable/disable TOTP
     * @param {boolean} [settings.webauthnEnabled] - Enable/disable WebAuthn
     * @param {boolean} [settings.require2FA] - Require 2FA on next login
     * @param {number} adminId - Admin performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateTwoFactorSettings(userId, settings, adminId, context) {
        try {
            const { totpEnabled, webauthnEnabled, require2FA } = settings;

            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Store old settings for logging
            const oldSettings = {
                totpEnabled: user.totp_enabled,
                webauthnEnabled: user.webauthn_enabled
            };

            // Update settings if provided
            let updated = false;

            if (totpEnabled !== undefined) {
                user.totp_enabled = totpEnabled;
                updated = true;

                // If disabling TOTP, clear the secret
                if (!totpEnabled) {
                    user.totp_secret = null;
                }
            }

            if (webauthnEnabled !== undefined) {
                user.webauthn_enabled = webauthnEnabled;
                updated = true;

                // If disabling WebAuthn, clear the credentials
                if (!webauthnEnabled) {
                    user.webauthn_credentials = null;
                }
            }

            if (!updated) {
                return {
                    success: false,
                    message: 'No 2FA settings to update'
                };
            }

            await user.save();

            // Log the change
            await logService.auditLog({
                eventType: 'user.2fa_settings_updated',
                userId: adminId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    oldSettings,
                    newSettings: {
                        totpEnabled: user.totp_enabled,
                        webauthnEnabled: user.webauthn_enabled
                    },
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: '2FA settings updated successfully'
            };
        } catch (error) {
            console.error('Update 2FA settings error:', error);
            return {
                success: false,
                message: 'Failed to update 2FA settings'
            };
        }
    }

    /**
     * Set account lock status
     * @param {number} userId - User ID
     * @param {boolean} locked - Whether to lock or unlock
     * @param {string} reason - Reason for lock/unlock
     * @param {number} adminId - Admin performing the action
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async setAccountLockStatus(userId, locked, reason, adminId, context) {
        try {
            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Update lock status
            user.account_locked = locked;

            // If locking, set expiry; if unlocking, clear expiry
            if (locked) {
                // Default to 30 days lockout for admin-initiated locks
                const lockoutUntil = new Date();
                lockoutUntil.setDate(lockoutUntil.getDate() + 30);
                user.account_locked_until = lockoutUntil;
            } else {
                user.account_locked_until = null;
                user.failed_login_attempts = 0;
            }

            await user.save();

            // Invalidate all user sessions if locking
            if (locked) {
                await this._invalidateAllUserSessions(userId, 'account_locked');
            }

            // Log the action
            await logService.securityLog({
                eventType: locked ? 'user.account_locked' : 'user.account_unlocked',
                severity: 'medium',
                userId: adminId,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    targetUserId: userId,
                    username: user.username,
                    reason,
                    lockoutUntil: user.account_locked_until,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: locked ?
                    'Account locked successfully' :
                    'Account unlocked successfully'
            };
        } catch (error) {
            console.error('Set account lock status error:', error);
            return {
                success: false,
                message: 'Failed to update account lock status'
            };
        }
    }

    /**
     * Get available roles
     * @returns {Promise<Object>} Roles list
     */
    async getRoles() {
        try {
            const roles = await db.Role.findAll({
                include: [{
                    model: db.Permission,
                    through: { attributes: [] }
                }],
                order: [['id', 'ASC']]
            });

            return {
                success: true,
                roles: roles.map(role => ({
                    id: role.id,
                    name: role.name,
                    description: role.description,
                    permissions: role.Permissions.map(p => p.name)
                }))
            };
        } catch (error) {
            console.error('Get roles error:', error);
            return {
                success: false,
                message: 'Failed to retrieve roles'
            };
        }
    }

    /**
     * Get user session information
     * @param {number} userId - User ID
     * @param {number} sessionId - Session ID
     * @returns {Promise<Object>} Session info
     */
    async getSessionInfo(userId, sessionId) {
        try {
            const session = await db.Session.findOne({
                where: {
                    id: sessionId,
                    user_id: userId
                }
            });

            if (!session) {
                return {
                    success: false,
                    message: 'Session not found'
                };
            }

            return {
                success: true,
                session: {
                    id: session.id,
                    created: session.created_at,
                    lastActivity: session.last_activity,
                    expires: session.expires_at,
                    ipAddress: session.ip_address,
                    userAgent: session.user_agent
                }
            };
        } catch (error) {
            console.error('Get session info error:', error);
            return {
                success: false,
                message: 'Failed to retrieve session information'
            };
        }
    }

    /**
     * Get user's authentication activity
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Authentication activity
     */
    async getUserAuthActivity(userId) {
        try {
            // Get recent login attempts
            const loginLogs = await db.AuditLog.findAll({
                where: {
                    user_id: userId,
                    event_type: {
                        [Op.in]: ['user.login', 'user.login_2fa', 'user.login_webauthn', 'user.logout']
                    }
                },
                order: [['created_at', 'DESC']],
                limit: 10
            });

            // Get failed login attempts
            const failedLogins = await db.SecurityLog.findAll({
                where: {
                    user_id: userId,
                    event_type: 'auth.failed'
                },
                order: [['created_at', 'DESC']],
                limit: 10
            });

            // Get password changes
            const passwordChanges = await db.AuditLog.findAll({
                where: {
                    user_id: userId,
                    event_type: 'user.password_changed'
                },
                order: [['created_at', 'DESC']],
                limit: 5
            });

            return {
                success: true,
                activity: {
                    logins: loginLogs.map(log => ({
                        id: log.id,
                        type: log.event_type,
                        timestamp: log.created_at,
                        ipAddress: log.ip_address,
                        userAgent: log.metadata?.userAgent || 'unknown'
                    })),
                    failedLogins: failedLogins.map(log => ({
                        id: log.id,
                        timestamp: log.created_at,
                        ipAddress: log.ip_address,
                        reason: log.metadata?.reason || 'unknown',
                        userAgent: log.metadata?.userAgent || 'unknown'
                    })),
                    passwordChanges: passwordChanges.map(log => ({
                        id: log.id,
                        timestamp: log.created_at,
                        ipAddress: log.ip_address
                    }))
                }
            };
        } catch (error) {
            console.error('Get auth activity error:', error);
            return {
                success: false,
                message: 'Failed to retrieve authentication activity'
            };
        }
    }

    /**
     * Get user preferences
     * @param {number} userId - User ID
     * @returns {Promise<Object>} User preferences
     */
    async getUserPreferences(userId) {
        try {
            // Get or create user preferences
            const [preferences, created] = await db.UserPreference.findOrCreate({
                where: { user_id: userId },
                defaults: {
                    user_id: userId,
                    preferences: {}
                }
            });

            return {
                success: true,
                preferences: preferences.preferences || {}
            };
        } catch (error) {
            console.error('Get preferences error:', error);
            return {
                success: false,
                message: 'Failed to retrieve user preferences'
            };
        }
    }

    /**
     * Update user preferences
     * @param {number} userId - User ID
     * @param {Object} preferences - User preferences
     * @returns {Promise<Object>} Update result
     */
    async updateUserPreferences(userId, preferences) {
        try {
            // Get or create user preferences
            const [userPreferences, created] = await db.UserPreference.findOrCreate({
                where: { user_id: userId },
                defaults: {
                    user_id: userId,
                    preferences: {}
                }
            });

            // Update preferences
            userPreferences.preferences = {
                ...userPreferences.preferences,
                ...preferences
            };

            await userPreferences.save();

            return {
                success: true,
                message: 'Preferences updated successfully',
                preferences: userPreferences.preferences
            };
        } catch (error) {
            console.error('Update preferences error:', error);
            return {
                success: false,
                message: 'Failed to update preferences'
            };
        }
    }

    /**
     * Invalidate all sessions for a user
     * @private
     * @param {number} userId - User ID
     * @param {string} reason - Reason for invalidation
     */
    async _invalidateAllUserSessions(userId, reason) {
        try {
            // Find all active sessions
            const sessions = await db.Session.findAll({
                where: {
                    user_id: userId,
                    is_valid: true
                }
            });

            for (const session of sessions) {
                // Invalidate session
                session.is_valid = false;
                await session.save();

                // Blacklist tokens
                if (session.token_id) {
                    await db.BlacklistedToken.create({
                        token_id: session.token_id,
                        user_id: userId,
                        reason
                    });
                }

                if (session.refresh_token_id) {
                    await db.BlacklistedToken.create({
                        token_id: session.refresh_token_id,
                        user_id: userId,
                        reason
                    });
                }
            }
        } catch (error) {
            console.error('Invalidate sessions error:', error);
            throw error;
        }
    }
}

module.exports = new UserService();