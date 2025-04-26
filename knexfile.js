// knexfile.js
require('dotenv').config();

module.exports = {
    development: {
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'auth_system_dev',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            port: process.env.DB_PORT || 5432,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations',
            directory: './src/db/migrations'
        },
        seeds: {
            directory: './src/db/seeds'
        }
    },

    test: {
        client: 'postgresql',
        connection: {
            host: process.env.TEST_DB_HOST || 'localhost',
            database: process.env.TEST_DB_NAME || 'auth_system_test',
            user: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || 'postgres',
            port: process.env.TEST_DB_PORT || 5432
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations',
            directory: './src/db/migrations'
        },
        seeds: {
            directory: './src/db/seeds/test'
        }
    },

    staging: {
        client: 'postgresql',
        connection: {
            host: process.env.STAGING_DB_HOST,
            database: process.env.STAGING_DB_NAME,
            user: process.env.STAGING_DB_USER,
            password: process.env.STAGING_DB_PASSWORD,
            port: process.env.STAGING_DB_PORT || 5432,
            ssl: { rejectUnauthorized: false }
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations',
            directory: './src/db/migrations'
        }
    },

    production: {
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
        },
        pool: {
            min: 5,
            max: 30
        },
        migrations: {
            tableName: 'knex_migrations',
            directory: './src/db/migrations'
        }
    }
};