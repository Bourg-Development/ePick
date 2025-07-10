const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Add prescription check interval settings to organization_settings
            await queryInterface.bulkInsert('organization_settings', [
                {
                    setting_key: 'prescription_check_interval_value',
                    setting_value: '4',
                    data_type: 'integer',
                    description: 'The numeric value for prescription check interval',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    setting_key: 'prescription_check_interval_unit',
                    setting_value: 'hours',
                    data_type: 'string',
                    description: 'The time unit for prescription check interval (hours or minutes)',
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ], { 
                transaction,
                ignoreDuplicates: true 
            });

            await transaction.commit();
            console.log('✓ Added prescription check interval setting');
            
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Error adding prescription check interval setting:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Remove the prescription check interval settings
            await queryInterface.bulkDelete('organization_settings', {
                setting_key: {
                    [Sequelize.Op.in]: [
                        'prescription_check_interval_value',
                        'prescription_check_interval_unit'
                    ]
                }
            }, { transaction });

            await transaction.commit();
            console.log('✓ Removed prescription check interval setting');
            
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Error removing prescription check interval setting:', error);
            throw error;
        }
    }
};