module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if occurrence_number column already exists
        const tableInfo = await queryInterface.describeTable('analyses');
        
        if (!tableInfo.occurrence_number) {
            await queryInterface.addColumn('analyses', 'occurrence_number', {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Which occurrence this is in the recurring series (1, 2, 3, etc.)'
            });
            console.log('✅ Added occurrence_number column');
        } else {
            console.log('ℹ️ occurrence_number column already exists, skipping...');
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('analyses', 'occurrence_number');
    }
};