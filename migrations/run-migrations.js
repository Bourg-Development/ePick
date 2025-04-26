require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../src/config/database');

const data = config[process.env.NODE_ENV || 'development']

const sequelize = new Sequelize({
    dialect: data.dialect,
    host: data.host,
    username: data.username,
    password: data.password,
    database: data.database,
    logging: false,
});

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    const migrationsDir = path.join(__dirname, 'scripts');

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));

    try {
        for (const file of files) {
            const migration = require(path.join(migrationsDir, file));
            console.log(`Running migration: ${file}`);
            await migration.up(queryInterface, Sequelize);
        }
        console.log('All migrations executed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
})();
