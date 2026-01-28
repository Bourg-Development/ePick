// services/maintenanceService.js
// Merged from maintenanceModeService.js and maintenanceSchedulingService.js

const fs = require('fs');
const path = require('path');
const { ScheduledMaintenance, User } = require('../db');
const { Op } = require('sequelize');

class MaintenanceService {
    constructor() {
        this.maintenanceFile = path.join(process.cwd(), '.maintenance');
    }

    // ==========================================
    // MAINTENANCE MODE (file-based toggle)
    // ==========================================

    async enableMaintenanceMode(options) {
        try {
            const { message, enabledBy, maintenanceId } = options;

            let enabledByUser = null;
            try {
                enabledByUser = await User.findByPk(enabledBy, {
                    attributes: ['id', 'username', 'full_name']
                });
            } catch (error) {
                console.warn('Could not fetch user info for maintenance enablement:', error);
            }

            const maintenanceData = {
                enabled: true,
                enabledAt: new Date().toISOString(),
                enabledBy: enabledByUser ? enabledByUser.full_name || enabledByUser.username : 'System Administrator',
                enabledByUserId: enabledBy,
                message: message || 'System is currently under maintenance. Please try again later.',
                maintenanceId: maintenanceId || null,
                source: maintenanceId ? 'scheduled' : 'manual'
            };

            fs.writeFileSync(this.maintenanceFile, JSON.stringify(maintenanceData, null, 2));
            console.log(`Maintenance mode enabled by user ${enabledBy}`);

            return { success: true, message: 'Maintenance mode enabled successfully', data: maintenanceData };
        } catch (error) {
            console.error('Enable maintenance mode error:', error);
            return { success: false, message: 'Failed to enable maintenance mode', error: error.message };
        }
    }

    async disableMaintenanceMode(disabledBy) {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return { success: false, message: 'Maintenance mode is not currently enabled' };
            }

            let currentData = null;
            try {
                currentData = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            } catch (error) {
                console.warn('Could not read current maintenance data:', error);
            }

            fs.unlinkSync(this.maintenanceFile);
            console.log(`Maintenance mode disabled by user ${disabledBy}`);

