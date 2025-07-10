// services/archiveService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');

/**
 * Service for managing archived blood analyses
 */
class ArchiveService {
    /**
     * Get archived analysis by ID
     * @param {number} archivedAnalysisId - Archived analysis ID
     * @returns {Promise<Object>} Archived analysis data or error
     */
    async getArchivedAnalysisById(archivedAnalysisId) {
        try {
            const archivedAnalysis = await db.ArchivedAnalysis.findByPk(archivedAnalysisId, {
                include: [
                    { association: 'patient', attributes: ['id', 'name', 'matricule_national'] },
                    { association: 'doctor', attributes: ['id', 'name'] },
                    { association: 'room', attributes: ['id', 'room_number'] },
                    { association: 'archivedBy', attributes: ['id', 'username'] },
                    { association: 'creator', attributes: ['id', 'username'] },
                    { association: 'completedBy', attributes: ['id', 'username'] }
                ]
            });

            if (!archivedAnalysis) {
                return {
                    success: false,
                    message: 'Archived analysis not found'
                };
            }

            return {
                success: true,
                data: archivedAnalysis
            };
        } catch (error) {
            console.error('Get archived analysis error:', error);
            return {
                success: false,
                message: 'Failed to retrieve archived analysis'
            };
        }
    }

    /**
     * Get archived analyses with filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.patientName] - Filter by patient name
     * @param {string} [filters.matriculeNational] - Filter by patient national ID
     * @param {string} [filters.doctorName] - Filter by doctor name
     * @param {string} [filters.roomNumber] - Filter by room number
     * @param {string} [filters.analysisType] - Filter by analysis type
     * @param {string} [filters.priority] - Filter by priority
     * @param {string} [filters.status] - Filter by status
     * @param {Date} [filters.startDate] - Filter by analysis start date
     * @param {Date} [filters.endDate] - Filter by analysis end date
     * @param {Date} [filters.archivedStartDate] - Filter by archived start date
     * @param {Date} [filters.archivedEndDate] - Filter by archived end date
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated archived analyses
     */
    async getArchivedAnalyses(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            // Apply filters
            if (filters.patientName) {
                whereClause.patient_name = { [Op.iLike]: `%${filters.patientName}%` };
            }

            if (filters.matriculeNational) {
                // Need to join with patient table for this filter
                // Will handle this in the include
            }

            if (filters.doctorName) {
                whereClause.doctor_name = { [Op.iLike]: `%${filters.doctorName}%` };
            }

            if (filters.roomNumber) {
                whereClause.room_number = { [Op.iLike]: `%${filters.roomNumber}%` };
            }

            if (filters.analysisType) {
                whereClause.analysis_type = filters.analysisType;
            }

            if (filters.priority) {
                whereClause.priority = filters.priority;
            }

            if (filters.status) {
                whereClause.status = filters.status;
            }

            // Analysis date range filtering
            if (filters.startDate || filters.endDate) {
                whereClause.analysis_date = {};

                if (filters.startDate) {
                    whereClause.analysis_date[Op.gte] = new Date(filters.startDate);
                }

                if (filters.endDate) {
                    whereClause.analysis_date[Op.lte] = new Date(filters.endDate);
                }
            }

            // Archived date range filtering
            if (filters.archivedStartDate || filters.archivedEndDate) {
                whereClause.archived_at = {};

                if (filters.archivedStartDate) {
                    whereClause.archived_at[Op.gte] = new Date(filters.archivedStartDate);
                }

                if (filters.archivedEndDate) {
                    whereClause.archived_at[Op.lte] = new Date(filters.archivedEndDate);
                }
            }

            const offset = (page - 1) * limit;

            // Build include array
            const includeArray = [
                { association: 'archivedBy', attributes: ['id', 'username'] }
            ];

            // Add patient include with matricule filter if needed
            if (filters.matriculeNational) {
                includeArray.push({
                    association: 'patient',
                    attributes: ['id', 'name', 'matricule_national'],
                    where: {
                        matricule_national: { [Op.iLike]: `%${filters.matriculeNational}%` }
                    }
                });
            } else {
                includeArray.push({
                    association: 'patient',
                    attributes: ['id', 'name', 'matricule_national'],
                    required: false
                });
            }

            // Get archived analyses with pagination
            const { count, rows } = await db.ArchivedAnalysis.findAndCountAll({
                where: whereClause,
                include: includeArray,
                order: [['archived_at', 'DESC']],
                limit,
                offset
            });

            return {
                success: true,
                archivedAnalyses: rows,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get archived analyses error:', error);
            return {
                success: false,
                message: 'Failed to retrieve archived analyses'
            };
        }
    }

    /**
     * Search archived analyses
     * @param {string} searchTerm - Search term
     * @param {number} [limit=10] - Maximum results
     * @returns {Promise<Object>} Search results
     */
    async searchArchivedAnalyses(searchTerm, limit = 10) {
        try {
            const archivedAnalyses = await db.ArchivedAnalysis.findAll({
                where: {
                    [Op.or]: [
                        { patient_name: { [Op.iLike]: `%${searchTerm}%` } },
                        { doctor_name: { [Op.iLike]: `%${searchTerm}%` } },
                        { room_number: { [Op.iLike]: `%${searchTerm}%` } }
                    ]
                },
                include: [
                    { association: 'patient', attributes: ['id', 'matricule_national'] }
                ],
                limit,
                order: [['archived_at', 'DESC']]
            });

            return {
                success: true,
                archivedAnalyses
            };
        } catch (error) {
            console.error('Search archived analyses error:', error);
            return {
                success: false,
                message: 'Failed to search archived analyses'
            };
        }
    }

