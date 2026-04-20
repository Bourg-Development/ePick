// db/migrations/scripts/042-seed-users-from-excel.js
'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const argon2 = require('argon2');
const crypto = require('crypto');

/**
 * Import users from an Excel file (e.g. example.xlsx).
 *
 * Expected columns (header row 1):
 *   username | full_name | password | role | service_id | email | preferred_language
 *
 * - username:           6-digit numeric string (e.g. "100001")
 * - full_name:          optional
 * - password:           plain-text — will be hashed with Argon2id + salt + pepper
 * - role:               role name (must already exist in `roles` table)
 * - service_id:         optional integer FK → services
 * - email:              optional
 * - preferred_language: optional, defaults to 'en'
 */

const EXCEL_PATH = path.resolve(__dirname, '..', '..', '..', 'example.xlsx');

async function hashPassword(password, pepper) {
    const salt = crypto.randomBytes(32).toString('hex');
    const pepperedPassword = `${password}${salt}${pepper}`;
    const hash = await argon2.hash(pepperedPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        hashLength: 32
    });
    return { hash, salt };
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_PATH);
        const sheet = workbook.worksheets[0];

        if (!sheet || sheet.rowCount < 2) {
            console.log('Excel file is empty or has no data rows — skipping.');
            return;
        }

        // Read the PEPPER from env (same as the app uses)
        const pepper = process.env.PEPPER || '';
        if (!pepper) {
            console.warn('WARNING: PEPPER env variable is not set. Passwords will be hashed without pepper.');
        }

        // Build a role-name → id lookup
        const [roles] = await queryInterface.sequelize.query(
            'SELECT id, name FROM roles'
        );
        const roleMap = {};
        for (const r of roles) {
            roleMap[r.name.toLowerCase()] = r.id;
        }

        // Parse header row to get column indices
        const headerRow = sheet.getRow(1);
        const headers = {};
        headerRow.eachCell((cell, colNumber) => {
            headers[String(cell.value).trim().toLowerCase()] = colNumber;
        });

        const users = [];
        const now = new Date();

        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const get = (col) => {
                const idx = headers[col];
                if (!idx) return null;
                const val = row.getCell(idx).value;
                return val != null ? String(val).trim() : null;
            };

            const username = get('username');
            if (!username) continue; // skip empty rows

            const password = get('password') || 'Changeme1!';
            const roleName = (get('role') || 'admin').toLowerCase();
            const roleId = roleMap[roleName];

            if (!roleId) {
                console.warn(`Row ${i}: unknown role "${roleName}" — skipping user ${username}`);
                continue;
            }

            const { hash, salt } = await hashPassword(password, pepper);

            const serviceId = get('service_id');

            users.push({
                username,
                full_name: get('full_name') || null,
                password_hash: hash,
                salt,
                role_id: roleId,
                service_id: serviceId ? parseInt(serviceId, 10) : null,
                email: get('email') || null,
                preferred_language: get('preferred_language') || 'en',
                totp_enabled: false,
                webauthn_enabled: false,
                failed_login_attempts: 0,
                account_locked: false,
                created_at: now,
                updated_at: now
            });
        }

        if (users.length === 0) {
            console.log('No valid users found in Excel — skipping.');
            return;
        }

        console.log(`Inserting ${users.length} user(s) from ${EXCEL_PATH}...`);

        // Insert with ON CONFLICT to avoid duplicates
        for (const user of users) {
            await queryInterface.sequelize.query(
                `INSERT INTO users (username, full_name, password_hash, salt, role_id, service_id,
                                    email, preferred_language, totp_enabled, webauthn_enabled,
                                    failed_login_attempts, account_locked, created_at, updated_at)
                 VALUES (:username, :full_name, :password_hash, :salt, :role_id, :service_id,
                         :email, :preferred_language, :totp_enabled, :webauthn_enabled,
                         :failed_login_attempts, :account_locked, :created_at, :updated_at)
                 ON CONFLICT (username) DO NOTHING`,
                { replacements: user }
            );
        }

        console.log('User import complete.');
    },

    down: async (queryInterface, Sequelize) => {
        // Read the same Excel to know which usernames to remove
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.readFile(EXCEL_PATH);
        } catch {
            console.log('Excel file not found — cannot rollback.');
            return;
        }

        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) return;

        const headerRow = sheet.getRow(1);
        const headers = {};
        headerRow.eachCell((cell, colNumber) => {
            headers[String(cell.value).trim().toLowerCase()] = colNumber;
        });

        const usernames = [];
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const idx = headers['username'];
            if (!idx) continue;
            const val = row.getCell(idx).value;
            if (val) usernames.push(String(val).trim());
        }

        if (usernames.length > 0) {
            await queryInterface.bulkDelete('users', {
                username: usernames
            });
            console.log(`Rolled back ${usernames.length} imported user(s).`);
        }
    }
};
