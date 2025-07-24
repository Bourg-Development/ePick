module.exports = {
    async up(queryInterface, Sequelize) {
        // Add ics_feed_token column to users table
        await queryInterface.addColumn('users', 'ics_feed_token', {
            type: Sequelize.STRING(64),
            allowNull: true,
            unique: true
        });

        // Add index for faster lookups
        await queryInterface.addIndex('users', ['ics_feed_token'], {
            name: 'users_ics_feed_token_idx',
            where: {
                ics_feed_token: {
                    [Sequelize.Op.ne]: null
                }
            }
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index
        await queryInterface.removeIndex('users', 'users_ics_feed_token_idx');
        
        // Remove column
        await queryInterface.removeColumn('users', 'ics_feed_token');
    }
};