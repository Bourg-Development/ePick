module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('analyses', 'occurrence_number', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Which occurrence this is in the recurring series (1, 2, 3, etc.)'
        });
    },
    
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('analyses', 'occurrence_number');
    }
};