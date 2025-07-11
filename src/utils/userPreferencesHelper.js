/**
 * User preferences helper utilities
 * Provides consistent functions for fetching and using user preferences across services
 */

const { User, UserPreference } = require('../db');
const DateFormatter = require('./dateFormatter');

class UserPreferencesHelper {
    /**
     * Get user's date and time formatting preferences
     * @param {number|string} userIdentifier - User ID or email address
     * @returns {Promise<Object>} User preferences with defaults
     */
    static async getUserDateTimePreferences(userIdentifier) {
        const defaults = {
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h'
        };

        try {
            // Find user by ID or email
            let user;
            if (typeof userIdentifier === 'number' || /^\d+$/.test(userIdentifier)) {
                user = await User.findByPk(userIdentifier);
            } else {
                user = await User.findOne({ where: { email: userIdentifier } });
            }

            if (!user) {
                console.warn(`User not found for identifier: ${userIdentifier}`);
                return defaults;
            }

            // Get user preferences
            const userPreference = await UserPreference.findOne({
                where: { user_id: user.id }
            });

            if (!userPreference || !userPreference.preferences) {
                return defaults;
            }

            return {
                dateFormat: userPreference.preferences.dateFormat || defaults.dateFormat,
                timeFormat: userPreference.preferences.timeFormat || defaults.timeFormat
            };

        } catch (error) {
            console.error('Error fetching user date/time preferences:', error);
            return defaults;
        }
    }

    /**
     * Format a date using user's preferences
     * @param {Date|string} date - Date to format
     * @param {number|string} userIdentifier - User ID or email address
     * @param {string} defaultFormat - Default format if user prefs not available
     * @returns {Promise<string>} Formatted date string
     */
    static async formatDateForUser(date, userIdentifier, defaultFormat = 'DD/MM/YYYY') {
        if (!date) return '';

        try {
            const userPrefs = await this.getUserDateTimePreferences(userIdentifier);
            return DateFormatter.formatDate(date, userPrefs.dateFormat);
        } catch (error) {
            console.error('Error formatting date for user:', error);
            return DateFormatter.formatDate(date, defaultFormat);
        }
    }

    /**
     * Format a date and time using user's preferences
     * @param {Date|string} date - Date to format
     * @param {number|string} userIdentifier - User ID or email address
     * @param {string} defaultDateFormat - Default date format
     * @param {string} defaultTimeFormat - Default time format
     * @returns {Promise<string>} Formatted date and time string
     */
    static async formatDateTimeForUser(date, userIdentifier, defaultDateFormat = 'DD/MM/YYYY', defaultTimeFormat = '24h') {
        if (!date) return '';

        try {
            const userPrefs = await this.getUserDateTimePreferences(userIdentifier);
            return DateFormatter.formatDateTime(date, userPrefs.dateFormat, userPrefs.timeFormat);
        } catch (error) {
            console.error('Error formatting date/time for user:', error);
            return DateFormatter.formatDateTime(date, defaultDateFormat, defaultTimeFormat);
        }
    }

    /**
     * Format a date for display in emails using user's preferences
     * @param {Date|string} date - Date to format
     * @param {number|string} userIdentifier - User ID or email address
     * @param {boolean} includeTime - Whether to include time
     * @returns {Promise<string>} Formatted date string for email
     */
    static async formatDateForEmail(date, userIdentifier, includeTime = false) {
        if (!date) return '';

        try {
            const userPrefs = await this.getUserDateTimePreferences(userIdentifier);
            
            if (includeTime) {
                return DateFormatter.formatDateTime(date, userPrefs.dateFormat, userPrefs.timeFormat);
            } else {
                return DateFormatter.formatDate(date, userPrefs.dateFormat);
            }
        } catch (error) {
            console.error('Error formatting date for email:', error);
            // Fallback to European format for emails
            if (includeTime) {
                return DateFormatter.formatDateTime(date, 'DD/MM/YYYY', '24h');
            } else {
                return DateFormatter.formatDate(date, 'DD/MM/YYYY');
            }
        }
    }

    /**
     * Get formatted date examples for UI display
     * @param {string} dateFormat - Date format
     * @param {string} timeFormat - Time format
     * @returns {Object} Examples for date and time formats
     */
    static getFormatExamples(dateFormat, timeFormat) {
        return {
            date: DateFormatter.getDateFormatExample(dateFormat),
            time: DateFormatter.getTimeFormatExample(timeFormat),
            dateTime: DateFormatter.formatDateTime(new Date(), dateFormat, timeFormat)
        };
    }

    /**
     * Validate date and time format preferences
     * @param {string} dateFormat - Date format to validate
     * @param {string} timeFormat - Time format to validate
     * @returns {Object} Validation result
     */
    static validateDateTimeFormats(dateFormat, timeFormat) {
        const validDateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
        const validTimeFormats = ['12h', '24h'];

        const result = {
            valid: true,
            errors: []
        };

        if (dateFormat && !validDateFormats.includes(dateFormat)) {
            result.valid = false;
            result.errors.push(`Invalid date format: ${dateFormat}. Valid formats: ${validDateFormats.join(', ')}`);
        }

        if (timeFormat && !validTimeFormats.includes(timeFormat)) {
            result.valid = false;
            result.errors.push(`Invalid time format: ${timeFormat}. Valid formats: ${validTimeFormats.join(', ')}`);
        }

        return result;
    }
}

module.exports = UserPreferencesHelper;