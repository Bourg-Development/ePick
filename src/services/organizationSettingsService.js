// services/organizationSettingsService.js - Enhanced with export functionality
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const docService = require('./docService'); // Add import for export functionality

/**
 * Service for managing organization settings
 */
class OrganizationSettingsService {
    /**
     * Get analysis types from organization settings
     * @returns {Promise<Object>} Analysis types
     */
    async getAnalysisTypes() {
        try {
            const setting = await db.OrganizationSettings.findOne({
                where: { setting_key: 'analysis_types' }
            });
            
            if (!setting) {
                // Return default analysis types if none configured
                const defaultTypes = [
                    { code: 'XY', name: 'XY Analysis', description: 'Standard XY blood analysis' },
                    { code: 'YZ', name: 'YZ Analysis', description: 'Standard YZ blood analysis' },
                    { code: 'ZG', name: 'ZG Analysis', description: 'Standard ZG blood analysis' },
                    { code: 'HG', name: 'HG Analysis', description: 'Standard HG blood analysis' }
                ];
                return {
                    success: true,
                    analysisTypes: defaultTypes
                };
            }
            
            const analysisTypes = JSON.parse(setting.setting_value);
            return {
                success: true,
                analysisTypes: analysisTypes
            };
        } catch (error) {
            console.error('Get analysis types error:', error);
            return {
                success: false,
                message: 'Failed to retrieve analysis types'
            };
        }
    }
    
    /**
     * Update analysis types in organization settings
     * @param {Array} analysisTypes - Array of analysis type objects
     * @param {number} userId - User ID making the change
     * @returns {Promise<Object>} Result
     */
    async updateAnalysisTypes(analysisTypes, userId) {
        try {
            // Validate input
            if (!Array.isArray(analysisTypes)) {
                return {
                    success: false,
                    message: 'Analysis types must be an array'
                };
            }
            
            // Validate analysis types
            for (const type of analysisTypes) {
                if (!type.code || !type.name) {
                    return {
                        success: false,
                        message: 'Each analysis type must have a code and name'
                    };
                }
                
                if (typeof type.code !== 'string' || typeof type.name !== 'string') {
                    return {
                        success: false,
                        message: 'Analysis type code and name must be strings'
                    };
                }
                
                if (type.code.length > 10) {
                    return {
                        success: false,
                        message: 'Analysis type code cannot exceed 10 characters'
                    };
                }
                
                if (type.name.length > 100) {
                    return {
                        success: false,
                        message: 'Analysis type name cannot exceed 100 characters'
                    };
                }
                
                if (type.description && type.description.length > 500) {
                    return {
                        success: false,
                        message: 'Analysis type description cannot exceed 500 characters'
                    };
                }
            }
            
            // Check for duplicate codes
            const codes = analysisTypes.map(t => t.code);
            const uniqueCodes = [...new Set(codes)];
            if (codes.length !== uniqueCodes.length) {
                return {
                    success: false,
                    message: 'Duplicate analysis type codes are not allowed'
                };
            }
            
            // Check if any deleted types are currently in use
            console.log('Checking for deleted types in use...');
            const currentTypes = await this.getAnalysisTypes();
            if (currentTypes.success) {
                const currentCodes = currentTypes.analysisTypes.map(t => t.code);
                const deletedCodes = currentCodes.filter(code => !codes.includes(code));
                console.log('Deleted codes:', deletedCodes);
                
                if (deletedCodes.length > 0) {
                    // Check if any deleted types are in use
                    console.log('Checking if deleted types are in use...');
                    const analysesUsingDeletedTypes = await db.Analysis.findOne({
                        where: {
                            analysis_type: {
                                [require('sequelize').Op.in]: deletedCodes
                            }
                        }
                    });
                    
                    if (analysesUsingDeletedTypes) {
                        console.log('Found analysis using deleted type:', analysesUsingDeletedTypes.analysis_type);
                        return {
                            success: false,
                            message: `Cannot delete analysis type "${analysesUsingDeletedTypes.analysis_type}" because it is currently in use by existing analyses`
                        };
                    }
                }
            }
            
            // Update or create setting
            console.log('Updating database setting...');
            const [setting] = await db.OrganizationSettings.findOrCreate({
                where: { setting_key: 'analysis_types' },
                defaults: {
                    setting_key: 'analysis_types',
                    setting_value: JSON.stringify(analysisTypes),
                    data_type: 'json',
                    description: 'Available analysis types for blood sample processing',
                    updated_by: userId
                }
            });
            
            if (!setting.isNewRecord) {
                console.log('Updating existing setting...');
                await setting.update({
                    setting_value: JSON.stringify(analysisTypes),
                    updated_by: userId
                });
            }
            
            // Log the change
            console.log('Logging change...');
            await logService.auditLog({
                eventType: 'settings.analysis_types.updated',
                userId,
                targetType: 'organization_settings',
                metadata: {
                    action: 'UPDATE_ANALYSIS_TYPES',
                    details: `Updated analysis types configuration`,
                    analysisTypesCount: analysisTypes.length
                }
            });
            
            console.log('Service completed successfully');
            return {
                success: true,
                message: 'Analysis types updated successfully'
            };
        } catch (error) {
            console.error('Update analysis types error:', error);
            return {
                success: false,
                message: 'Failed to update analysis types'
            };
        }
    }
    /**
     * Get all organization settings
     * @returns {Promise<Object>} All settings
     */
    async getAllSettings() {
        try {
            const settings = await db.OrganizationSettings.findAll({
                include: [
                    { association: 'updatedBy', attributes: ['id', 'username'] }
                ],
                order: [['setting_key', 'ASC']]
            });

            // Parse values based on data type
            const parsedSettings = settings.map(setting => ({
                id: setting.id,
                key: setting.setting_key,
                value: this._parseValue(setting.setting_value, setting.data_type),
                rawValue: setting.setting_value,
                dataType: setting.data_type,
                description: setting.description,
                updatedBy: setting.updatedBy,
                createdAt: setting.created_at,
                updatedAt: setting.updated_at
            }));

            return {
                success: true,
                settings: parsedSettings
            };
        } catch (error) {
            console.error('Get all settings error:', error);
            return {
                success: false,
                message: 'Failed to retrieve settings'
            };
        }
    }