    /**
     * Get patient's archived analysis history
     * @param {number} patientId - Patient ID
     * @param {number} [page=1] - Page number
     * @param {number} [limit=10] - Results per page
     * @returns {Promise<Object>} Patient's archived analyses
     */
    async getPatientArchivedHistory(patientId, page = 1, limit = 10) {
        try {
            const patient = await db.Patient.findByPk(patientId);

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await db.ArchivedAnalysis.findAndCountAll({
                where: { patient_id: patientId },
                order: [['analysis_date', 'DESC']],
                limit,
                offset
            });

            return {
                success: true,
                patient: {
                    id: patient.id,
                    name: patient.name,
                    matricule_national: patient.matricule_national
                },
                archivedAnalyses: rows,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get patient archived history error:', error);
            return {
                success: false,
                message: 'Failed to retrieve patient archived history'
            };
        }
    }

    /**
     * Get doctor's archived analysis history
     * @param {number} doctorId - Doctor ID
     * @param {number} [page=1] - Page number
     * @param {number} [limit=10] - Results per page
     * @returns {Promise<Object>} Doctor's archived analyses
     */
    async getDoctorArchivedHistory(doctorId, page = 1, limit = 10) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await db.ArchivedAnalysis.findAndCountAll({
                where: { doctor_id: doctorId },
                include: [
                    { association: 'patient', attributes: ['id', 'name', 'matricule_national'] }
                ],
                order: [['analysis_date', 'DESC']],
                limit,
                offset
            });

            return {
                success: true,
                doctor: {
                    id: doctor.id,
                    name: doctor.name
                },
                archivedAnalyses: rows,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get doctor archived history error:', error);
            return {
                success: false,
                message: 'Failed to retrieve doctor archived history'
            };
        }
    }

    /**
     * Export archived analyses data
     * @param {Object} filters - Filter criteria (same as getArchivedAnalyses)
     * @param {string} [format='json'] - Export format (json, csv)
     * @returns {Promise<Object>} Export result
     */
    async exportArchivedAnalyses(filters = {}, format = 'json') {
        try {
            // Get all matching archived analyses without pagination
            const result = await this.getArchivedAnalyses(filters, 1, 1000000); // Large limit to get all

            if (!result.success) {
                return result;
            }

            const data = result.archivedAnalyses.map(analysis => ({
                id: analysis.id,
                originalAnalysisId: analysis.original_analysis_id,
                analysisDate: analysis.analysis_date,
                patientName: analysis.patient_name,
                matriculeNational: analysis.patient?.matricule_national || 'N/A',
                doctorName: analysis.doctor_name,
                roomNumber: analysis.room_number,
                status: analysis.status,
                analysisType: analysis.analysis_type,
                priority: analysis.priority,
                postponedCount: analysis.postponed_count,
                completedAt: analysis.completed_at,
                archivedAt: analysis.archived_at,
                archivedBy: analysis.archivedBy?.username || 'System'
            }));

            if (format === 'csv') {
                // Convert to CSV format
                if (data.length === 0) {
                    return {
                        success: true,
                        data: 'No data to export',
                        format: 'csv'
                    };
                }

                const headers = Object.keys(data[0]).join(',');
                const csvRows = data.map(row =>
                    Object.values(row).map(value =>
                        typeof value === 'string' && value.includes(',')
                            ? `"${value}"`
                            : value
                    ).join(',')
                );

                const csvData = [headers, ...csvRows].join('\n');

                return {
                    success: true,
                    data: csvData,
                    format: 'csv',
                    count: data.length
                };
            }

            return {
                success: true,
                data,
                format: 'json',
                count: data.length
            };
        } catch (error) {
            console.error('Export archived analyses error:', error);
            return {
                success: false,
                message: 'Failed to export archived analyses'
            };
        }
    }

    /**
     * Clean up old archived analyses (hard delete)
     * @param {number} olderThanDays - Delete archives older than this many days
     * @param {number} userId - User ID performing the cleanup
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupOldArchives(olderThanDays, userId, context) {
        try {
            if (olderThanDays < 365) {
                return {
                    success: false,
                    message: 'Cannot delete archives less than 1 year old for compliance reasons'
                };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            // Count archives to be deleted
            const countToDelete = await db.ArchivedAnalysis.count({
                where: {
                    archived_at: { [Op.lt]: cutoffDate }
                }
            });

            if (countToDelete === 0) {
                return {
                    success: true,
                    message: 'No old archives found to delete',
                    deletedCount: 0
                };
            }

            // Delete old archives
            const deletedCount = await db.ArchivedAnalysis.destroy({
                where: {
                    archived_at: { [Op.lt]: cutoffDate }
                }
            });

            // Log the cleanup
            await logService.auditLog({
                eventType: 'archived_analyses.cleanup',
                userId,
                targetType: 'archived_analyses',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    olderThanDays,
                    cutoffDate,
                    deletedCount,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: `Successfully deleted ${deletedCount} old archived analyses`,
                deletedCount
            };
        } catch (error) {
            console.error('Cleanup old archives error:', error);
            return {
                success: false,
                message: 'Failed to cleanup old archives'
            };
        }
    }
}

module.exports = new ArchiveService();