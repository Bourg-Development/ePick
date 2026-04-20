// db/migrations/scripts/042-seed-users-from-excel.js
'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const crypto = require('crypto');

/**
 * Import users from Epick.xlsx and generate reference codes.
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
 * Users are created WITHOUT a password — they must register via the
 * generated reference code.
 */

const EXCEL_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'example.xlsx');

function generateCode() {
    const digits = [];
    for (let i = 0; i < 9; i++) {
        digits.push(crypto.randomInt(0, 10));
    }
    return [
        digits.slice(0, 3).join(''),
        digits.slice(3, 6).join(''),
        digits.slice(6, 9).join('')
    ].join('-');
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

        // Get admin user (id=1) as the creator for ref codes
        const [admins] = await queryInterface.sequelize.query(
            `SELECT id FROM users ORDER BY id ASC LIMIT 1`
        );
        const adminId = admins.length > 0 ? admins[0].id : null;

        console.log(`Using role_id=${nurseRoleId} (nurse), service_id=${defaultServiceId}`);

        const now = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry for bulk import

        const results = [];

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

            const usernameStr = String(username).trim();

            // Insert user without password (empty hash/salt — must register via ref code)
            const [inserted] = await queryInterface.sequelize.query(
                `INSERT INTO users (username, full_name, password_hash, salt, role_id, service_id,
                                    preferred_language, totp_enabled, webauthn_enabled,
                                    failed_login_attempts, account_locked, created_at, updated_at)
                 VALUES (:username, :full_name, '', '', :role_id, :service_id,
                         'fr', false, false, 0, false, :created_at, :updated_at)
                 ON CONFLICT (username) DO NOTHING
                 RETURNING id, username`,
                {
                    replacements: {
                        username: usernameStr,
                        full_name: fullName,
                        role_id: nurseRoleId,
                        service_id: defaultServiceId,
                        created_at: now,
                        updated_at: now
                    }
                }
            );

            // Only generate ref code if user was actually inserted (not a duplicate)
            if (inserted && inserted.length > 0) {
                const userId = inserted[0].id;
                const code = generateCode();

                await queryInterface.sequelize.query(
                    `INSERT INTO reference_codes (code, user_id, created_by, expires_at, status, require_2fa, created_at)
                     VALUES (:code, :user_id, :created_by, :expires_at, 'active', false, :created_at)`,
                    {
                        replacements: {
                            code,
                            user_id: userId,
                            created_by: adminId,
                            expires_at: expiresAt,
                            created_at: now
                        }
                    }
                );

                results.push({ username: usernameStr, fullName, code });
            }
        }

        if (results.length === 0) {
            console.log('No new users to import (all already exist) — skipping.');
            return;
        }

        console.log(`\n=== Imported ${results.length} user(s) with reference codes ===\n`);
        console.log('Username | Name                          | Reference Code');
        console.log('---------|-------------------------------|---------------');
        for (const r of results) {
            const name = (r.fullName || '').padEnd(30);
            console.log(`${r.username}  | ${name} | ${r.code}`);
        }
        console.log(`\nCodes expire: ${expiresAt.toISOString().split('T')[0]}`);
        console.log('Users must register at /auth/register?refCode=xxx-xxx-xxx\n');
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
            // Delete ref codes for these users first (FK constraint)
            await queryInterface.sequelize.query(
                `DELETE FROM reference_codes WHERE user_id IN (
                    SELECT id FROM users WHERE username IN (:usernames)
                    AND password_hash = ''
                )`,
                { replacements: { usernames } }
            );

            // Only delete users that never registered (empty password_hash)
            await queryInterface.sequelize.query(
                `DELETE FROM users WHERE username IN (:usernames) AND password_hash = ''`,
                { replacements: { usernames } }
            );

            console.log(`Rolled back imported users (only those who hadn't registered yet).`);
        }
    }
};
