// services/maintenanceSchedulingService.js
const { ScheduledMaintenance, User } = require('../db');
const emailService = require('./emailService');
const userService = require('./userService');
const maintenanceModeService = require('./maintenanceModeService');
const { Op } = require('sequelize');

/**
 * Service for managing scheduled maintenance
 */
class MaintenanceSchedulingService {
    
    /**
     * Schedule new maintenance
     * @param {Object} maintenanceData - Maintenance details
     * @param {number} userId - ID of user scheduling the maintenance
     * @returns {Promise<Object>} Result with success status and data
     */
    async scheduleMaintenance(maintenanceData, userId) {
        try {
            const {
                title,
                description,
                scheduledStart,
                scheduledEnd,
                priority,
                maintenanceType,
                affectsAvailability,
                estimatedDurationMinutes,
                notes
            } = maintenanceData;

            // Validate dates
            const startDate = new Date(scheduledStart);
            const endDate = new Date(scheduledEnd);
            const now = new Date();

            if (startDate <= now) {
                return {
                    success: false,
                    message: 'Maintenance cannot be scheduled in the past'
                };
            }

            if (endDate <= startDate) {
                return {
                    success: false,
                    message: 'End time must be after start time'
                };
            }

            // Calculate notification timing (7 weeks = 49 days before)
            const notificationDate = new Date(startDate);
            notificationDate.setDate(notificationDate.getDate() - 49);
            
            // If notification date is in the past, schedule immediately
            const notificationScheduledFor = notificationDate <= now ? new Date() : notificationDate;

            // Calculate reminder timing (24 hours before)
            const reminderDate = new Date(startDate);
            reminderDate.setHours(reminderDate.getHours() - 24);
            const reminderScheduledFor = reminderDate > now ? reminderDate : null;

            // Create scheduled maintenance record
            const maintenance = await ScheduledMaintenance.create({
                title,
                description,
                scheduled_start: startDate,
                scheduled_end: endDate,
                priority: priority || 'medium',
                maintenance_type: maintenanceType || 'system_update',
                affects_availability: affectsAvailability !== false,
                estimated_duration_minutes: estimatedDurationMinutes,
                notification_scheduled_for: notificationScheduledFor,
                reminder_scheduled_for: reminderScheduledFor,
                notes,
                created_by: userId,
                status: 'scheduled'
            });

            // Schedule immediate notification if needed
            if (notificationScheduledFor <= new Date()) {
                await this.sendMaintenanceNotification(maintenance.id, 'initial');
            }

            console.log(`Maintenance scheduled: ${maintenance.id} - ${title}`);
            console.log(`Notification scheduled for: ${notificationScheduledFor}`);
            if (reminderScheduledFor) {
                console.log(`Reminder scheduled for: ${reminderScheduledFor}`);
            }

            return {
                success: true,
                message: 'Maintenance scheduled successfully',
                data: maintenance
            };
        } catch (error) {
            console.error('Schedule maintenance error:', error);
            return {
                success: false,
                message: 'Failed to schedule maintenance',
                error: error.message
            };
        }
    }

    /**
     * Get scheduled maintenance records
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Result with maintenance records
     */
    async getScheduledMaintenance(filters = {}) {
        try {
            const {
                status,
                priority,
                startDate,
                endDate,
                limit = 50,
                offset = 0
            } = filters;

            const whereClause = {};

            if (status) {
                whereClause.status = status;
            }

            if (priority) {
                whereClause.priority = priority;
            }

            if (startDate || endDate) {
                whereClause.scheduled_start = {};
                if (startDate) {
                    whereClause.scheduled_start[Op.gte] = new Date(startDate);
                }
                if (endDate) {
                    whereClause.scheduled_start[Op.lte] = new Date(endDate);
                }
            }

            const maintenanceRecords = await ScheduledMaintenance.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    }
                ],
                order: [['scheduled_start', 'ASC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return {
                success: true,
                data: {
                    maintenance: maintenanceRecords.rows,
                    total: maintenanceRecords.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            };
        } catch (error) {
            console.error('Get scheduled maintenance error:', error);
            return {
                success: false,
                message: 'Failed to retrieve scheduled maintenance',
                error: error.message
            };
        }
    }

