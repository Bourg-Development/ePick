// controllers/api/maintenanceController.js
const maintenanceSchedulingService = require('../../services/maintenanceSchedulingService');
const maintenanceModeService = require('../../services/maintenanceModeService');
const logService = require('../../services/logService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Controller for maintenance scheduling operations
 */
class MaintenanceController {
    
    /**
     * Schedule new maintenance
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async scheduleMaintenance(req, res) {
        try {
            const { userId } = req.auth;
            const maintenanceData = req.body;

            // Validate required fields
            const requiredFields = ['title', 'scheduledStart', 'scheduledEnd'];
            const missingFields = requiredFields.filter(field => !maintenanceData[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                });
            }

            // Schedule the maintenance
            const result = await maintenanceSchedulingService.scheduleMaintenance(maintenanceData, userId);
            
            if (result.success) {
                // Log the scheduling action
                await logService.auditLog({
                    eventType: 'maintenance.scheduled',
                    userId: userId,
                    targetId: result.data.id,
                    targetType: 'scheduled_maintenance',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        title: maintenanceData.title,
                        scheduledStart: maintenanceData.scheduledStart,
                        scheduledEnd: maintenanceData.scheduledEnd,
                        priority: maintenanceData.priority || 'medium',
                        maintenanceType: maintenanceData.maintenanceType || 'system_update',
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Schedule maintenance error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to schedule maintenance'
            });
        }
    }

    /**
     * Get scheduled maintenance records
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getScheduledMaintenance(req, res) {
        try {
            const filters = {
                status: req.query.status,
                priority: req.query.priority,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: req.query.limit,
                offset: req.query.offset
            };

            const result = await maintenanceSchedulingService.getScheduledMaintenance(filters);
            
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Get scheduled maintenance error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve scheduled maintenance'
            });
        }
    }

    /**
     * Get specific maintenance record
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getMaintenanceById(req, res) {
        try {
            const { maintenanceId } = req.params;
            
            const result = await maintenanceSchedulingService.getScheduledMaintenance({ 
                limit: 1,
                offset: 0 
            });
            
            if (result.success) {
                const maintenance = result.data.maintenance.find(m => m.id === parseInt(maintenanceId));
                
                if (maintenance) {
                    return res.status(200).json({
                        success: true,
                        data: maintenance
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: 'Maintenance record not found'
                    });
                }
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Get maintenance by ID error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve maintenance record'
            });
        }
    }

    /**
     * Update maintenance status
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateMaintenanceStatus(req, res) {
        try {
            const { userId } = req.auth;
            const { maintenanceId } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
            }

            const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const result = await maintenanceSchedulingService.updateMaintenanceStatus(
                parseInt(maintenanceId), 
                status, 
                userId
            );
            
            if (result.success) {
                // Log the status update
                await logService.auditLog({
                    eventType: 'maintenance.status_updated',
                    userId: userId,
                    targetId: parseInt(maintenanceId),
                    targetType: 'scheduled_maintenance',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        newStatus: status,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Update maintenance status error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update maintenance status'
            });
        }
    }

    /**
     * Cancel scheduled maintenance
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async cancelMaintenance(req, res) {
        try {
            const { userId } = req.auth;
            const { maintenanceId } = req.params;
            const { reason } = req.body;

            if (!reason || reason.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Cancellation reason is required'
                });
            }

            const result = await maintenanceSchedulingService.cancelMaintenance(
                parseInt(maintenanceId), 
                reason.trim(), 
                userId
            );
            
            if (result.success) {
                // Log the cancellation
                await logService.auditLog({
                    eventType: 'maintenance.cancelled',
                    userId: userId,
                    targetId: parseInt(maintenanceId),
                    targetType: 'scheduled_maintenance',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        reason: reason.trim(),
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Cancel maintenance error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel maintenance'
            });
        }
    }

    /**
     * Send maintenance notification manually
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async sendMaintenanceNotification(req, res) {
        try {
            const { userId } = req.auth;
            const { maintenanceId } = req.params;
            const { notificationType } = req.body;

            const validTypes = ['initial', 'reminder', 'cancelled'];
            if (!validTypes.includes(notificationType)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
                });
            }

            const result = await maintenanceSchedulingService.sendMaintenanceNotification(
                parseInt(maintenanceId), 
                notificationType
            );
            
            if (result.success) {
                // Log the manual notification
                await logService.auditLog({
                    eventType: 'maintenance.notification_sent',
                    userId: userId,
                    targetId: parseInt(maintenanceId),
                    targetType: 'scheduled_maintenance',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        notificationType,
                        recipientCount: result.data.sent,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Send maintenance notification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send maintenance notification'
            });
        }
    }

    /**
     * Process pending notifications and maintenance activation (for cron/scheduler)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async processMaintenanceJobs(req, res) {
        try {
            const { userId } = req.auth;

            // Process pending notifications
            const notificationResult = await maintenanceSchedulingService.processPendingNotifications();
            
            // Process maintenance activation
            const activationResult = await maintenanceSchedulingService.processMaintenanceActivation();

            // Log the processing
            await logService.auditLog({
                eventType: 'maintenance.jobs_processed',
                userId: userId,
                targetType: 'system',
                ipAddress: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                metadata: {
                    notificationsProcessed: notificationResult.data?.processedCount || 0,
                    maintenanceActivated: activationResult.data?.activatedCount || 0,
                    maintenanceCompleted: activationResult.data?.completedCount || 0,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            });

            return res.status(200).json({
                success: true,
                message: 'Maintenance jobs processed successfully',
                data: {
                    notifications: notificationResult,
                    activation: activationResult
                }
            });
        } catch (error) {
            console.error('Process maintenance jobs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process maintenance jobs'
            });
        }
    }

    /**
     * Get maintenance mode status
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getMaintenanceModeStatus(req, res) {
        try {
            const status = maintenanceModeService.getMaintenanceModeStatus();
            
            return res.status(200).json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('Get maintenance mode status error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get maintenance mode status'
            });
        }
    }

    /**
     * Enable maintenance mode manually
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async enableMaintenanceMode(req, res) {
        try {
            const { userId } = req.auth;
            const { message } = req.body;

            if (!message || message.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Maintenance message is required'
                });
            }

            const result = await maintenanceModeService.enableMaintenanceMode({
                message: message.trim(),
                enabledBy: userId
            });
            
            if (result.success) {
                // Log the manual enablement
                await logService.auditLog({
                    eventType: 'maintenance_mode.enabled',
                    userId: userId,
                    targetType: 'system',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        message: message.trim(),
                        source: 'manual',
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Enable maintenance mode error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to enable maintenance mode'
            });
        }
    }

    /**
     * Disable maintenance mode manually
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async disableMaintenanceMode(req, res) {
        try {
            const { userId } = req.auth;

            const result = await maintenanceModeService.disableMaintenanceMode(userId);
            
            if (result.success) {
                // Log the manual disablement
                await logService.auditLog({
                    eventType: 'maintenance_mode.disabled',
                    userId: userId,
                    targetType: 'system',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        source: 'manual',
                        previousData: result.data.previousData,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Disable maintenance mode error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to disable maintenance mode'
            });
        }
    }

    /**
     * Update maintenance mode message
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateMaintenanceMessage(req, res) {
        try {
            const { userId } = req.auth;
            const { message } = req.body;

            if (!message || message.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Maintenance message is required'
                });
            }

            const result = await maintenanceModeService.updateMaintenanceMessage(message.trim(), userId);
            
            if (result.success) {
                // Log the message update
                await logService.auditLog({
                    eventType: 'maintenance_mode.message_updated',
                    userId: userId,
                    targetType: 'system',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        newMessage: message.trim(),
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Update maintenance message error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update maintenance message'
            });
        }
    }
}

module.exports = new MaintenanceController();