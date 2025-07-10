'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
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

        // Add index for performance
        await queryInterface.addIndex('analyses', ['recurring_analysis_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('analyses', ['recurring_analysis_id']);
        await queryInterface.removeColumn('analyses', 'recurring_analysis_id');
    }
};