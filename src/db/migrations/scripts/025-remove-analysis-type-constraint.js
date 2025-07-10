// db/migrations/021-remove-analysis-type-constraint.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Drop the check constraint that restricts analysis types to hardcoded values
        await queryInterface.sequelize.query(`
            ALTER TABLE analyses DROP CONSTRAINT IF EXISTS check_analysis_type_values;
        `);
        
        // Also drop the constraint on archived_analyses if it exists
        await queryInterface.sequelize.query(`
            ALTER TABLE archived_analyses DROP CONSTRAINT IF EXISTS check_analysis_type_values;
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Re-add the original constraint if needed (for rollback)
        await queryInterface.sequelize.query(`
            ALTER TABLE analyses ADD CONSTRAINT check_analysis_type_values
                CHECK (analysis_type IN ('XY', 'YZ', 'ZG', 'HG'));
        `);
    }
};