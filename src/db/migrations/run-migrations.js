// db/migrations/run-migrations.js
require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME || 'security_auth',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : false
};

// Sequelize configuration (matching your migration files)
const sequelizeConfig = {
    username: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    dialectOptions: dbConfig.ssl ? { ssl: dbConfig.ssl } : {}
};

// Tracking table for migrations
const MIGRATION_TABLE = 'sequelize_meta';

// Main function to run migrations
async function runMigrations() {
    console.log('Starting database migrations...');

    // Create a connection pool
    const pool = new Pool(dbConfig);

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('Database connection established successfully.');

        // Create migration tracking table if it doesn't exist
        await createMigrationTable(pool);

        // Get applied migrations
        const appliedMigrations = await getAppliedMigrations(pool);
        console.log(`Found ${appliedMigrations.length} previously applied migrations.`);

        // Get all migration files
        const migrationsDir = path.join(__dirname, 'scripts');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js') && file !== 'run-migrations.js')
            .sort(); // Sort to ensure migrations run in order

        console.log(`Found ${migrationFiles.length} migration files.`);

        // Filter out migrations that haven't been applied yet
        const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.includes(file));
        console.log(`Found ${pendingMigrations.length} pending migrations.`);

        // Apply pending migrations
        if (pendingMigrations.length > 0) {
            for (const migrationFile of pendingMigrations) {
                console.log(`Applying migration: ${migrationFile}`);

                // Import the migration file
                const migration = require(path.join(migrationsDir, migrationFile));

                // Create Sequelize instance
                const sequelize = new Sequelize(sequelizeConfig);

                try {
                    // Run the migration's up function
                    await migration.up(sequelize.getQueryInterface(), Sequelize);

                    // Record the migration as applied
                    await recordMigration(pool, migrationFile);

                    console.log(`Migration ${migrationFile} applied successfully.`);
                } catch (err) {
                    console.error(`Error applying migration ${migrationFile}:`, err);
                    throw err;
                } finally {
                    // Close the Sequelize connection
                    await sequelize.close();
                }
            }

            console.log('All migrations applied successfully.');
        } else {
            console.log('Database is already up to date.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Create migration tracking table
async function createMigrationTable(pool) {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    } catch (err) {
        console.error('Error creating migration table:', err);
        throw err;
    }
}

// Get list of applied migrations
async function getAppliedMigrations(pool) {
    try {
        const result = await pool.query(`
      SELECT name FROM ${MIGRATION_TABLE} ORDER BY applied_at ASC;
    `);
        return result.rows.map(row => row.name);
    } catch (err) {
        console.error('Error getting applied migrations:', err);
        throw err;
    }
}

// Record a migration as applied
async function recordMigration(pool, migrationName) {
    try {
        await pool.query(`
      INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1);
    `, [migrationName]);
    } catch (err) {
        console.error(`Error recording migration ${migrationName}:`, err);
        throw err;
    }
}

// Create database if doesn't exist
async function createDatabaseIfNotExists() {
    // Connect to postgres database to check if target database exists
    const adminConfig = {
        ...dbConfig,
        database: 'postgres' // Connect to default postgres database
    };

    const adminPool = new Pool(adminConfig);

    try {
        // Check if database exists
        const result = await adminPool.query(`
      SELECT EXISTS (
        SELECT FROM pg_database WHERE datname = $1
      );
    `, [dbConfig.database]);

        const exists = result.rows[0].exists;

        if (!exists) {
            console.log(`Creating database ${dbConfig.database}...`);
            await adminPool.query(`CREATE DATABASE ${dbConfig.database};`);
            console.log(`Database ${dbConfig.database} created successfully.`);
        } else {
            console.log(`Database ${dbConfig.database} already exists.`);
        }
    } catch (err) {
        console.error('Error checking/creating database:', err);
        throw err;
    } finally {
        await adminPool.end();
    }
}

// Check for command line arguments
const args = process.argv.slice(2);
if (args.includes('--create-db')) {
    createDatabaseIfNotExists()
        .then(() => runMigrations())
        .catch(err => {
            console.error('Setup failed:', err);
            process.exit(1);
        });
} else {
    runMigrations().catch(err => {
        process.exit(1);
    });
}