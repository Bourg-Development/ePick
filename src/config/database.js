const { Sequelize } = require('sequelize');
const env = require('./config');
const logger = require('./logger').getComponentLogger('database');

// Initialize Sequel with secure options
const sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
    host: env.dbHost,
    port: env.dbPort,
    dialect: env.dbDialect,
    logging: env.nodeEnv === 'development' ? logger.debug : false,

    // Enhanced security for production
    dialectOptions:{
        ssl: env.nodeEnv === 'production' ? {
            require: true,
            rejectUnauthorized: true, // Validate SSL certificates
        } : false,
        // Prevent potential SQL injection vectors
        options: {
            encrypt: true,
            trustServerCertificate: env.nodeEnv !== 'production',
        }
    },

    // Connection pool configuration for reliability
    pool:{
        max: 10,                    // Maximum number of connections in pool
        min: 0,                     // Minimum number of connections in pool
        acquire: 30000,             // Maximum time to acquire a connection
        idle: 10000,                // Maximum tine if connection can be idle
        evict: 1000,                // Time between eviction rns for idle production
        validateConnection: true    // Validate connections before use from pool
    },

    // Sequelize options for better security
    define: {
        // Use underscored naming for consistency
        underscored: true,
        // Don't delete records, mark them as deleted instead
        paranoid: true,
        // Add created_at and updated_at timestamps
        timestamps: true,
        // Lock the table definition to prevent accidents
        freezeTableName: true,
    }
});

// Test database connection function
async function testConnection(){
    try{
        await sequelize.authenticate();
        logger.info('Database connection has been established successfully.');
        return true;
    }catch(error){
        console.error('Unable to connect to the database', error);
        return false;
    }
}
module.exports = {
    sequelize,
    testConnection
}