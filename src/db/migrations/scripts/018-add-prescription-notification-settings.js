// Migration to add prescription validation notification settings

const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add organization setting for prescription validation notification timeframe
        await queryInterface.bulkInsert('organization_settings', [
            {
                setting_key: 'prescription_validation_notification_hours',
                setting_value: '24',
                data_type: 'integer',
                description: 'Number of hours before a recurring analysis is due to send prescription validation notifications to agents',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'prescription_notification_enabled',
                setting_value: 'true',
                data_type: 'boolean',
                description: 'Enable notifications for recurring analyses requiring prescription validation',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the organization settings
        await queryInterface.bulkDelete('organization_settings', {
            setting_key: {
                [Sequelize.Op.in]: [
                    'prescription_validation_notification_hours',
                    'prescription_notification_enabled'
                ]
            }
        });
    }
};