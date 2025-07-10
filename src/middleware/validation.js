// middleware/validation.js
const validator = require('../utils/validator');
const logService = require('../services/logService');
const { validationResult } = require('express-validator');

/**
 * Middleware for validating API inputs
 */
const validation = {
    // ============================================
    // AUTHENTICATION VALIDATIONS
    // ============================================

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
        const refreshToken = req.cookies.refreshToken;

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
    },

    /**
     * Validate full name update request
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware
     */
    validateFullNameUpdate(req, res, next){
        const { fullName } = req.body;

        // Full name is optional, but if provided, validate it
        if (fullName !== undefined && fullName !== null) {
            // Check if it's a string
            if (typeof fullName !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Full name must be a string'
                });
            }

            // Check length constraints
            const trimmedName = fullName.trim();
            if (trimmedName.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name cannot be empty'
                });
            }

            if (trimmedName.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name cannot exceed 255 characters'
                });
            }

            // Check for invalid characters (optional - adjust as needed)
            // This allows letters, spaces, hyphens, apostrophes, and periods
            const nameRegex = /^[a-zA-Z\s\-'.À-ÿ]+$/;
            if (!nameRegex.test(trimmedName)) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name contains invalid characters'
                });
            }
        }

        // Continue to next middleware
        next();
    },


    // ============================================
    // USER MANAGEMENT VALIDATIONS
    // ============================================

    /**
     * Validate user creation request
     */
    validateUserCreation(req, res, next) {
        const { username, roleId, serviceId, email } = req.body;
        const errors = [];

        // Username validation
        if (!username) {
            errors.push('Username is required');
        } else {
            // Validate username format
            const usernameValidation = validator.validateUsername(username);
            if (!usernameValidation.valid) {
                errors.push(usernameValidation.message);
            }
        }

        // Role ID validation
        if (!roleId) {
            errors.push('Role ID is required');
        } else if (!Number.isInteger(parseInt(roleId)) || parseInt(roleId) <= 0) {
            errors.push('Role ID must be a positive integer');
        }

        // Service ID validation (optional)
        if (serviceId !== undefined && serviceId !== null) {
            if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
                errors.push('Service ID must be a positive integer');
            }
        }

        // Email validation (optional)
        if (email) {
            const emailValidation = validator.validateEmail(email);
            if (!emailValidation.valid) {
                errors.push(emailValidation.message);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate reference code generation for existing user
     */
    validateReferenceCodeGenerationForExistingUser(req, res, next) {
        const { userId, require2FA } = req.body;
        const errors = [];

        // User ID validation
        if (!userId) {
            errors.push('User ID is required');
        } else if (!Number.isInteger(parseInt(userId)) || parseInt(userId) <= 0) {
            errors.push('User ID must be a positive integer');
        }

        // require2FA validation (optional)
        if (require2FA !== undefined && typeof require2FA !== 'boolean') {
            errors.push('require2FA must be a boolean value');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate reference code generation request (legacy - for backwards compatibility)
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
     * Validate service update request (for updating user's service)
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

    // ============================================
    // SERVICE MANAGEMENT VALIDATIONS
    // ============================================

    /**
     * Validate service creation request
     */
    validateServiceCreation(req, res, next) {
        const { name, email, description } = req.body;
        const errors = [];

        // Name validation (required)
        if (!name) {
            errors.push('Service name is required');
        } else if (typeof name !== 'string' || name.trim().length === 0) {
            errors.push('Service name must be a non-empty string');
        } else if (name.trim().length > 100) {
            errors.push('Service name must be less than 100 characters');
        }

        // Email validation (required)
        if (!email) {
            errors.push('Service email is required');
        } else if (typeof email !== 'string') {
            errors.push('Service email must be a string');
        } else {
            const emailValidation = validator.validateEmail(email);
            if (!emailValidation.valid) {
                errors.push(emailValidation.message);
            } else if (email.length > 255) {
                errors.push('Email must be less than 255 characters');
            }
        }

        // Description validation (optional)
        if (description !== undefined && description !== null) {
            if (typeof description !== 'string') {
                errors.push('Description must be a string');
            } else if (description.length > 1000) {
                errors.push('Description must be less than 1000 characters');
            }
        }

        if (errors.length > 0) {
            logValidationFailure(req, 'service_creation', errors.join(', '));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate service update request
     */
    validateServiceManagementUpdate(req, res, next) {
        const { name, email, description, active } = req.body;
        const { serviceId } = req.params;
        const errors = [];

        // Validate service ID from params
        if (!serviceId) {
            errors.push('Service ID is required');
        } else if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
            errors.push('Service ID must be a positive integer');
        }

        // Name validation (optional for update)
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                errors.push('Service name must be a non-empty string');
            } else if (name.trim().length > 100) {
                errors.push('Service name must be less than 100 characters');
            }
        }

        // Email validation (optional for update)
        if (email !== undefined) {
            if (typeof email !== 'string') {
                errors.push('Service email must be a string');
            } else {
                const emailValidation = validator.validateEmail(email);
                if (!emailValidation.valid) {
                    errors.push(emailValidation.message);
                } else if (email.length > 255) {
                    errors.push('Email must be less than 255 characters');
                }
            }
        }

        // Description validation (optional)
        if (description !== undefined && description !== null) {
            if (typeof description !== 'string') {
                errors.push('Description must be a string');
            } else if (description.length > 1000) {
                errors.push('Description must be less than 1000 characters');
            }
        }

        // Active status validation (optional)
        if (active !== undefined && typeof active !== 'boolean') {
            errors.push('Active status must be a boolean');
        }

        if (errors.length > 0) {
            logValidationFailure(req, 'service_update', errors.join(', '));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate service search request
     */
    validateServiceSearch(req, res, next) {
        const { term } = req.params;
        const { limit } = req.query;
        const errors = [];

        // Search term validation
        if (!term) {
            errors.push('Search term is required');
        } else if (typeof term !== 'string' || term.trim().length < 2) {
            errors.push('Search term must be at least 2 characters long');
        } else if (term.length > 100) {
            errors.push('Search term must be less than 100 characters');
        }

        // Limit validation (optional)
        if (limit !== undefined) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
                errors.push('Limit must be between 1 and 50');
            }
        }

        if (errors.length > 0) {
            logValidationFailure(req, 'service_search', errors.join(', '));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate user transfer between services
     */
    validateUserTransfer(req, res, next) {
        const { serviceId } = req.params; // Source service ID
        const { toServiceId } = req.body;
        const errors = [];

        // Source service ID validation
        if (!serviceId) {
            errors.push('Source service ID is required');
        } else if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
            errors.push('Source service ID must be a positive integer');
        }

        // Target service ID validation
        if (!toServiceId) {
            errors.push('Target service ID is required');
        } else if (!Number.isInteger(parseInt(toServiceId)) || parseInt(toServiceId) <= 0) {
            errors.push('Target service ID must be a positive integer');
        }

        // Check if source and target are different
        if (serviceId && toServiceId && parseInt(serviceId) === parseInt(toServiceId)) {
            errors.push('Cannot transfer users to the same service');
        }

        if (errors.length > 0) {
            logValidationFailure(req, 'user_transfer', errors.join(', '));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    /**
     * Validate service filters for listing
     */
    validateServiceFilters(req, res, next) {
        const { name, email, active, page, limit } = req.query;
        const errors = [];

        // Name filter validation (optional)
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                errors.push('Name filter must be a non-empty string');
            } else if (name.length > 100) {
                errors.push('Name filter must be less than 100 characters');
            }
        }

        // Email filter validation (optional)
        if (email !== undefined) {
            if (typeof email !== 'string' || email.trim().length === 0) {
                errors.push('Email filter must be a non-empty string');
            } else if (email.length > 255) {
                errors.push('Email filter must be less than 255 characters');
            }
        }

        // Active filter validation (optional)
        if (active !== undefined) {
            if (!['true', 'false'].includes(active)) {
                errors.push('Active filter must be "true" or "false"');
            }
        }

        // Page validation (optional)
        if (page !== undefined) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                errors.push('Page must be a positive integer');
            }
        }

        // Limit validation (optional)
        if (limit !== undefined) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                errors.push('Limit must be between 1 and 100');
            }
        }

        if (errors.length > 0) {
            logValidationFailure(req, 'service_filters', errors.join(', '));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    },

    // ============================================
    // COMMON VALIDATIONS
    // ============================================

    /**
     * Validate ID parameter
     */
    validateId(req, res, next) {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID is required'
            });
        }

        const idNum = parseInt(id);
        if (isNaN(idNum) || idNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        next();
    },

    /**
     * Validate search term
     */
    validateSearchTerm(req, res, next) {
        const { term } = req.params;

        if (!term || term.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search term is required'
            });
        }

        if (term.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Search term is too long'
            });
        }

        next();
    },



    /**
     * Validate date range
     */
    validateDateRange(req, res, next) {
        const { startDate, endDate } = req.query;

        if (startDate && !validator.isValidDate(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid start date format'
            });
        }

        if (endDate && !validator.isValidDate(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid end date format'
            });
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start > end) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date cannot be after end date'
                });
            }
        }

        next();
    },

    /**
     * Validate optional date
     */
    validateOptionalDate(req, res, next) {
        const { startDate } = req.query;

        if (startDate && !validator.isValidDate(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        next();
    },

    /**
     * Validate pagination parameters
     */
    validatePagination(req, res, next) {
        const { page, limit } = req.query;

        if (page) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Page must be a positive integer'
                });
            }
        }

        if (limit) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 2000) {
                return res.status(400).json({
                    success: false,
                    message: 'Limit must be between 1 and 2000'
                });
            }
        }

        next();
    },

    /**
     * Validate department filter
     */
    validateDepartmentFilter(req, res, next) {
        const { department } = req.query;

        if (department && department.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Department name is too long'
            });
        }

        next();
    },

    // ============================================
    // PATIENT VALIDATIONS
    // ============================================

    /**
     * Validate patient creation
     */
    validatePatientCreate(req, res, next) {
        const { name, matriculeNational, dateOfBirth, gender, phone, email } = req.body;

        // Required fields
        if (!name || !matriculeNational) {
            return res.status(400).json({
                success: false,
                message: 'Patient name and national ID are required'
            });
        }

        // Validate name length
        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Patient name is too long'
            });
        }

        // Validate matricule national format (basic validation)
        if (matriculeNational.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'National ID is too long'
            });
        }

        // Validate date of birth if provided
        if (dateOfBirth && !validator.isValidDate(dateOfBirth)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date of birth format'
            });
        }

        // Validate gender if provided
        if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Gender must be Male, Female, or Other'
            });
        }

        // Validate phone if provided
        if (phone && phone.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is too long'
            });
        }

        // Validate email if provided
        if (email && !validator.validateEmail(email).valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        next();
    },

    /**
     * Validate patient update
     */
    validatePatientUpdate(req, res, next) {
        // Same as create but all fields are optional
        const { name, matriculeNational, dateOfBirth, gender, phone, email } = req.body;

        // Validate name length if provided
        if (name && name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Patient name is too long'
            });
        }

        // Validate matricule national if provided
        if (matriculeNational && matriculeNational.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'National ID is too long'
            });
        }

        // Validate date of birth if provided
        if (dateOfBirth && !validator.isValidDate(dateOfBirth)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date of birth format'
            });
        }

        // Validate gender if provided
        if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Gender must be Male, Female, or Other'
            });
        }

        // Validate phone if provided
        if (phone && phone.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is too long'
            });
        }

        // Validate email if provided
        if (email && !validator.validateEmail(email).valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        next();
    },

    /**
     * Validate patient filters
     */
    validatePatientFilters(req, res, next) {
        const { name, matriculeNational, doctorId, roomId, active, page, limit } = req.query;

        // Validate string filters
        if (name && name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name filter is too long'
            });
        }

        if (matriculeNational && matriculeNational.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'National ID filter is too long'
            });
        }

        // Validate ID filters
        if (doctorId && (isNaN(parseInt(doctorId)) || parseInt(doctorId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid doctor ID'
            });
        }

        if (roomId && (isNaN(parseInt(roomId)) || parseInt(roomId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID'
            });
        }

        // Validate boolean filter
        if (active && !['true', 'false'].includes(active)) {
            return res.status(400).json({
                success: false,
                message: 'Active filter must be true or false'
            });
        }

        // Validate pagination
        validation.validatePagination(req, res, next);
    },

    // ============================================
    // DOCTOR VALIDATIONS
    // ============================================

    /**
     * Validate doctor creation
     */
    validateDoctorCreate(req, res, next) {
        const { name, specialization, phone, email } = req.body;

        // Required field
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Doctor name is required'
            });
        }

        // Validate name length
        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Doctor name is too long'
            });
        }

        // Validate specialization if provided
        if (specialization && specialization.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Specialization is too long'
            });
        }

        // Validate phone if provided
        if (phone && phone.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is too long'
            });
        }

        // Validate email if provided
        if (email && !validator.validateEmail(email).valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        next();
    },

    /**
     * Validate doctor update
     */
    validateDoctorUpdate(req, res, next) {
        const { name, specialization, phone, email } = req.body;

        // Validate name length if provided
        if (name && name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Doctor name is too long'
            });
        }

        // Validate specialization if provided
        if (specialization && specialization.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Specialization is too long'
            });
        }

        // Validate phone if provided
        if (phone && phone.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is too long'
            });
        }

        // Validate email if provided
        if (email && !validator.validateEmail(email).valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        next();
    },

    /**
     * Validate doctor filters
     */
    validateDoctorFilters(req, res, next) {
        const { name, specialization, active } = req.query;

        // Validate string filters
        if (name && name.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name filter is too long'
            });
        }

        if (specialization && specialization.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Specialization filter is too long'
            });
        }

        // Validate boolean filter
        if (active && !['true', 'false'].includes(active)) {
            return res.status(400).json({
                success: false,
                message: 'Active filter must be true or false'
            });
        }

        next();
    },

    // ============================================
    // ROOM VALIDATIONS
    // ============================================

