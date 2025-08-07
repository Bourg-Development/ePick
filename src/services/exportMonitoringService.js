// services/exportMonitoringService.js
const db = require('../db');
const { Op } = require('sequelize');
const logService = require('./logService');
const userService = require('./userService');
const emailService = require('./emailService');

class ExportMonitoringService {
    constructor() {
        // Configurable thresholds - tightened for patient data protection
        this.thresholds = {
            // Maximum exports in a time window
            maxExportsPerHour: 3,
            maxExportsPerDay: 5,
            maxExportsPerWeek: 10,
            
            // Maximum data volume thresholds
            maxRecordsPerHour: 100,
            maxRecordsPerDay: 250,
            
            // Suspicious patterns
            rapidExportThreshold: 2, // exports within 1 minute
            differentFormatsThreshold: 2, // different formats in short time
            
            // Lock thresholds
            warningThreshold: 0.7, // 70% of limit triggers warning
            lockThreshold: 1.0 // 100% triggers lock
        };
        
        // Time windows in milliseconds
        this.timeWindows = {
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000
        };
    }

    /**
     * Monitor export activity and check for suspicious behavior
     * @param {number} userId - User performing export
     * @param {string} exportType - Type of data being exported
     * @param {number} recordCount - Number of records exported
     * @param {string} format - Export format (csv, json, excel)
     * @param {Object} context - Additional context (IP, device, etc)
     * @returns {Promise<Object>} Monitoring result
     */
    async monitorExport(userId, exportType, recordCount, format, context = {}) {
        try {
            // Get user's recent export history
            const exportHistory = await this.getExportHistory(userId);
            
            // Check various suspicious patterns
            const checks = await Promise.all([
                this.checkExportFrequency(userId, exportHistory),
                this.checkDataVolume(userId, exportHistory, recordCount),
                this.checkRapidExports(userId, exportHistory),
                this.checkFormatVariation(userId, exportHistory, format),
                this.checkUnusualTiming(userId, exportHistory),
                this.checkLocationAnomaly(userId, context)
            ]);
            
            // Use the highest risk score (not average) for security-critical decisions
            const totalRiskScore = Math.max(...checks.map(check => check.riskScore));
            const suspiciousPatterns = checks.filter(c => c.suspicious).map(c => c.pattern);
            
            console.log(`Export monitoring - User ${userId}: Risk score ${totalRiskScore}, patterns: ${suspiciousPatterns.join(', ') || 'none'}`);
            
            // Log the export activity
            await this.logExportActivity(userId, exportType, recordCount, format, context, totalRiskScore, suspiciousPatterns);
            
            // Determine action based on risk score
            const action = await this.determineAction(userId, totalRiskScore, suspiciousPatterns, context);
            
            // Calculate current usage for warnings
            const frequencyCheck = checks.find(c => c.checkType === 'frequency') || checks[0];
            const exportLimits = {
                hourlyUsed: frequencyCheck.exportsLastHour || 0,
                hourlyLimit: this.thresholds.maxExportsPerHour,
                hourlyRemaining: Math.max(0, this.thresholds.maxExportsPerHour - (frequencyCheck.exportsLastHour || 0) - 1),
                dailyUsed: frequencyCheck.exportsLastDay || 0,
                dailyLimit: this.thresholds.maxExportsPerDay,
                dailyRemaining: Math.max(0, this.thresholds.maxExportsPerDay - (frequencyCheck.exportsLastDay || 0) - 1)
            };
            
            return {
                allowed: action.allowed,
                riskScore: totalRiskScore,
                action: action.type,
                message: action.message,
                suspiciousPatterns,
                exportLimits,
                showWarning: exportLimits.hourlyRemaining <= 1 || exportLimits.dailyRemaining <= 2
            };
            
        } catch (error) {
            console.error('Export monitoring error:', error);
            // On error, allow but log
            await logService.securityLog({
                eventType: 'export.monitoring_error',
                severity: 'high',
                userId,
                metadata: { error: error.message, exportType, recordCount }
            });
            
            return { allowed: true, riskScore: 0, action: 'allow' };
        }
    }

