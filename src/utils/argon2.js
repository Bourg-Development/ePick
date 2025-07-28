// utils/argon2.js
const argon2 = require('argon2');
const crypto = require('crypto');
const { PEPPER } = require('../config/environment');
const secureRandom = require('./secureRandom');

/**
 * Utility for Argon2id password hashing and verification
 */
class Argon2Util {
    /**
     * Hash a password with Argon2id, using salt and pepper
     * @param {string} password - Plain text password
     * @param {string} [salt] - Optional salt (generated if not provided)
     * @returns {Promise<Object>} Hash result with hash and salt
     */
    async hashPassword(password, salt = null) {
        try {
            // Generate random salt if not provided
            if (!salt) {
                salt = crypto.randomBytes(32).toString('hex');
            }

            // Combine password, salt, and global pepper
            const pepperedPassword = `${password}${salt}${PEPPER}`;

            // Hash with Argon2id (memory-hard function resistant to GPU attacks)
            const hash = await argon2.hash(pepperedPassword, {
                type: argon2.argon2id,
                memoryCost: 65536, // 64 MiB
                timeCost: 3,       // 3 iterations
                parallelism: 4,    // 4 threads
                hashLength: 32     // 32 bytes output
            });

            return {
                hash,
                salt
            };
        } catch (error) {
            console.error('Password hashing error:', error);
            throw new Error('Failed to hash password');
        }
    }

    /**
     * Verify a password against a stored hash
     * @param {string} password - Plain text password to verify
     * @param {string} hash - Stored password hash
     * @param {string} salt - User's salt
     * @returns {Promise<boolean>} Whether password is valid
     */
    async verifyPassword(password, hash, salt) {
        try {
            // Add salt and pepper
            const pepperedPassword = `${password}${salt}${PEPPER}`;

            // Verify with Argon2id
            return await argon2.verify(hash, pepperedPassword);
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    /**
     * Generate a random password
     * @param {number} [length=16] - Password length
     * @param {boolean} [includeSpecial=true] - Include special characters
     * @returns {string} Generated password
     */
    generateRandomPassword(length = 16, includeSpecial = true) {
        try {
            // Define character sets
            const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O
            const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // No l
            const numberChars = '23456789'; // No 0, 1
            const specialChars = includeSpecial ? '!@#$%^&*-_=+' : '';

            // Combine character sets
            const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

            // Generate password
            let password = '';
            const randomBytes = crypto.randomBytes(length * 2); // Get extra bytes for randomness

            // Ensure we have at least one character from each required set
            password += uppercaseChars.charAt(randomBytes[0] % uppercaseChars.length);
            password += lowercaseChars.charAt(randomBytes[1] % lowercaseChars.length);
            password += numberChars.charAt(randomBytes[2] % numberChars.length);

            if (includeSpecial) {
                password += specialChars.charAt(randomBytes[3] % specialChars.length);
            }

            // Fill the rest with random characters
            for (let i = password.length; i < length; i++) {
                const randomByte = randomBytes[i + 2];
                password += allChars.charAt(randomByte % allChars.length);
            }

            // Securely shuffle the password using cryptographically secure randomness
            password = secureRandom.shuffleString(password);

            return password;
        } catch (error) {
            console.error('Password generation error:', error);
            throw new Error('Failed to generate password');
        }
    }
}

module.exports = new Argon2Util();