const { Sequelize } = require('sequelize');
const Migrator = require('./migrate');
const config = require('../src/config/config');

const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'postgres',
    dialectOptions: {
        ssl: config.db.ssl && {
            require: true,
            rejectUnauthorized: false
        },
    },
    logging: config.env === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    define:{
        timestamps: true,
        paranoid: true,
        underscored: true
    },
});


// Create and run migrator
const migrator = new Migrator(sequelize);

async function main() {
    try {
        await migrator.runMigrations();
        console.log('Migrations completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();