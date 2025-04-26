// services/logService.js
const crypto = require('crypto');
const db = require('../db');
const cryptoService = require('./cryptoService');
const { LOG_ENCRYPTION_ENABLED } = require('../config/environment');

/**
 * Service for handling secure, tamper-resistant logging
 */
class LogService {
    /**
     * Create an audit log entry
     * @param {Object} logData - Audit log data
     * @param {string} logData.eventType - Type of event (e.g., 'user.login', 'user.created')
     * @param {number} [logData.userId] - User ID who performed the action
     * @param {number} [logData.targetId] - ID of the target resource
     * @param {string} [logData.targetType] - Type of the target resource
     * @param {string} [logData.ipAddress] - IP address
     * @param {string} [logData.deviceFingerprint] - Device fingerprint
     * @param {Object} [logData.metadata] - Additional data about the event
     * @returns {Promise<boolean>} Success indicator
     */
    async auditLog(logData) {
        try {
            // Process metadata - encrypt sensitive fields if enabled
            const processedMetadata = LOG_ENCRYPTION_ENABLED ?
                this._encryptSensitiveData(logData.metadata) :
                logData.metadata;

            // Create the audit log record
            // Note: The database trigger handles hash chaining for tamper resistance
            await db.AuditLog.create({
                event_type: logData.eventType,
                user_id: logData.userId || null,
                target_id: logData.targetId || null,
                target_type: logData.targetType || null,
                ip_address: logData.ipAddress || null,
                device_fingerprint: logData.deviceFingerprint || null,
                metadata: processedMetadata || {}
            });

            return true;
        } catch (error) {
            console.error('Audit logging error:', error);
            // Attempt fallback logging to console if database logging fails
            this._fallbackLog('AUDIT', logData, error);
            return false;
        }
    }

    /**
     * Create a security log entry
     * @param {Object} logData - Security log data
     * @param {string} logData.eventType - Type of security event
     * @param {string} logData.severity - Severity level ('low', 'medium', 'high', 'critical')
     * @param {number} [logData.userId] - User ID related to event
     * @param {string} logData.ipAddress - IP address
     * @param {string} [logData.deviceFingerprint] - Device fingerprint
     * @param {Object} [logData.metadata] - Additional data about the event
     * @returns {Promise<boolean>} Success indicator
     */
    async securityLog(logData) {
        try {
            // Validate severity
            const severity = this._validateSeverity(logData.severity);

            // Process metadata - encrypt sensitive fields if enabled
            const processedMetadata = LOG_ENCRYPTION_ENABLED ?
                this._encryptSensitiveData(logData.metadata) :
                logData.metadata;

            // Create the security log record
            // Note: The database trigger handles hash chaining for tamper resistance
            await db.SecurityLog.create({
                event_type: logData.eventType,
                severity,
                user_id: logData.userId || null,
                ip_address: logData.ipAddress || 'unknown',
                device_fingerprint: logData.deviceFingerprint || null,
                metadata: processedMetadata || {}
            });

            // For critical severity, we might want to trigger additional alerts
            if (severity === 'critical') {
                await this._triggerSecurityAlert(logData);
            }

            return true;
        } catch (error) {
            console.error('Security logging error:', error);
            // Attempt fallback logging to console if database logging fails
            this._fallbackLog('SECURITY', logData, error);
            return false;
        }
    }

