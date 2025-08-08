// controllers/organizationSettingsController.js - Enhanced with export functionality
const organizationSettingsService = require('../../services/organizationSettingsService');
const authService = require('../../services/authService');
const logService = require('../../services/logService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
const schedulerService = require('../../services/schedulerService');

/**
 * Organization Settings controller for managing system settings
 */
class OrganizationSettingsController {
    constructor() {
        // Bind methods that use private methods to maintain proper context
        this.exportSettingsJson = this.exportSettingsJson.bind(this);
        this.exportSettingsCsv = this.exportSettingsCsv.bind(this);
        this.exportSettingsExcel = this.exportSettingsExcel.bind(this);
        this.exportSettings = this.exportSettings.bind(this);
    }

    /**
     * Get analysis types
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAnalysisTypes(req, res) {
        try {
            const result = await organizationSettingsService.getAnalysisTypes();
            
            return res.status(200).json(result);
        } catch (error) {
            console.error('Get analysis types error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve analysis types'
            });
        }
    }
    
    /**
     * Update analysis types
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateAnalysisTypes(req, res) {
        try {
            const { analysisTypes } = req.body;
            const userId = req.auth?.userId;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            
            if (!analysisTypes) {
                return res.status(400).json({
                    success: false,
                    message: 'Analysis types data is required'
                });
            }
            
            if (!Array.isArray(analysisTypes)) {
                return res.status(400).json({
                    success: false,
                    message: 'Analysis types must be an array'
                });
            }
            
            const result = await organizationSettingsService.updateAnalysisTypes(analysisTypes, userId);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            return res.status(200).json(result);
        } catch (error) {
            console.error('Update analysis types error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update analysis types',
                error: error.message
            });
        }
    }

    /**
     * Get all organization settings
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAllSettings(req, res) {
        try {
            const result = await organizationSettingsService.getAllSettings();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get all settings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve settings'
            });
        }
    }

    /**
     * Get specific setting by key
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSetting(req, res) {
        try {
            const { key } = req.params;

            const result = await organizationSettingsService.getSetting(key);

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.setting
            });
        } catch (error) {
            console.error('Get setting error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve setting'
            });
        }
    }

    /**
     * Create new setting
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createSetting(req, res) {
        try {
            const { key, value, dataType, description } = req.body;
            const { userId } = req.auth;

            // Validate required fields
            if (!key || value === undefined || !dataType) {
                return res.status(400).json({
                    success: false,
                    message: 'Key, value, and data type are required'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await organizationSettingsService.createSetting({
                key,
                value,
                dataType,
                description
            }, userId, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create setting error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create setting'
            });
        }
    }

    /**
     * Update specific setting
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateSetting(req, res) {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const { userId } = req.auth;

            console.log(`[DEBUG] updateSetting called with key: ${key}, value: ${value}`);

            if (value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Value is required'
                });
            }

            // Validate prescription check interval if that's what's being updated
            if (key === 'prescription_check_interval_value') {
                const intervalValue = parseInt(value);
                if (isNaN(intervalValue) || intervalValue < 1) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval value must be a positive number'
                    });
                }
                
                // Get the unit to validate range properly
                try {
                    const unitResult = await organizationSettingsService.getSetting('prescription_check_interval_unit', 'hours');
                    const unit = unitResult.success ? unitResult.setting.value : 'hours';
                    
                    if (unit === 'minutes' && intervalValue > 1440) {
                        return res.status(400).json({
                            success: false,
                            message: 'Prescription check interval cannot exceed 1440 minutes (24 hours)'
                        });
                    } else if (unit === 'hours' && intervalValue > 24) {
                        return res.status(400).json({
                            success: false,
                            message: 'Prescription check interval cannot exceed 24 hours'
                        });
                    }
                } catch (validationError) {
                    console.warn('Error validating prescription interval unit:', validationError);
                }
            }
            
            if (key === 'prescription_check_interval_unit') {
                if (!['hours', 'minutes'].includes(value)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval unit must be either "hours" or "minutes"'
                    });
                }
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await organizationSettingsService.updateSetting(
                key,
                value,
                userId,
                context
            );

            console.log(`[DEBUG] updateSetting result for ${key}:`, result);

            // If prescription check interval was updated successfully, reconfigure the scheduler
            if (result.success && (key === 'prescription_check_interval_value' || key === 'prescription_check_interval_unit')) {
                try {
                    const settingType = key === 'prescription_check_interval_value' ? 'value' : 'unit';
                    console.log(`Prescription check interval ${settingType} updated to ${value}, reconfiguring scheduler...`);
                    await schedulerService.reconfigurePrescriptionVerificationJob();
                    console.log('Scheduler reconfigured successfully');
                } catch (schedulerError) {
                    console.error('Failed to reconfigure scheduler:', schedulerError);
                    // Don't fail the setting update, just log the error
                }
            }

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update setting error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update setting'
            });
        }
    }

    /**
     * Delete specific setting
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deleteSetting(req, res) {
        try {
            const { key } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await organizationSettingsService.deleteSetting(
                key,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Delete setting error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete setting'
            });
        }
    }

    /**
     * Get system configuration
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSystemConfiguration(req, res) {
        try {
            const result = await organizationSettingsService.getSystemConfiguration();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get system configuration error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve system configuration'
            });
        }
    }

    /**
     * Update multiple settings at once
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateMultipleSettings(req, res) {
        try {
            const { settings } = req.body;
            const { userId } = req.auth;

            console.log(`[DEBUG] updateMultipleSettings called with settings:`, settings);

            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Settings object is required'
                });
            }

            // Validate prescription check interval settings if present
            if (settings.prescription_check_interval_value) {
                const intervalValue = parseInt(settings.prescription_check_interval_value);
                if (isNaN(intervalValue) || intervalValue < 1) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval value must be a positive number'
                    });
                }
                
                // Get the unit to validate range properly
                let unit = settings.prescription_check_interval_unit;
                if (!unit) {
                    try {
                        const unitResult = await organizationSettingsService.getSetting('prescription_check_interval_unit', 'hours');
                        unit = unitResult.success ? unitResult.setting.value : 'hours';
                    } catch (validationError) {
                        console.warn('Error getting prescription interval unit:', validationError);
                        unit = 'hours';
                    }
                }
                
                if (unit === 'minutes' && intervalValue > 1440) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval cannot exceed 1440 minutes (24 hours)'
                    });
                } else if (unit === 'hours' && intervalValue > 24) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval cannot exceed 24 hours'
                    });
                }
            }
            
            if (settings.prescription_check_interval_unit) {
                if (!['hours', 'minutes'].includes(settings.prescription_check_interval_unit)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Prescription check interval unit must be either "hours" or "minutes"'
                    });
                }
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await organizationSettingsService.updateMultipleSettings(
                settings,
                userId,
                context
            );

            console.log(`[DEBUG] updateMultipleSettings result:`, result);

            // If prescription check interval was updated successfully, reconfigure the scheduler
            if (result.success && (settings.prescription_check_interval_value || settings.prescription_check_interval_unit)) {
                try {
                    console.log('Prescription check interval updated in bulk, reconfiguring scheduler...');
                    await schedulerService.reconfigurePrescriptionVerificationJob();
                    console.log('Scheduler reconfigured successfully');
                } catch (schedulerError) {
                    console.error('Failed to reconfigure scheduler after bulk update:', schedulerError);
                    // Don't fail the setting update, just log the error
                }
            }

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update multiple settings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update settings'
            });
        }
    }

    // ===== NEW EXPORT METHODS =====

    /**
     * Export organization settings to JSON format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportSettingsJson(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('organization_settings.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new OrganizationSettingsController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('json', adminId, context, 'organization_settings');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Export settings
            const result = await organizationSettingsService.exportSettings(filters, 'json', {
                includeColumns,
                excludeColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new OrganizationSettingsController()._logExportSuccess('json', adminId, result.dataCount, filters, context, 'organization_settings');

            // Set headers for file download
            const filename = `organization_settings_export_${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).json({
                success: true,
                exportDate: new Date().toISOString(),
                exportedBy: adminUsername,
                settingsCount: result.dataCount,
                filters: result.appliedFilters,
                settings: result.data
            });
        } catch (error) {
            console.error('Export settings JSON error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export organization settings'
            });
        }
    }

    /**
     * Export organization settings to CSV format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportSettingsCsv(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('organization_settings.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new OrganizationSettingsController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('csv', adminId, context, 'organization_settings');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Export settings
            const result = await organizationSettingsService.exportSettings(filters, 'csv', {
                includeColumns,
                excludeColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new OrganizationSettingsController()._logExportSuccess('csv', adminId, result.dataCount, filters, context, 'organization_settings');

            // Set headers for CSV download
            const filename = `organization_settings_export_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.csvData);
        } catch (error) {
            console.error('Export settings CSV error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export organization settings'
            });
        }
    }

    /**
     * Export organization settings to Excel format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportSettingsExcel(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('organization_settings.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new OrganizationSettingsController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('excel', adminId, context, 'organization_settings');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Export settings
            const result = await organizationSettingsService.exportSettings(filters, 'excel', {
                includeColumns,
                excludeColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new OrganizationSettingsController()._logExportSuccess('excel', adminId, result.dataCount, filters, context, 'organization_settings');

            // Set headers for Excel download
            const filename = `organization_settings_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.excelBuffer);
        } catch (error) {
            console.error('Export settings Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export organization settings'
            });
        }
    }

    /**
     * Export organization settings in any format (unified endpoint)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportSettings(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('organization_settings.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, format = 'json', includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new OrganizationSettingsController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure(format, adminId, context, 'organization_settings');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Export settings
            const result = await organizationSettingsService.exportSettings(filters, format, {
                includeColumns,
                excludeColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new OrganizationSettingsController()._logExportSuccess(format, adminId, result.dataCount, filters, context, 'organization_settings');

            // Set appropriate headers and response based on format
            const filename = `organization_settings_export_${new Date().toISOString().split('T')[0]}`;

            switch (format.toLowerCase()) {
                case 'csv':
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
                    return res.status(200).send(result.csvData);

                case 'excel':
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
                    return res.status(200).send(result.excelBuffer);

                case 'json':
                default:
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
                    return res.status(200).json({
                        success: true,
                        exportDate: new Date().toISOString(),
                        exportedBy: adminUsername,
                        settingsCount: result.dataCount,
                        filters: result.appliedFilters,
                        settings: result.data
                    });
            }
        } catch (error) {
            console.error('Export settings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export organization settings'
            });
        }
    }

    // ===== HELPER METHODS =====

    /**
     * Helper method to log export failures
     * @private
     * @param {string} format - Export format
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @param {string} [exportType] - Type of data being exported
     */
    async _logExportFailure(format, adminId, context, exportType = 'organization_settings') {
        await logService.securityLog({
            eventType: 'export.password_failed',
            severity: 'medium',
            userId: adminId,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType: exportType,
                format,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Helper method to log successful exports
     * @private
     * @param {string} format - Export format
     * @param {number} adminId - Admin user ID
     * @param {number} dataCount - Number of records exported
     * @param {Object} filters - Applied filters
     * @param {Object} context - Request context
     * @param {string} [exportType] - Type of data being exported
     */
    async _logExportSuccess(format, adminId, dataCount, filters, context, exportType = 'organization_settings') {
        await logService.auditLog({
            eventType: `${exportType}.exported`,
            userId: adminId,
            targetType: exportType,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType,
                format,
                dataCount,
                filters,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }
}

module.exports = new OrganizationSettingsController();