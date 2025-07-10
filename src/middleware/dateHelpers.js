/**
 * Middleware to add date formatting helpers to EJS views
 * Includes user-specific date/time format preferences
 */

const DateFormatter = require('../utils/dateFormatter');
const userService = require('../services/userService');

/**
 * Middleware to add date helpers to res.locals
 */
async function dateHelpers(req, res, next) {
    try {
        let userDateFormat = 'MM/DD/YYYY';
        let userTimeFormat = '12h'; // Fixed format since time is not user-configurable

        // DateHelpers middleware running

        // Get user preferences if authenticated
        if (req.auth && req.auth.userId) {
            try {
                // Fetching display preferences for user
                const prefsResult = await userService.getUserDisplayPreferences(req.auth.userId);
                // Display preferences loaded
                if (prefsResult.success && prefsResult.preferences) {
                    userDateFormat = prefsResult.preferences.dateFormat || 'MM/DD/YYYY';
                    // Time format is fixed to 12h since it's not user-configurable
                    // Setting user preferences
                }
            } catch (error) {
                console.error('Error loading user display preferences:', error);
                // Use defaults if error
            }
        } else {
            // No authenticated user, using defaults
        }

        // Add formatting functions to res.locals for use in EJS templates
        res.locals.formatDate = function(date, format = userDateFormat) {
            return DateFormatter.formatDate(date, format);
        };

        res.locals.formatTime = function(date, format = userTimeFormat) {
            return DateFormatter.formatTime(date, format);
        };

        res.locals.formatDateTime = function(date, dateFormat = userDateFormat, timeFormat = userTimeFormat) {
            return DateFormatter.formatDateTime(date, dateFormat, timeFormat);
        };

        res.locals.formatForDisplay = function(date, includeTime = true) {
            return DateFormatter.formatForDisplay(date, userDateFormat, userTimeFormat, includeTime);
        };

        res.locals.formatRelative = function(date) {
            return DateFormatter.formatRelative(date);
        };

        res.locals.formatForInput = function(date) {
            return DateFormatter.formatForInput(date);
        };

        // Add user's current preferences to locals
        res.locals.userDateFormat = userDateFormat;
        res.locals.userTimeFormat = userTimeFormat; // Keep for internal use only

        // Add a script tag to inject preferences into client-side JavaScript
        res.locals.datePreferencesScript = `
            <script>
                // User date preferences are set
                window.userDateFormat = '${userDateFormat}';
                window.userTimeFormat = '12h'; // Fixed format since time is not user-configurable
                
                // Client-side date formatting functions
                window.formatDate = function(date, format = window.userDateFormat) {
                    if (!date) return '';
                    
                    try {
                        const dateObj = new Date(date);
                        if (isNaN(dateObj.getTime())) return '';
                        
                        const pad = (num) => num.toString().padStart(2, '0');
                        const month = pad(dateObj.getMonth() + 1);
                        const day = pad(dateObj.getDate());
                        const year = dateObj.getFullYear();
                        
                        switch (format) {
                            case 'MM/DD/YYYY':
                                return month + '/' + day + '/' + year;
                            case 'DD/MM/YYYY':
                                return day + '/' + month + '/' + year;
                            case 'YYYY-MM-DD':
                                return year + '-' + month + '-' + day;
                            default:
                                return month + '/' + day + '/' + year;
                        }
                    } catch (error) {
                        console.error('Date formatting error:', error);
                        return '';
                    }
                };
                
                window.formatTime = function(date, format = '12h') {
                    if (!date) return '';
                    
                    try {
                        const dateObj = new Date(date);
                        if (isNaN(dateObj.getTime())) return '';
                        
                        const pad = (num) => num.toString().padStart(2, '0');
                        const hours = dateObj.getHours();
                        const minutes = pad(dateObj.getMinutes());
                        
                        // Always use 12-hour format since time format is not user-configurable
                        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        return hour12 + ':' + minutes + ' ' + ampm;
                    } catch (error) {
                        console.error('Time formatting error:', error);
                        return '';
                    }
                };
                
                window.formatDateTime = function(date, dateFormat = window.userDateFormat, timeFormat = '12h') {
                    if (!date) return '';
                    const formattedDate = window.formatDate(date, dateFormat);
                    const formattedTime = window.formatTime(date, timeFormat);
                    if (!formattedDate || !formattedTime) return formattedDate || formattedTime || '';
                    return formattedDate + ' ' + formattedTime;
                };
            </script>
        `;

        // Add example text helpers
        res.locals.getDateFormatExample = function(format) {
            return DateFormatter.getDateFormatExample(format);
        };

        next();
    } catch (error) {
        console.error('Date helpers middleware error:', error);
        // Add default helpers even if there's an error
        res.locals.formatDate = function(date) {
            return DateFormatter.formatDate(date, 'MM/DD/YYYY');
        };
        res.locals.formatTime = function(date) {
            return DateFormatter.formatTime(date, '12h');
        };
        res.locals.formatDateTime = function(date) {
            return DateFormatter.formatDateTime(date, 'MM/DD/YYYY', '12h');
        };
        res.locals.formatForDisplay = function(date, includeTime = true) {
            return DateFormatter.formatForDisplay(date, 'MM/DD/YYYY', '12h', includeTime);
        };
        res.locals.formatRelative = function(date) {
            return DateFormatter.formatRelative(date);
        };
        res.locals.formatForInput = function(date) {
            return DateFormatter.formatForInput(date);
        };
        res.locals.userDateFormat = 'MM/DD/YYYY';
        res.locals.userTimeFormat = '12h'; // Fixed format for internal use
        res.locals.getDateFormatExample = function(format) {
            return DateFormatter.getDateFormatExample(format);
        };
        next();
    }
}

module.exports = dateHelpers;