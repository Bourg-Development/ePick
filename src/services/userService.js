// services/userService.js
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const db = require('../db');
const logService = require('./logService');
const docService = require('./docService');
const mailingListService = require('./mailingListService');

/**
 * Service for user management operations
 */
class UserService {

    /**
     * Create a new user
     * @param {Object} userData - User creation data
     * @param {string} userData.username - 6-digit numeric username
     * @param {string} [userData.fullName] - Full name of the user
     * @param {number} userData.roleId - Role ID for the user
     * @param {number} userData.serviceId - Service ID for regular staff (optional)
     * @param {string} userData.email - Email for admin accounts (optional)
     * @param {number} userData.createdBy - Admin user ID creating this user
     * @param {Object} context - Request context
     * @returns {Promise<Object>} User creation result
     */
    async createUser(userData, context) {
        try {
            const {
                username,
                fullName,
                roleId,
                serviceId,
                email,
                createdBy
            } = userData;

            // Validate username format (6 digits)
            if (!username.match(/^\d{6}$/)) {
                return {
                    success: false,
                    message: 'Username must be exactly 6 digits'
                };
            }

            // Validate full name if provided
            if (fullName && (fullName.trim().length === 0 || fullName.trim().length > 255)) {
                return {
                    success: false,
                    message: 'Full name must be between 1 and 255 characters'
                };
            }

            // Check if username already exists
            const existingUser = await db.User.findOne({
                where: { username }
            });

            if (existingUser) {
                return {
                    success: false,
                    message: 'Username already exists'
                };
            }

            // Get role information
            const role = await db.Role.findByPk(roleId);
            if (!role) {
                return { success: false, message: 'Invalid role' };
            }

            // Check if role is a system role
            if (role.is_system) {
                return {
                    success: false,
                    message: 'System roles cannot be assigned during user creation. This role can only be assigned by the system.'
                };
            }

            // Validate service ID for regular staff
            if (role.name !== 'admin' && !serviceId) {
                return {
                    success: false,
                    message: 'Service ID is required for non-admin users'
                };
            }

            // Validate service exists if provided
            if (serviceId) {
                const service = await db.Service.findByPk(serviceId);
                if (!service) {
                    return {
                        success: false,
                        message: 'Invalid service ID'
                    };
                }
            }

            // Validate email for admin accounts
            if (role.name === 'admin' && !email) {
                return {
                    success: false,
                    message: 'Email is required for admin accounts'
                };
            }

            // Validate email format if provided
            if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return {
                    success: false,
                    message: 'Invalid email format'
                };
            }

            // Create user with empty password (to be set during registration)
            const user = await db.User.create({
                username,
                full_name: fullName ? fullName.trim() : null,
                password_hash: '', // Will be set during registration
                salt: '',          // Will be set during registration
                role_id: roleId,
                service_id: serviceId || null,
                email: email || null,
                totp_enabled: false,
                webauthn_enabled: false,
                account_locked: false,
                failed_login_attempts: 0,
                created_by: createdBy
            });

            // Log user creation
            await logService.auditLog({
                eventType: 'user.created',
                userId: createdBy,
                targetId: user.id,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username,
                    fullName: user.full_name,
                    role: role.name,
                    serviceId,
                    email,
                    userAgent: context.userAgent
                }
            });

            // Send account creation email first if user has a personal email
            if (user.email) {
                const emailService = require('./emailService');
                const service = serviceId ? await db.Service.findByPk(serviceId) : null;
                
                await emailService.sendAccountCreatedEmail({
                    email: user.email,
                    userName: user.full_name,
                    role: role.display_name || role.name,
                    organization: service ? service.name : 'ePick',
                    createdDate: user.created_at
                });
            }

