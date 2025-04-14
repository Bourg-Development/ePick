require('dotenv').config();

module.exports = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    max: process.env.DB_POOL_MAX || 20,
    idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000,
    connectionTimeoutMillis: process.env.DB_CONN_TIMEOUT || 2000,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: true,
        ca: Buffer.from(process.env.DB_CA_CERT, 'base64').toString('ascii')
    } : false,
    application_name: 'medical-app'
};