const ical = require('ical-generator').default;
const crypto = require('crypto');
const db = require('../db');
const { Op } = require('sequelize');
const cryptoService = require('./cryptoService');
const { BASE_URL } = require('../config/environment');

class ICSService {
    /**
     * Generate a unique ICS feed token for a user
     * @param {number} userId - User ID
     * @returns {string} - Unique token
     */
    generateFeedToken(userId) {
        const timestamp = Date.now();
        const data = `${userId}-${timestamp}-${process.env.JWT_SECRET}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * Validate ICS feed token
     * @param {string} token - Feed token
     * @returns {Promise<Object|null>} - User object or null
     */
    async validateFeedToken(token) {
        try {
            const user = await db.User.findOne({
                where: { ics_feed_token: token },
                include: [{
                    model: db.Service,
                    as: 'service'
                }]
            });
            
            return user;
        } catch (error) {
            console.error('Error validating ICS feed token:', error);
            return null;
        }
    }

    /**
     * Generate ICS feed for a user's service analyses
     * @param {number} userId - User ID
     * @param {string} token - Feed token
     * @returns {Promise<string>} - ICS feed content
     */
    async generateUserServiceFeed(userId, token) {
        try {
            // Validate token
            const user = await this.validateFeedToken(token);
            if (!user || user.id !== userId) {
                throw new Error('Invalid feed token');
            }

            // Check if ICS feed is enabled for this user
            const preference = await db.UserPreference.findOne({
                where: { user_id: userId }
            });

            if (!preference || !preference.preferences || preference.preferences.ics_feed_enabled !== true) {
                throw new Error('ICS feed is not enabled for this user');
            }

            // Get user's service
            const userService = user.service;
            if (!userService) {
                // Return empty calendar if user has no services
                const calendar = ical({
                    name: 'ePick Analyses',
                    description: 'No analyses found - User has no assigned services',
                    timezone: 'Europe/Luxembourg'
                });
                return calendar.toString();
            }

            // Get analyses for user's service (upcoming and recent)
            const dateLimit = new Date();
            dateLimit.setMonth(dateLimit.getMonth() - 1); // Include analyses from past month

            const analyses = await db.Analysis.findAll({
                where: {
                    analysis_date: {
                        [Op.gte]: dateLimit
                    },
                    status: {
                        [Op.notIn]: ['Cancelled', 'Archived']
                    }
                },
                include: [
                    {
                        model: db.Patient,
                        as: 'patient',
                        attributes: ['id', 'name', 'matricule_national']
                    },
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name']
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        attributes: ['id', 'room_number'],
                        include: [{
                            model: db.Service,
                            as: 'service',
                            attributes: ['id', 'name'],
                            where: {
                                id: userService.id
                            }
                        }]
                    }
                ],
                order: [['analysis_date', 'ASC']]
            });

            // Create calendar
            const calendar = ical({
                name: `ePick Analyses - ${userService.name}`,
                description: `Blood analyses for ${user.full_name || user.username} in ${userService.name}`,
                timezone: 'Europe/Luxembourg',
                ttl: 3600 // 1 hour cache
            });

            // Add events for each analysis
            analyses.forEach(analysis => {
                // Decrypt sensitive fields
                const patientName = this.decryptField(analysis.patient.name);
                const doctorName = this.decryptField(analysis.doctor.name);
                
                console.log('Patient name (decrypted):', patientName);
                console.log('Doctor name (decrypted):', doctorName);
                
                const analysisType = analysis.analysis_type || 'Blood Analysis';
                
                const analysisDate = new Date(analysis.analysis_date);
                
                const event = calendar.createEvent({
                    start: analysisDate,
                    allDay: true,
                    summary: `${analysisType} - ${patientName}`,
                    description: this.buildEventDescription(analysis, patientName, doctorName),
                    location: analysis.room ? `Room ${analysis.room.room_number}` : 'TBD',
                    uid: `analysis-${analysis.id}@epick.fondation.lu`,
                    status: this.mapAnalysisStatus(analysis.status),
                    organizer: {
                        name: doctorName,
                        email: 'noreply@epick.fondation.lu'
                    }
                });

                // Add alarm 15 minutes before
                event.createAlarm({
                    type: 'display',
                    trigger: 900 // 15 minutes before
                });
            });

            return calendar.toString();
        } catch (error) {
            console.error('Error generating ICS feed:', error);
            throw error;
        }
    }

    /**
     * Decrypt an encrypted field if it's encrypted
     * @param {string} value - Potentially encrypted value
     * @returns {string} - Decrypted value or original if not encrypted
     */
    decryptField(value) {
        if (!value || typeof value !== 'string') return value;
        
        // Check if it's in encrypted format (IV:encryptedData)
        if (value.includes(':') && value.length > 32) {
            try {
                return cryptoService.decrypt(value);
            } catch (error) {
                console.error('Error decrypting field:', error);
                return value; // Return original if decryption fails
            }
        }
        
        return value; // Already decrypted or not encrypted
    }

    /**
     * Build event description for analysis
     * @param {Object} analysis - Analysis object
     * @param {string} patientName - Decrypted patient name
     * @param {string} doctorName - Decrypted doctor name
     * @returns {string} - Event description
     */
    buildEventDescription(analysis, patientName, doctorName) {
        const parts = [
            `Patient: ${patientName}`,
            `Doctor: ${doctorName}`,
            `Service: ${analysis.room?.service?.name || 'Unknown Service'}`,
            `Type: ${analysis.analysis_type || 'Blood Analysis'}`,
            `Status: ${analysis.status}`
        ];

        if (analysis.notes) {
            parts.push(`Notes: ${analysis.notes}`);
        }

        if (analysis.postponed_count > 0) {
            parts.push(`Postponed: ${analysis.postponed_count} time(s)`);
        }

        return parts.join('\n');
    }

    /**
     * Map analysis status to ICS event status
     * @param {string} analysisStatus - Analysis status
     * @returns {string} - ICS event status
     */
    mapAnalysisStatus(analysisStatus) {
        const statusMap = {
            'Pending': 'CONFIRMED',
            'In Progress': 'CONFIRMED',
            'Completed': 'CONFIRMED',
            'Postponed': 'TENTATIVE',
            'Cancelled': 'CANCELLED'
        };

        return statusMap[analysisStatus] || 'CONFIRMED';
    }

    /**
     * Enable ICS feed for a user
     * @param {number} userId - User ID
     * @returns {Promise<string>} - Feed token
     */
    async enableFeedForUser(userId) {
        try {
            // Generate new token
            const token = this.generateFeedToken(userId);

            // Update user with token
            await db.User.update(
                { ics_feed_token: token },
                { where: { id: userId } }
            );

            // Get or create preference record
            const [preference, created] = await db.UserPreference.findOrCreate({
                where: { user_id: userId },
                defaults: { preferences: {} }
            });

            // Update preferences
            preference.preferences = {
                ...preference.preferences,
                ics_feed_enabled: true
            };
            await preference.save();

            return token;
        } catch (error) {
            console.error('Error enabling ICS feed:', error);
            throw error;
        }
    }

    /**
     * Disable ICS feed for a user
     * @param {number} userId - User ID
     */
    async disableFeedForUser(userId) {
        try {
            // Remove token
            await db.User.update(
                { ics_feed_token: null },
                { where: { id: userId } }
            );

            // Update preference
            const preference = await db.UserPreference.findOne({
                where: { user_id: userId }
            });
            
            if (preference) {
                preference.preferences = {
                    ...preference.preferences,
                    ics_feed_enabled: false
                };
                await preference.save();
            }
        } catch (error) {
            console.error('Error disabling ICS feed:', error);
            throw error;
        }
    }

    /**
     * Get feed URL for a user
     * @param {number} userId - User ID
     * @returns {Promise<string|null>} - Feed URL or null
     */
    async getFeedUrl(userId) {
        try {
            const user = await db.User.findByPk(userId);
            if (!user || !user.ics_feed_token) {
                return null;
            }

            return `${BASE_URL}/api/ics/feed/${userId}/${user.ics_feed_token}`;
        } catch (error) {
            console.error('Error getting feed URL:', error);
            return null;
        }
    }
}

module.exports = new ICSService();