    /**
     * Get user's export history
     * @private
     */
    async getExportHistory(userId, timeWindow = this.timeWindows.week) {
        const since = new Date(Date.now() - timeWindow);
        
        return await db.AuditLog.findAll({
            where: {
                user_id: userId,
                event_type: { [Op.in]: ['export', 'export_success', 'export_attempt', 'analyses.exported', 'archived_analyses.exported'] },
                created_at: { [Op.gte]: since }
            },
            order: [['created_at', 'DESC']],
            limit: 100
        });
    }

    /**
     * Check export frequency
     * @private
     */
    async checkExportFrequency(userId, exportHistory) {
        const now = Date.now();
        
        const exportsLastHour = exportHistory.filter(e => 
            now - new Date(e.created_at).getTime() < this.timeWindows.hour
        ).length;
        
        const exportsLastDay = exportHistory.filter(e => 
            now - new Date(e.created_at).getTime() < this.timeWindows.day
        ).length;
        
        // Add 1 to count the current export attempt
        const totalExportsLastHour = exportsLastHour + 1;
        const totalExportsLastDay = exportsLastDay + 1;
        
        console.log(`Export frequency check - User ${userId}: ${totalExportsLastHour} exports in last hour (including current), ${totalExportsLastDay} in last day`);
        
        let riskScore = 0;
        let suspicious = false;
        let pattern = null;
        
        if (totalExportsLastHour >= this.thresholds.maxExportsPerHour) {
            riskScore = 1.0;
            suspicious = true;
            pattern = 'excessive_exports_per_hour';
        } else if (totalExportsLastDay >= this.thresholds.maxExportsPerDay) {
            riskScore = 0.8;
            suspicious = true;
            pattern = 'excessive_exports_per_day';
        } else {
            riskScore = Math.max(
                totalExportsLastHour / this.thresholds.maxExportsPerHour,
                totalExportsLastDay / this.thresholds.maxExportsPerDay
            ) * 0.5;
        }
        
        return { 
            riskScore, 
            suspicious, 
            pattern,
            checkType: 'frequency',
            exportsLastHour,
            exportsLastDay
        };
    }

    /**
     * Check data volume
     * @private
     */
    async checkDataVolume(userId, exportHistory, currentRecordCount) {
        const now = Date.now();
        
        // Calculate total records exported in time windows
        const recordsLastHour = exportHistory
            .filter(e => now - new Date(e.created_at).getTime() < this.timeWindows.hour)
            .reduce((sum, e) => {
                const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : (e.metadata || {});
                return sum + (metadata.recordCount || metadata.dataCount || 0);
            }, 0) + currentRecordCount;
            
        const recordsLastDay = exportHistory
            .filter(e => now - new Date(e.created_at).getTime() < this.timeWindows.day)
            .reduce((sum, e) => {
                const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : (e.metadata || {});
                return sum + (metadata.recordCount || metadata.dataCount || 0);
            }, 0) + currentRecordCount;
        
        let riskScore = 0;
        let suspicious = false;
        let pattern = null;
        
        if (recordsLastHour > this.thresholds.maxRecordsPerHour) {
            riskScore = 1.0;
            suspicious = true;
            pattern = 'excessive_data_volume_per_hour';
        } else if (recordsLastDay > this.thresholds.maxRecordsPerDay) {
            riskScore = 0.8;
            suspicious = true;
            pattern = 'excessive_data_volume_per_day';
        } else {
            riskScore = Math.max(
                recordsLastHour / this.thresholds.maxRecordsPerHour,
                recordsLastDay / this.thresholds.maxRecordsPerDay
            ) * 0.6;
        }
        
        return { riskScore, suspicious, pattern };
    }

