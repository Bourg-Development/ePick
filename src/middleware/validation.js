// middleware/validation.js
const validator = require('../utils/validator');
const logService = require('../services/logService');

/**
 * Middleware for validating API inputs
 */
const validation = {
    /**
     * Validate login request
     */
    validateLogin(req, res, next) {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Validate username format (6 digits)
        const usernameValidation = validator.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message
            });
        }

        next();
    },

    /**
     * Validate TOTP code
     */
    validateTOTP(req, res, next) {
        const { totpCode } = req.body;

        if (!totpCode) {
            return res.status(400).json({
                success: false,
                message: 'TOTP code is required'
            });
        }

        // Validate TOTP format
        const totpValidation = validator.validateTOTPCode(totpCode);
        if (!totpValidation.valid) {
            return res.status(400).json({
                success: false,
                message: totpValidation.message
            });
        }

        next();
    },

    /**
     * Validate WebAuthn authentication
     */
    validateWebAuthn(req, res, next) {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: 'WebAuthn credential is required'
            });
        }

        // Basic structure validation
        if (!credential.id || !credential.response) {
            return res.status(400).json({
                success: false,
                message: 'Invalid WebAuthn credential format'
            });
        }

        next();
    },

    /**
     * Validate WebAuthn registration
     */
    validateWebAuthnRegistration(req, res, next) {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: 'WebAuthn credential is required'
            });
        }

        // Basic structure validation
        if (!credential.id || !credential.rawId || !credential.response || !credential.type) {
            return res.status(400).json({
                success: false,
                message: 'Invalid WebAuthn credential format'
            });
        }

        next();
    },

    /**
     * Validate refresh token
     */
    validateRefreshToken(req, res, next) {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        next();
    },

    /**
     * Validate registration request
     */
    validateRegistration(req, res, next) {
        const { referenceCode, password, confirmPassword } = req.body;

        if (!referenceCode || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Reference code, password, and password confirmation are required'
            });
        }

        // Validate reference code format
        const refCodeValidation = validator.validateReferenceCode(referenceCode);
        if (!refCodeValidation.valid) {
            return res.status(400).json({
                success: false,
                message: refCodeValidation.message
            });
        }

        // Validate passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Validate password strength
        const passwordValidation = validator.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message
            });
        }

        next();
    },

    /**
     * Validate password change request
     */
    validatePasswordChange(req, res, next) {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password, new password, and confirmation are required'
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        // Validate password strength
        const passwordValidation = validator.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message
            });
        }

        next();
    },

    /**
     * Validate reference code generation request
     */
    validateReferenceCodeGeneration(req, res, next) {
        const { username, roleId } = req.body;

        if (!username || !roleId) {
            return res.status(400).json({
                success: false,
                message: 'Username and role ID are required'
            });
        }

        // Validate username format
        const usernameValidation = validator.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message
            });
        }

        // If email is provided, validate format
        if (req.body.email) {
            const emailValidation = validator.validateEmail(req.body.email);
            if (!emailValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: emailValidation.message
                });
            }
        }

        next();
    },

    /**
     * Validate password reset code generation
     */
    validatePasswordResetGeneration(req, res, next) {
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Target user ID is required'
            });
        }

        // Ensure it's a valid integer
        if (!Number.isInteger(parseInt(targetUserId))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        next();
    },

    /**
     * Validate role update request
     */
    validateRoleUpdate(req, res, next) {
        const { roleId } = req.body;

        if (!roleId) {
            return res.status(400).json({
                success: false,
                message: 'Role ID is required'
            });
        }

        // Ensure it's a valid integer
        if (!Number.isInteger(parseInt(roleId))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID format'
            });
        }

        next();
    },

    /**
     * Validate service update request
     */
    validateServiceUpdate(req, res, next) {
        const { serviceId } = req.body;

        // serviceId can be null but if provided must be valid
        if (serviceId !== undefined && serviceId !== null) {
            // Ensure it's a valid integer
            if (!Number.isInteger(parseInt(serviceId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service ID format'
                });
            }
        }

        next();
    },

    /**
     * Validate 2FA settings update
     */
    validate2FAUpdate(req, res, next) {
        const { totpEnabled, webauthnEnabled, require2FA } = req.body;

        // Ensure all fields are boolean if provided
        if (totpEnabled !== undefined && typeof totpEnabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'TOTP enabled flag must be a boolean'
            });
        }

        if (webauthnEnabled !== undefined && typeof webauthnEnabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'WebAuthn enabled flag must be a boolean'
            });
        }

        if (require2FA !== undefined && typeof require2FA !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Require 2FA flag must be a boolean'
            });
        }

        next();
    },

    /**
     * Validate account lock status update
     */
    validateLockStatus(req, res, next) {
        const { locked, reason } = req.body;

        if (locked === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Lock status is required'
            });
        }

        // Ensure it's a boolean
        if (typeof locked !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Lock status must be a boolean'
            });
        }

        // Reason is required when locking an account
        if (locked && !reason) {
            return res.status(400).json({
                success: false,
                message: 'Reason is required when locking an account'
            });
        }

        next();
    },

    /**
     * Validate username input
     */
    validateUsername(req, res, next) {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        // Validate username format
        const usernameValidation = validator.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: usernameValidation.message
            });
        }

        next();
    }
};

/**
 * Log validation failures
 * @param {Object} req - Express request
 * @param {string} validationType - Type of validation
 * @param {string} reason - Reason for failure
 */
const logValidationFailure = async (req, validationType, reason) => {
    try {
        await logService.securityLog({
            eventType: 'validation.failed',
            severity: 'low',
            userId: req.auth?.userId || null,
            ipAddress: req.ip,
            deviceFingerprint: req.get('X-Device-Fingerprint') || null,
            metadata: {
                validationType,
                reason,
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'] || 'unknown'
            }
        });
    } catch (error) {
        console.error('Failed to log validation failure:', error);
    }
};

module.exports = validation;