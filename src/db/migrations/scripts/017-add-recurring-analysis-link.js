'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if recurring_analysis_id column already exists
        const tableInfo = await queryInterface.describeTable('analyses');
        
        if (!tableInfo.recurring_analysis_id) {
            await queryInterface.addColumn('analyses', 'recurring_analysis_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'recurring_analyses',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Links to recurring pattern if this analysis is part of a series'
            });
            console.log('✅ Added recurring_analysis_id column');
        } else {
            console.log('ℹ️ recurring_analysis_id column already exists, skipping...');
        }

        // Check if index exists before adding
        const indexExists = await queryInterface.sequelize.query(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'analyses' AND indexname LIKE '%recurring_analysis_id%'",
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (indexExists.length === 0) {
            // Add index for performance
            await queryInterface.addIndex('analyses', ['recurring_analysis_id']);
            console.log('✅ Added recurring_analysis_id index');
        } else {
            console.log('ℹ️ recurring_analysis_id index already exists, skipping...');
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('analyses', ['recurring_analysis_id']);
        await queryInterface.removeColumn('analyses', 'recurring_analysis_id');
    }
};