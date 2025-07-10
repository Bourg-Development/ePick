// controllers/api/forensicsController.js
const forensicsService = require('../../services/forensicsService');
const logService = require('../../services/logService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Controller for forensics and advanced audit trail analysis
 */
class ForensicsController {

    /**
     * Analyze user behavior patterns
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async analyzeUserBehavior(req, res) {
        try {
            const { userId: requestingUserId, permissions, role } = req.auth;

            // Check permissions - only system admins and authorized users
            if (role !== 'system_admin' && !permissions.includes('forensics.analyze')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            const { userId, days = 30 } = req.params;
            const targetUserId = parseInt(userId);

            // Validate parameters
            if (!targetUserId || targetUserId < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            if (days < 1 || days > 365) {
                return res.status(400).json({
                    success: false,
                    message: 'Days must be between 1 and 365'
                });
            }

            // Perform analysis
            const analysis = await forensicsService.analyzeUserBehavior(targetUserId, parseInt(days));

            // Log the forensic analysis action
            await logService.auditLog({
                eventType: 'forensics.user_behavior_analyzed',
                userId: requestingUserId,
                targetId: targetUserId,
                targetType: 'user',
                ipAddress: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                metadata: {
                    analysisPeriod: days,
                    riskScore: analysis.riskScore,
                    anomaliesFound: analysis.anomalies.length,
                    userAgent: req.headers['user-agent']
                }
            });

            return res.status(200).json({
                success: true,
                data: analysis
            });

        } catch (error) {
            console.error('User behavior analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to analyze user behavior'
            });
        }
    }

    /**
     * Investigate suspicious activity
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async investigateSuspiciousActivity(req, res) {
        try {
            const { userId: requestingUserId, permissions, role } = req.auth;

            // Check permissions - only system admins and security analysts
            if (role !== 'system_admin' && !permissions.includes('forensics.investigate')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            const {
                startDate,
                endDate,
                eventTypes,
                ipAddresses,
                userIds,
                riskThreshold = 5
            } = req.body;

            // Build investigation criteria
            const criteria = {
                riskThreshold: parseInt(riskThreshold)
            };

            if (startDate) criteria.startDate = new Date(startDate);
            if (endDate) criteria.endDate = new Date(endDate);
            if (eventTypes && Array.isArray(eventTypes)) criteria.eventTypes = eventTypes;
            if (ipAddresses && Array.isArray(ipAddresses)) criteria.ipAddresses = ipAddresses;
            if (userIds && Array.isArray(userIds)) criteria.userIds = userIds.map(id => parseInt(id));

            // Perform investigation
            const investigation = await forensicsService.investigateSuspiciousActivity(criteria);

            // Log the investigation action
            await logService.auditLog({
                eventType: 'forensics.suspicious_activity_investigated',
                userId: requestingUserId,
                targetType: 'system',
                ipAddress: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                metadata: {
                    investigationCriteria: criteria,
                    findingsCount: investigation.findings.length,
                    highRiskUsersFound: investigation.highRiskUsers.length,
                    suspiciousIPsFound: investigation.suspiciousIPs.length,
                    userAgent: req.headers['user-agent']
                }
            });

            return res.status(200).json({
                success: true,
                data: investigation
            });

        } catch (error) {
            console.error('Suspicious activity investigation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to investigate suspicious activity'
            });
        }
    }

    /**
     * Generate comprehensive audit report
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generateAuditReport(req, res) {
        try {
            const { userId: requestingUserId, permissions, role } = req.auth;

            // Check permissions - system admins and compliance officers
            if (role !== 'system_admin' && !permissions.includes('forensics.audit_report')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            const {
                startDate,
                endDate,
                includeUserActivity = true,
                includeSystemEvents = true,
                includeSecurityEvents = true,
                format = 'detailed'
            } = req.body;

            // Build report options
            const options = {
                includeUserActivity: Boolean(includeUserActivity),
                includeSystemEvents: Boolean(includeSystemEvents),
                includeSecurityEvents: Boolean(includeSecurityEvents),
                format
            };

            if (startDate) options.startDate = new Date(startDate);
            if (endDate) options.endDate = new Date(endDate);

            // Generate report
            const report = await forensicsService.generateAuditReport(options);

            // Log the report generation
            await logService.auditLog({
                eventType: 'forensics.audit_report_generated',
                userId: requestingUserId,
                targetType: 'system',
                ipAddress: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                metadata: {
                    reportOptions: options,
                    totalEvents: report.summary.totalEvents,
                    reportFormat: format,
                    userAgent: req.headers['user-agent']
                }
            });

            return res.status(200).json({
                success: true,
                data: report
            });

        } catch (error) {
            console.error('Audit report generation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate audit report'
            });
        }
    }

    /**
     * Verify audit log integrity
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyAuditIntegrity(req, res) {
        try {
            const { userId: requestingUserId, permissions, role } = req.auth;

            // Check permissions - system admins only
            if (role !== 'system_admin' && !permissions.includes('forensics.verify_integrity')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            const {
                startDate,
                endDate,
                checkHashChain = true,
                checkTampering = true
            } = req.body;

            // Build verification options
            const options = {
                checkHashChain: Boolean(checkHashChain),
                checkTampering: Boolean(checkTampering)
            };

            if (startDate) options.startDate = new Date(startDate);
            if (endDate) options.endDate = new Date(endDate);

            // Perform verification
            const verification = await forensicsService.verifyAuditIntegrity(options);

            // Log the verification action
            await logService.auditLog({
                eventType: 'forensics.integrity_verification_performed',
                userId: requestingUserId,
                targetType: 'system',
                ipAddress: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                metadata: {
                    verificationOptions: options,
                    verificationResult: verification.results,
                    totalRecords: verification.totalRecords,
                    verifiedRecords: verification.verifiedRecords,
                    corruptedRecords: verification.corruptedRecords.length,
                    userAgent: req.headers['user-agent']
                }
            });

            return res.status(200).json({
                success: true,
                data: verification
            });

        } catch (error) {
            console.error('Audit integrity verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify audit integrity'
            });
        }
    }

    /**
     * Get real-time security dashboard data
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSecurityDashboard(req, res) {
        try {
            const { userId: requestingUserId, permissions, role } = req.auth;

            // Check permissions
            if (role !== 'system_admin' && !permissions.includes('forensics.dashboard')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            // Get recent activity and security metrics
            const dashboard = {
                timestamp: new Date(),
                recentActivity: {},
                securityMetrics: {},
                alerts: []
            };

            // Get recent suspicious activity (last 24 hours)
            const recentInvestigation = await forensicsService.investigateSuspiciousActivity({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endDate: new Date(),
                riskThreshold: 3
            });

            dashboard.recentActivity = {
                suspiciousIPs: recentInvestigation.suspiciousIPs.length,
                highRiskUsers: recentInvestigation.highRiskUsers.length,
                anomalousEvents: recentInvestigation.anomalousEvents.length
            };

            dashboard.securityMetrics = {
                totalFindings: recentInvestigation.findings.length,
                recommendations: recentInvestigation.recommendations.length
            };

            // Get recent security events
            const recentEvents = await forensicsService.getRecentSecurityEvents(24); // Last 24 hours
            dashboard.recentEvents = recentEvents;

            // Generate alerts for high-risk items
            if (recentInvestigation.highRiskUsers.length > 0) {
                dashboard.alerts.push({
                    type: 'high_risk_users',
                    severity: 'high',
                    message: `${recentInvestigation.highRiskUsers.length} high-risk users detected`,
                    count: recentInvestigation.highRiskUsers.length
                });
            }

            if (recentInvestigation.suspiciousIPs.length > 0) {
                dashboard.alerts.push({
                    type: 'suspicious_ips',
                    severity: 'medium',
                    message: `${recentInvestigation.suspiciousIPs.length} suspicious IP addresses detected`,
                    count: recentInvestigation.suspiciousIPs.length
                });
            }

            return res.status(200).json({
                success: true,
                data: dashboard
            });

        } catch (error) {
            console.error('Security dashboard error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to load security dashboard'
            });
        }
    }
}

module.exports = new ForensicsController();