// Migration: Seed default analysis types in organization settings
const { Sequelize } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const now = new Date();
        const defaultAnalysisTypes = [
            { code: 'XY', name: 'XY Analysis', description: 'Standard XY blood analysis' },
            { code: 'YZ', name: 'YZ Analysis', description: 'Standard YZ blood analysis' },
            { code: 'ZG', name: 'ZG Analysis', description: 'Standard ZG blood analysis' },
            { code: 'HG', name: 'HG Analysis', description: 'Standard HG blood analysis' }
        ];

        // Check if analysis_types setting already exists
        const existingSetting = await queryInterface.sequelize.query(
            `SELECT id FROM organization_settings WHERE setting_key = 'analysis_types'`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (existingSetting.length === 0) {
            await queryInterface.bulkInsert('organization_settings', [{
                setting_key: 'analysis_types',
                setting_value: JSON.stringify(defaultAnalysisTypes),
                data_type: 'json',
                description: 'Available analysis types for blood sample processing',
                created_at: now,
                updated_at: now
            }]);
            console.log('✓ Default analysis types seeded in organization settings');
        } else {
            console.log('✓ Analysis types setting already exists, skipping seed');
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('organization_settings', {
            setting_key: 'analysis_types'
        });
        
        console.log('✓ Analysis types setting removed from organization settings');
    }
};