    /**
     * Check for rapid exports
     * @private
     */
    async checkRapidExports(userId, exportHistory) {
        const now = Date.now();
        const recentExports = exportHistory.filter(e => 
            now - new Date(e.created_at).getTime() < this.timeWindows.minute
        );
        
        if (recentExports.length >= this.thresholds.rapidExportThreshold) {
            return {
                riskScore: 0.9,
                suspicious: true,
                pattern: 'rapid_sequential_exports'
            };
        }
        
        return {
            riskScore: recentExports.length / this.thresholds.rapidExportThreshold * 0.3,
            suspicious: false,
            pattern: null
        };
    }

    /**
     * Check format variation (trying different formats rapidly)
     * @private
     */
    async checkFormatVariation(userId, exportHistory, currentFormat) {
        const now = Date.now();
        const recentExports = exportHistory.filter(e => 
            now - new Date(e.created_at).getTime() < this.timeWindows.hour
        );
        
        const formats = new Set();
        recentExports.forEach(e => {
            const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : (e.metadata || {});
            if (metadata.format) formats.add(metadata.format);
        });
        formats.add(currentFormat);
        
        if (formats.size >= this.thresholds.differentFormatsThreshold) {
            return {
                riskScore: 0.7,
                suspicious: true,
                pattern: 'multiple_format_exports'
            };
        }
        
        return {
            riskScore: formats.size / this.thresholds.differentFormatsThreshold * 0.2,
            suspicious: false,
            pattern: null
        };
    }

    /**
     * Check unusual timing (e.g., exports at unusual hours)
     * @private
     */
    async checkUnusualTiming(userId, exportHistory) {
        const currentHour = new Date().getHours();
        const isUnusualHour = currentHour < 6 || currentHour > 22; // Outside 6 AM - 10 PM
        
        if (isUnusualHour && exportHistory.length > 2) {
            return {
                riskScore: 0.4,
                suspicious: true,
                pattern: 'unusual_hour_export'
            };
        }
        
        return { riskScore: 0, suspicious: false, pattern: null };
    }