    /**
     * Get audit logs with optional filtering
     * @param {Object} filters - Filter criteria
     * @param {number} [filters.userId] - Filter by user ID
     * @param {string} [filters.eventType] - Filter by event type
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {number} [page=1] - Page number
     * @param {number} [limit=100] - Results per page
     * @returns {Promise<Object>} Paginated audit logs
     */
    async getAuditLogs(filters = {}, page = 1, limit = 100) {
        try {
            const whereClause = this._buildWhereClause(filters);

            const offset = (page - 1) * limit;

            // Query with pagination
            const { count, rows } = await db.AuditLog.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: db.User,
                        as: 'User',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            // Process logs - decrypt sensitive data if needed
            const processedLogs = LOG_ENCRYPTION_ENABLED ?
                rows.map(log => this._decryptLogData(log)) :
                rows;

            return {
                logs: processedLogs,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Error retrieving audit logs:', error);
            throw new Error('Failed to retrieve audit logs');
        }
    }

    /**
     * Get security logs with optional filtering
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.severity] - Filter by severity
     * @param {string} [filters.eventType] - Filter by event type
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {number} [page=1] - Page number
     * @param {number} [limit=100] - Results per page
     * @returns {Promise<Object>} Paginated security logs
     */
    async getSecurityLogs(filters = {}, page = 1, limit = 100) {
        try {
            const whereClause = this._buildWhereClause(filters);

            // Add severity filter if provided
            if (filters.severity) {
                whereClause.severity = filters.severity;
            }

            const offset = (page - 1) * limit;

            // Query with pagination
            const { count, rows } = await db.SecurityLog.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: db.User,
                        as: 'User',
                        attributes: ['id', 'username']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            // Process logs - decrypt sensitive data if needed
            const processedLogs = LOG_ENCRYPTION_ENABLED ?
                rows.map(log => this._decryptLogData(log)) :
                rows;

            return {
                logs: processedLogs,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Error retrieving security logs:', error);
            throw new Error('Failed to retrieve security logs');
        }
    }

    /**
     * Verify the integrity of log chains
     * @param {string} logType - Type of log ('audit' or 'security')
     * @param {number} [startId] - Starting log ID
     * @param {number} [endId] - Ending log ID
     * @returns {Promise<Object>} Verification results
     */
    async verifyLogIntegrity(logType = 'audit', startId = null, endId = null) {
        try {
            // Select the appropriate log model
            const LogModel = logType === 'audit' ? db.AuditLog : db.SecurityLog;

            // Build query conditions
            const whereClause = {};
            if (startId !== null) {
                whereClause.id = { [db.Sequelize.Op.gte]: startId };
            }
            if (endId !== null) {
                whereClause.id = {
                    ...whereClause.id,
                    [db.Sequelize.Op.lte]: endId
                };
            }

            // Retrieve logs in order
            const logs = await LogModel.findAll({
                where: whereClause,
                order: [['id', 'ASC']]
            });

            if (logs.length === 0) {
                return {
                    verified: true,
                    message: 'No logs to verify',
                    totalChecked: 0,
                    corrupt: []
                };
            }

            // Verify the hash chain
            const corruptEntries = [];
            let previousHash = null;

            for (const log of logs) {
                // Check if this is the first log in the sequence
                if (log.previous_hash === null && previousHash === null) {
                    // First log in the chain - just store its hash
                    previousHash = log.record_hash;
                    continue;
                }

                // Verify that the previous_hash matches the actual previous hash
                if (log.previous_hash !== previousHash) {
                    corruptEntries.push({
                        id: log.id,
                        expectedPreviousHash: previousHash,
                        actualPreviousHash: log.previous_hash
                    });
                }

                // Verify the current log's hash is valid
                const calculatedHash = this._calculateLogHash(log);
                if (calculatedHash !== log.record_hash) {
                    corruptEntries.push({
                        id: log.id,
                        tamperedContent: true,
                        expectedHash: calculatedHash,
                        actualHash: log.record_hash
                    });
                }

                previousHash = log.record_hash;
            }

            return {
                verified: corruptEntries.length === 0,
                message: corruptEntries.length === 0 ?
                    'Log integrity verified' :
                    'Log integrity compromised',
                totalChecked: logs.length,
                corrupt: corruptEntries
            };
        } catch (error) {
            console.error('Log integrity verification error:', error);
            throw new Error('Failed to verify log integrity');
        }
    }

    /**
     * Calculate the hash of a log entry
     * @private
     * @param {Object} log - Log entry
     * @returns {string} Calculated hash
     */
    _calculateLogHash(log) {
        // Recreate the same hash calculation as the database trigger
        const dataToHash =
            (log.previous_hash || '') +
            log.id.toString() +
            log.event_type +
            (log.user_id?.toString() || '') +
            (log.ip_address || '') +
            log.created_at.toISOString();

        return crypto
            .createHash('sha256')
            .update(dataToHash)
            .digest('hex');
    }

    /**
     * Build a where clause for log queries
     * @private
     * @param {Object} filters - Filter criteria
     * @returns {Object} Sequelize where clause
     */
    _buildWhereClause(filters) {
        const whereClause = {};

        if (filters.userId) {
            whereClause.user_id = filters.userId;
        }

        if (filters.eventType) {
            whereClause.event_type = filters.eventType;
        }

        // Date range filtering
        if (filters.startDate || filters.endDate) {
            whereClause.created_at = {};

            if (filters.startDate) {
                whereClause.created_at[db.Sequelize.Op.gte] = new Date(filters.startDate);
            }

            if (filters.endDate) {
                whereClause.created_at[db.Sequelize.Op.lte] = new Date(filters.endDate);
            }
        }

        return whereClause;
    }

    /**
     * Validate and normalize severity level
     * @private
     * @param {string} severity - Severity level
     * @returns {string} Normalized severity
     */
    _validateSeverity(severity) {
        const validSeverities = ['low', 'medium', 'high', 'critical'];

        if (!severity || !validSeverities.includes(severity.toLowerCase())) {
            return 'medium'; // Default severity
        }

        return severity.toLowerCase();
    }

    /**
     * Encrypt sensitive data in metadata
     * @private
     * @param {Object} metadata - Log metadata
     * @returns {Object} Processed metadata
     */
    _encryptSensitiveData(metadata) {
        if (!metadata) return {};

        const result = { ...metadata };

        // Define fields that should be encrypted
        const sensitiveFields = [
            'password', 'token', 'secret', 'credential',
            'email', 'phone', 'address', 'ssn', 'creditCard'
        ];

        // Encrypt any matching fields
        Object.keys(result).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                // Only encrypt strings
                if (typeof result[key] === 'string') {
                    result[key] = cryptoService.encrypt(result[key]);
                    // Mark field as encrypted
                    result[`${key}_encrypted`] = true;
                }
            }
        });

