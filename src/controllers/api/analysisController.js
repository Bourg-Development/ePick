// controllers/analysisController.js
const analysisService = require('../../services/analysisService');
const userService = require('../../services/userService');
const authService = require('../../services/authService');
const logService = require('../../services/logService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
const organizationSettingsService = require('../../services/organizationSettingsService');

/**
 * Analysis controller for managing blood analyses
 */
class AnalysisController {

    /**
     * Create a new analysis
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createAnalysis(req, res) {
        try {
            const {
                analysisDate,
                patientId,
                doctorId,
                roomId,
                analysisType,
                notes
            } = req.body;
            const { userId } = req.auth;

            // Validate required fields
            if (!analysisDate || !patientId || !doctorId || !roomId || !analysisType) {
                return res.status(400).json({
                    success: false,
                    message: 'Analysis date, patient, doctor, room, and analysis type are required'
                });
            }

            // Validate analysis type against configured types
            const analysisTypesResult = await organizationSettingsService.getAnalysisTypes();
            if (!analysisTypesResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to retrieve analysis types configuration'
                });
            }
            
            const validTypes = analysisTypesResult.analysisTypes.map(type => type.code);
            if (!validTypes.includes(analysisType)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid analysis type. Valid types are: ${validTypes.join(', ')}`
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await analysisService.createAnalysis({
                analysisDate: new Date(analysisDate),
                patientId: parseInt(patientId),
                doctorId: parseInt(doctorId),
                roomId: parseInt(roomId),
                analysisType,
                notes,
                createdBy: userId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create analysis'
            });
        }
    }

    /**
     * Get analysis by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAnalysisById(req, res) {
        try {
            const { id } = req.params;

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.getAnalysisById(
                parseInt(id),
                userContext
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Get analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve analysis'
            });
        }
    }

    /**
     * Get analyses with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAnalyses(req, res) {
        try {
            const {
                search,
                status,
                analysisType,
                patientId,
                doctorId,
                roomId,
                startDate,
                endDate,
                page = 1,
                limit = 20
            } = req.query;

            const filters = {
                search,
                status,
                analysisType,
                patientId: patientId ? parseInt(patientId) : undefined,
                doctorId: doctorId ? parseInt(doctorId) : undefined,
                roomId: roomId ? parseInt(roomId) : undefined,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.getAnalyses(
                filters,
                parseInt(page),
                parseInt(limit),
                userContext
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.analyses,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                },
                serviceFiltered: result.serviceFiltered || false
            });
        } catch (error) {
            console.error('Get analyses error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve analyses'
            });
        }
    }

    /**
     * Export analyses to JSON format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportAnalysesJson(req, res) {
        try {
            const { userId, username, permissions } = req.auth;

            if (!permissions.includes('analyses.view') && !permissions.includes('analyses.export')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AnalysisController()._getRequestContext(req);

            // Verify user's password
            const passwordValid = await authService.verifyUserPassword(userId, password);
            if (!passwordValid.success) {
                await new AnalysisController()._logExportFailure('json', userId, context, 'analyses');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const unifiedFilters = {
                search: filters.search,
                status: filters.status,
                analysisType: filters.analysisType,
                patientId: filters.patientId ? parseInt(filters.patientId) : undefined,
                doctorId: filters.doctorId ? parseInt(filters.doctorId) : undefined,
                roomId: filters.roomId ? parseInt(filters.roomId) : undefined,
                startDate: filters.startDate ? new Date(filters.startDate) : null,
                endDate: filters.endDate ? new Date(filters.endDate) : null
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            // Export analyses using the service
            const result = await analysisService.exportAnalyses(unifiedFilters, 'json', {
                includeColumns,
                excludeColumns
            }, userContext);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AnalysisController()._logExportSuccess('json', userId, result.dataCount, filters, context, 'analyses');

            // Set headers for file download
            const filename = `analyses_export_${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).json({
                success: true,
                exportDate: new Date().toISOString(),
                exportedBy: username,
                analysisCount: result.dataCount,
                filters: result.appliedFilters,
                serviceFiltered: result.metadata?.serviceFiltered || false,
                analyses: result.data
            });
        } catch (error) {
            console.error('Export analyses JSON error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export analyses'
            });
        }
    }

    /**
     * Export analyses to CSV format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportAnalysesCsv(req, res) {
        try {
            const { userId, username, permissions } = req.auth;

            if (!permissions.includes('analyses.view') && !permissions.includes('analyses.export')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AnalysisController()._getRequestContext(req);

            // Verify user's password
            const passwordValid = await authService.verifyUserPassword(userId, password);
            if (!passwordValid.success) {
                await new AnalysisController()._logExportFailure('csv', userId, context, 'analyses');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const unifiedFilters = {
                search: filters.search,
                status: filters.status,
                analysisType: filters.analysisType,
                patientId: filters.patientId ? parseInt(filters.patientId) : undefined,
                doctorId: filters.doctorId ? parseInt(filters.doctorId) : undefined,
                roomId: filters.roomId ? parseInt(filters.roomId) : undefined,
                startDate: filters.startDate ? new Date(filters.startDate) : null,
                endDate: filters.endDate ? new Date(filters.endDate) : null
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            // Export analyses using the service
            const result = await analysisService.exportAnalyses(unifiedFilters, 'csv', {
                includeColumns,
                excludeColumns
            }, userContext);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AnalysisController()._logExportSuccess('csv', userId, result.dataCount, filters, context, 'analyses');

            // Set headers for CSV download
            const filename = `analyses_export_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.csvData);
        } catch (error) {
            console.error('Export analyses CSV error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export analyses'
            });
        }
    }

    /**
     * Export analyses to Excel format
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportAnalysesExcel(req, res) {
        try {
            const { userId, username, permissions } = req.auth;

            if (!permissions.includes('analyses.view') && !permissions.includes('analyses.export')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AnalysisController()._getRequestContext(req);

            // Verify user's password
            const passwordValid = await authService.verifyUserPassword(userId, password);
            if (!passwordValid.success) {
                await new AnalysisController()._logExportFailure('excel', userId, context, 'analyses');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const unifiedFilters = {
                search: filters.search,
                status: filters.status,
                analysisType: filters.analysisType,
                patientId: filters.patientId ? parseInt(filters.patientId) : undefined,
                doctorId: filters.doctorId ? parseInt(filters.doctorId) : undefined,
                roomId: filters.roomId ? parseInt(filters.roomId) : undefined,
                startDate: filters.startDate ? new Date(filters.startDate) : null,
                endDate: filters.endDate ? new Date(filters.endDate) : null
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            // Export analyses using the service
            const result = await analysisService.exportAnalyses(unifiedFilters, 'excel', {
                includeColumns,
                excludeColumns
            }, userContext);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AnalysisController()._logExportSuccess('excel', userId, result.dataCount, filters, context, 'analyses');

            // Set headers for Excel download
            const filename = `analyses_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.excelBuffer);
        } catch (error) {
            console.error('Export analyses Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export analyses'
            });
        }
    }

    /**
     * Update analysis status
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateAnalysisStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const { userId } = req.auth;

            // Validate status
            const validStatuses = ['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.updateAnalysisStatus(
                parseInt(id),
                status,
                userId,
                context,
                userContext
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update analysis status error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update analysis status'
            });
        }
    }

    /**
     * Postpone analysis
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async postponeAnalysis(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.postponeAnalysis(
                parseInt(id),
                userId,
                context,
                userContext
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Postpone analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to postpone analysis'
            });
        }
    }

    /**
     * Cancel analysis
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async cancelAnalysis(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const { userId } = req.auth;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: 'Cancellation reason is required'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.cancelAnalysis(
                parseInt(id),
                reason,
                userId,
                context,
                userContext
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Cancel analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel analysis'
            });
        }
    }

    /**
     * Get analysis statistics
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAnalysisStatistics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.getAnalysisStatistics(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null,
                userContext
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get analysis statistics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve statistics'
            });
        }
    }

    /**
     * Get dashboard data
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDashboard(req, res) {
        try {
            // Extract user context for service filtering
            const userContext = await new AnalysisController()._extractUserContext(req);

            const result = await analysisService.getDashboard(userContext);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get dashboard error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve dashboard data'
            });
        }
    }

    /**
     * Get next available date
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getNextAvailableDate(req, res) {
        try {
            const { startDate } = req.query;

            const result = await analysisService.getNextAvailableDate(
                startDate ? new Date(startDate) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get next available date error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get next available date'
            });
        }
    }

    /**
     * Helper method to log export failures
     * @private
     * @param {string} format - Export format
     * @param {number} userId - User ID
     * @param {Object} context - Request context
     * @param {string} exportType - Type of data being exported
     */
    async _logExportFailure(format, userId, context, exportType = 'analyses') {
        await logService.securityLog({
            eventType: 'export.password_failed',
            severity: 'medium',
            userId,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType,
                format,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Helper method to log successful exports
     * @private
     * @param {string} format - Export format
     * @param {number} userId - User ID
     * @param {number} dataCount - Number of records exported
     * @param {Object} filters - Applied filters
     * @param {Object} context - Request context
     * @param {string} exportType - Type of data being exported
     */
    async _logExportSuccess(format, userId, dataCount, filters, context, exportType = 'analyses') {
        await logService.auditLog({
            eventType: `${exportType}.exported`,
            userId,
            targetType: exportType,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType,
                format,
                dataCount,
                filters,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }

    /**
     * Extract user context from request for service filtering
     * @private
     * @param {Object} req - Express request
     * @returns {Object|null} User context object
     */
    async _extractUserContext(req) {
        const auth = req.auth;
        const { data: userData } = await userService.getUserById(auth.userId);

        if (!auth) {
            return null;
        }

        return {
            userId: auth.userId,
            role: auth.role,
            permissions: auth.permissions || [],
            serviceId: userData.service_id,
            service: userData.service || null
        };
    }
}

module.exports = new AnalysisController();