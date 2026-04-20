// db/migrations/scripts/042-seed-users-from-excel.js
'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const argon2 = require('argon2');
const crypto = require('crypto');

/**
 * Import users from Epick.xlsx
 *
 * Excel columns:
 *   A: Titre       (ignored)
 *   B: Prénom      → first name
 *   C: Nom         → last name
 *   D: Code interne → username (6-digit)
 *   E: Fonction    (ignored)
 *   F: Date sortie (ignored)
 *
 * All users are assigned the "nurse" role and the first service.
 * Password defaults to "Changeme1!" (users should reset on first login).
 */

const EXCEL_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'example.xlsx');

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

        const pepper = process.env.PEPPER || '';
        if (!pepper) {
            console.warn('WARNING: PEPPER env variable is not set. Passwords will be hashed without pepper.');
        }

        // Get the "nurse" role ID
        const [roles] = await queryInterface.sequelize.query(
            `SELECT id FROM roles WHERE name = 'nurse' LIMIT 1`
        );
        if (roles.length === 0) {
            throw new Error('Role "nurse" not found — cannot import users.');
        }
        const nurseRoleId = roles[0].id;

        // Get the first service ID
        const [services] = await queryInterface.sequelize.query(
            `SELECT id FROM services ORDER BY id ASC LIMIT 1`
        );
        if (services.length === 0) {
            throw new Error('No services found — cannot import users.');
        }
        const defaultServiceId = services[0].id;

        console.log(`Using role_id=${nurseRoleId} (nurse), service_id=${defaultServiceId}`);

        const users = [];
        const now = new Date();
        const defaultPassword = 'Changeme1!';

        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);

            const username = row.getCell(4).value; // D: Code interne
            if (!username) continue;

            const prenom = row.getCell(2).value;   // B: Prénom
            const nom = row.getCell(3).value;       // C: Nom

            const fullName = [prenom, nom]
                .filter(Boolean)
                .map(s => String(s).trim())
                .join(' ') || null;

            const { hash, salt } = await hashPassword(defaultPassword, pepper);

            users.push({
                username: String(username).trim(),
                full_name: fullName,
                password_hash: hash,
                salt,
                role_id: nurseRoleId,
                service_id: defaultServiceId,
                email: null,
                preferred_language: 'fr',
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

        console.log(`Inserting ${users.length} user(s) from Excel...`);

        let inserted = 0;
        for (const user of users) {
            const [, meta] = await queryInterface.sequelize.query(
                `INSERT INTO users (username, full_name, password_hash, salt, role_id, service_id,
                                    email, preferred_language, totp_enabled, webauthn_enabled,
                                    failed_login_attempts, account_locked, created_at, updated_at)
                 VALUES (:username, :full_name, :password_hash, :salt, :role_id, :service_id,
                         :email, :preferred_language, :totp_enabled, :webauthn_enabled,
                         :failed_login_attempts, :account_locked, :created_at, :updated_at)
                 ON CONFLICT (username) DO NOTHING`,
                { replacements: user }
            );
            if (meta) inserted++;
        }

        console.log(`User import complete. ${inserted} inserted, ${users.length - inserted} skipped (already existed).`);
    },

    down: async (queryInterface, Sequelize) => {
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.readFile(EXCEL_PATH);
        } catch {
            console.log('Excel file not found — cannot rollback.');
            return;
        }

        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) return;

        const usernames = [];
        for (let i = 2; i <= sheet.rowCount; i++) {
            const val = sheet.getRow(i).getCell(4).value; // D: Code interne
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
