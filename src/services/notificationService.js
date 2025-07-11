const db = require('../db');
const logService = require('./logService');
const DateFormatter = require('../utils/dateFormatter');
const userService = require('./userService');
const UserPreferencesHelper = require('../utils/userPreferencesHelper');

class NotificationService {
    /**
     * Create a notification for one or more users
     */
    async createNotification(data) {
        const {
            userIds, // Array of user IDs or single user ID
            user_id, // Single user ID (alternative to userIds)
            type,
            title,
            message,
            priority = 'normal',
            actionRequired = false,
            actionUrl = null,
            relatedId = null,
            relatedType = null,
            expiresAt = null,
            metadata = null
        } = data;

        try {
            // Handle both userIds array and single user_id
            let userIdArray;
            if (userIds) {
                userIdArray = Array.isArray(userIds) ? userIds : [userIds];
            } else if (user_id) {
                userIdArray = [user_id];
            } else {
                throw new Error('Either userIds or user_id must be provided');
            }
            
            const notifications = [];

            for (const userId of userIdArray) {
                const notification = await db.Notification.create({
                    user_id: userId,
                    type,
                    title,
                    message,
                    priority,
                    action_required: actionRequired,
                    action_url: actionUrl,
                    related_id: relatedId,
                    related_type: relatedType,
                    expires_at: expiresAt,
                    metadata
                });

                notifications.push(notification);
            }

            // Log notification creation
            await logService.auditLog({
                eventType: 'notifications_created',
                userId: null,
                targetType: 'Notification',
                metadata: {
                    type,
                    title,
                    recipientCount: userIdArray.length,
                    priority,
                    actionRequired
                }
            });

            return notifications;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get unread notifications for a user
     */
    async getUserNotifications(userId, filters = {}) {
        const {
            includeRead = false,
            includeDismissed = false,
            type = null,
            actionRequired = null,
            limit = 50,
            offset = 0
        } = filters;

        try {
            const whereClause = {
                user_id: userId
            };

            if (!includeRead) {
                whereClause.is_read = false;
            }

            if (!includeDismissed) {
                whereClause.is_dismissed = false;
            }

            if (type) {
                whereClause.type = type;
            }

            if (actionRequired !== null) {
                whereClause.action_required = actionRequired;
            }

            // Filter out expired notifications
            whereClause[db.Sequelize.Op.or] = [
                { expires_at: null },
                { expires_at: { [db.Sequelize.Op.gt]: new Date() } }
            ];

            const notifications = await db.Notification.findAll({
                where: whereClause,
                order: [
                    ['priority', 'DESC'], // urgent, high, normal, low
                    ['created_at', 'DESC']
                ],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return notifications;
        } catch (error) {
            console.error('Error fetching user notifications:', error);
            throw error;
        }
    }

    /**
     * Get notification counts for a user
     */
    async getUserNotificationCounts(userId) {
        try {
            const activeWhere = {
                user_id: userId,
                is_dismissed: false,
                [db.Sequelize.Op.or]: [
                    { expires_at: null },
                    { expires_at: { [db.Sequelize.Op.gt]: new Date() } }
                ]
            };

            const [unread, actionRequired, total] = await Promise.all([
                db.Notification.count({
                    where: { ...activeWhere, is_read: false }
                }),
                db.Notification.count({
                    where: { ...activeWhere, action_required: true, is_read: false }
                }),
                db.Notification.count({
                    where: activeWhere
                })
            ]);

            return {
                unread,
                actionRequired,
                total
            };
        } catch (error) {
            console.error('Error fetching notification counts:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const [updatedCount] = await db.Notification.update(
                { is_read: true },
                {
                    where: {
                        id: notificationId,
                        user_id: userId
                    }
                }
            );

            return updatedCount > 0;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark multiple notifications as read
     */
    async markMultipleAsRead(notificationIds, userId) {
        try {
            const [updatedCount] = await db.Notification.update(
                { is_read: true },
                {
                    where: {
                        id: { [db.Sequelize.Op.in]: notificationIds },
                        user_id: userId
                    }
                }
            );

            return updatedCount;
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            throw error;
        }
    }

    /**
     * Dismiss notification
     */
    async dismissNotification(notificationId, userId) {
        try {
            const [updatedCount] = await db.Notification.update(
                { is_dismissed: true },
                {
                    where: {
                        id: notificationId,
                        user_id: userId
                    }
                }
            );

            return updatedCount > 0;
        } catch (error) {
            console.error('Error dismissing notification:', error);
            throw error;
        }
    }

    /**
     * Create prescription verification notifications
     */
    async createPrescriptionVerificationNotifications(recurringAnalysis, nextAnalysisDate) {
        try {
            // Get service users for the patient's service
            const serviceUsers = await this.getServiceUsers(recurringAnalysis.Patient);
            
            // Format date using default European format (we'll use individual user prefs when displaying)
            const formattedDate = DateFormatter.formatDate(nextAnalysisDate, 'DD/MM/YYYY');
            
            const title = 'Prescription Verification Required';
            const message = `Recurring analysis for ${recurringAnalysis.Patient.name} is due on ${formattedDate}. Please verify that a valid prescription is available before the analysis proceeds.`;
            
            // Set expiration to the analysis date
            const expiresAt = new Date(nextAnalysisDate);
            
            // Create notification for all service users
            const notifications = await this.createNotification({
                userIds: serviceUsers.map(user => user.id),
                type: 'prescription_verification',
                title,
                message,
                priority: 'high',
                actionRequired: true,
                actionUrl: `/restricted/prescriptions/verify/${recurringAnalysis.id}`,
                relatedId: recurringAnalysis.id,
                relatedType: 'RecurringAnalysis',
                expiresAt,
                metadata: {
                    patientId: recurringAnalysis.patient_id,
                    patientName: recurringAnalysis.Patient.name,
                    analysisType: recurringAnalysis.analysis_type,
                    nextAnalysisDate: nextAnalysisDate.toISOString(),
                    recurringAnalysisId: recurringAnalysis.id
                }
            });

            return notifications;
        } catch (error) {
            console.error('Error creating prescription verification notifications:', error);
            throw error;
        }
    }

    /**
     * Get users from the same service as the patient's room
     */
    async getServiceUsers(patient) {
        try {
            // Get the patient's room and service
            const room = await db.Room.findByPk(patient.room_id, {
                include: [{
                    model: db.Service,
                    as: 'service'
                }]
            });

            if (!room || !room.service) {
                throw new Error('Patient room or service not found');
            }

            // Get all active users from the same service
            const serviceUsers = await db.User.findAll({
                where: {
                    service_id: room.service.id,
                    active: true
                },
                attributes: ['id', 'username', 'full_name', 'email']
            });

            return serviceUsers;
        } catch (error) {
            console.error('Error getting service users:', error);
            throw error;
        }
    }

    /**
     * Clean up expired notifications
     */
    async cleanupExpiredNotifications() {
        try {
            const deletedCount = await db.Notification.destroy({
                where: {
                    expires_at: {
                        [db.Sequelize.Op.lt]: new Date()
                    }
                }
            });

            console.log(`Cleaned up ${deletedCount} expired notifications`);
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up expired notifications:', error);
            throw error;
        }
    }

    /**
     * Format date for display using user preferences
     * @param {Date|string} date - Date to format
     * @param {number} userId - User ID for preferences (optional)
     * @param {string} defaultFormat - Default format if user prefs not available
     * @returns {Promise<string>} Formatted date string
     */
    async formatDate(date, userId = null, defaultFormat = 'DD/MM/YYYY') {
        if (!date) return '';
        
        let userDateFormat = defaultFormat;
        
        // Try to get user preferences if userId provided
        if (userId) {
            try {
                const userPrefs = await userService.getUserDisplayPreferences(userId);
                if (userPrefs.success && userPrefs.preferences) {
                    userDateFormat = userPrefs.preferences.dateFormat || defaultFormat;
                }
            } catch (error) {
                console.error('Error fetching user preferences for date formatting:', error);
            }
        }
        
        return DateFormatter.formatDate(date, userDateFormat);
    }

    /**
     * Format date and time for display using user preferences
     * @param {Date|string} date - Date to format
     * @param {number} userId - User ID for preferences (optional)
     * @param {string} defaultDateFormat - Default date format
     * @param {string} defaultTimeFormat - Default time format
     * @returns {Promise<string>} Formatted date and time string
     */
    async formatDateTime(date, userId = null, defaultDateFormat = 'DD/MM/YYYY', defaultTimeFormat = '24h') {
        if (!date) return '';
        
        let userDateFormat = defaultDateFormat;
        let userTimeFormat = defaultTimeFormat;
        
        // Try to get user preferences if userId provided
        if (userId) {
            try {
                const userPrefs = await userService.getUserDisplayPreferences(userId);
                if (userPrefs.success && userPrefs.preferences) {
                    userDateFormat = userPrefs.preferences.dateFormat || defaultDateFormat;
                    userTimeFormat = userPrefs.preferences.timeFormat || defaultTimeFormat;
                }
            } catch (error) {
                console.error('Error fetching user preferences for date/time formatting:', error);
            }
        }
        
        return DateFormatter.formatDateTime(date, userDateFormat, userTimeFormat);
    }
}

module.exports = new NotificationService();