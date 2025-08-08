// controllers/archiveController.js
const archiveService = require('../../services/archiveService');
const exportMonitoringService = require('../../services/exportMonitoringService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
const EncryptionHooks = require('../../utils/encryptionHooks');

/**
 * Archive controller for handling archived blood analyses operations
 */
class ArchiveController {

    /**
     * Get archived analyses with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getArchivedAnalyses(req, res) {
        try {
            const {
                patientName,
                matriculeNational,
                doctorName,
                roomNumber,
                analysisType,
                priority,
                status,
                startDate,
                endDate,
                archivedStartDate,
                archivedEndDate,
                page = 1,
                limit = 20
            } = req.query;

            const filters = {
                patientName,
                matriculeNational,
                doctorName,
                roomNumber,
                analysisType,
                priority,
                status,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                archivedStartDate: archivedStartDate ? new Date(archivedStartDate) : null,
                archivedEndDate: archivedEndDate ? new Date(archivedEndDate) : null
            };

            const result = await archiveService.getArchivedAnalyses(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Decrypt patient data in archived analyses
            const decryptedData = result.archivedAnalyses.map(archive => {
                if (archive.patient && archive.patient.matricule_national) {
                    const patientFields = ['name', 'matricule_national', 'phone', 'address'];
                    archive.patient.dataValues = EncryptionHooks.prepareFromDatabase(archive.patient.dataValues, patientFields);
                }
                return archive;
            });

            return res.status(200).json({
                success: true,
                data: decryptedData,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get archived analyses error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve archived analyses'
            });
        }
    }

    /**
     * Get specific archived analysis by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getArchivedAnalysisById(req, res) {
        try {
            const { id } = req.params;

            const result = await archiveService.getArchivedAnalysisById(parseInt(id));

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Decrypt archived analysis data
            const archive = result.data;
            
            // Decrypt the archived fields (patient_name, doctor_name, notes, results)
            const archivedFields = ['patient_name', 'doctor_name', 'notes', 'results'];
            archive.dataValues = EncryptionHooks.prepareFromDatabase(archive.dataValues, archivedFields);
            
            // Decrypt associated patient data if present
            if (archive.patient && archive.patient.matricule_national) {
                const patientFields = ['name', 'matricule_national', 'phone', 'address'];
                archive.patient.dataValues = EncryptionHooks.prepareFromDatabase(archive.patient.dataValues, patientFields);
            }

            return res.status(200).json({
                success: true,
                data: archive
            });
        } catch (error) {
            console.error('Get archived analysis error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve archived analysis'
            });
        }
    }

    /**
     * Search archived analyses
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async searchArchivedAnalyses(req, res) {
        try {
            const { term } = req.params;
            const { limit = 10 } = req.query;

            const result = await archiveService.searchArchivedAnalyses(term, parseInt(limit));

            return res.status(200).json(result);
        } catch (error) {
            console.error('Search archived analyses error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search archived analyses'
            });
        }
    }

    /**
     * Get patient's archived analysis history
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPatientArchivedHistory(req, res) {
        try {
            const { patientId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const result = await archiveService.getPatientArchivedHistory(
                parseInt(patientId),
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Decrypt archived analyses data
            const decryptedArchivedAnalyses = result.archivedAnalyses.map(archive => {
                // Decrypt the archived fields
                const archivedFields = ['patient_name', 'doctor_name', 'notes', 'results'];
                archive.dataValues = EncryptionHooks.prepareFromDatabase(archive.dataValues, archivedFields);
                
                // Decrypt associated patient data if present
                if (archive.patient && archive.patient.matricule_national) {
                    const patientFields = ['name', 'matricule_national', 'phone', 'address'];
                    archive.patient.dataValues = EncryptionHooks.prepareFromDatabase(archive.patient.dataValues, patientFields);
                }
                return archive;
            });

            return res.status(200).json({
                success: true,
                patient: result.patient,
                data: decryptedArchivedAnalyses,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get patient archived history error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patient archived history'
            });
        }
    }

    /**
     * Get doctor's archived analysis history
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDoctorArchivedHistory(req, res) {
        try {
            const { doctorId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const result = await archiveService.getDoctorArchivedHistory(
                parseInt(doctorId),
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Decrypt archived analyses data
            const decryptedArchivedAnalyses = result.archivedAnalyses.map(archive => {
                // Decrypt the archived fields
                const archivedFields = ['patient_name', 'doctor_name', 'notes', 'results'];
                archive.dataValues = EncryptionHooks.prepareFromDatabase(archive.dataValues, archivedFields);
                
                // Decrypt associated patient data if present
                if (archive.patient && archive.patient.matricule_national) {
                    const patientFields = ['name', 'matricule_national', 'phone', 'address'];
                    archive.patient.dataValues = EncryptionHooks.prepareFromDatabase(archive.patient.dataValues, patientFields);
                }
                return archive;
            });

            return res.status(200).json({
                success: true,
                doctor: result.doctor,
                data: decryptedArchivedAnalyses,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get doctor archived history error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctor archived history'
            });
        }
    }

    /**
     * Export archived analyses
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportArchivedAnalyses(req, res) {
        try {
            const { filters, format = 'json', password, columns = [] } = req.body;
            const { userId } = req.auth;

            // Verify user password for security
            const authService = require('../../services/authService');
            const isValidPassword = await authService.verifyUserPassword(userId, password);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Log export attempt
            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            // Get actual count of archived analyses that will be exported
            const countResult = await archiveService.getArchivedAnalyses(filters || {}, 1, 1);
            const actualCount = countResult.success ? countResult.total : 0;

            // Monitor export behavior before proceeding with actual count
            const monitoringResult = await exportMonitoringService.monitorExport(
                userId,
                'archived_analyses',
                actualCount, // Use actual count instead of hardcoded estimate
                format,
                context
            );

            if (!monitoringResult.allowed) {
                return res.status(403).json({
                    success: false,
                    message: monitoringResult.message || 'Export not allowed due to security restrictions'
                });
            }

            const result = await archiveService.exportArchivedAnalyses(filters, format, columns, userId, context);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Add export limit warning headers
            if (monitoringResult.showWarning) {
                res.setHeader('X-Export-Warning', 'true');
                res.setHeader('X-Export-Limits', JSON.stringify(monitoringResult.exportLimits));
                res.setHeader('X-Export-Message', `Warning: You have ${monitoringResult.exportLimits.hourlyRemaining} export(s) remaining this hour and ${monitoringResult.exportLimits.dailyRemaining} export(s) remaining today.`);
            }

            // Set appropriate headers for file download
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="archived_analyses.csv"');
                return res.status(200).send(result.data);
            } else if (format === 'excel') {
                // For Excel, send base64 encoded binary data
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({
                    success: true,
                    data: result.data, // Base64 encoded Excel file
                    format: result.format
                });
            }

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="archived_analyses.json"');
            return res.status(200).json({
                success: true,
                data: result.data,
                count: result.count,
                format: result.format
            });
        } catch (error) {
            console.error('Export archived analyses error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export archived analyses'
            });
        }
    }

    /**
     * Clean up old archived analyses
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async cleanupOldArchives(req, res) {
        try {
            const { olderThanDays } = req.body;
            const { userId } = req.auth;

            if (!olderThanDays || olderThanDays < 365) {
                return res.status(400).json({
                    success: false,
                    message: 'Must specify at least 365 days for cleanup'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await archiveService.cleanupOldArchives(
                parseInt(olderThanDays),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Cleanup old archives error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cleanup old archives'
            });
        }
    }
}

module.exports = new ArchiveController();