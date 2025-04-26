// services/referenceCodeService.js
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const emailService = require('./emailService');
const { REFERENCE_CODE_EXPIRY_DAYS } = require('../config/environment');

/**
 * Service for managing user registration reference codes
 */
class ReferenceCodeService {
    /**
     * Generate a new reference code for user creation
     * @param {Object} data - Reference code data
     * @param {string} data.username - 6-digit numeric username for the new user
     * @param {number} data.roleId - Role ID for the new user
     * @param {number} data.serviceId - Service ID for regular staff (optional)
     * @param {string} data.email - Email for admin accounts (optional)
     * @param {boolean} data.require2FA - Whether to require 2FA setup (optional)
     * @param {number} data.createdBy - Admin user ID creating this code
     * @param {Object} context - Request context with IP and device info
     * @returns {Promise<Object>} Generated reference code information
     */
    async generateReferenceCode(data, context) {
        try {
            const {
                username,
                roleId,
                serviceId,
                email,
                require2FA = false,
                createdBy
            } = data;

            // Validate username format (6 digits)
            if (!username.match(/^\d{6}$/)) {
                return {
                    success: false,
                    message: 'Username must be exactly 6 digits'
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

            // Validate service ID for regular staff
            if (role.name !== 'admin' && !serviceId) {
                return {
                    success: false,
                    message: 'Service ID is required for non-admin users'
                };
            }

            // Validate email for admin accounts
            if (role.name === 'admin' && !email) {
                return {
                    success: false,
                    message: 'Email is required for admin accounts'
                };
            }

            // Begin transaction
            const transaction = await db.sequelize.transaction();

            try {
                // Create pre-registered user
                const user = await db.User.create({
                    username,
                    password_hash: '', // Will be set during registration
                    salt: '',          // Will be set during registration
                    role_id: roleId,
                    service_id: serviceId || null,
                    email: email || null,
                    totp_enabled: false,
                    webauthn_enabled: false,
                    created_by: createdBy
                }, { transaction });

                // Generate random code in format xxx-xxx-xxx
                const code = this._generateCode();

                // Calculate expiry date (default: 7 days)
                const expiryDays = REFERENCE_CODE_EXPIRY_DAYS || 7;
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + expiryDays);

                // Create reference code record
                const refCode = await db.RefCode.create({
                    code,
                    user_id: user.id,
                    created_by: createdBy,
                    expires_at: expiresAt,
                    status: 'active',
                    require_2fa: require2FA
                }, { transaction });

                // Commit transaction
                await transaction.commit();

                // Log reference code creation
                await logService.auditLog({
                    eventType: 'refcode.created',
                    userId: createdBy,
                    targetId: user.id,
                    targetType: 'user',
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        username,
                        role: role.name,
                        expiresAt,
                        require2FA,
                        userAgent: context.userAgent
                    }
                });

                // If email is provided, send notification
                if (email) {
                    await emailService.sendReferenceCode({
                        email,
                        code,
                        expiresAt,
                        createdByUserId: createdBy
                    });
                }

                return {
                    success: true,
                    code,
                    userId: user.id,
                    username,
                    role: role.name,
                    expiresAt,
                    message: 'Reference code generated successfully'
                };
            } catch (error) {
                // Rollback transaction on error
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Reference code generation error:', error);
            await logService.securityLog({
                eventType: 'refcode.generation_error',
                severity: 'medium',
                userId: data.createdBy,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    username: data.username,
                    userAgent: context.userAgent
                }
            });
            return { success: false, message: 'Failed to generate reference code' };
        }
    }

    /**
     * Validate a reference code
     * @param {string} code - Reference code in format xxx-xxx-xxx
     * @returns {Promise<Object>} Validation result
     */
    async validateReferenceCode(code) {
        try {
            // Format validation
            if (!code.match(/^\d{3}-\d{3}-\d{3}$/)) {
                return { success: false, message: 'Invalid code format' };
            }

            // Find the reference code
            const refCode = await db.RefCode.findOne({
                where: {
                    code,
                    status: 'active',
                    expires_at: { [Op.gt]: new Date() }
                },
                include: [{
                    model: db.User,
                    as: 'TargetUser',
                    include: [{ model: db.Role }]
                }]
            });

            if (!refCode) {
                return {
                    success: false,
                    message: 'Invalid or expired reference code'
                };
            }

            return {
                success: true,
                userId: refCode.user_id,
                username: refCode.TargetUser.username,
                role: refCode.TargetUser.Role.name,
                require2FA: refCode.require_2fa,
                expiresAt: refCode.expires_at,
                message: 'Valid reference code'
            };
        } catch (error) {
            console.error('Reference code validation error:', error);
            return { success: false, message: 'Validation failed' };
        }
    }