// ============================================
    // ROOM VALIDATIONS (UPDATED FOR SERVICE_ID)
    // ============================================

    /**
     * Validate room creation
     */
    validateRoomCreate(req, res, next) {
        const { roomNumber, serviceId, capacity } = req.body;

        // Required field
        if (!roomNumber) {
            return res.status(400).json({
                success: false,
                message: 'Room number is required'
            });
        }

        // Validate room number format (4 digits)
        if (!roomNumber.match(/^\d{4}$/)) {
            return res.status(400).json({
                success: false,
                message: 'Room number must be exactly 4 digits'
            });
        }

        // Validate service ID if provided (optional)
        if (serviceId !== undefined && serviceId !== null) {
            if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID must be a positive integer'
                });
            }
        }

        // Validate capacity if provided
        if (capacity) {
            const cap = parseInt(capacity);
            if (isNaN(cap) || cap < 1 || cap > 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Capacity must be between 1 and 10'
                });
            }
        }

        next();
    },

    /**
     * Validate room update
     */
    validateRoomUpdate(req, res, next) {
        const { roomNumber, serviceId, capacity, active } = req.body;

        // Validate room number format if provided
        if (roomNumber && !roomNumber.match(/^\d{4}$/)) {
            return res.status(400).json({
                success: false,
                message: 'Room number must be exactly 4 digits'
            });
        }

        // Validate service ID if provided (can be null to unassign)
        if (serviceId !== undefined && serviceId !== null) {
            if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID must be a positive integer'
                });
            }
        }

        // Validate capacity if provided
        if (capacity) {
            const cap = parseInt(capacity);
            if (isNaN(cap) || cap < 1 || cap > 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Capacity must be between 1 and 10'
                });
            }
        }

        // Validate active status if provided
        if (active !== undefined && typeof active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Active status must be a boolean'
            });
        }

        next();
    },

    /**
     * Validate room filters
     */
    validateRoomFilters(req, res, next) {
        const { roomNumber, serviceId, active, page, limit } = req.query;

        // Validate room number filter
        if (roomNumber && roomNumber.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Room number filter is too long'
            });
        }

        // Validate service ID filter
        if (serviceId && (isNaN(parseInt(serviceId)) || parseInt(serviceId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Service ID filter must be a positive integer'
            });
        }

        // Validate boolean filter
        if (active && !['true', 'false'].includes(active)) {
            return res.status(400).json({
                success: false,
                message: 'Active filter must be true or false'
            });
        }

        // Validate pagination
        if (page) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Page must be a positive integer'
                });
            }
        }

        if (limit) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Limit must be between 1 and 100'
                });
            }
        }

        next();
    },

    /**
     * Validate service filter (replaces validateDepartmentFilter)
     */
    validateServiceFilter(req, res, next) {
        const { serviceId } = req.query;

        if (serviceId && (isNaN(parseInt(serviceId)) || parseInt(serviceId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Service ID must be a positive integer'
            });
        }

        next();
    },

    /**
     * Validate service analysis permissions update
     */
    validateServiceAnalysisPermissions(req, res, next) {
        const { serviceId } = req.params;
        const { canViewAllAnalyses } = req.body;

        // Validate service ID from params
        if (!serviceId) {
            return res.status(400).json({
                success: false,
                message: 'Service ID is required'
            });
        }

        if (!Number.isInteger(parseInt(serviceId)) || parseInt(serviceId) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Service ID must be a positive integer'
            });
        }

        // Validate canViewAllAnalyses flag
        if (canViewAllAnalyses === undefined) {
            return res.status(400).json({
                success: false,
                message: 'canViewAllAnalyses flag is required'
            });
        }

        if (typeof canViewAllAnalyses !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'canViewAllAnalyses must be a boolean value'
            });
        }

        next();
    },

    // ============================================
    // ANALYSIS VALIDATIONS
    // ============================================

    /**
     * Validate analysis creation
     */
    validateAnalysisCreate(req, res, next) {
        const { analysisDate, patientId, doctorId, roomId, analysisType } = req.body;
        console.log(req.body)
        // Required fields
        if (!analysisDate || !patientId || !doctorId || !roomId || !analysisType) {
            return res.status(400).json({
                success: false,
                message: 'Analysis date, patient, doctor, room, and analysis type are required'
            });
        }

        // Validate date
        if (!validator.isValidDate(analysisDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid analysis date format'
            });
        }

        // Validate IDs
        if (isNaN(parseInt(patientId)) || parseInt(patientId) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid patient ID'
            });
        }

        if (isNaN(parseInt(doctorId)) || parseInt(doctorId) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid doctor ID'
            });
        }

        if (isNaN(parseInt(roomId)) || parseInt(roomId) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID'
            });
        }

        // Analysis type validation is handled in the controller
        // Skip validation here since we need to check against dynamic configuration
        next();
    },

    /**
     * Validate analysis status update
     */
    validateAnalysisStatusUpdate(req, res, next) {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        next();
    },

    /**
     * Validate analysis cancellation
     */
    validateAnalysisCancel(req, res, next) {
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        if (reason.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is too long'
            });
        }

        next();
    },

    /**
     * Validate analysis filters
     */
    validateAnalysisFilters(req, res, next) {
        const { status, analysisType, patientId, doctorId, roomId, startDate, endDate } = req.query;

        // Validate status filter
        if (status) {
            const validStatuses = ['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status filter'
                });
            }
        }

        // Validate analysis type filter
        if (analysisType) {
            const validTypes = ['XY', 'YZ', 'ZG', 'HG'];
            if (!validTypes.includes(analysisType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid analysis type filter'
                });
            }
        }


        // Validate ID filters
        if (patientId && (isNaN(parseInt(patientId)) || parseInt(patientId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid patient ID filter'
            });
        }

        if (doctorId && (isNaN(parseInt(doctorId)) || parseInt(doctorId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid doctor ID filter'
            });
        }

        if (roomId && (isNaN(parseInt(roomId)) || parseInt(roomId) <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID filter'
            });
        }

        // Validate date filters
        if (startDate) {
            const startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid start date format'
                });
            }
        }

        if (endDate) {
            const endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid end date format'
                });
            }
        }

        // Validate date range
        if (startDate && endDate) {
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            if (startDateObj > endDateObj) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date cannot be after end date'
                });
            }
        }

        // Validate pagination
        validation.validatePagination(req, res, next);
    },

    // ============================================
    // ARCHIVE VALIDATIONS
    // ============================================

    /**
     * Validate archive filters
     */
    validateArchiveFilters(req, res, next) {
        const {
            patientName,
            matriculeNational,
            doctorName,
            roomNumber,
            analysisType,
            status
        } = req.query;

        // Validate string filters
        if (patientName && patientName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Patient name filter is too long'
            });
        }

        if (matriculeNational && matriculeNational.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'National ID filter is too long'
            });
        }

        if (doctorName && doctorName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Doctor name filter is too long'
            });
        }

        if (roomNumber && roomNumber.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Room number filter is too long'
            });
        }

        // Validate enum filters
        if (analysisType) {
            const validTypes = ['XY', 'YZ', 'ZG', 'HG'];
            if (!validTypes.includes(analysisType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid analysis type filter'
                });
            }
        }



        if (status) {
            const validStatuses = ['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status filter'
                });
            }
        }

        next();
    },

    /**
     * Validate export request
     */
    validateExportRequest(req, res, next) {
        const { format } = req.body;

        if (format && !['json', 'csv', 'excel'].includes(format)) {
            return res.status(400).json({
                success: false,
                message: 'Export format must be json, csv, or excel'
            });
        }

        next();
    },

    /**
     * Validate cleanup request
     */
    validateCleanupRequest(req, res, next) {
        const { olderThanDays } = req.body;

        if (!olderThanDays) {
            return res.status(400).json({
                success: false,
                message: 'olderThanDays is required'
            });
        }

        const days = parseInt(olderThanDays);
        if (isNaN(days) || days < 365) {
            return res.status(400).json({
                success: false,
                message: 'Must specify at least 365 days for cleanup'
            });
        }

        next();
    },

    /**
     * Validate basic document template data
     */
    validateDocumentData (req, res, next) {
        const { templateName, data } = req.body;

        // Validate template name
        if (!templateName || typeof templateName !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Template name is required and must be a string'
            });
        }

        // Validate template name format (alphanumeric, hyphens, underscores only)
        if (!templateName.match(/^[a-zA-Z0-9_-]+$/)) {
            return res.status(400).json({
                success: false,
                message: 'Template name contains invalid characters'
            });
        }

        // Validate data object
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                message: 'Template data is required and must be an object'
            });
        }

        // Check data size (prevent overly large payloads)
        const dataString = JSON.stringify(data);
        if (dataString.length > 50000) { // 50KB limit
            return res.status(400).json({
                success: false,
                message: 'Template data is too large (max 50KB)'
            });
        }

        next();
    },

    /**
     * Validate document generation request
     */
    validateDocumentGeneration(req, res, next){
        const { format } = req.body;

        // First run basic validation
        validation.validateDocumentData(req, res, (err) => {
            if (err) return;

            // Validate format if provided
            if (format && !['pdf', 'html'].includes(format)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format must be either "pdf" or "html"'
                });
            }

            next();
        });
    },

    /**
     * Validate user export request
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware
     */

    validateUserExport(req, res, next) {
        const { password, filters = {}, includeColumns, excludeColumns } = req.body;

        // Validate password is provided
        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required for export operations'
            });
        }

        // Validate password is a string and not empty
        if (typeof password !== 'string' || password.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Password must be a non-empty string'
            });
        }

        // Validate filters if provided
        if (filters && typeof filters !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Filters must be an object'
            });
        }

        // Validate filter values if provided
        if (filters.username && typeof filters.username !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Username filter must be a string'
            });
        }

        if (filters.fullName && typeof filters.fullName !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Full name filter must be a string'
            });
        }

        if (filters.email && typeof filters.email !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Email filter must be a string'
            });
        }

        if (filters.roleId && (!Number.isInteger(filters.roleId) || filters.roleId <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Role ID filter must be a positive integer'
            });
        }

        if (filters.serviceId && (!Number.isInteger(filters.serviceId) || filters.serviceId <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Service ID filter must be a positive integer'
            });
        }

        // Validate filter string lengths to prevent abuse
        const maxFilterLength = 100;

        if (filters.username && filters.username.length > maxFilterLength) {
            return res.status(400).json({
                success: false,
                message: 'Username filter is too long'
            });
        }

        if (filters.fullName && filters.fullName.length > maxFilterLength) {
            return res.status(400).json({
                success: false,
                message: 'Full name filter is too long'
            });
        }

        if (filters.email && filters.email.length > maxFilterLength) {
            return res.status(400).json({
                success: false,
                message: 'Email filter is too long'
            });
        }

        // Define allowed columns for export (security whitelist)
        const allowedColumns = [
            'id', 'username', 'fullName', 'email', 'isRegistered',
            'role', 'roleId', 'service', 'serviceId', 'serviceEmail',
            'totpEnabled', 'webauthnEnabled', 'accountLocked', 'accountLockedUntil',
            'failedLoginAttempts', 'lastLogin', 'lastLoginAttempt', 'lastIpAddress',
            'createdAt', 'updatedAt', 'createdBy', 'createdById'
        ];

        // Validate includeColumns if provided
        if (includeColumns !== undefined) {
            if (!Array.isArray(includeColumns)) {
                return res.status(400).json({
                    success: false,
                    message: 'includeColumns must be an array'
                });
            }

            if (includeColumns.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'includeColumns cannot be empty'
                });
            }

            // Check for invalid columns
            const invalidColumns = includeColumns.filter(col => !allowedColumns.includes(col));
            if (invalidColumns.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid columns in includeColumns: ${invalidColumns.join(', ')}`
                });
            }
        }

        // Validate excludeColumns if provided
        if (excludeColumns !== undefined) {
            if (!Array.isArray(excludeColumns)) {
                return res.status(400).json({
                    success: false,
                    message: 'excludeColumns must be an array'
                });
            }

            // Check for invalid columns
            const invalidColumns = excludeColumns.filter(col => !allowedColumns.includes(col));
            if (invalidColumns.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid columns in excludeColumns: ${invalidColumns.join(', ')}`
                });
            }
        }

        // Prevent both includeColumns and excludeColumns being specified
        if (includeColumns && excludeColumns) {
            return res.status(400).json({
                success: false,
                message: 'Cannot specify both includeColumns and excludeColumns. Use one or the other.'
            });
        }

        // Store allowed columns for use in controller
        req.allowedColumns = allowedColumns;

        next();
    },


    // ============================================
    // ORGANIZATION SETTINGS VALIDATIONS
    // ============================================

    /**
     * Validate setting key
     */
    validateSettingKey(req, res, next) {
        const { key } = req.params;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: 'Setting key is required'
            });
        }

        if (key.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Setting key is too long'
            });
        }

        next();
    },

    /**
     * Validate setting creation
     */
    validateSettingCreate(req, res, next) {
        const { key, value, dataType } = req.body;

        if (!key || value === undefined || !dataType) {
            return res.status(400).json({
                success: false,
                message: 'Key, value, and data type are required'
            });
        }

        if (key.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Setting key is too long'
            });
        }

        const validDataTypes = ['string', 'integer', 'decimal', 'boolean', 'json'];
        if (!validDataTypes.includes(dataType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid data type'
            });
        }

        next();
    },

    /**
     * Validate setting update
     */
    validateSettingUpdate(req, res, next) {
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Value is required'
            });
        }
        next();
    },

    /**
     * Validate bulk settings update
     */
    validateBulkSettingsUpdate(req, res, next) {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Settings object is required'
            });
        }

        if (Object.keys(settings).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one setting must be provided'
            });
        }

        next();
    },

