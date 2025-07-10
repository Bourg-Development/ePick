// services/maintenanceModeService.js
const fs = require('fs');
const path = require('path');
const { ScheduledMaintenance, User } = require('../db');

/**
 * Service for managing system maintenance mode
 */
class MaintenanceModeService {
    
    constructor() {
        this.maintenanceFile = path.join(process.cwd(), '.maintenance');
    }

    /**
     * Enable maintenance mode
     * @param {Object} options - Maintenance options
     * @param {string} options.message - Maintenance message to display
     * @param {number} options.enabledBy - User ID who enabled maintenance
     * @param {number} [options.maintenanceId] - Scheduled maintenance ID (optional)
     * @returns {Promise<Object>} Result with success status
     */
    async enableMaintenanceMode(options) {
        try {
            const { message, enabledBy, maintenanceId } = options;

            // Get user info for logging
            let enabledByUser = null;
            try {
                const { User } = require('../db');
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

            // Write maintenance file
            fs.writeFileSync(this.maintenanceFile, JSON.stringify(maintenanceData, null, 2));

            console.log(`Maintenance mode enabled by user ${enabledBy} (${maintenanceData.enabledBy})`);
            console.log(`Message: ${maintenanceData.message}`);

            return {
                success: true,
                message: 'Maintenance mode enabled successfully',
                data: maintenanceData
            };
        } catch (error) {
            console.error('Enable maintenance mode error:', error);
            return {
                success: false,
                message: 'Failed to enable maintenance mode',
                error: error.message
            };
        }
    }

    /**
     * Disable maintenance mode
     * @param {number} disabledBy - User ID who disabled maintenance
     * @returns {Promise<Object>} Result with success status
     */
    async disableMaintenanceMode(disabledBy) {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return {
                    success: false,
                    message: 'Maintenance mode is not currently enabled'
                };
            }

            // Get current maintenance data for logging
            let currentData = null;
            try {
                currentData = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            } catch (error) {
                console.warn('Could not read current maintenance data:', error);
            }

            // Remove maintenance file
            fs.unlinkSync(this.maintenanceFile);

            console.log(`Maintenance mode disabled by user ${disabledBy}`);
            if (currentData?.maintenanceId) {
                console.log(`Related scheduled maintenance ID: ${currentData.maintenanceId}`);
            }

            return {
                success: true,
                message: 'Maintenance mode disabled successfully',
                data: {
                    disabledAt: new Date().toISOString(),
                    disabledBy: disabledBy,
                    previousData: currentData
                }
            };
        } catch (error) {
            console.error('Disable maintenance mode error:', error);
            return {
                success: false,
                message: 'Failed to disable maintenance mode',
                error: error.message
            };
        }
    }

    /**
     * Check if maintenance mode is currently enabled
     * @returns {boolean} Whether maintenance mode is enabled
     */
    isMaintenanceModeEnabled() {
        return fs.existsSync(this.maintenanceFile);
    }

    /**
     * Get current maintenance mode status and data
     * @returns {Object} Maintenance mode status and data
     */
    getMaintenanceModeStatus() {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return {
                    enabled: false,
                    data: null
                };
            }

            const data = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            return {
                enabled: true,
                data: data
            };
        } catch (error) {
            console.error('Get maintenance mode status error:', error);
            return {
                enabled: this.isMaintenanceModeEnabled(),
                data: null,
                error: error.message
            };
        }
    }

    /**
     * Automatically enable maintenance mode for scheduled maintenance
     * @param {number} maintenanceId - Scheduled maintenance ID
     * @returns {Promise<Object>} Result with success status
     */
    async autoEnableForScheduledMaintenance(maintenanceId) {
        try {
            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId, {
                include: [
                    {
                        model: User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    }
                ]
            });

            if (!maintenance) {
                return {
                    success: false,
                    message: 'Scheduled maintenance not found'
                };
            }

            if (!maintenance.affects_availability) {
                console.log(`Maintenance ${maintenanceId} does not affect availability - skipping maintenance mode activation`);
                return {
                    success: true,
                    message: 'Maintenance does not affect availability - no maintenance mode needed',
                    data: { skipped: true }
                };
            }

            const message = `Scheduled maintenance in progress: ${maintenance.title}${maintenance.description ? '. ' + maintenance.description : ''}. Expected completion: ${maintenance.scheduled_end.toLocaleString()}.`;

            const result = await this.enableMaintenanceMode({
                message: message,
                enabledBy: maintenance.created_by,
                maintenanceId: maintenanceId
            });

            if (result.success) {
                console.log(`Automatically enabled maintenance mode for scheduled maintenance ${maintenanceId}`);
            }

            return result;
        } catch (error) {
            console.error('Auto enable maintenance mode error:', error);
            return {
                success: false,
                message: 'Failed to automatically enable maintenance mode',
                error: error.message
            };
        }
    }

    /**
     * Automatically disable maintenance mode for completed scheduled maintenance
     * @param {number} maintenanceId - Scheduled maintenance ID
     * @returns {Promise<Object>} Result with success status
     */
    async autoDisableForScheduledMaintenance(maintenanceId) {
        try {
            const status = this.getMaintenanceModeStatus();
            
            if (!status.enabled) {
                return {
                    success: true,
                    message: 'Maintenance mode was not enabled',
                    data: { skipped: true }
                };
            }

            // Check if this maintenance mode was enabled for this specific maintenance
            if (status.data?.maintenanceId !== maintenanceId) {
                console.log(`Maintenance mode was not enabled for maintenance ${maintenanceId} - skipping auto-disable`);
                return {
                    success: true,
                    message: 'Maintenance mode was not enabled for this scheduled maintenance',
                    data: { skipped: true }
                };
            }

            const maintenance = await ScheduledMaintenance.findByPk(maintenanceId);
            
            if (!maintenance) {
                return {
                    success: false,
                    message: 'Scheduled maintenance not found'
                };
            }

            const result = await this.disableMaintenanceMode(maintenance.created_by);

            if (result.success) {
                console.log(`Automatically disabled maintenance mode for completed maintenance ${maintenanceId}`);
            }

            return result;
        } catch (error) {
            console.error('Auto disable maintenance mode error:', error);
            return {
                success: false,
                message: 'Failed to automatically disable maintenance mode',
                error: error.message
            };
        }
    }

    /**
     * Update maintenance mode message
     * @param {string} newMessage - New maintenance message
     * @param {number} updatedBy - User ID who updated the message
     * @returns {Promise<Object>} Result with success status
     */
    async updateMaintenanceMessage(newMessage, updatedBy) {
        try {
            if (!this.isMaintenanceModeEnabled()) {
                return {
                    success: false,
                    message: 'Maintenance mode is not currently enabled'
                };
            }

            const currentData = JSON.parse(fs.readFileSync(this.maintenanceFile, 'utf8'));
            
            const updatedData = {
                ...currentData,
                message: newMessage,
                lastUpdatedAt: new Date().toISOString(),
                lastUpdatedBy: updatedBy
            };

            fs.writeFileSync(this.maintenanceFile, JSON.stringify(updatedData, null, 2));

            console.log(`Maintenance mode message updated by user ${updatedBy}`);

            return {
                success: true,
                message: 'Maintenance mode message updated successfully',
                data: updatedData
            };
        } catch (error) {
            console.error('Update maintenance message error:', error);
            return {
                success: false,
                message: 'Failed to update maintenance mode message',
                error: error.message
            };
        }
    }
}

module.exports = new MaintenanceModeService();