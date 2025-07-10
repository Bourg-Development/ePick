// utils/encryptionHooks.js
const cryptoService = require('../services/cryptoService');

/**
 * Utility for adding field-level encryption hooks to Sequelize models
 * Automatically encrypts/decrypts specified sensitive fields
 */
class EncryptionHooks {
    /**
     * Add encryption hooks to a Sequelize model
     * @param {Object} model - Sequelize model
     * @param {Array} encryptedFields - Array of field names to encrypt
     */
    static addEncryptionHooks(model, encryptedFields) {
        if (!encryptedFields || encryptedFields.length === 0) {
            return;
        }

        // Before creating a record - encrypt sensitive fields
        model.addHook('beforeCreate', async (instance) => {
            await this.encryptFields(instance, encryptedFields);
        });

        // Before updating a record - encrypt sensitive fields
        model.addHook('beforeUpdate', async (instance) => {
            await this.encryptFields(instance, encryptedFields);
        });

        // Before bulk creating - encrypt sensitive fields for all instances
        model.addHook('beforeBulkCreate', async (instances) => {
            for (const instance of instances) {
                await this.encryptFields(instance, encryptedFields);
            }
        });

        // After finding records - decrypt sensitive fields
        model.addHook('afterFind', async (result) => {
            if (!result) return;
            
            if (Array.isArray(result)) {
                // Handle array of results
                for (const instance of result) {
                    await this.decryptFields(instance, encryptedFields);
                }
            } else {
                // Handle single result
                await this.decryptFields(result, encryptedFields);
            }
        });
    }

    /**
     * Encrypt specified fields in a model instance
     * @param {Object} instance - Sequelize model instance
     * @param {Array} fields - Fields to encrypt
     */
    static async encryptFields(instance, fields) {
        if (!instance || !fields) return;

        for (const field of fields) {
            if (instance.dataValues && instance.dataValues[field] && 
                !this.isAlreadyEncrypted(instance.dataValues[field])) {
                try {
                    const originalValue = instance.dataValues[field];
                    const encryptedValue = cryptoService.encrypt(originalValue);
                    instance.dataValues[field] = encryptedValue;
                    instance[field] = encryptedValue;
                } catch (error) {
                    console.error(`Error encrypting field ${field}:`, error);
                    throw new Error(`Failed to encrypt ${field}`);
                }
            }
        }
    }

    /**
     * Decrypt specified fields in a model instance
     * @param {Object} instance - Sequelize model instance
     * @param {Array} fields - Fields to decrypt
     */
    static async decryptFields(instance, fields) {
        if (!instance || !fields) return;

        for (const field of fields) {
            if (instance.dataValues && instance.dataValues[field] && 
                this.isAlreadyEncrypted(instance.dataValues[field])) {
                try {
                    const encryptedValue = instance.dataValues[field];
                    const decryptedValue = cryptoService.decrypt(encryptedValue);
                    instance.dataValues[field] = decryptedValue;
                    instance[field] = decryptedValue;
                } catch (error) {
                    console.error(`Error decrypting field ${field}:`, error);
                    // Don't throw error on decryption failure - return encrypted value
                    console.warn(`Returning encrypted value for field ${field}`);
                }
            }
        }
    }

    /**
     * Check if a value appears to be already encrypted
     * @param {string} value - Value to check
     * @returns {boolean} True if value appears encrypted
     */
    static isAlreadyEncrypted(value) {
        if (!value || typeof value !== 'string') return false;
        
        // Check for the IV:encrypted format used by cryptoService
        const parts = value.split(':');
        return parts.length === 2 && 
               parts[0].length === 32 && // IV should be 32 hex characters
               /^[0-9a-f]+$/i.test(parts[0]); // IV should be hex
    }

    /**
     * Manually encrypt a field value (for migrations or one-off operations)
     * @param {string} value - Value to encrypt
     * @returns {string} Encrypted value
     */
    static encryptValue(value) {
        if (!value || this.isAlreadyEncrypted(value)) return value;
        return cryptoService.encrypt(value);
    }

    /**
     * Manually decrypt a field value (for migrations or one-off operations)
     * @param {string} value - Value to decrypt
     * @returns {string} Decrypted value
     */
    static decryptValue(value) {
        if (!value || !this.isAlreadyEncrypted(value)) return value;
        try {
            return cryptoService.decrypt(value);
        } catch (error) {
            console.error('Decryption error:', error);
            return value; // Return original value if decryption fails
        }
    }

    /**
     * Create a searchable hash for encrypted field (for indexed searches)
     * @param {string} value - Original value to hash
     * @returns {string} Hash for searching
     */
    static createSearchHash(value) {
        if (!value) return null;
        return cryptoService.hash(value.toLowerCase().trim());
    }

    /**
     * Prepare encrypted fields for database operations
     * Useful for raw queries or when hooks don't fire
     * @param {Object} data - Data object with fields to encrypt
     * @param {Array} fields - Fields to encrypt
     * @returns {Object} Data with encrypted fields
     */
    static prepareForDatabase(data, fields) {
        const prepared = { ...data };
        
        for (const field of fields) {
            if (prepared[field] && !this.isAlreadyEncrypted(prepared[field])) {
                prepared[field] = this.encryptValue(prepared[field]);
            }
        }
        
        return prepared;
    }

    /**
     * Prepare encrypted fields after database retrieval
     * Useful for raw queries or when hooks don't fire
     * @param {Object} data - Data object with fields to decrypt
     * @param {Array} fields - Fields to decrypt
     * @returns {Object} Data with decrypted fields
     */
    static prepareFromDatabase(data, fields) {
        const prepared = { ...data };
        
        for (const field of fields) {
            if (prepared[field] && this.isAlreadyEncrypted(prepared[field])) {
                prepared[field] = this.decryptValue(prepared[field]);
            }
        }
        
        return prepared;
    }
}

module.exports = EncryptionHooks;