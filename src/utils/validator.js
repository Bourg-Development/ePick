// utils/validator.js

/**
 * Validation utility functions
 */
const validator = {
    /**
     * Validate username format (6 digits)
     * @param {string} username - Username to validate
     * @returns {Object} - Validation result
     */
    validateUsername(username) {
        if (!username) {
            return { valid: false, message: 'Username is required' };
        }

        // Username must be exactly 6 digits
        const usernameRegex = /^\d{6}$/;
        if (!usernameRegex.test(username)) {
            return { valid: false, message: 'Username must be exactly 6 digits' };
        }

        return { valid: true };
    },

    /**
     * Validate TOTP code format
     * @param {string} totpCode - TOTP code to validate
     * @returns {Object} - Validation result
     */
    validateTOTPCode(totpCode) {
        if (!totpCode) {
            return { valid: false, message: 'TOTP code is required' };
        }

        // TOTP code should be 6 digits
        const totpRegex = /^\d{6}$/;
        if (!totpRegex.test(totpCode)) {
            return { valid: false, message: 'TOTP code must be 6 digits' };
        }

        return { valid: true };
    },

    /**
     * Validate reference code format
     * @param {string} referenceCode - Reference code to validate
     * @returns {Object} - Validation result
     */

    validateReferenceCode(referenceCode) {
        if (!referenceCode) {
            return { valid: false, message: 'Reference code is required' };
        }

        // Reference code should be in format XXX-XXX-XXX (9 digits with dashes)
        const refCodeRegex = /^\d{3}-\d{3}-\d{3}$/;
        if (!refCodeRegex.test(referenceCode)) {
            return { valid: false, message: 'Reference code must be in format XXX-XXX-XXX (digits only)' };
        }

        return { valid: true };
    },
    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} - Validation result
     */
    validatePassword(password) {
        if (!password) {
            return { valid: false, message: 'Password is required' };
        }

        // Minimum length requirement
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long' };
        }

        // Maximum length requirement
        if (password.length > 128) {
            return { valid: false, message: 'Password must not exceed 128 characters' };
        }

        // Must contain at least one lowercase letter
        if (!/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter' };
        }

        // Must contain at least one uppercase letter
        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter' };
        }

        // Must contain at least one digit
        if (!/\d/.test(password)) {
            return { valid: false, message: 'Password must contain at least one digit' };
        }

        // Must contain at least one special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one special character' };
        }

        // Check for common weak patterns
        const commonPatterns = [
            /(.)\1{2,}/, // Three or more repeated characters
            /123456|654321|abcdef|qwerty|password/i, // Common sequences
        ];

        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                return { valid: false, message: 'Password contains common weak patterns' };
            }
        }

        return { valid: true };
    },

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {Object} - Validation result
     */
    validateEmail(email) {
        if (!email) {
            return { valid: false, message: 'Email is required' };
        }

        // Basic email format regex - more comprehensive than the simple one
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!emailRegex.test(email)) {
            return { valid: false, message: 'Invalid email format' };
        }

        // Check length constraints
        if (email.length > 254) {
            return { valid: false, message: 'Email address is too long' };
        }

        // Check local part length (before @)
        const localPart = email.split('@')[0];
        if (localPart.length > 64) {
            return { valid: false, message: 'Email local part is too long' };
        }

        return { valid: true };
    },

    /**
     * Validate date format and validity
     * @param {string} dateString - Date string to validate
     * @returns {boolean} - True if valid date
     */
    isValidDate(dateString) {
        if (!dateString) {
            return false;
        }

        // Try to parse the date
        const date = new Date(dateString);

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return false;
        }

        // Check if the date string represents the same date after parsing
        // This catches invalid dates like "2023-02-30"
        const isoString = date.toISOString().split('T')[0];
        const inputDate = new Date(dateString).toISOString().split('T')[0];

        return isoString === inputDate;
    },

    /**
     * Validate phone number format
     * @param {string} phone - Phone number to validate
     * @returns {Object} - Validation result
     */
    validatePhone(phone) {
        if (!phone) {
            return { valid: false, message: 'Phone number is required' };
        }

        // Remove all non-digit characters for validation
        const cleanPhone = phone.replace(/\D/g, '');

        // Phone should be 8-15 digits (international standard)
        if (cleanPhone.length < 8 || cleanPhone.length > 15) {
            return { valid: false, message: 'Phone number must be 8-15 digits' };
        }

        return { valid: true };
    },

    /**
     * Validate national ID format (matricule national)
     * @param {string} matricule - National ID to validate
     * @returns {Object} - Validation result
     */
    validateMatriculeNational(matricule) {
        if (!matricule) {
            return { valid: false, message: 'National ID is required' };
        }

        // Basic validation - alphanumeric, 5-50 characters
        const matriculeRegex = /^[A-Za-z0-9]{5,50}$/;
        if (!matriculeRegex.test(matricule)) {
            return { valid: false, message: 'National ID must be 5-50 alphanumeric characters' };
        }

        return { valid: true };
    },

    /**
     * Validate room number format
     * @param {string} roomNumber - Room number to validate
     * @returns {Object} - Validation result
     */
    validateRoomNumber(roomNumber) {
        if (!roomNumber) {
            return { valid: false, message: 'Room number is required' };
        }

        // Room number must be exactly 4 digits
        const roomRegex = /^\d{4}$/;
        if (!roomRegex.test(roomNumber)) {
            return { valid: false, message: 'Room number must be exactly 4 digits' };
        }

        return { valid: true };
    },

    /**
     * Validate integer ID
     * @param {string|number} id - ID to validate
     * @returns {Object} - Validation result
     */
    validateId(id) {
        if (!id) {
            return { valid: false, message: 'ID is required' };
        }

        const idNum = parseInt(id);
        if (isNaN(idNum) || idNum <= 0) {
            return { valid: false, message: 'ID must be a positive integer' };
        }

        return { valid: true };
    },

    /**
     * Validate string length
     * @param {string} str - String to validate
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @param {string} fieldName - Field name for error message
     * @returns {Object} - Validation result
     */
    validateStringLength(str, minLength, maxLength, fieldName = 'Field') {
        if (!str && minLength > 0) {
            return { valid: false, message: `${fieldName} is required` };
        }

        if (str && str.length < minLength) {
            return { valid: false, message: `${fieldName} must be at least ${minLength} characters` };
        }

        if (str && str.length > maxLength) {
            return { valid: false, message: `${fieldName} must not exceed ${maxLength} characters` };
        }

        return { valid: true };
    },

    /**
     * Validate enum value
     * @param {string} value - Value to validate
     * @param {Array} validValues - Array of valid values
     * @param {string} fieldName - Field name for error message
     * @returns {Object} - Validation result
     */
    validateEnum(value, validValues, fieldName = 'Field') {
        if (!value) {
            return { valid: false, message: `${fieldName} is required` };
        }

        if (!validValues.includes(value)) {
            return { valid: false, message: `${fieldName} must be one of: ${validValues.join(', ')}` };
        }

        return { valid: true };
    },

    /**
     * Validate number range
     * @param {string|number} value - Value to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {string} fieldName - Field name for error message
     * @returns {Object} - Validation result
     */
    validateNumberRange(value, min, max, fieldName = 'Field') {
        if (!value && value !== 0) {
            return { valid: false, message: `${fieldName} is required` };
        }

        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, message: `${fieldName} must be a number` };
        }

        if (num < min || num > max) {
            return { valid: false, message: `${fieldName} must be between ${min} and ${max}` };
        }

        return { valid: true };
    }
};

module.exports = validator;