    /**
     * List all active reference codes
     * @param {number} createdBy - Admin user ID (optional, for filtering)
     * @returns {Promise<Object>} List of active reference codes
     */
    async listActiveCodes(createdBy = null) {
        try {
            const whereClause = {
                status: 'active',
                expires_at: { [Op.gt]: new Date() }
            };

            // If createdBy is provided, filter by creator
            if (createdBy) {
                whereClause.created_by = createdBy;
            }

            const refCodes = await db.RefCode.findAll({
                where: whereClause,
                include: [{
                    model: db.User,
                    as: 'TargetUser',
                    attributes: ['id', 'username'],
                    include: [{
                        model: db.Role,
                        attributes: ['id', 'name']
                    }]
                }, {
                    model: db.User,
                    as: 'Creator',
                    attributes: ['id', 'username']
                }],
                order: [['created_at', 'DESC']]
            });

            return {
                success: true,
                refCodes: refCodes.map(code => ({
                    id: code.id,
                    code: code.code,
                    userId: code.user_id,
                    username: code.TargetUser.username,
                    role: code.TargetUser.Role.name,
                    createdBy: code.Creator.username,
                    createdAt: code.created_at,
                    expiresAt: code.expires_at,
                    require2FA: code.require_2fa
                }))
            };
        } catch (error) {
            console.error('List reference codes error:', error);
            return { success: false, message: 'Failed to list reference codes' };
        }
    }

    /**
     * Revoke a reference code
     * @param {string} code - Reference code to revoke
     * @param {number} adminId - Admin user ID performing the revocation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Revocation result
     */
    async revokeReferenceCode(code, adminId, context) {
        try {
            const refCode = await db.RefCode.findOne({
                where: {
                    code,
                    status: 'active'
                },
                include: [{
                    model: db.User,
                    as: 'TargetUser',
                    attributes: ['id', 'username']
                }]
            });

            if (!refCode) {
                return { success: false, message: 'Invalid or already used code' };
            }

            // Update reference code status
            refCode.status = 'revoked';
            await refCode.save();

            // Log revocation
            await logService.auditLog({
                eventType: 'refcode.revoked',
                userId: adminId,
                targetId: refCode.id,
                targetType: 'refcode',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    code,
                    targetUserId: refCode.user_id,
                    targetUsername: refCode.TargetUser.username,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Reference code revoked successfully'
            };
        } catch (error) {
            console.error('Revoke reference code error:', error);
            return { success: false, message: 'Failed to revoke reference code' };
        }
    }

    /**
     * Generate a new reference code for resetting a user's password
     * @param {number} userId - User ID for password reset
     * @param {number} adminId - Admin user ID creating the reset code
     * @param {boolean} require2FA - Whether to require 2FA setup after reset
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Generated reset code information
     */
    async generatePasswordResetCode(userId, adminId, require2FA, context) {
        try {
            // Get user information
            const user = await db.User.findByPk(userId, {
                include: [{ model: db.Role }]
            });

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Check for existing active reference codes for this user
            const existingCodes = await db.RefCode.findAll({
                where: {
                    user_id: userId,
                    status: 'active',
                    expires_at: { [Op.gt]: new Date() }
                }
            });

            // Invalidate existing codes
            for (const code of existingCodes) {
                code.status = 'revoked';
                await code.save();

                await logService.auditLog({
                    eventType: 'refcode.auto_revoked',
                    userId: adminId,
                    targetId: code.id,
                    targetType: 'refcode',
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        reason: 'password_reset_new_code',
                        targetUserId: userId,
                        targetUsername: user.username,
                        userAgent: context.userAgent
                    }
                });
            }

            // Generate new random code
            const code = this._generateCode();

            // Calculate expiry date (default: 7 days)
            const expiryDays = REFERENCE_CODE_EXPIRY_DAYS || 7;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);

            // Create reference code record
            const refCode = await db.RefCode.create({
                code,
                user_id: userId,
                created_by: adminId,
                expires_at: expiresAt,
                status: 'active',
                require_2fa: require2FA
            });

            // Log reference code creation for password reset
            await logService.auditLog({
                eventType: 'refcode.password_reset',
                userId: adminId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    role: user.Role.name,
                    expiresAt,
                    require2FA,
                    userAgent: context.userAgent
                }
            });

            // Send email notification if user has email
            if (user.email) {
                await emailService.sendPasswordResetCode({
                    email: user.email,
                    code,
                    expiresAt,
                    resetByUserId: adminId
                });
            }

            return {
                success: true,
                code,
                userId,
                username: user.username,
                expiresAt,
                message: 'Password reset code generated successfully'
            };
        } catch (error) {
            console.error('Password reset code generation error:', error);
            await logService.securityLog({
                eventType: 'refcode.reset_generation_error',
                severity: 'medium',
                userId: adminId,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    targetUserId: userId,
                    userAgent: context.userAgent
                }
            });
            return { success: false, message: 'Failed to generate password reset code' };
        }
    }

    /**
     * Generate a reference code in format xxx-xxx-xxx
     * @private
     * @returns {string} Formatted reference code
     */
    _generateCode() {
        // Generate 9 random digits
        const digits = [];
        for (let i = 0; i < 9; i++) {
            digits.push(Math.floor(Math.random() * 10));
        }

        // Format as xxx-xxx-xxx
        return [
            digits.slice(0, 3).join(''),
            digits.slice(3, 6).join(''),
            digits.slice(6, 9).join('')
        ].join('-');
    }
}

module.exports = new ReferenceCodeService();