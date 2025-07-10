// commands/assign-admin-role.js
require('dotenv').config();
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

/**
 * Assign admin role to a user
 */
async function assignAdminRole() {
    console.log('=== Assign Admin Role to User ===\n');

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

        // Get username from user input
        const username = await question('Enter username (6 digits): ');

        if (!username || !username.match(/^\d{6}$/)) {
            console.error('Error: Username must be exactly 6 digits.');
            rl.close();
            await pool.end();
            return;
        }

        // Check if user exists
        const userResult = await pool.query(`
            SELECT id, username, role_id, r.name as role_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE username = $1
        `, [username]);

        if (userResult.rows.length === 0) {
            console.error(`Error: User with username ${username} not found.`);
            rl.close();
            await pool.end();
            return;
        }

        const user = userResult.rows[0];
        console.log(`Found user: ${user.username}, current role: ${user.role_name || 'None'}`);

        // Get admin role
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

        if (user.role_id === adminRoleId) {
            console.log('User already has admin role.');
            rl.close();
            await pool.end();
            return;
        }

        // Confirm action
        const confirm = await question(`Are you sure you want to assign admin role to user ${username}? (yes/no): `);
        
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Operation cancelled.');
            rl.close();
            await pool.end();
            return;
        }

        // Update user role
        await pool.query(`
            UPDATE users 
            SET role_id = $1, updated_at = NOW()
            WHERE id = $2
        `, [adminRoleId, user.id]);

        // Log the role change
        await pool.query(`
            INSERT INTO audit_logs (event_type, user_id, target_id, target_type, ip_address, device_fingerprint, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            'user.role_updated',
            user.id, // The user making the change (in this case, the user themselves via admin command)
            user.id,
            'user',
            '127.0.0.1',
            'admin_command',
            JSON.stringify({
                username: username,
                oldRole: user.role_name,
                newRole: 'admin',
                updatedBy: 'admin_command'
            })
        ]);

        console.log('\n=== ADMIN ROLE ASSIGNED SUCCESSFULLY ===');
        console.log(`Username: ${username}`);
        console.log(`New Role: admin`);
        console.log('\nThe user now has admin access to the system.');
        console.log('They can access rooms, services, and patients management pages.');
        console.log('===========================================\n');

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        rl.close();
        await pool.end();
    }
}

// Run the script
assignAdminRole();