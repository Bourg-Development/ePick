'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add new organization settings for archiving configuration
        await queryInterface.bulkInsert('organization_settings', [
            {
                setting_key: 'archiving_check_interval_value',
                setting_value: '1',
                data_type: 'integer',
                description: 'How often to run archiving jobs (number)',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'archiving_check_interval_unit',
                setting_value: 'hours',
                data_type: 'string',
                description: 'Unit for archiving check interval (minutes, hours, days)',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'archiving_timezone',
                setting_value: 'America/New_York',
                data_type: 'string',
                description: 'Timezone for running archiving jobs',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the settings
        await queryInterface.bulkDelete('organization_settings', {
            setting_key: [
                'archiving_check_interval_value',
                'archiving_check_interval_unit', 
                'archiving_timezone'
            ]
        });
    }
};