// utils/secureRandom.js

const crypto = require('crypto');

/**
 * Secure randomness utility using cryptographically secure random number generation
 * Replaces weak Math.random() usage with crypto.randomBytes()
 */
class SecureRandom {
    /**
     * Generate a cryptographically secure random integer in range [min, max)
     * @param {number} min - Minimum value (inclusive) 
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Secure random integer
     */
    randomInt(min, max) {
        if (min >= max) {
            throw new Error('min must be less than max');
        }
        
        const range = max - min;
        const maxValidValue = Math.floor(0x100000000 / range) * range - 1;
        
        let randomValue;
        do {
            // Generate 32-bit random number
            randomValue = crypto.randomBytes(4).readUInt32BE(0);
        } while (randomValue > maxValidValue);
        
        return min + (randomValue % range);
    }
    
    /**
     * Generate a cryptographically secure random float in range [0, 1)
     * @returns {number} Secure random float
     */
    randomFloat() {
        // Generate 32-bit random number and normalize to [0, 1)
        const randomValue = crypto.randomBytes(4).readUInt32BE(0);
        return randomValue / 0x100000000;
    }
    
    /**
     * Securely shuffle an array using Fisher-Yates algorithm with crypto randomness
     * @param {Array} array - Array to shuffle (modified in place)
     * @returns {Array} The shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array]; // Create copy to avoid modifying original
        
        for (let i = shuffled.length - 1; i > 0; i--) {
            // Generate secure random index
            const j = this.randomInt(0, i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled;
    }
    
    /**
     * Securely shuffle a string using crypto randomness
     * @param {string} str - String to shuffle
     * @returns {string} Shuffled string
     */
    shuffleString(str) {
        const chars = str.split('');
        const shuffled = this.shuffleArray(chars);
        return shuffled.join('');
    }
    
    /**
     * Generate a cryptographically secure random digit (0-9)
     * @returns {number} Random digit
     */
    randomDigit() {
        return this.randomInt(0, 10);
    }
    
    /**
     * Generate multiple cryptographically secure random digits
     * @param {number} count - Number of digits to generate
     * @returns {number[]} Array of random digits
     */
    randomDigits(count) {
        const digits = [];
        for (let i = 0; i < count; i++) {
            digits.push(this.randomDigit());
        }
        return digits;
    }
    
    /**
     * Select a random element from an array using crypto randomness
     * @param {Array} array - Array to select from
     * @returns {*} Random element from array
     */
    randomChoice(array) {
        if (!array || array.length === 0) {
            throw new Error('Array cannot be empty');
        }
        
        const index = this.randomInt(0, array.length);
        return array[index];
    }
    
    /**
     * Generate a cryptographically secure random byte array
     * @param {number} length - Number of bytes to generate
     * @returns {Buffer} Random bytes
     */
    randomBytes(length) {
        return crypto.randomBytes(length);
    }
    
    /**
     * Generate a cryptographically secure random hex string
     * @param {number} length - Length of hex string (must be even)
     * @returns {string} Random hex string
     */
    randomHex(length) {
        if (length % 2 !== 0) {
            throw new Error('Hex string length must be even');
        }
        
        return crypto.randomBytes(length / 2).toString('hex');
    }
    
    /**
     * Generate a cryptographically secure random base64 string
     * @param {number} byteLength - Number of random bytes to encode
     * @returns {string} Random base64 string
     */
    randomBase64(byteLength) {
        return crypto.randomBytes(byteLength).toString('base64');
    }
    
    /**
     * Add secure random delay (for timing attack mitigation)
     * @param {number} minMs - Minimum delay in milliseconds
     * @param {number} maxMs - Maximum delay in milliseconds
     * @returns {Promise} Promise that resolves after random delay
     */
    async randomDelay(minMs, maxMs) {
        const delayMs = this.randomInt(minMs, maxMs);
        return new Promise(resolve => setTimeout(resolve, delayMs));
    }
}

module.exports = new SecureRandom();