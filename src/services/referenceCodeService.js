// services/referenceCodeService.js
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const emailService = require('./emailService');
const { REFERENCE_CODE_EXPIRY_DAYS } = require('../config/environment');
const secureRandom = require('../utils/secureRandom');

/**
 * Service for managing user registration reference codes
 */
class ReferenceCodeService {
    /**
     * Generate a new reference code for an existing user
     * @param {Object} data - Reference code data
     * @param {number} data.userId - ID of existing user to generate code for
     * @param {boolean} data.require2FA - Whether to require 2FA setup (optional)
     * @param {number} data.createdBy - Admin user ID creating this code
     * @param {Object} context - Request context with IP and device info
     * @returns {Promise<Object>} Generated reference code information
     */
    async generateReferenceCode(data, context) {
        try {
            const {
                userId,
                require2FA = false,
                createdBy
            } = data;

            // Get user information
            const user = await db.User.findByPk(userId, {
                include: [
                    { association: 'role' },
                    { association: 'service' }
                ]
            });

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Check if user already has an active reference code
            const existingCode = await db.RefCode.findOne({
                where: {
                    user_id: userId,
                    status: 'active',
                    expires_at: { [Op.gt]: new Date() }
                }
            });

            if (existingCode) {
                return {
                    success: false,
                    message: 'User already has an active reference code'
                };
            }

            // Check if user already has a password set (indicating they've already registered)
            if (user.password_hash && user.password_hash.length > 0) {
                return {
                    success: false,
                    message: 'User has already completed registration'
                };
            }

            // Generate random code in format xxx-xxx-xxx
            const code = this._generateCode();

            // Calculate expiry date (default: 7 days)
            const expiryDays = REFERENCE_CODE_EXPIRY_DAYS || 7;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);

            // Create reference code record
            const refCode = await db.RefCode.create({
                code,
                user_id: userId,
                created_by: createdBy,
                expires_at: expiresAt,
                status: 'active',
                require_2fa: require2FA
            });

            // Log reference code creation
            await logService.auditLog({
                eventType: 'refcode.created',
                userId: createdBy,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    username: user.username,
                    role: user.role.name,
                    expiresAt,
                    require2FA,
                    userAgent: context.userAgent
                }
            });

            // If email is provided, send notification
            if (user.email) {
                await emailService.sendReferenceCode({
                    email: user.email,
                    code,
                    expiresAt,
                    createdByUserId: createdBy
                });
            }

            return {
                success: true,
                code,
                userId: user.id,
                username: user.username,
                role: user.role.name,
                expiresAt,
                message: 'Reference code generated successfully'
            };
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
                    userId: data.userId,
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
                    include: [{ association: 'role' }]
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
                role: refCode.TargetUser.role.name,
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
                        association: 'role',
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
                    role: code.TargetUser.role.name,
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
                include: [{ association: 'role' }]
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
                    role: user.role.name,
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
        // Generate 9 cryptographically secure random digits
        const digits = secureRandom.randomDigits(9);

        // Format as xxx-xxx-xxx
        return [
            digits.slice(0, 3).join(''),
            digits.slice(3, 6).join(''),
            digits.slice(6, 9).join('')
        ].join('-');
    }
}

module.exports = new ReferenceCodeService();