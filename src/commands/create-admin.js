// commands/create-admin.js
require('dotenv').config();
const crypto = require('crypto');
const argon2 = require('argon2');
const { Pool } = require('pg');
const readline = require('readline');

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

// Constants
const PEPPER = process.env.PEPPER || 'change-me-in-production-pepper';

/**
 * Generate a 6-digit username
 * @returns {string} 6-digit numeric username
 */
const generateUsername = () => {
    const min = 100000; // 6 digits start at 100000
    const max = 999999; // 6 digits end at 999999
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Generate a random password
 * @param {number} length - Password length
 * @returns {string} Generated password
 */
const generatePassword = (length = 16) => {
    const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O
    const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // No l
    const numberChars = '23456789'; // No 0, 1
    const specialChars = '!@#$%^&*-_=+';

    const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

    let password = '';
    const randomBytes = crypto.randomBytes(length * 2);

    // Ensure at least one character from each set
    password += uppercaseChars.charAt(randomBytes[0] % uppercaseChars.length);
    password += lowercaseChars.charAt(randomBytes[1] % lowercaseChars.length);
    password += numberChars.charAt(randomBytes[2] % numberChars.length);
    password += specialChars.charAt(randomBytes[3] % specialChars.length);

    // Fill rest with random characters
    for (let i = password.length; i < length; i++) {
        password += allChars.charAt(randomBytes[i + 2] % allChars.length);
    }

    // Shuffle password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Hash password with Argon2id, salt, and pepper
 * @param {string} password - Plain text password
 * @param {string} salt - User-specific salt
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password, salt) => {
    const pepperedPassword = `${password}${salt}${PEPPER}`;

    return argon2.hash(pepperedPassword, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MiB
        timeCost: 3,       // 3 iterations
        parallelism: 4,    // 4 threads
        hashLength: 32     // 32 bytes output
    });
};

/**
 * Create admin user
 */
async function createAdminUser() {
    console.log('=== Creating Initial Admin User ===\n');

    // Create readline interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Create a promise-based question function
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    const pool = new Pool(dbConfig);

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('Database connection established successfully.');

        // Check if admin role exists
        const roleResult = await pool.query(`
      SELECT id FROM roles WHERE name = 'admin'
    `);

        if (roleResult.rows.length === 0) {
            console.error('Error: Admin role not found. Please run migrations first.');
            rl.close();
            await pool.end();
            return;
        }

        const adminRoleId = roleResult.rows[0].id;

        // Check if admin user already exists
        const userResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE role_id = $1
    `, [adminRoleId]);

        if (parseInt(userResult.rows[0].count) > 0) {
            console.log('Admin user already exists. If you need to create another admin, use the reference code system.');
            rl.close();
            await pool.end();
            return;
        }

        // Generate random username
        const username = generateUsername();

        // Get email from user input
        const email = await question('Enter admin email: ');

        if (!email || !email.includes('@')) {
            console.error('Error: Valid email is required.');
            rl.close();
            await pool.end();
            return;
        }

        // Generate random password
        const password = generatePassword();

        // Generate salt and hash password
        const salt = crypto.randomBytes(32).toString('hex');
        const passwordHash = await hashPassword(password, salt);

        // Begin transaction
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Insert admin user
            const userInsertResult = await client.query(`
        INSERT INTO users (username, password_hash, salt, role_id, email, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, [username, passwordHash, salt, adminRoleId, email]);

            const userId = userInsertResult.rows[0].id;

            // Store password in history
            await client.query(`
        INSERT INTO password_history (user_id, password_hash, created_at)
        VALUES ($1, $2, NOW())
      `, [userId, passwordHash]);

            await client.query('COMMIT');

            console.log('\n=== ADMIN USER CREATED SUCCESSFULLY ===');
            console.log(`Username: ${username}`);
            console.log(`Password: ${password}`);
            console.log(`Email: ${email}`);
            console.log('\nPLEASE SAVE THIS INFORMATION SECURELY');
            console.log('You will need these credentials to log in to the system.');
            console.log('================================================\n');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating admin user:', err);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Database error:', err);
    } finally {
        rl.close();
        await pool.end();
    }
}

// Run the script
createAdminUser();