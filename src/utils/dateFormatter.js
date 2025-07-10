/**
 * Date and time formatting utilities
 * Handles user-specific date/time format preferences
 */

class DateFormatter {
    /**
     * Parse date from various formats
     * @param {Date|string} date - Date to parse
     * @returns {Date|null} Parsed date or null if invalid
     */
    static parseDate(date) {
        if (!date) return null;
        
        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }
        
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Pad number with leading zero
     * @param {number} num - Number to pad
     * @returns {string} Padded number string
     */
    static pad(num) {
        return num.toString().padStart(2, '0');
    }

    /**
     * Format a date according to user preference
     * @param {Date|string} date - Date to format
     * @param {string} format - User's preferred date format
     * @returns {string} Formatted date string
     */
    static formatDate(date, format = 'MM/DD/YYYY') {
        if (!date) return '';

        try {
            const dateObj = this.parseDate(date);
            if (!dateObj) return '';

            const month = this.pad(dateObj.getMonth() + 1);
            const day = this.pad(dateObj.getDate());
            const year = dateObj.getFullYear();

            switch (format) {
                case 'MM/DD/YYYY':
                    return `${month}/${day}/${year}`;
                case 'DD/MM/YYYY':
                    return `${day}/${month}/${year}`;
                case 'YYYY-MM-DD':
                    return `${year}-${month}-${day}`;
                default:
                    return `${month}/${day}/${year}`;
            }
        } catch (error) {
            console.error('Date formatting error:', error);
            return '';
        }
    }

    /**
     * Format a time according to user preference
     * @param {Date|string} date - Date/time to format
     * @param {string} format - User's preferred time format ('12h' or '24h')
     * @returns {string} Formatted time string
     */
    static formatTime(date, format = '12h') {
        if (!date) return '';

        try {
            const dateObj = this.parseDate(date);
            if (!dateObj) return '';

            const hours = dateObj.getHours();
            const minutes = this.pad(dateObj.getMinutes());

            switch (format) {
                case '12h':
                    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    return `${hour12}:${minutes} ${ampm}`;
                case '24h':
                    return `${this.pad(hours)}:${minutes}`;
                default:
                    const defaultHour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                    const defaultAmpm = hours >= 12 ? 'PM' : 'AM';
                    return `${defaultHour12}:${minutes} ${defaultAmpm}`;
            }
        } catch (error) {
            console.error('Time formatting error:', error);
            return '';
        }
    }

    /**
     * Format a date and time together according to user preferences
     * @param {Date|string} date - Date/time to format
     * @param {string} dateFormat - User's preferred date format
     * @param {string} timeFormat - User's preferred time format
     * @returns {string} Formatted date and time string
     */
    static formatDateTime(date, dateFormat = 'MM/DD/YYYY', timeFormat = '12h') {
        if (!date) return '';

        const formattedDate = this.formatDate(date, dateFormat);
        const formattedTime = this.formatTime(date, timeFormat);

        if (!formattedDate || !formattedTime) return formattedDate || formattedTime || '';

        return `${formattedDate} ${formattedTime}`;
    }

    /**
     * Format a date for display in tables or lists
     * @param {Date|string} date - Date to format
     * @param {string} dateFormat - User's preferred date format
     * @param {string} timeFormat - User's preferred time format
     * @param {boolean} includeTime - Whether to include time
     * @returns {string} Formatted date string
     */
    static formatForDisplay(date, dateFormat = 'MM/DD/YYYY', timeFormat = '12h', includeTime = true) {
        if (!date) return '';

        if (includeTime) {
            return this.formatDateTime(date, dateFormat, timeFormat);
        } else {
            return this.formatDate(date, dateFormat);
        }
    }

    /**
     * Get a relative time string (e.g., "2 hours ago")
     * @param {Date|string} date - Date to format
     * @returns {string} Relative time string
     */
    static formatRelative(date) {
        if (!date) return '';

        try {
            const dateObj = this.parseDate(date);
            if (!dateObj) return '';

            const now = new Date();
            const diffMs = now.getTime() - dateObj.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffSeconds < 60) {
                return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;
            } else if (diffMinutes < 60) {
                return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
            } else if (diffHours < 24) {
                return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
            } else if (diffDays < 7) {
                return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
            } else {
                // For older dates, just show the formatted date
                return this.formatDate(dateObj);
            }
        } catch (error) {
            console.error('Relative time formatting error:', error);
            return '';
        }
    }

    /**
     * Format date for forms and inputs (always returns YYYY-MM-DD for HTML date inputs)
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date string for HTML inputs
     */
    static formatForInput(date) {
        if (!date) return '';

        try {
            const dateObj = this.parseDate(date);
            if (!dateObj) return '';

            const year = dateObj.getFullYear();
            const month = this.pad(dateObj.getMonth() + 1);
            const day = this.pad(dateObj.getDate());

            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Input date formatting error:', error);
            return '';
        }
    }

    /**
     * Get date format example text for UI
     * @param {string} format - Date format
     * @returns {string} Example date string
     */
    static getDateFormatExample(format) {
        switch (format) {
            case 'MM/DD/YYYY':
                return '03/15/2024';
            case 'DD/MM/YYYY':
                return '15/03/2024';
            case 'YYYY-MM-DD':
                return '2024-03-15';
            default:
                return '03/15/2024';
        }
    }

    /**
     * Get time format example text for UI
     * @param {string} format - Time format
     * @returns {string} Example time string
     */
    static getTimeFormatExample(format) {
        switch (format) {
            case '12h':
                return '2:30 PM';
            case '24h':
                return '14:30';
            default:
                return '2:30 PM';
        }
    }
}

module.exports = DateFormatter;