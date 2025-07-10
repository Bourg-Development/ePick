// db/migrations/scripts/010-remove-room-capacity-status.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Remove capacity and active columns from rooms table
        await queryInterface.removeColumn('rooms', 'capacity');
        await queryInterface.removeColumn('rooms', 'active');
        
        // Remove indexes that might reference these columns
        try {
            await queryInterface.removeIndex('rooms', ['active']);
        } catch (error) {
            // Index might not exist, ignore error
            console.log('Index on active column might not exist, skipping removal');
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Add back capacity column
        await queryInterface.addColumn('rooms', 'capacity', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 1,
            validate: {
                min: 1
            }
        });

        // Add back active column
        await queryInterface.addColumn('rooms', 'active', {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        });

        // Re-create index on active column
        await queryInterface.addIndex('rooms', ['active']);
    }
};