const { Pool } = require('pg');
const config = require('../config/database');
const logger = require('../config/logger').getComponentLogger('database');

const pool = new Pool(config);

// Connection lifecycle hooks
pool.on('connect', (client) => {
    logger.debug('Database connection established');
    // Set statement timeout for all queries
    client.query('SET statement_timeout TO 30000');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error', err);
    process.exit(-1);
});

module.exports = {
    query: async (text, params) => {
        const start = Date.now();
        try {
            const res = await pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug(`Query executed in ${duration}ms`, { text });
            return res;
        } catch (err) {
            logger.error('Query error', { text, params, error: err.message });
            throw err;
        }
    },
    getClient: async () => {
        const client = await pool.connect();
        const query = client.query;
        const release = client.release;

        // Set a timeout of 5 seconds for releasing the client
        const timeout = setTimeout(() => {
            logger.error('Client has been checked out for too long');
        }, 5000);

        // Monkey patch the release method
        client.release = () => {
            clearTimeout(timeout);
            client.query = query;
            client.release = release;
            return release.apply(client);
        };

        return client;
    }
};