        return result;
    }

    /**
     * Decrypt sensitive data in logs
     * @private
     * @param {Object} log - Log record
     * @returns {Object} Processed log
     */
    _decryptLogData(log) {
        if (!log || !log.metadata) return log;

        const result = log.toJSON();

        // Decrypt any marked fields
        Object.keys(result.metadata).forEach(key => {
            if (key.endsWith('_encrypted') && result.metadata[key] === true) {
                const dataKey = key.replace('_encrypted', '');
                if (result.metadata[dataKey]) {
                    try {
                        result.metadata[dataKey] = cryptoService.decrypt(result.metadata[dataKey]);
                    } catch (error) {
                        result.metadata[dataKey] = '[Decryption failed]';
                    }
                }
            }
        });

        return result;
    }

    /**
     * Trigger a security alert
     * @private
     * @param {Object} logData - Security log data
     */
    async _triggerSecurityAlert(logData) {
        // This would integrate with external alerting systems or notify admins
        console.warn('CRITICAL SECURITY ALERT:', {
            eventType: logData.eventType,
            userId: logData.userId,
            ipAddress: logData.ipAddress,
            timestamp: new Date().toISOString()
        });

        // Example: Email security administrators
        // await emailService.sendSecurityAlert(logData);
    }

    /**
     * Fallback logging to console if database logging fails
     * @private
     * @param {string} type - Log type
     * @param {Object} data - Log data
     * @param {Error} error - Original error
     */
    _fallbackLog(type, data, error) {
        console.error(`${type} LOG FALLBACK - Database logging failed:`, error.message);
        console.error(`${type} LOG DATA:`, JSON.stringify({
            ...data,
            timestamp: new Date().toISOString(),
            fallback: true
        }));
    }
}

module.exports = new LogService();