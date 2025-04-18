// utils/migrator.js
const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

class Migrator {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.queryInterface = sequelize.getQueryInterface();
    }

    async runMigrations() {
        // Create migrations table if it doesn't exist
        await this._createMigrationsTable();

        // Get all migration files
        const migrationFiles = fs.readdirSync(path.join(__dirname, './scripts'))
            .filter(file => file.endsWith('.js'))
            .sort();

        // Get executed migrations
        const executedMigrations = await this.sequelize.models.Migration.findAll();
        const executedMigrationNames = executedMigrations.map(m => m.name);

        // Run pending migrations
        for (const file of migrationFiles) {
            if (!executedMigrationNames.includes(file)) {
                const migration = require(path.join(__dirname, './scripts', file));
                console.log(`Running migration: ${file}`);
                await migration.up(this.queryInterface, Sequelize);
                await this.sequelize.models.Migration.create({ name: file });
                console.log(`Completed migration: ${file}`);
            }
        }
    }

    async rollbackMigration() {
        await this._createMigrationsTable();
        const executedMigrations = await this.sequelize.models.Migration.findAll({
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        if (executedMigrations.length > 0) {
            const lastMigration = executedMigrations[0];
            const migration = require(path.join(__dirname, './scripts', lastMigration.name));
            console.log(`Rolling back migration: ${lastMigration.name}`);
            await migration.down(this.queryInterface, Sequelize);
            await this.sequelize.models.Migration.destroy({ where: { name: lastMigration.name } });
            console.log(`Rolled back migration: ${lastMigration.name}`);
        }
    }

// utils/migrator.js (updated)
    async _createMigrationsTable() {
        try {
            if (!this.sequelize.models.Migration) {
                this.sequelize.define('Migration', {
                    name: {
                        type: DataTypes.STRING,
                        allowNull: false,
                        unique: true
                    }
                }, {
                    tableName: 'sequelize_migrations',
                    schema: 'public'  // Explicitly specify schema
                });

                // Try to sync, if fails due to permissions, continue
                try {
                    await this.sequelize.models.Migration.sync();
                } catch (syncError) {
                    console.warn('Could not sync Migration table (might exist already):', syncError.message);
                }

                // Verify table exists
                const tableExists = await this.queryInterface.showAllTables();
                if (!tableExists.includes('sequelize_migrations')) {
                    throw new Error('Migration table could not be created - check database permissions');
                }
            }
        } catch (error) {
            console.error('Migration setup failed:', error);
            throw error;
        }
    }
}

module.exports = Migrator;