    /**
     * Check location anomaly
     * @private
     */
    async checkLocationAnomaly(userId, context) {
        if (!context.ip) return { riskScore: 0, suspicious: false, pattern: null };
        
        // Get user's recent IPs
        const recentLogs = await db.SecurityLog.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: new Date(Date.now() - this.timeWindows.week) }
            },
            attributes: ['ip_address'],
            group: ['ip_address'],
            limit: 10
        });
        
        const knownIPs = new Set(recentLogs.map(log => log.ip_address));
        
        if (knownIPs.size > 0 && !knownIPs.has(context.ip)) {
            return {
                riskScore: 0.5,
                suspicious: true,
                pattern: 'new_ip_location'
            };
        }
        
        return { riskScore: 0, suspicious: false, pattern: null };
    }

    /**
     * Log export activity
     * @private
     */
    async logExportActivity(userId, exportType, recordCount, format, context, riskScore, patterns) {
        await db.AuditLog.create({
            user_id: userId,
            target_type: exportType,
            target_id: null,
            event_type: 'export_attempt',
            metadata: JSON.stringify({
                recordCount,
                format,
                riskScore,
                patterns,
                timestamp: new Date()
            }),
            ip_address: context.ip,
            device_fingerprint: context.deviceFingerprint
        });
        
        if (riskScore > this.thresholds.warningThreshold) {
            await logService.securityLog({
                eventType: 'export.suspicious_activity',
                severity: riskScore > 0.8 ? 'high' : 'medium',
                userId,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    exportType,
                    recordCount,
                    format,
                    riskScore,
                    patterns
                }
            });
        }
    }

    /**
     * Determine action based on risk score
     * @private
     */
    async determineAction(userId, riskScore, patterns, context) {
        // Critical risk - lock account
        if (riskScore >= this.thresholds.lockThreshold) {
            await this.lockUserAccount(userId, patterns, context);
            return {
                allowed: false,
                type: 'account_locked',
                message: 'Account locked due to suspicious export activity'
            };
        }
        
        // High risk - block export
        if (riskScore >= 0.8) {
            await this.notifyAdmins(userId, riskScore, patterns, false, context);
            return {
                allowed: false,
                type: 'export_blocked',
                message: 'Export blocked due to unusual activity. Please contact administrator.'
            };
        }
        
        // Medium risk - allow but notify
        if (riskScore >= this.thresholds.warningThreshold) {
            await this.warnUser(userId, patterns);
            return {
                allowed: true,
                type: 'warning_issued',
                message: 'Unusual export activity detected. This has been logged.'
            };
        }
        
        // Low risk - allow
        return {
            allowed: true,
            type: 'allowed',
            message: null
        };
    }

    /**
     * Lock user account
     * @private
     */
    async lockUserAccount(userId, patterns, context = {}) {
        const user = await db.User.findByPk(userId);
        if (!user) return;
        
        // Lock the account
        await user.update({
            account_locked: true,
            account_locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000) // Lock for 24 hours
        });
        
        // Log the lock
        await logService.securityLog({
            eventType: 'account.locked_suspicious_export',
            severity: 'critical',
            userId,
            metadata: {
                patterns,
                autoLocked: true,
                reason: 'Excessive or suspicious data export activity'
            }
        });
        
        // Always notify the user whose account was locked (personal notification)
        await emailService.sendSecurityAlert({
            email: user.email,
            userId: user.id,
            alertType: 'account_locked',
            eventDetails: {
                user_id: user.id,
                date_time: new Date().toLocaleString(),
                ip_address: context.ip || 'Unknown',
                location: 'Unknown', // We don't have geolocation yet
                device: context.deviceFingerprint ? context.deviceFingerprint.substring(0, 16) + '...' : 'Unknown',
                lockout_reason: `Suspicious export activity: ${patterns.join(', ')}`
            }
        });
        
        // Notify all admins (administrative notification about user lockout)
        await this.notifyAdmins(userId, 1.0, patterns, true, context);
    }

    /**
     * Warn user about suspicious activity
     * @private
     */
    async warnUser(userId, patterns) {
        const user = await db.User.findByPk(userId);
        if (!user) return;
        
        await emailService.sendSecurityAlert({
            email: user.email,
            userId: user.id,
            alertType: 'export_warning',
            eventDetails: {
                patterns: patterns.join(', '),
                message: 'Unusual export activity has been detected on your account',
                timestamp: new Date()
            }
        });
    }

    /**
     * Notify administrators
     * @private
     */
    async notifyAdmins(userId, riskScore, patterns, accountLocked = false, context = {}) {
        const user = await db.User.findByPk(userId);
        const admins = await db.User.findAll({
            include: [{
                model: db.Role,
                as: 'role',
                where: {
                    name: 'system_admin'
                }
            }]
        });
        
        console.log(`Admin notification - Found ${admins.length} admins for user ${userId} lockout`);
        console.log(`Admin details:`, admins.map(a => ({ id: a.id, username: a.username, email: a.email, role_id: a.role_id })));
        
        for (const admin of admins) {
            console.log(`Sending admin email to ${admin.email} (${admin.username}) - Alert type: ${accountLocked ? 'admin_user_account_locked' : 'admin_suspicious_export_activity'}`);
            
            try {
                await emailService.sendSecurityAlert({
                    email: admin.email,
                    userId: admin.id,
                    alertType: accountLocked ? 'admin_user_account_locked' : 'admin_suspicious_export_activity',
                    eventDetails: {
                        affectedUserId: userId,
                        affectedUsername: user?.username,
                        affectedUserEmail: user?.email,
                        riskScore,
                        patterns: patterns.join(', '),
                        accountLocked,
                        lockedUntil: accountLocked ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
                        timestamp: new Date(),
                        ip_address: context.ip,
                        device_fingerprint: context.deviceFingerprint,
                        user_agent: context.userAgent
                    }
                });
                console.log(`Admin email sent successfully to ${admin.email}`);
            } catch (emailError) {
                console.error(`Failed to send admin email to ${admin.email}:`, emailError);
            }
        }
    }

}

module.exports = new ExportMonitoringService();