    /**
     * Get a specific setting by key
     * @param {string} settingKey - Setting key
     * @returns {Promise<Object>} Setting value or error
     */
    async getSetting(settingKey) {
        try {
            const setting = await db.OrganizationSettings.findOne({
                where: { setting_key: settingKey },
                include: [
                    { association: 'updatedBy', attributes: ['id', 'username'] }
                ]
            });

            if (!setting) {
                return {
                    success: false,
                    message: 'Setting not found'
                };
            }

            return {
                success: true,
                setting: {
                    id: setting.id,
                    key: setting.setting_key,
                    value: this._parseValue(setting.setting_value, setting.data_type),
                    rawValue: setting.setting_value,
                    dataType: setting.data_type,
                    description: setting.description,
                    updatedBy: setting.updatedBy,
                    createdAt: setting.created_at,
                    updatedAt: setting.updated_at
                }
            };
        } catch (error) {
            console.error('Get setting error:', error);
            return {
                success: false,
                message: 'Failed to retrieve setting'
            };
        }
    }

    /**
     * Update a setting value
     * @param {string} settingKey - Setting key
     * @param {any} value - New value
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateSetting(settingKey, value, userId, context) {
        try {
            const setting = await db.OrganizationSettings.findOne({
                where: { setting_key: settingKey }
            });

            if (!setting) {
                return {
                    success: false,
                    message: 'Setting not found'
                };
            }

            // Store old value for logging
            const oldValue = setting.setting_value;

            // Validate and serialize the new value
            const serializedValue = this._serializeValue(value, setting.data_type);

            if (serializedValue === null) {
                return {
                    success: false,
                    message: `Invalid value for data type ${setting.data_type}`
                };
            }

            // Validate specific settings
            const validationResult = await this._validateSetting(settingKey, value);
            if (!validationResult.valid) {
                return {
                    success: false,
                    message: validationResult.message
                };
            }

            // Update the setting
            setting.setting_value = serializedValue;
            setting.updated_by = userId;
            await setting.save();

            // Log the update
            await logService.auditLog({
                eventType: 'organization_settings.updated',
                userId,
                targetId: setting.id,
                targetType: 'organization_settings',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    settingKey,
                    oldValue,
                    newValue: serializedValue,
                    dataType: setting.data_type,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Setting updated successfully',
                setting: {
                    key: setting.setting_key,
                    value: this._parseValue(setting.setting_value, setting.data_type),
                    dataType: setting.data_type
                }
            };
        } catch (error) {
            console.error('Update setting error:', error);
            return {
                success: false,
                message: 'Failed to update setting'
            };
        }
    }

    /**
     * Create a new setting
     * @param {Object} data - Setting data
     * @param {string} data.key - Setting key
     * @param {any} data.value - Setting value
     * @param {string} data.dataType - Data type (string, integer, decimal, boolean, json)
     * @param {string} [data.description] - Setting description
     * @param {number} userId - User ID creating the setting
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createSetting(data, userId, context) {
        try {
            const { key, value, dataType, description } = data;

            // Check if setting already exists
            const existingSetting = await db.OrganizationSettings.findOne({
                where: { setting_key: key }
            });

            if (existingSetting) {
                return {
                    success: false,
                    message: 'Setting with this key already exists'
                };
            }

            // Validate data type
            const validDataTypes = ['string', 'integer', 'decimal', 'boolean', 'json'];
            if (!validDataTypes.includes(dataType)) {
                return {
                    success: false,
                    message: 'Invalid data type'
                };
            }

            // Serialize the value
            const serializedValue = this._serializeValue(value, dataType);

            if (serializedValue === null) {
                return {
                    success: false,
                    message: `Invalid value for data type ${dataType}`
                };
            }

            // Create the setting
            const setting = await db.OrganizationSettings.create({
                setting_key: key,
                setting_value: serializedValue,
                data_type: dataType,
                description: description || null,
                updated_by: userId
            });

            // Log the creation
            await logService.auditLog({
                eventType: 'organization_settings.created',
                userId,
                targetId: setting.id,
                targetType: 'organization_settings',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    settingKey: key,
                    value: serializedValue,
                    dataType,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                settingId: setting.id,
                message: 'Setting created successfully'
            };
        } catch (error) {
            console.error('Create setting error:', error);
            return {
                success: false,
                message: 'Failed to create setting'
            };
        }
    }

    /**
     * Delete a setting
     * @param {string} settingKey - Setting key
     * @param {number} userId - User ID performing the deletion
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Deletion result
     */
    async deleteSetting(settingKey, userId, context) {
        try {
            const setting = await db.OrganizationSettings.findOne({
                where: { setting_key: settingKey }
            });

            if (!setting) {
                return {
                    success: false,
                    message: 'Setting not found'
                };
            }

            // Check if setting is critical and cannot be deleted
            const criticalSettings = [
                'max_analyses_per_day',
                'working_days',
            ];

            if (criticalSettings.includes(settingKey)) {
                return {
                    success: false,
                    message: 'Cannot delete critical system setting'
                };
            }

            // Store setting data for logging
            const settingData = {
                key: setting.setting_key,
                value: setting.setting_value,
                dataType: setting.data_type
            };

            // Delete the setting
            await setting.destroy();

            // Log the deletion
            await logService.auditLog({
                eventType: 'organization_settings.deleted',
                userId,
                targetId: setting.id,
                targetType: 'organization_settings',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    deletedSetting: settingData,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Setting deleted successfully'
            };
        } catch (error) {
            console.error('Delete setting error:', error);
            return {
                success: false,
                message: 'Failed to delete setting'
            };
        }
    }

    /**
     * Get system configuration for the blood analysis system
     * @returns {Promise<Object>} System configuration
     */
    async getSystemConfiguration() {
        try {
            const systemSettings = await db.OrganizationSettings.findAll({
                where: {
                    setting_key: {
                        [Op.in]: [
                            'max_analyses_per_day',
                            'working_days',
                            'auto_archive_enabled',
                            'notification_enabled',
                        ]
                    }
                }
            });

            const config = {};
            systemSettings.forEach(setting => {
                config[setting.setting_key] = this._parseValue(setting.setting_value, setting.data_type);
            });

            return {
                success: true,
                configuration: config
            };
        } catch (error) {
            console.error('Get system configuration error:', error);
            return {
                success: false,
                message: 'Failed to retrieve system configuration'
            };
        }
    }

    /**
     * Update multiple settings at once
     * @param {Object} settings - Object with setting keys and values
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateMultipleSettings(settings, userId, context) {
        const transaction = await db.sequelize.transaction();

        try {
            const results = [];
            const errors = [];

            for (const [key, value] of Object.entries(settings)) {
                try {
                    const setting = await db.OrganizationSettings.findOne({
                        where: { setting_key: key },
                        transaction
                    });

                    if (!setting) {
                        errors.push(`Setting '${key}' not found`);
                        continue;
                    }

                    // Validate and serialize the new value
                    const serializedValue = this._serializeValue(value, setting.data_type);

                    if (serializedValue === null) {
                        errors.push(`Invalid value for setting '${key}' (expected ${setting.data_type})`);
                        continue;
                    }

                    // Validate specific settings
                    const validationResult = await this._validateSetting(key, value);
                    if (!validationResult.valid) {
                        errors.push(`${key}: ${validationResult.message}`);
                        continue;
                    }

                    const oldValue = setting.setting_value;
                    setting.setting_value = serializedValue;
                    setting.updated_by = userId;
                    await setting.save({ transaction });

                    results.push({
                        key,
                        oldValue,
                        newValue: serializedValue,
                        success: true
                    });

                } catch (error) {
                    errors.push(`Error updating '${key}': ${error.message}`);
                }
            }

            if (errors.length > 0 && results.length === 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Failed to update settings',
                    errors
                };
            }

            await transaction.commit();

            // Log the bulk update
            await logService.auditLog({
                eventType: 'organization_settings.bulk_updated',
                userId,
                targetType: 'organization_settings',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    updatedSettings: results,
                    errors,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: `Updated ${results.length} settings successfully`,
                results,
                errors: errors.length > 0 ? errors : undefined
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Update multiple settings error:', error);
            return {
                success: false,
                message: 'Failed to update settings'
            };
        }
    }

    // ===== NEW EXPORT FUNCTIONALITY =====

    /**
     * Export organization settings to JSON, CSV, or Excel format
     * @param {Object} filters - Filter criteria
     * @param {string} format - Export format ('json', 'csv', 'excel')
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Export result
     */
    async exportSettings(filters = {}, format = 'json', options = {}) {
        try {
            const whereClause = {};

            // Apply filtering logic
            if (filters.key) {
                whereClause.setting_key = { [Op.iLike]: `%${filters.key}%` };
            }
            if (filters.dataType) {
                whereClause.data_type = filters.dataType;
            }
            if (filters.hasDescription !== undefined) {
                if (filters.hasDescription) {
                    whereClause.description = { [Op.not]: null };
                } else {
                    whereClause.description = null;
                }
            }

            // Get all matching settings (no pagination for export)
            const settings = await db.OrganizationSettings.findAll({
                where: whereClause,
                include: [
                    {
                        association: 'updatedBy',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['setting_key', 'ASC']]
            });

            // Format settings for export
            const formattedSettings = settings.map(setting => this._formatSettingForExport(setting));

            // Track applied filters
            const appliedFilters = {};
            if (filters.key) appliedFilters.key = filters.key;
            if (filters.dataType) appliedFilters.dataType = filters.dataType;
            if (filters.hasDescription !== undefined) appliedFilters.hasDescription = filters.hasDescription;

            // Prepare settings-specific export options
            const settingsExportOptions = {
                ...options,
                appliedFilters,
                defaultExcludedFields: [], // No sensitive fields for organization settings
                columnHeaders: this._getSettingsColumnHeaders(),
                sheetName: 'Organization Settings',
                exportTitle: 'EPICK ORGANIZATION SETTINGS\nSettings Export Report',
                metadata: {
                    exportType: 'organization_settings',
                    totalSettings: formattedSettings.length
                }
            };

            // Use the document service for export
            return await docService.exportData(formattedSettings, format, settingsExportOptions);

        } catch (error) {
            console.error('Export settings error:', error);
            return {
                success: false,
                message: 'Failed to export organization settings'
            };
        }
    }

    /**
     * Format setting data for export (flatten associations, format values)
     * @private
     * @param {Object} setting - Setting instance from database
     * @returns {Object} Formatted setting data
     */
    _formatSettingForExport(setting) {
        const settingData = setting.toJSON();

        return {
            id: settingData.id,
            key: settingData.setting_key,
            value: this._parseValue(settingData.setting_value, settingData.data_type),
            rawValue: settingData.setting_value,
            dataType: settingData.data_type,
            description: settingData.description,
            isCritical: this._isCriticalSetting(settingData.setting_key),
            hasDescription: settingData.description !== null,
            createdAt: settingData.created_at,
            updatedAt: settingData.updated_at,
            updatedBy: settingData.updatedBy ? settingData.updatedBy.username : null,
            updatedById: settingData.updated_by
        };
    }

    /**
     * Get settings-specific column headers for export
     * @private
     * @returns {Object} Column header mappings
     */
    _getSettingsColumnHeaders() {
        return {
            id: 'Setting ID',
            key: 'Setting Key',
            value: 'Current Value',
            rawValue: 'Raw Value (Stored)',
            dataType: 'Data Type',
            description: 'Description',
            isCritical: 'Critical Setting',
            hasDescription: 'Has Description',
            createdAt: 'Created Date',
            updatedAt: 'Last Modified',
            updatedBy: 'Last Updated By',
            updatedById: 'Updated By ID'
        };
    }

    /**
     * Check if a setting is critical (cannot be deleted)
     * @private
     * @param {string} settingKey - Setting key
     * @returns {boolean} Whether the setting is critical
     */
    _isCriticalSetting(settingKey) {
        const criticalSettings = [
            'max_analyses_per_day',
            'working_days',
        ];
        return criticalSettings.includes(settingKey);
    }

    // ===== END EXPORT FUNCTIONALITY =====

    /**
     * Parse a setting value based on its data type
     * @private
     * @param {string} value - Raw value
     * @param {string} dataType - Data type
     * @returns {any} Parsed value
     */
    _parseValue(value, dataType) {
        try {
            switch (dataType) {
                case 'integer':
                    return parseInt(value);
                case 'decimal':
                    return parseFloat(value);
                case 'boolean':
                    return value === 'true' || value === true;
                case 'json':
                    return JSON.parse(value);
                case 'string':
                default:
                    return value;
            }
        } catch (error) {
            console.error(`Error parsing value '${value}' as ${dataType}:`, error);
            return value; // Return original value if parsing fails
        }
    }

    /**
     * Serialize a value based on its data type
     * @private
     * @param {any} value - Value to serialize
     * @param {string} dataType - Data type
     * @returns {string|null} Serialized value or null if invalid
     */
    _serializeValue(value, dataType) {
        try {
            switch (dataType) {
                case 'integer':
                    const intValue = parseInt(value);
                    return isNaN(intValue) ? null : intValue.toString();

                case 'decimal':
                    const floatValue = parseFloat(value);
                    return isNaN(floatValue) ? null : floatValue.toString();

                case 'boolean':
                    if (typeof value === 'boolean') {
                        return value.toString();
                    }
                    if (typeof value === 'string') {
                        const lowerValue = value.toLowerCase();
                        if (lowerValue === 'true' || lowerValue === 'false') {
                            return lowerValue;
                        }
                    }
                    return null;

                case 'json':
                    if (typeof value === 'object') {
                        return JSON.stringify(value);
                    }
                    if (typeof value === 'string') {
                        JSON.parse(value); // Validate JSON
                        return value;
                    }
                    return null;

                case 'string':
                default:
                    return value.toString();
            }
        } catch (error) {
            console.error(`Error serializing value for ${dataType}:`, error);
            return null;
        }
    }

    /**
     * Validate a specific setting value
     * @private
     * @param {string} settingKey - Setting key
     * @param {any} value - Value to validate
     * @returns {Object} Validation result
     */
    async _validateSetting(settingKey, value) {
        switch (settingKey) {
            case 'max_analyses_per_day':
                const maxAnalyses = parseInt(value);
                if (isNaN(maxAnalyses) || maxAnalyses < 1) {
                    return { valid: false, message: 'Maximum analyses per day must be a positive integer' };
                }
                if (maxAnalyses > 1000) {
                    return { valid: false, message: 'Maximum analyses per day cannot exceed 1000' };
                }
                break;

            case 'working_days':
                value = JSON.parse(value)
                if (!Array.isArray(value)) {
                    console.log(2)
                    return { valid: false, message: 'Working days must be an array' };
                }
                const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const invalidDays = value.filter(day => !validDays.includes(day));
                if (invalidDays.length > 0) {
                    return { valid: false, message: `Invalid day(s): ${invalidDays.join(', ')}` };
                }
                if (value.length === 0) {
                    return { valid: false, message: 'At least one working day must be specified' };
                }
                break;
        }

        return { valid: true };
    }
}

module.exports = new OrganizationSettingsService();