/**
 * Validate organization settings export specific filters
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
 validateSettingsExportFilters(req, res, next) {
    const { filters } = req.body;

    if (filters) {
        // Validate dataType filter
        if (filters.dataType && !['string', 'integer', 'decimal', 'boolean', 'json'].includes(filters.dataType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid dataType filter. Must be one of: string, integer, decimal, boolean, json'
            });
        }

        // Validate hasDescription filter
        if (filters.hasDescription !== undefined && typeof filters.hasDescription !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'hasDescription filter must be a boolean'
            });
        }

        // Validate key filter
        if (filters.key && typeof filters.key !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'key filter must be a string'
            });
        }
    }

    next();
},

/**
 * Validate language update request
 */
validateLanguageUpdate(req, res, next) {
    const { language } = req.body;
    const errors = [];

    if (!language) {
        errors.push('Language is required');
    } else if (typeof language !== 'string') {
        errors.push('Language must be a string');
    } else if (!['en', 'fr', 'es'].includes(language)) {
        errors.push('Language must be one of: en, fr, es');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
},

/**
 * Validate request using express-validator and handle errors
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
validateRequest(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        
        // Log validation failure
        logValidationFailure(req, 'express_validator', errorMessages.join(', '));
        
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
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

// ===== ANNOUNCEMENT VALIDATION =====

/**
 * Validate announcement creation
 */
validation.validateAnnouncementCreate = function(req, res, next) {
    const { 
        title, 
        message, 
        type = 'info', 
        priority = 'normal', 
        target_audience = 'all',
        target_roles,
        scheduled_for,
        expires_at
    } = req.body;
    const errors = [];

    // Title validation
    if (!title || title.trim().length === 0) {
        errors.push('Title is required');
    } else if (title.length > 200) {
        errors.push('Title must be 200 characters or less');
    }

    // Message validation
    if (!message || message.trim().length === 0) {
        errors.push('Message is required');
    } else if (message.length > 5000) {
        errors.push('Message must be 5000 characters or less');
    }

    // Type validation
    const validTypes = ['info', 'warning', 'critical', 'maintenance', 'success'];
    if (!validTypes.includes(type)) {
        errors.push('Invalid announcement type');
    }

    // Priority validation
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
        errors.push('Invalid priority level');
    }

    // Target audience validation
    const validAudiences = ['all', 'admins', 'staff', 'specific_role'];
    if (!validAudiences.includes(target_audience)) {
        errors.push('Invalid target audience');
    }

    // Target roles validation
    if (target_audience === 'specific_role') {
        if (!target_roles || !Array.isArray(target_roles) || target_roles.length === 0) {
            errors.push('Target roles are required when target audience is specific_role');
        }
    }

    // Date validation
    if (scheduled_for) {
        const scheduledDate = new Date(scheduled_for);
        if (isNaN(scheduledDate.getTime())) {
            errors.push('Invalid scheduled date format');
        } else if (scheduledDate < new Date()) {
            errors.push('Scheduled date must be in the future');
        }
    }

    if (expires_at) {
        const expiryDate = new Date(expires_at);
        if (isNaN(expiryDate.getTime())) {
            errors.push('Invalid expiry date format');
        } else if (expiryDate < new Date()) {
            errors.push('Expiry date must be in the future');
        }
    }

    if (scheduled_for && expires_at) {
        const scheduledDate = new Date(scheduled_for);
        const expiryDate = new Date(expires_at);
        if (expiryDate <= scheduledDate) {
            errors.push('Expiry date must be after scheduled date');
        }
    }

    if (errors.length > 0) {
        validation.logValidationFailure('announcement_create', errors.join(', '), req);
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

/**
 * Validate announcement update
 */
validation.validateAnnouncementUpdate = function(req, res, next) {
    // Use same validation as create for now
    // In the future, might have different rules for updates
    validation.validateAnnouncementCreate(req, res, next);
};

module.exports = validation;