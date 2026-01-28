// commands/create-admin.js
require('dotenv').config();
const crypto = require('crypto');
const argon2 = require('argon2');
const { Pool } = require('pg');
const readline = require('readline');
const secureRandom = require('../utils/secureRandom');

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
const SYSTEM_ADMIN_USERNAME = '000000'; // Default system administrator username

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

    // Securely shuffle password using cryptographically secure randomness
    return secureRandom.shuffleString(password);
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
 * Create system administrator user
 */
async function createSystemAdminUser() {
    console.log('=== Creating System Administrator User ===\n');

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

        // Check if system_admin role exists
        const roleResult = await pool.query(`
      SELECT id, is_system FROM roles WHERE name = 'system_admin'
    `);

        if (roleResult.rows.length === 0) {
            console.error('Error: System Administrator role not found. Please run migrations first.');
            return;
        }

        const systemAdminRole = roleResult.rows[0];

        if (!systemAdminRole.is_system) {
            console.error('Error: system_admin role is not marked as a system role.');
            return;
        }

        const systemAdminRoleId = systemAdminRole.id;

        // Check if system admin user already exists
        const userResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE username = $1
    `, [SYSTEM_ADMIN_USERNAME]);

        if (parseInt(userResult.rows[0].count) > 0) {
            console.log('System Administrator user already exists with username 000000.');
            return;
        }

        // Use predefined system admin username
        const username = SYSTEM_ADMIN_USERNAME;

        // Get email from user input
        const email = await question('Enter admin email: ');

        if (!email || !email.includes('@')) {
            console.error('Error: Valid email is required.');
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

            // Insert system admin user (created_by = NULL for system-created user)
            const userInsertResult = await client.query(`
        INSERT INTO users (username, password_hash, salt, role_id, email, full_name, created_at, updated_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NULL)
        RETURNING id
      `, [username, passwordHash, salt, systemAdminRoleId, email, 'System Administrator']);

            const userId = userInsertResult.rows[0].id;

            // Store password in history
            await client.query(`
        INSERT INTO password_history (user_id, password_hash, created_at)
        VALUES ($1, $2, NOW())
      `, [userId, passwordHash]);

            // Log the system admin creation (using the created user ID as system user for logging)
            await client.query(`
        INSERT INTO audit_logs (event_type, user_id, target_id, target_type, ip_address, device_fingerprint, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
                'user.system_admin_created',
                userId, // Use the created user ID as the "system" user for this log
                userId,
                'user',
                '127.0.0.1',
                'system',
                JSON.stringify({
                    username: username,
                    email: email,
                    roleId: systemAdminRoleId,
                    roleName: 'system_admin',
                    createdBy: 'system_initialization'
                })
            ]);

            await client.query('COMMIT');

            // Send account creation email with timeout
            try {
                console.log('\n📧 Attempting to send account creation email...');
                const emailService = require('../services/emailService');
                
                // Create a timeout promise
                const emailTimeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Email sending timeout after 10 seconds')), 10000);
                });
                
                // Race between email sending and timeout
                await Promise.race([
                    emailService.sendAccountCreatedEmail({
                        email: email,
                        userName: 'System Administrator',
                        role: 'System Administrator',
                        organization: 'ePick',
                        createdDate: new Date()
                    }),
                    emailTimeout
                ]);
                
                console.log('✓ Account creation email sent to:', email);
            } catch (emailError) {
                console.log('⚠️  Warning: Could not send account creation email:', emailError.message);
                console.log('   This does not affect the account creation process.');
            }

            console.log('\n=== SYSTEM ADMINISTRATOR CREATED SUCCESSFULLY ===');
            console.log(`Username: ${username}`);
            console.log(`Password: ${password}`);
            console.log(`Email: ${email}`);
            console.log('\n⚠️  IMPORTANT SECURITY NOTICE:');
            console.log('This is a SYSTEM ADMINISTRATOR account with full system access.');
            console.log('This account cannot be modified or deleted by regular admins.');
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
createSystemAdminUser()
    .then(() => {
        console.log('Script completed successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });