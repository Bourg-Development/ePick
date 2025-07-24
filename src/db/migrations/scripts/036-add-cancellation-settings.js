// db/migrations/scripts/036-add-cancellation-settings.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add cancellation-related organization settings
        await queryInterface.bulkInsert('organization_settings', [
            {
                setting_key: 'cancellation_reason_min_length',
                setting_value: '10',
                data_type: 'integer',
                description: 'Minimum character length required for analysis cancellation reasons',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'bulk_cancellation_max_count',
                setting_value: '100',
                data_type: 'integer',
                description: 'Maximum number of analyses that can be cancelled in a single bulk operation',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                setting_key: 'cancelled_analysis_archive_delay',
                setting_value: '1',
                data_type: 'integer',
                description: 'Number of days after cancellation before cancelled analyses are automatically archived',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the added settings
        await queryInterface.bulkDelete('organization_settings', {
            setting_key: {
                [Sequelize.Op.in]: [
                    'cancellation_reason_min_length',
                    'bulk_cancellation_max_count',
                    'cancelled_analysis_archive_delay'
                ]
            }
        });
    }
};