    /**
     * Update maintenance status
     * @param {number} maintenanceId - Maintenance ID
     * @param {string} status - New status
     * @param {number} userId - User making the update
     * @returns {Promise<Object>} Result with success status
     */
    async updateMaintenanceStatus(maintenanceId, status, userId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            
            if (!maintenance) {
                return {
                    success: false,
                    message: 'Maintenance record not found'
                };
            }

            const updateData = {
                status,
                updated_by: userId
            };

            // Set actual timestamps based on status
            if (status === 'in_progress' && !maintenance.actual_start) {
                updateData.actual_start = new Date();
            } else if (status === 'completed' && !maintenance.actual_end) {
                updateData.actual_end = new Date();
            }

            await maintenance.update(updateData);

            console.log(`Maintenance ${maintenanceId} status updated to: ${status}`);

            return {
                success: true,
                message: 'Maintenance status updated successfully',
                data: maintenance
            };
        } catch (error) {
            console.error('Update maintenance status error:', error);
            return {
                success: false,
                message: 'Failed to update maintenance status',
                error: error.message
            };
        }
    }

    /**
     * Cancel scheduled maintenance
     * @param {number} maintenanceId - Maintenance ID
     * @param {string} reason - Cancellation reason
     * @param {number} userId - User cancelling the maintenance
     * @returns {Promise<Object>} Result with success status
     */
    async cancelMaintenance(maintenanceId, reason, userId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            
            if (!maintenance) {
                return {
                    success: false,
                    message: 'Maintenance record not found'
                };
            }

            if (maintenance.status === 'completed') {
                return {
                    success: false,
                    message: 'Cannot cancel completed maintenance'
                };
            }

            await maintenance.update({
                status: 'cancelled',
                cancelled_by: userId,
                cancellation_reason: reason,
                updated_by: userId
            });

            // Send cancellation notification to users
            await this.sendMaintenanceNotification(maintenanceId, 'cancelled');

            console.log(`Maintenance ${maintenanceId} cancelled by user ${userId}`);

            return {
                success: true,
                message: 'Maintenance cancelled successfully',
                data: maintenance
            };
        } catch (error) {
            console.error('Cancel maintenance error:', error);
            return {
                success: false,
                message: 'Failed to cancel maintenance',
                error: error.message
            };
        }
    }

    /**
     * Send maintenance notification to all users
     * @param {number} maintenanceId - Maintenance ID
     * @param {string} notificationType - Type of notification (initial, reminder, cancelled)
     * @returns {Promise<Object>} Result with success status
     */
    async sendMaintenanceNotification(maintenanceId, notificationType = 'initial') {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            
            if (!maintenance) {
                return {
                    success: false,
                    message: 'Maintenance record not found'
                };
            }

            // Get all users with email addresses
            const usersResult = await userService.getAllUsersWithEmail();
            
            if (!usersResult.success) {
                return {
                    success: false,
                    message: 'Failed to retrieve users for notification'
                };
            }

            const users = usersResult.data;
            let notificationsSent = 0;
            let notificationsFailed = 0;

            // Send notifications to all users
            for (const user of users) {
                try {
                    let subject, emailContent;
                    
                    switch (notificationType) {
                        case 'cancelled':
                            subject = `Maintenance Cancelled: ${maintenance.title}`;
                            emailContent = this._generateCancellationEmailContent(maintenance);
                            break;
                        case 'reminder':
                            subject = `Maintenance Reminder: ${maintenance.title}`;
                            emailContent = this._generateReminderEmailContent(maintenance);
                            break;
                        default:
                            subject = `Scheduled Maintenance: ${maintenance.title}`;
                            emailContent = this._generateMaintenanceEmailContent(maintenance);
                    }

                    const result = await emailService.sendMaintenanceNotification({
                        email: user.email,
                        userId: user.id,
                        title: maintenance.title,
                        description: maintenance.description,
                        scheduledStart: maintenance.scheduled_start,
                        scheduledEnd: maintenance.scheduled_end,
                        priority: maintenance.priority,
                        maintenanceType: maintenance.maintenance_type,
                        affectsAvailability: maintenance.affects_availability,
                        estimatedDurationMinutes: maintenance.estimated_duration_minutes,
                        notificationType: notificationType,
                        notes: maintenance.notes
                    });

                    if (result) {
                        notificationsSent++;
                    } else {
                        notificationsFailed++;
                    }
                } catch (error) {
                    console.error(`Failed to send maintenance notification to user ${user.id}:`, error);
                    notificationsFailed++;
                }
            }

            // Update maintenance record with notification timestamp
            const updateField = notificationType === 'reminder' ? 'reminder_sent_at' : 'notification_sent_at';
            await maintenance.update({
                [updateField]: new Date()
            });

            console.log(`Maintenance notification sent: ${notificationsSent} successful, ${notificationsFailed} failed`);

            return {
                success: true,
                message: `Maintenance notifications sent to ${notificationsSent} users`,
                data: {
                    sent: notificationsSent,
                    failed: notificationsFailed,
                    total: users.length
                }
            };
        } catch (error) {
            console.error('Send maintenance notification error:', error);
            return {
                success: false,
                message: 'Failed to send maintenance notifications',
                error: error.message
            };
        }
    }

    /**
     * Check for pending notifications and reminders
     * @returns {Promise<Object>} Result with processing status
     */
    async processPendingNotifications() {
        try {
            const now = new Date();
            let processedCount = 0;

            // Check for initial notifications
            const pendingNotifications = await ScheduledMaintenance.findAll({
                where: {
                    notification_scheduled_for: {
                        [Op.lte]: now
                    },
                    notification_sent_at: null,
                    status: 'scheduled'
                }
            });

            for (const maintenance of pendingNotifications) {
                await this.sendMaintenanceNotification(maintenance.id, 'initial');
                processedCount++;
            }

            // Check for reminders
            const pendingReminders = await ScheduledMaintenance.findAll({
                where: {
                    reminder_scheduled_for: {
                        [Op.lte]: now
                    },
                    reminder_sent_at: null,
                    status: 'scheduled'
                }
            });

            for (const maintenance of pendingReminders) {
                await this.sendMaintenanceNotification(maintenance.id, 'reminder');
                processedCount++;
            }

            return {
                success: true,
                message: `Processed ${processedCount} pending notifications`,
                data: { processedCount }
            };
        } catch (error) {
            console.error('Process pending notifications error:', error);
            return {
                success: false,
                message: 'Failed to process pending notifications',
                error: error.message
            };
        }
    }

    /**
     * Check for maintenance that should be activated
     * @returns {Promise<Object>} Result with activation status
     */
    async processMaintenanceActivation() {
        try {
            const now = new Date();
            let activatedCount = 0;
            let completedCount = 0;

            // Check for maintenance that should start
            const maintenanceToStart = await ScheduledMaintenance.findAll({
                where: {
                    scheduled_start: {
                        [Op.lte]: now
                    },
                    status: 'scheduled',
                    affects_availability: true
                }
            });

            for (const maintenance of maintenanceToStart) {
                await this.updateMaintenanceStatus(maintenance.id, 'in_progress', maintenance.created_by);
                
                // Enable maintenance mode if this maintenance affects availability
                if (maintenance.affects_availability) {
                    await maintenanceModeService.autoEnableForScheduledMaintenance(maintenance.id);
                }
                
                activatedCount++;
                console.log(`Activated maintenance: ${maintenance.title}`);
            }

            // Check for maintenance that should end
            const maintenanceToEnd = await ScheduledMaintenance.findAll({
                where: {
                    scheduled_end: {
                        [Op.lte]: now
                    },
                    status: 'in_progress'
                }
            });

            for (const maintenance of maintenanceToEnd) {
                await this.updateMaintenanceStatus(maintenance.id, 'completed', maintenance.created_by);
                
                // Disable maintenance mode if it was enabled for this maintenance
                await maintenanceModeService.autoDisableForScheduledMaintenance(maintenance.id);
                
                completedCount++;
                console.log(`Completed maintenance: ${maintenance.title}`);
            }

            return {
                success: true,
                message: `Activated ${activatedCount} maintenance, completed ${completedCount} maintenance`,
                data: { activatedCount, completedCount }
            };
        } catch (error) {
            console.error('Process maintenance activation error:', error);
            return {
                success: false,
                message: 'Failed to process maintenance activation',
                error: error.message
            };
        }
    }

    /**
     * Generate email content for maintenance notification
     * @private
     */
    _generateMaintenanceEmailContent(maintenance) {
        const duration = maintenance.estimated_duration_minutes 
            ? `approximately ${maintenance.estimated_duration_minutes} minutes`
            : 'TBD';

        return `
            ${maintenance.description || 'System maintenance has been scheduled.'}
            
            Duration: ${duration}
            Priority: ${maintenance.priority.toUpperCase()}
            Type: ${maintenance.maintenance_type.replace('_', ' ').toUpperCase()}
            
            ${maintenance.affects_availability 
                ? 'This maintenance may affect system availability. Please plan accordingly.'
                : 'This maintenance should not affect system availability.'
            }
            
            ${maintenance.notes ? `Additional Notes: ${maintenance.notes}` : ''}
        `;
    }

    /**
     * Generate email content for maintenance reminder
     * @private
     */
    _generateReminderEmailContent(maintenance) {
        return `
            This is a reminder that scheduled maintenance will begin in approximately 24 hours.
            
            ${this._generateMaintenanceEmailContent(maintenance)}
            
            Please ensure any critical work is completed before the maintenance window begins.
        `;
    }

    /**
     * Generate email content for maintenance cancellation
     * @private
     */
    _generateCancellationEmailContent(maintenance) {
        return `
            The scheduled maintenance "${maintenance.title}" has been cancelled.
            
            ${maintenance.cancellation_reason ? `Reason: ${maintenance.cancellation_reason}` : ''}
            
            We apologize for any inconvenience this may cause.
        `;
    }
}

module.exports = new MaintenanceSchedulingService();