            // Auto-subscribe user to mailing lists based on their role after account creation email
            await this._autoSubscribeUserToMailingLists(user.id, role.name, context);

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.full_name,
                    role: role.name,
                    serviceId: user.service_id,
                    email: user.email,
                    createdAt: user.created_at
                },
                message: 'User created successfully'
            };
        } catch (error) {
            console.error('Create user error:', error);
            await logService.securityLog({
                eventType: 'user.creation_error',
                severity: 'medium',
                userId: userData.createdBy,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    username: userData.username,
                    userAgent: context.userAgent
                }
            });
            return {
                success: false,
                message: 'Failed to create user'
            };
        }
    }

    /**
     * Get user by ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} User data or error
     */
    async getUserById(userId) {
        try {
            const user = await db.User.findByPk(userId, {
                include: [
                    {
                        association: 'role',
                        include: [{ association: 'permissions' }]
                    },
                    { association: 'service' }
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
                    {
                        association: 'role',
                        include: [{ association: 'permissions' }]
                    },
                    { association: 'service' }
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
     * @param {string} [filters.fullName] - Filter by full name
     * @param {number} [filters.roleId] - Filter by role ID
     * @param {number} [filters.serviceId] - Filter by service ID
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated users
     */

    async getUsers(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            if (filters.search && filters.search.trim()) {
                const searchTerm = `%${filters.search.trim().toLowerCase()}%`;

                whereClause[Op.or] = [
                    // Search in username
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.username')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in full name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.full_name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in email
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.email')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in role name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('role.name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in service name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('service.name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in service email
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('service.email')),
                        Op.like,
                        searchTerm
                    )
                ];
            }


            if (filters.roleId) {
                whereClause.role_id = filters.roleId;
            }

            if (filters.serviceId) {
                whereClause.service_id = filters.serviceId;
            }

            const offset = (page - 1) * limit;

            // Rest of your existing getUsers method stays the same...
            const { count, rows } = await db.User.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        association: 'role',
                        attributes: ['id', 'name']
                    },
                    {
                        association: 'service',
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        association: 'Creator',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset,
                // Exclude sensitive data
                attributes: {
                    exclude: ['password_hash', 'salt', 'totp_secret', 'webauthn_credentials'],
                    include: [
                        [
                            db.sequelize.literal(`CASE WHEN "User".password_hash IS NOT NULL AND "User".password_hash != '' THEN true ELSE false END`),
                            'is_registered'
                        ]
                    ]
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
     * Update user's full name
     * @param {number} userId - User ID
     * @param {string} fullName - New full name
     * @param {number} adminId - Admin performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateUserFullName(userId, fullName, adminId, context) {
        try {
            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Validate full name
            if (fullName && (fullName.trim().length === 0 || fullName.trim().length > 255)) {
                return {
                    success: false,
                    message: 'Full name must be between 1 and 255 characters'
                };
            }

            // Store old name for logging
            const oldFullName = user.full_name;

            // Update full name
            user.full_name = fullName ? fullName.trim() : null;
            await user.save();

            // Log the change
            await logService.auditLog({
                eventType: 'user.full_name_updated',
                userId: adminId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    oldFullName,
                    newFullName: user.full_name,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Full name updated successfully'
            };
        } catch (error) {
            console.error('Update full name error:', error);
            return {
                success: false,
                message: 'Failed to update full name'
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

            // Check if role is a system role
            if (role.is_system) {
                return {
                    success: false,
                    message: 'System roles cannot be assigned manually. This role can only be assigned by the system.'
                };
            }

            // Store old role for logging
            const oldRoleId = user.role_id;
            
            // Get old role name for mailing list handling
            const oldRole = await db.Role.findByPk(oldRoleId);
            const oldRoleName = oldRole ? oldRole.name : null;

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

            // Handle mailing list subscriptions based on role change
            await this._handleRoleChangeMailingLists(userId, oldRoleName, role.name, context);

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
                    association: 'permissions'
                }],
                order: [['id', 'ASC']]
            });

            return {
                success: true,
                roles: roles.map(role => ({
                    id: role.id,
                    name: role.name,
                    description: role.description,
                    permissions: role.permissions.map(p => p.name)
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

            // Validate notification preferences if provided
            if (preferences.notifications) {
                const { notifications } = preferences;
                
                // Validate email notification setting
                if (notifications.email !== undefined && typeof notifications.email !== 'boolean') {
                    return {
                        success: false,
                        message: 'Email notification setting must be a boolean value'
                    };
                }
                
                // Check if user has an email address for email notifications
                if (notifications.email === true) {
                    const user = await db.User.findByPk(userId, {
                        include: [{ association: 'service' }]
                    });
                    
                    const hasEmail = user && (user.email || user.service?.email);
                    if (!hasEmail) {
                        return {
                            success: false,
                            message: 'Cannot enable email notifications: no email address available'
                        };
                    }
                }
            }

            // Also validate individual notification preferences if provided
            if (preferences.notifications && preferences.notifications.email !== undefined && preferences.notifications.email) {
                // Check if user has a personal email address before allowing email notifications
                const user = await db.User.findByPk(userId);

                if (!user) {
                    return {
                        success: false,
                        message: 'User not found'
                    };
                }

                const hasPersonalEmail = user.email;
                if (!hasPersonalEmail) {
                    return {
                        success: false,
                        message: 'Cannot enable email notifications - no personal email address on file'
                    };
                }
            }

            // Update preferences
            userPreferences.preferences = {
                ...userPreferences.preferences,
                ...preferences
            };

            await userPreferences.save();

            // If language preference is provided, also update the user's preferred_language field
            // so that the i18n middleware can detect it automatically
            if (preferences.language) {
                console.log('DEBUG - Language preference detected:', preferences.language);
                console.log('DEBUG - Attempting to update user ID:', userId);
                
                const user = await db.User.findByPk(userId);
                if (user) {
                    const oldLang = user.preferred_language;
                    console.log('DEBUG - User found, current language:', oldLang);
                    console.log('DEBUG - Setting preferred_language to:', preferences.language);
                    
                    user.preferred_language = preferences.language;
                    const saveResult = await user.save();
                    console.log('DEBUG - Save result:', saveResult ? 'success' : 'failed');
                    
                    // Re-fetch to verify the save worked
                    const verifyUser = await db.User.findByPk(userId, {
                        attributes: ['preferred_language']
                    });
                    console.log('DEBUG - Verification query result:', verifyUser?.preferred_language);
                    console.log('DEBUG - Language update complete: from', oldLang, 'to', verifyUser?.preferred_language);
                } else {
                    console.log('DEBUG - ERROR: User not found for ID:', userId);
                }
            }

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
     * Export users to JSON, CSV, or Excel format
     * @param {Object} filters - Filter criteria (same as getUsers)
     * @param {string} format - Export format ('json', 'csv', 'excel')
     * @param {Object} options - Export options
     * @param {Array} [options.includeColumns] - Columns to include
     * @param {Array} [options.excludeColumns] - Columns to exclude
     * @param {Array} [options.allowedColumns] - Allowed columns (security whitelist)
     * @returns {Promise<Object>} Export result
     */
    async exportUsers(filters = {}, format = 'json', options = {}) {
        try {
            const whereClause = {};

            if (filters.search && filters.search.trim()) {
                const searchTerm = `%${filters.search.trim().toLowerCase()}%`;

                whereClause[Op.or] = [
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.username')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.full_name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('User.email')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('role.name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('service.name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('service.email')),
                        Op.like,
                        searchTerm
                    )
                ];
            }


            if (filters.roleId) {
                whereClause.role_id = filters.roleId;
            }

            if (filters.serviceId) {
                whereClause.service_id = filters.serviceId;
            }

            // Get all matching users (no pagination for export)
            const users = await db.User.findAll({
                where: whereClause,
                include: [
                    {
                        association: 'role',
                        attributes: ['id', 'name']
                    },
                    {
                        association: 'service',
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        association: 'Creator',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['created_at', 'DESC']],
                // Exclude sensitive data from export
                attributes: {
                    exclude: ['password_hash', 'salt', 'totp_secret', 'webauthn_credentials'],
                    include: [
                        [
                            db.sequelize.literal(`CASE WHEN "User".password_hash IS NOT NULL AND "User".password_hash != '' THEN true ELSE false END`),
                            'is_registered'
                        ]
                    ]
                }
            });

            // Format users for export using the helper method
            const formattedUsers = users.map(user => this._formatUserForExport(user));

            // Apply filters for tracking
            const appliedFilters = {};
            if (filters.search) appliedFilters.search = filters.search;
            if (filters.roleId) appliedFilters.roleId = filters.roleId;
            if (filters.serviceId) appliedFilters.serviceId = filters.serviceId;

            // Prepare user-specific column headers and options
            const userExportOptions = {
                ...options,
                appliedFilters,
                defaultExcludedFields: ['lastIpAddress', 'accountLockedUntil'], // User-specific security exclusions
                columnHeaders: this._getUserColumnHeaders(),
                sheetName: 'Users',
                exportTitle: 'USER MANAGEMENT SYSTEM\nData Export Report',
                metadata: {
                    exportType: 'users',
                    totalUsers: formattedUsers.length
                }
            };

            // Use the document service for export
            return await docService.exportData(formattedUsers, format, userExportOptions);

        } catch (error) {
            console.error('Export users error:', error);
            return {
                success: false,
                message: 'Failed to export users'
            };
        }
    }

    /**
     * Format user data for export (remove sensitive fields, flatten associations)
     * @private
     * @param {Object} user - User instance from database
     * @returns {Object} Formatted user data
     */
    _formatUserForExport(user) {
        const userData = user.toJSON();

        // Define all available columns with their data
        return {
            id: userData.id,
            username: userData.username,
            fullName: userData.full_name,
            email: userData.email,
            isRegistered: userData.is_registered,
            role: userData.role ? userData.role.name : null,
            roleId: userData.role_id,
            service: userData.service ? userData.service.name : null,
            serviceId: userData.service_id,
            serviceEmail: userData.service ? userData.service.email : null,
            totpEnabled: userData.totp_enabled,
            webauthnEnabled: userData.webauthn_enabled,
            accountLocked: userData.account_locked,
            accountLockedUntil: userData.account_locked_until,
            failedLoginAttempts: userData.failed_login_attempts,
            lastLogin: userData.last_login,
            lastLoginAttempt: userData.last_login_attempt,
            lastIpAddress: userData.last_ip_address,
            createdAt: userData.created_at,
            updatedAt: userData.updated_at,
            createdBy: userData.Creator ? userData.Creator.username : null,
            createdById: userData.created_by
        };
    }

    /**
     * Get user-specific column headers for export
     * @private
     * @returns {Object} Column header mappings
     */
    _getUserColumnHeaders() {
        return {
            id: 'ID',
            username: 'Username',
            fullName: 'Full Name',
            email: 'Email',
            isRegistered: 'Is Registered',
            role: 'Role',
            roleId: 'Role ID',
            service: 'Service',
            serviceId: 'Service ID',
            serviceEmail: 'Service Email',
            totpEnabled: 'TOTP Enabled',
            webauthnEnabled: 'WebAuthn Enabled',
            accountLocked: 'Account Locked',
            accountLockedUntil: 'Account Locked Until',
            failedLoginAttempts: 'Failed Login Attempts',
            lastLogin: 'Last Login',
            lastLoginAttempt: 'Last Login Attempt',
            lastIpAddress: 'Last IP Address',
            createdAt: 'Created At',
            updatedAt: 'Updated At',
            createdBy: 'Created By',
            createdById: 'Created By ID'
        };
    }

    /**
     * Update user language preference
     * @param {number} userId - User ID
     * @param {string} language - Language code (en, fr, es)
     * @returns {Promise<Object>} Update result
     */
    async updateUserLanguage(userId, language) {
        try {
            // Validate language
            const validLanguages = ['en', 'fr', 'es'];
            if (!validLanguages.includes(language)) {
                return {
                    success: false,
                    message: 'Invalid language code'
                };
            }

            // Find user
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Update language preference
            user.preferred_language = language;
            await user.save();

            return {
                success: true,
                message: 'Language preference updated successfully',
                language
            };
        } catch (error) {
            console.error('Update language error:', error);
            return {
                success: false,
                message: 'Failed to update language preference'
            };
        }
    }

    /**
     * Update user display preferences (date format)
     * @param {number} userId - User ID
     * @param {Object} displayPrefs - Display preferences object
     * @param {string} displayPrefs.dateFormat - Date format preference 
     * @returns {Promise<Object>} Result object
     */
    async updateUserDisplayPreferences(userId, displayPrefs) {
        try {
            const { dateFormat } = displayPrefs;

            // Validate date format
            const validDateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
            if (dateFormat && !validDateFormats.includes(dateFormat)) {
                return {
                    success: false,
                    message: 'Invalid date format'
                };
            }

            // Find or create user preferences
            let userPrefs = await db.UserPreference.findOne({
                where: { user_id: userId }
            });

            if (!userPrefs) {
                userPrefs = await db.UserPreference.create({
                    user_id: userId,
                    preferences: {}
                });
            }

            // Get current preferences and update them
            const currentPrefs = userPrefs.preferences || {};
            const updatedPrefs = { ...currentPrefs };

            if (dateFormat) {
                updatedPrefs.dateFormat = dateFormat;
            }

            userPrefs.preferences = updatedPrefs;
            await userPrefs.save();

            return {
                success: true,
                message: 'Display preferences updated successfully',
                preferences: {
                    dateFormat: updatedPrefs.dateFormat || 'MM/DD/YYYY'
                }
            };
        } catch (error) {
            console.error('Update display preferences error:', error);
            return {
                success: false,
                message: 'Failed to update display preferences'
            };
        }
    }

    /**
     * Get user display preferences
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Result object with preferences
     */
    async getUserDisplayPreferences(userId) {
        try {
            const userPrefs = await db.UserPreference.findOne({
                where: { user_id: userId }
            });

            let preferences = {
                dateFormat: 'MM/DD/YYYY'
            };

            if (userPrefs && userPrefs.preferences) {
                preferences = {
                    dateFormat: userPrefs.preferences.dateFormat || 'MM/DD/YYYY'
                };
            }

            return {
                success: true,
                preferences
            };
        } catch (error) {
            console.error('Get display preferences error:', error);
            return {
                success: false,
                message: 'Failed to retrieve display preferences'
            };
        }
    }

    /**
     * Get user preferences
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Result object with all preferences
     */
    async getUserPreferences(userId) {
        try {
            const userPrefs = await db.UserPreference.findOne({
                where: { user_id: userId }
            });

            // Check if user has personal email address
            const user = await db.User.findByPk(userId);
            const hasPersonalEmail = user && user.email;

            let preferences = {
                dateFormat: 'MM/DD/YYYY',
                notifications: {
                    email: false
                }
            };

            if (userPrefs && userPrefs.preferences) {
                preferences = {
                    dateFormat: userPrefs.preferences.dateFormat || 'MM/DD/YYYY',
                    notifications: userPrefs.preferences.notifications || { email: false },
                    ...userPrefs.preferences
                };
                
                // Force email notifications to false if user has no personal email
                if (!hasPersonalEmail && preferences.notifications) {
                    preferences.notifications.email = false;
                }
            }

            return {
                success: true,
                preferences
            };
        } catch (error) {
            console.error('Get user preferences error:', error);
            return {
                success: false,
                message: 'Failed to retrieve user preferences'
            };
        }
    }


    /**
     * Assign a system role to a user (system-only method)
     * @param {number} userId - User ID
     * @param {number} roleId - System role ID
     * @param {string} systemReason - Reason for system role assignment
     * @returns {Promise<Object>} Assignment result
     */
    async assignSystemRole(userId, roleId, systemReason) {
        try {
            // This method is intended to be called only by system processes
            // Not exposed via API endpoints
            
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
            
            // Verify this is actually a system role
            if (!role.is_system) {
                return {
                    success: false,
                    message: 'This method can only assign system roles'
                };
            }
            
            // Store old role for logging
            const oldRoleId = user.role_id;
            
            // Update role
            user.role_id = roleId;
            await user.save();
            
            // Invalidate all user sessions when assigning system role
            await this._invalidateAllUserSessions(userId, 'System role assigned');
            
            // Log the system assignment
            await logService.auditLog({
                eventType: 'user.system_role_assigned',
                userId: 0, // System user ID
                targetId: userId,
                targetType: 'user',
                ipAddress: '127.0.0.1',
                deviceFingerprint: 'system',
                metadata: {
                    username: user.username,
                    oldRoleId,
                    newRoleId: roleId,
                    roleName: role.name,
                    systemReason,
                    userAgent: 'system'
                }
            });
            
            await logService.securityLog({
                eventType: 'user.system_role_assigned',
                severity: 'high',
                userId: 0,
                targetUserId: userId,
                ipAddress: '127.0.0.1',
                deviceFingerprint: 'system',
                metadata: {
                    username: user.username,
                    roleName: role.name,
                    systemReason
                }
            });
            
            return {
                success: true,
                message: 'System role assigned successfully'
            };
        } catch (error) {
            console.error('Assign system role error:', error);
            return {
                success: false,
                message: 'Failed to assign system role'
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

    /**
     * Auto-subscribe user to mailing lists based on their role
     * @private
     * @param {number} userId - User ID
     * @param {string} roleName - Role name
     * @param {Object} context - Request context
     */
    async _autoSubscribeUserToMailingLists(userId, roleName, context) {
        try {
            // Get the user with their email information
            const user = await db.User.findByPk(userId, {
                include: [{ association: 'service' }]
            });

            // Only auto-subscribe users with personal email addresses (not service emails)
            if (!user || !user.email) {
                console.log(`User ${userId} has no personal email address, skipping mailing list auto-subscription`);
                return;
            }

            // Find all active mailing lists that auto-subscribe this role
            const mailingLists = await db.MailingList.findAll({
                where: {
                    is_active: true,
                    auto_subscribe_roles: {
                        [Op.contains]: [roleName]
                    }
                }
            });

            if (mailingLists.length === 0) {
                console.log(`No mailing lists found that auto-subscribe role: ${roleName}`);
                return;
            }

            console.log(`Found ${mailingLists.length} mailing lists that auto-subscribe role: ${roleName}`);

            // Subscribe the user to each mailing list
            for (const mailingList of mailingLists) {
                try {
                    // Check if user is already subscribed
                    const existingSubscription = await db.MailingListSubscriber.findOne({
                        where: {
                            list_id: mailingList.id,
                            user_id: userId
                        }
                    });

                    if (!existingSubscription) {
                        // Create subscription
                        const subscriber = await db.MailingListSubscriber.create({
                            list_id: mailingList.id,
                            user_id: userId,
                            status: 'active',
                            subscription_source: 'auto_role'
                        });

                        // Send notification email
                        await mailingListService._sendSubscriptionNotification(mailingList, subscriber, userId, null);

                        console.log(`User ${userId} auto-subscribed to mailing list: ${mailingList.name}`);

                        // Log the auto-subscription
                        await logService.auditLog({
                            eventType: 'mailing_list.auto_subscriber_added',
                            userId: 0, // System action
                            targetId: subscriber.id,
                            targetType: 'mailing_list_subscriber',
                            ipAddress: context.ip,
                            deviceFingerprint: context.deviceFingerprint,
                            metadata: {
                                listId: mailingList.id,
                                listName: mailingList.name,
                                userId,
                                roleName,
                                subscriptionSource: 'auto_role',
                                userAgent: context.userAgent
                            }
                        });
                    } else if (existingSubscription.status === 'unsubscribed') {
                        // Reactivate subscription if it was previously unsubscribed
                        existingSubscription.status = 'active';
                        existingSubscription.subscribed_at = new Date();
                        existingSubscription.unsubscribed_at = null;
                        existingSubscription.subscription_source = 'auto_role';
                        await existingSubscription.save();

                        console.log(`User ${userId} re-subscribed to mailing list: ${mailingList.name}`);
                    }
                } catch (error) {
                    console.error(`Error auto-subscribing user ${userId} to mailing list ${mailingList.name}:`, error);
                    // Continue with other mailing lists even if one fails
                }
            }
        } catch (error) {
            console.error('Auto-subscribe user to mailing lists error:', error);
            // Don't throw error - we don't want to fail user creation if auto-subscription fails
        }
    }

    /**
     * Handle mailing list subscriptions when user's role changes
     * @private
     * @param {number} userId - User ID
     * @param {string} oldRoleName - Old role name
     * @param {string} newRoleName - New role name
     * @param {Object} context - Request context
     */
    async _handleRoleChangeMailingLists(userId, oldRoleName, newRoleName, context) {
        try {
            // Get the user with their email information
            const user = await db.User.findByPk(userId, {
                include: [{ association: 'service' }]
            });

            // Only handle role changes for users with personal email addresses (not service emails)
            if (!user || !user.email) {
                console.log(`User ${userId} has no personal email address, skipping mailing list role change handling`);
                return;
            }

            // Find all active mailing lists
            const allMailingLists = await db.MailingList.findAll({
                where: {
                    is_active: true,
                    auto_subscribe_roles: {
                        [Op.or]: [
                            oldRoleName ? { [Op.contains]: [oldRoleName] } : { [Op.contains]: [] },
                            { [Op.contains]: [newRoleName] }
                        ]
                    }
                }
            });

            for (const mailingList of allMailingLists) {
                const shouldBeSubscribedOld = oldRoleName && mailingList.auto_subscribe_roles.includes(oldRoleName);
                const shouldBeSubscribedNew = mailingList.auto_subscribe_roles.includes(newRoleName);

                // Find existing subscription
                const existingSubscription = await db.MailingListSubscriber.findOne({
                    where: {
                        list_id: mailingList.id,
                        user_id: userId
                    }
                });

                // If new role should be subscribed but old role wasn't
                if (shouldBeSubscribedNew && !shouldBeSubscribedOld) {
                    if (!existingSubscription) {
                        // Create new subscription
                        const subscriber = await db.MailingListSubscriber.create({
                            list_id: mailingList.id,
                            user_id: userId,
                            status: 'active',
                            subscription_source: 'auto_role'
                        });

                        // Send notification email
                        await mailingListService._sendSubscriptionNotification(mailingList, subscriber, userId, null);

                        console.log(`User ${userId} auto-subscribed to mailing list ${mailingList.name} due to role change to ${newRoleName}`);

                        // Log the auto-subscription
                        await logService.auditLog({
                            eventType: 'mailing_list.auto_subscriber_added_role_change',
                            userId: 0, // System action
                            targetId: subscriber.id,
                            targetType: 'mailing_list_subscriber',
                            ipAddress: context.ip,
                            deviceFingerprint: context.deviceFingerprint,
                            metadata: {
                                listId: mailingList.id,
                                listName: mailingList.name,
                                userId,
                                oldRoleName,
                                newRoleName,
                                subscriptionSource: 'auto_role',
                                userAgent: context.userAgent
                            }
                        });
                    } else if (existingSubscription.status === 'unsubscribed') {
                        // Reactivate if it was manually unsubscribed
                        existingSubscription.status = 'active';
                        existingSubscription.subscribed_at = new Date();
                        existingSubscription.unsubscribed_at = null;
                        existingSubscription.subscription_source = 'auto_role';
                        await existingSubscription.save();

                        console.log(`User ${userId} re-subscribed to mailing list ${mailingList.name} due to role change`);
                    }
                } 
                // If old role was subscribed but new role isn't, and subscription was auto-created
                else if (shouldBeSubscribedOld && !shouldBeSubscribedNew && existingSubscription) {
                    // Only unsubscribe if it was auto-subscribed (not manually subscribed)
                    if (existingSubscription.subscription_source === 'auto_role' && existingSubscription.status === 'active') {
                        existingSubscription.status = 'unsubscribed';
                        existingSubscription.unsubscribed_at = new Date();
                        await existingSubscription.save();

                        console.log(`User ${userId} auto-unsubscribed from mailing list ${mailingList.name} due to role change from ${oldRoleName}`);

                        // Log the auto-unsubscription
                        await logService.auditLog({
                            eventType: 'mailing_list.auto_subscriber_removed_role_change',
                            userId: 0, // System action
                            targetId: existingSubscription.id,
                            targetType: 'mailing_list_subscriber',
                            ipAddress: context.ip,
                            deviceFingerprint: context.deviceFingerprint,
                            metadata: {
                                listId: mailingList.id,
                                listName: mailingList.name,
                                userId,
                                oldRoleName,
                                newRoleName,
                                userAgent: context.userAgent
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Handle role change mailing lists error:', error);
            // Don't throw error - we don't want to fail role update if mailing list handling fails
        }
    }

    /**
     * Get all users with email addresses for notifications
     * @returns {Promise<Object>} Result with users data
     */
    async getAllUsersWithEmail() {
        try {
            const users = await db.User.findAll({
                where: {
                    email: {
                        [Op.ne]: null,
                        [Op.ne]: ''
                    }
                },
                attributes: ['id', 'email', 'full_name', 'username'],
                order: [['id', 'ASC']]
            });

            return {
                success: true,
                data: users,
                message: `Found ${users.length} users with email addresses`
            };
        } catch (error) {
            console.error('Get all users with email error:', error);
            return {
                success: false,
                message: 'Failed to retrieve users with email addresses',
                error: error.message
            };
        }
    }
}

module.exports = new UserService();