            return {
                success: true,
                message: 'Maintenance mode disabled successfully',
                data: { disabledAt: new Date().toISOString(), disabledBy, previousData: currentData }
            };
        } catch (error) {
            console.error('Disable maintenance mode error:', error);
            return { success: false, message: 'Failed to disable maintenance mode', error: error.message };
        }
    }

    isMaintenanceModeEnabled() {
        return fs.existsSync(this.maintenanceFile);
    }

    getMaintenanceModeStatus() {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return { enabled: false, data: null };
            }
            const data = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            return { enabled: true, data };
        } catch (error) {
            console.error('Get maintenance mode status error:', error);
            return { enabled: this.isMaintenanceModeEnabled(), data: null, error: error.message };
        }
    }

    async updateMaintenanceMessage(newMessage, updatedBy) {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return { success: false, message: 'Maintenance mode is not currently enabled' };
            }

            const currentData = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            const updatedData = {
                ...currentData,
                message: newMessage,
                lastUpdatedAt: new Date().toISOString(),
                lastUpdatedBy: updatedBy
            };

            fs.writeFileSync(this.maintenanceFile, JSON.stringify(updatedData, null, 2));
            return { success: true, message: 'Maintenance mode message updated successfully', data: updatedData };
        } catch (error) {
            console.error('Update maintenance message error:', error);
            return { success: false, message: 'Failed to update maintenance mode message', error: error.message };
        }
    }

    // ==========================================
    // SCHEDULED MAINTENANCE (database-based)
    // ==========================================

    async scheduleMaintenance(maintenanceData, userId) {
        try {
            const { title, description, scheduledStart, scheduledEnd, priority, maintenanceType, affectsAvailability, estimatedDurationMinutes, notes } = maintenanceData;

            const startDate = new Date(scheduledStart);
            const endDate = new Date(scheduledEnd);
            const now = new Date();

            if (startDate <= now) {
                return { success: false, message: 'Maintenance cannot be scheduled in the past' };
            }
            if (endDate <= startDate) {
                return { success: false, message: 'End time must be after start time' };
            }

            // Notification 7 weeks before, reminder 24h before
            const notificationDate = new Date(startDate);
            notificationDate.setDate(notificationDate.getDate() - 49);
            const notificationScheduledFor = notificationDate <= now ? new Date() : notificationDate;

            const reminderDate = new Date(startDate);
            reminderDate.setHours(reminderDate.getHours() - 24);
            const reminderScheduledFor = reminderDate > now ? reminderDate : null;

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

            if (notificationScheduledFor <= new Date()) {
                await this.sendMaintenanceNotification(maintenance.id, 'initial');
            }

            return { success: true, message: 'Maintenance scheduled successfully', data: maintenance };
        } catch (error) {
            console.error('Schedule maintenance error:', error);
            return { success: false, message: 'Failed to schedule maintenance', error: error.message };
        }
    }

    async getScheduledMaintenance(filters = {}) {
        try {
            const { status, priority, startDate, endDate, limit = 50, offset = 0 } = filters;
            const whereClause = {};

            if (status) whereClause.status = status;
            if (priority) whereClause.priority = priority;

            if (startDate || endDate) {
                whereClause.scheduled_start = {};
                if (startDate) whereClause.scheduled_start[Op.gte] = new Date(startDate);
                if (endDate) whereClause.scheduled_start[Op.lte] = new Date(endDate);
            }

            const maintenanceRecords = await ScheduledMaintenance.findAndCountAll({
                where: whereClause,
                include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'full_name'] }],
                order: [['scheduled_start', 'ASC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return {
                success: true,
                data: { maintenance: maintenanceRecords.rows, total: maintenanceRecords.count, limit: parseInt(limit), offset: parseInt(offset) }
            };
        } catch (error) {
            console.error('Get scheduled maintenance error:', error);
            return { success: false, message: 'Failed to retrieve scheduled maintenance', error: error.message };
        }
    }

    async updateMaintenanceStatus(maintenanceId, status, userId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            if (!maintenance) {
                return { success: false, message: 'Maintenance record not found' };
            }

            const updateData = { status, updated_by: userId };
            if (status === 'in_progress' && !maintenance.actual_start) updateData.actual_start = new Date();
            else if (status === 'completed' && !maintenance.actual_end) updateData.actual_end = new Date();

            await maintenance.update(updateData);
            return { success: true, message: 'Maintenance status updated successfully', data: maintenance };
        } catch (error) {
            console.error('Update maintenance status error:', error);
            return { success: false, message: 'Failed to update maintenance status', error: error.message };
        }
    }

    async cancelMaintenance(maintenanceId, reason, userId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            if (!maintenance) return { success: false, message: 'Maintenance record not found' };
            if (maintenance.status === 'completed') return { success: false, message: 'Cannot cancel completed maintenance' };

            await maintenance.update({
                status: 'cancelled',
                cancelled_by: userId,
                cancellation_reason: reason,
                updated_by: userId
            });

            await this.sendMaintenanceNotification(maintenanceId, 'cancelled');
            return { success: true, message: 'Maintenance cancelled successfully', data: maintenance };
        } catch (error) {
            console.error('Cancel maintenance error:', error);
            return { success: false, message: 'Failed to cancel maintenance', error: error.message };
        }
    }

    async sendMaintenanceNotification(maintenanceId, notificationType = 'initial') {
        try {
            const emailService = require('./emailService');
            const userService = require('./userService');

            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            if (!maintenance) return { success: false, message: 'Maintenance record not found' };

            const usersResult = await userService.getAllUsersWithEmail();
            if (!usersResult.success) return { success: false, message: 'Failed to retrieve users for notification' };

            let notificationsSent = 0, notificationsFailed = 0;

            for (const user of usersResult.data) {
                try {
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
                        notificationType,
                        notes: maintenance.notes
                    });
                    result ? notificationsSent++ : notificationsFailed++;
                } catch (error) {
                    console.error(`Failed to send notification to user ${user.id}:`, error);
                    notificationsFailed++;
                }
            }

            const updateField = notificationType === 'reminder' ? 'reminder_sent_at' : 'notification_sent_at';
            await maintenance.update({ [updateField]: new Date() });

            return { success: true, message: `Notifications sent to ${notificationsSent} users`, data: { sent: notificationsSent, failed: notificationsFailed } };
        } catch (error) {
            console.error('Send maintenance notification error:', error);
            return { success: false, message: 'Failed to send maintenance notifications', error: error.message };
        }
    }

    async processPendingNotifications() {
        try {
            const now = new Date();
            let processedCount = 0;

            const pendingNotifications = await ScheduledMaintenance.findAll({
                where: { notification_scheduled_for: { [Op.lte]: now }, notification_sent_at: null, status: 'scheduled' }
            });
            for (const m of pendingNotifications) {
                await this.sendMaintenanceNotification(m.id, 'initial');
                processedCount++;
            }

            const pendingReminders = await ScheduledMaintenance.findAll({
                where: { reminder_scheduled_for: { [Op.lte]: now }, reminder_sent_at: null, status: 'scheduled' }
            });
            for (const m of pendingReminders) {
                await this.sendMaintenanceNotification(m.id, 'reminder');
                processedCount++;
            }

            return { success: true, message: `Processed ${processedCount} pending notifications`, data: { processedCount } };
        } catch (error) {
            console.error('Process pending notifications error:', error);
            return { success: false, message: 'Failed to process pending notifications', error: error.message };
        }
    }

    async processMaintenanceActivation() {
        try {
            const now = new Date();
            let activatedCount = 0, completedCount = 0;

            const maintenanceToStart = await ScheduledMaintenance.findAll({
                where: { scheduled_start: { [Op.lte]: now }, status: 'scheduled', affects_availability: true }
            });

            for (const m of maintenanceToStart) {
                await this.updateMaintenanceStatus(m.id, 'in_progress', m.created_by);
                if (m.affects_availability) {
                    await this.autoEnableForScheduledMaintenance(m.id);
                }
                activatedCount++;
            }

            const maintenanceToEnd = await ScheduledMaintenance.findAll({
                where: { scheduled_end: { [Op.lte]: now }, status: 'in_progress' }
            });

            for (const m of maintenanceToEnd) {
                await this.updateMaintenanceStatus(m.id, 'completed', m.created_by);
                await this.autoDisableForScheduledMaintenance(m.id);
                completedCount++;
            }

            return { success: true, message: `Activated ${activatedCount}, completed ${completedCount}`, data: { activatedCount, completedCount } };
        } catch (error) {
            console.error('Process maintenance activation error:', error);
            return { success: false, message: 'Failed to process maintenance activation', error: error.message };
        }
    }

    // Auto-enable/disable for scheduled maintenance
    async autoEnableForScheduledMaintenance(maintenanceId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId, {
                include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'full_name'] }]
            });

            if (!maintenance) return { success: false, message: 'Scheduled maintenance not found' };
            if (!maintenance.affects_availability) {
                return { success: true, message: 'Maintenance does not affect availability', data: { skipped: true } };
            }

            const message = `Scheduled maintenance in progress: ${maintenance.title}. Expected completion: ${maintenance.scheduled_end.toLocaleString()}.`;
            return await this.enableMaintenanceMode({ message, enabledBy: maintenance.created_by, maintenanceId });
        } catch (error) {
            console.error('Auto enable maintenance mode error:', error);
            return { success: false, message: 'Failed to automatically enable maintenance mode', error: error.message };
        }
    }

    async autoDisableForScheduledMaintenance(maintenanceId) {
        try {
            const status = this.getMaintenanceModeStatus();
            if (!status.enabled) return { success: true, message: 'Maintenance mode was not enabled', data: { skipped: true } };
            if (status.data?.maintenanceId !== maintenanceId) {
                return { success: true, message: 'Maintenance mode was not for this maintenance', data: { skipped: true } };
            }

            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            if (!maintenance) return { success: false, message: 'Scheduled maintenance not found' };

            return await this.disableMaintenanceMode(maintenance.created_by);
        } catch (error) {
            console.error('Auto disable maintenance mode error:', error);
            return { success: false, message: 'Failed to automatically disable maintenance mode', error: error.message };
        }
    }
}

module.exports = new MaintenanceService();
