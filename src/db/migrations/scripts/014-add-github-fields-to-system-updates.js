const { DataTypes } = require('sequelize');

/**
 * Migration: Add GitHub integration fields to system_updates table
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if system_updates table exists
        const tableInfo = await queryInterface.describeTable('system_updates');
        
        const columnsToAdd = [
            ['github_release_id', {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: 'GitHub release ID if imported from GitHub'
            }],
            ['github_release_url', {
                type: DataTypes.STRING(500),
                allowNull: true,
                comment: 'GitHub release URL'
            }],
            ['github_tag_name', {
                type: DataTypes.STRING(100),
                allowNull: true,
                comment: 'GitHub release tag name'
            }],
            ['auto_imported', {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this update was automatically imported from GitHub'
            }]
        ];

        // Add columns if they don't exist
        for (const [columnName, columnConfig] of columnsToAdd) {
            if (!tableInfo[columnName]) {
                await queryInterface.addColumn('system_updates', columnName, columnConfig);
                console.log(`✅ Added ${columnName} column`);
            } else {
                console.log(`ℹ️ ${columnName} column already exists, skipping...`);
            }
        }

        // Check if indexes exist before adding them
        const indexChecks = [
            ['idx_system_updates_github_release_id', 'github_release_id'],
            ['idx_system_updates_github_tag_name', 'github_tag_name']
        ];

        for (const [indexName, fieldName] of indexChecks) {
            const indexExists = await queryInterface.sequelize.query(
                `SELECT indexname FROM pg_indexes WHERE tablename = 'system_updates' AND indexname = '${indexName}'`,
                { type: Sequelize.QueryTypes.SELECT }
            );
            
            if (indexExists.length === 0) {
                await queryInterface.addIndex('system_updates', {
                    fields: [fieldName],
                    name: indexName
                });
                console.log(`✅ Added ${indexName} index`);
            } else {
                console.log(`ℹ️ ${indexName} index already exists, skipping...`);
            }
        }
    },

    async down(queryInterface) {
        // Remove indexes first
        await queryInterface.removeIndex('system_updates', 'idx_system_updates_github_tag_name');
        await queryInterface.removeIndex('system_updates', 'idx_system_updates_github_release_id');

        // Remove columns
        await queryInterface.removeColumn('system_updates', 'auto_imported');
        await queryInterface.removeColumn('system_updates', 'github_tag_name');
        await queryInterface.removeColumn('system_updates', 'github_release_url');
        await queryInterface.removeColumn('system_updates', 'github_release_id');
    }
};