const { DataTypes } = require('sequelize');

/**
 * Migration: Add GitHub integration fields to system_updates table
 */

module.exports = {
    async up(queryInterface) {
        await queryInterface.addColumn('system_updates', 'github_release_id', {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'GitHub release ID if imported from GitHub'
        });

        await queryInterface.addColumn('system_updates', 'github_release_url', {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'GitHub release URL'
        });

        await queryInterface.addColumn('system_updates', 'github_tag_name', {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'GitHub release tag name'
        });

        await queryInterface.addColumn('system_updates', 'auto_imported', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this update was automatically imported from GitHub'
        });

        // Add index for GitHub release ID for faster lookups
        await queryInterface.addIndex('system_updates', {
            fields: ['github_release_id'],
            name: 'idx_system_updates_github_release_id'
        });

        // Add index for GitHub tag name
        await queryInterface.addIndex('system_updates', {
            fields: ['github_tag_name'],
            name: 'idx_system_updates_github_tag_name'
        });
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