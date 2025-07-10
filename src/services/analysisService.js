// services/analysisService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const docService = require('./docService');
const cryptoService = require('./cryptoService');

/**
 * Service for managing blood analyses
 */
class AnalysisService {

    /**
     * Create a new blood analysis
     * @param {Object} data - Analysis data
     * @param {Date} data.analysisDate - Date for the analysis
     * @param {number} data.patientId - Patient ID
     * @param {number} data.doctorId - Doctor ID
     * @param {number} data.roomId - Room ID
     * @param {string} data.analysisType - Type of analysis (XY, YZ, ZG, HG)
     * @param {string} [data.notes] - Additional notes
     * @param {number} data.createdBy - User ID creating the analysis
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createAnalysis(data, context) {
        try {
            const {
                analysisDate,
                patientId,
                doctorId,
                roomId,
                analysisType,
                notes,
                createdBy
            } = data;

            // Validate required relationships exist
            const patient = await db.Patient.findByPk(patientId);
            if (!patient || !patient.active) {
                return { success: false, message: 'Patient not found or inactive' };
            }

            const doctor = await db.Doctor.findByPk(doctorId);
            if (!doctor || !doctor.active) {
                return { success: false, message: 'Doctor not found or inactive' };
            }

            const room = await db.Room.findByPk(roomId);
            if (!room) {
                return { success: false, message: 'Room not found' };
            }

            // Check if the selected date is a working day
            const workingDays = await this._getOrganizationSetting('working_days');
            if (workingDays) {
                const workingDaysArray = JSON.parse(workingDays);
                const dayName = analysisDate.toLocaleDateString('en-US', { weekday: 'long' });

                if (!workingDaysArray.includes(dayName)) {
                    return {
                        success: false,
                        message: `${dayName} is not a working day. Please select a date on one of the working days: ${workingDaysArray.join(', ')}`
                    };
                }
            }

            // Check scheduling constraints using database function
            const analysisCount = await db.sequelize.query(
                'SELECT count_analyses_for_date(:analysisDate) as count',
                {
                    replacements: { analysisDate: analysisDate.toDateString() },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            const maxAnalysesPerDay = await this._getOrganizationSetting('max_analyses_per_day');
            if (maxAnalysesPerDay && analysisCount[0].count >= parseInt(maxAnalysesPerDay)) {
                return {
                    success: false,
                    message: `Maximum analyses per day (${maxAnalysesPerDay}) would be exceeded. Consider postponing to next available date.`
                };
            }

            // Check if patient already has an analysis scheduled for this date
            const patientConflict = await db.sequelize.query(
                `SELECT COUNT(*) as conflict_count
                 FROM analyses
                 WHERE patient_id = :patientId
                   AND DATE(analysis_date) = DATE(:analysisDate)
                   AND status IN ('Pending', 'Delayed', 'In Progress')`,
                {
                    replacements: {
                        patientId,
                        analysisDate: analysisDate.toISOString().split('T')[0] // Format as YYYY-MM-DD
                    },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            if (patientConflict[0].conflict_count > 0) {
                return {
                    success: false,
                    message: 'Patient already has an analysis scheduled for this date'
                };
            }

            // Create the analysis
            const analysis = await db.Analysis.create({
                analysis_date: analysisDate,
                patient_id: patientId,
                doctor_id: doctorId,
                room_id: roomId,
                status: 'Pending',
                analysis_type: analysisType,
                notes,
                created_by: createdBy
            });

            // Log the creation
            await logService.auditLog({
                eventType: 'analysis.created',
                userId: createdBy,
                targetId: analysis.id,
                targetType: 'analysis',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    patientId,
                    doctorId,
                    roomId,
                    analysisType,
                    analysisDate: analysisDate.toISOString(),
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                analysisId: analysis.id,
                message: 'Analysis created successfully'
            };
        } catch (error) {
            console.error('Create analysis error:', error);
            return {
                success: false,
                message: 'Failed to create analysis'
            };
        }
    }

    /**
     * Get analysis by ID with all related data
     * @param {number} analysisId - Analysis ID
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Analysis data or error
     */
    async getAnalysisById(analysisId, userContext = null) {
        try {
            const includeOptions = [
                { association: 'patient' },
                { association: 'doctor' },
                {
                    association: 'room',
                    include: [{ association: 'service', attributes: ['id', 'name'] }]
                },
                { association: 'creator', attributes: ['id', 'username'] },
                { association: 'completedBy', attributes: ['id', 'username'] }
            ];

            const analysis = await db.Analysis.findByPk(analysisId, {
                include: includeOptions
            });

            if (!analysis) {
                return {
                    success: false,
                    message: 'Analysis not found'
                };
            }

            // Apply service-based filtering for non-admin users
            if (userContext && !this._canViewAllAnalyses(userContext)) {
                const roomServiceId = analysis.room?.service_id;

                if (roomServiceId !== userContext.serviceId) {
                    return {
                        success: false,
                        message: 'Analysis not found'
                    };
                }
            }

            return {
                success: true,
                data: analysis
            };
        } catch (error) {
            console.error('Get analysis error:', error);
            return {
                success: false,
                message: 'Failed to retrieve analysis'
            };
        }
    }

    /**
     * Get analyses with filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.status] - Filter by status
     * @param {string} [filters.analysisType] - Filter by analysis type
     * @param {number} [filters.patientId] - Filter by patient
     * @param {number} [filters.doctorId] - Filter by doctor
     * @param {number} [filters.roomId] - Filter by room
     * @param {Date} [filters.startDate] - Filter by start date
     * @param {Date} [filters.endDate] - Filter by end date
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @param {Object} [userContext] - User context for service-based filtering
     * @returns {Promise<Object>} Paginated analyses
     */
    async getAnalyses(filters = {}, page = 1, limit = 20, userContext = null) {
        try {
            const whereClause = {};
            const includeOptions = [
                { association: 'patient', attributes: ['id', 'name', 'matricule_national'] },
                { association: 'doctor', attributes: ['id', 'name'] },
                {
                    association: 'room',
                    attributes: ['id', 'room_number', 'service_id'],
                    include: [{ association: 'service', attributes: ['id', 'name'] }]
                },
                { association: 'creator', attributes: ['id', 'username'] },
                {
                    association: 'recurringPattern',
                    attributes: ['id'],
                    include: [{
                        association: 'prescriptions',
                        attributes: ['id', 'status', 'valid_from', 'valid_until', 'remaining_analyses'],
                        required: false
                    }],
                    required: false
                }
            ];

            // Apply service-based filtering for non-admin users
            if (userContext && !this._canViewAllAnalyses(userContext)) {
                // Add room service filter - only show analyses for rooms belonging to user's service
                includeOptions[2].where = { service_id: userContext.serviceId };
                includeOptions[2].required = true; // INNER JOIN to enforce the filter
            }

            // Handle search functionality
            if (filters.search && filters.search.trim()) {
                const searchTerm = `%${filters.search.trim().toLowerCase()}%`;

                whereClause[Op.or] = [
                    // Search in patient name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('patient.name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in patient matricule
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('patient.matricule_national')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in doctor name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('doctor.name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in room number
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('room.room_number')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in room service name
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('room.service.name')),
                        Op.like,
                        searchTerm
                    ),
                    // Search in notes
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('Analysis.notes')),
                        Op.like,
                        searchTerm
                    )
                ];

                // Make patient, doctor, and room associations required when searching
                includeOptions[0].required = true; // patient
                includeOptions[1].required = true; // doctor
                if (!includeOptions[2].required) {
                    includeOptions[2].required = true; // room (if not already required by service filtering)
                }
            }

            // Apply other filters
            if (filters.status) {
                whereClause.status = filters.status;
            }

            if (filters.analysisType) {
                whereClause.analysis_type = filters.analysisType;
            }

            if (filters.patientId) {
                whereClause.patient_id = filters.patientId;
            }

            if (filters.doctorId) {
                whereClause.doctor_id = filters.doctorId;
            }

            if (filters.roomId) {
                whereClause.room_id = filters.roomId;
            }

            // Date range filtering
            if (filters.startDate || filters.endDate) {
                whereClause.analysis_date = {};

                if (filters.startDate) {
                    whereClause.analysis_date[Op.gte] = new Date(filters.startDate);
                }

                if (filters.endDate) {
                    whereClause.analysis_date[Op.lte] = new Date(filters.endDate);
                }
            }

            const offset = (page - 1) * limit;

            // Get analyses with pagination
            const { count, rows } = await db.Analysis.findAndCountAll({
                where: whereClause,
                include: includeOptions,
                order: [
                    ['analysis_date', 'ASC']
                ],
                limit,
                offset,
                distinct: true // Important when using includes with filtering
            });

            // Process analyses to add prescription status and decrypt data
            const processedAnalyses = await Promise.all(rows.map(async analysis => {
                const analysisData = analysis.toJSON();
                
                // Decrypt patient data if it exists
                if (analysisData.patient && analysisData.patient.name) {
                    try {
                        analysisData.patient.name = await cryptoService.decrypt(analysisData.patient.name);
                    } catch (error) {
                        console.warn('Failed to decrypt patient name:', error.message);
                    }
                }
                
                if (analysisData.patient && analysisData.patient.matricule_national) {
                    try {
                        analysisData.patient.matricule_national = await cryptoService.decrypt(analysisData.patient.matricule_national);
                    } catch (error) {
                        console.warn('Failed to decrypt patient matricule:', error.message);
                    }
                }
                
                // Decrypt doctor data if it exists
                if (analysisData.doctor && analysisData.doctor.name) {
                    try {
                        analysisData.doctor.name = await cryptoService.decrypt(analysisData.doctor.name);
                    } catch (error) {
                        console.warn('Failed to decrypt doctor name:', error.message);
                    }
                }
                
                // Check if this analysis has a valid prescription
                if (analysisData.recurringPattern && analysisData.recurringPattern.prescriptions) {
                    const analysisDate = new Date(analysisData.analysis_date);
                    const validPrescription = analysisData.recurringPattern.prescriptions.find(p => 
                        p.status === 'Active' &&
                        new Date(p.valid_from) <= analysisDate &&
                        new Date(p.valid_until) >= analysisDate &&
                        p.remaining_analyses > 0
                    );
                    analysisData.has_valid_prescription = !!validPrescription;
                } else {
                    analysisData.has_valid_prescription = analysisData.recurring_analysis_id ? false : null;
                }
                
                return analysisData;
            }));

            return {
                success: true,
                analyses: processedAnalyses,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit,
                serviceFiltered: userContext && !this._canViewAllAnalyses(userContext)
            };
        } catch (error) {
            console.error('Get analyses error:', error);
            return {
                success: false,
                message: 'Failed to retrieve analyses'
            };
        }
    }

    /**
     * Export analyses to JSON, CSV, or Excel format
     * @param {Object} filters - Filter criteria (same as getAnalyses)
     * @param {string} format - Export format ('json', 'csv', 'excel')
     * @param {Object} options - Export options
     * @param {Array} [options.includeColumns] - Columns to include
     * @param {Array} [options.excludeColumns] - Columns to exclude
     * @param {Object} [userContext] - User context for service-based filtering
     * @returns {Promise<Object>} Export result
     */
    async exportAnalyses(filters = {}, format = 'json', options = {}, userContext = null) {
        try {
            const whereClause = {};
            const includeOptions = [
                { association: 'patient', attributes: ['id', 'name', 'matricule_national'] },
                { association: 'doctor', attributes: ['id', 'name', 'specialization'] },
                {
                    association: 'room',
                    attributes: ['id', 'room_number', 'service_id'],
                    include: [{ association: 'service', attributes: ['id', 'name'] }]
                },
                { association: 'creator', attributes: ['id', 'username'] },
                { association: 'completedBy', attributes: ['id', 'username'] }
            ];

            // Apply service-based filtering for non-admin users
            if (userContext && !this._canViewAllAnalyses(userContext)) {
                includeOptions[2].where = { service_id: userContext.serviceId };
                includeOptions[2].required = true;
            }

            // Handle search functionality
            if (filters.search && filters.search.trim()) {
                const searchTerm = `%${filters.search.trim().toLowerCase()}%`;

                whereClause[Op.or] = [
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('patient.name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('patient.matricule_national')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('doctor.name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('room.room_number')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('room.service.name')),
                        Op.like,
                        searchTerm
                    ),
                    db.Sequelize.where(
                        db.Sequelize.fn('LOWER', db.Sequelize.col('Analysis.notes')),
                        Op.like,
                        searchTerm
                    )
                ];

                includeOptions[0].required = true; // patient
                includeOptions[1].required = true; // doctor
                if (!includeOptions[2].required) {
                    includeOptions[2].required = true; // room
                }
            }

            // Apply other filters
            if (filters.status) {
                whereClause.status = filters.status;
            }

            if (filters.analysisType) {
                whereClause.analysis_type = filters.analysisType;
            }

            if (filters.patientId) {
                whereClause.patient_id = filters.patientId;
            }

            if (filters.doctorId) {
                whereClause.doctor_id = filters.doctorId;
            }

            if (filters.roomId) {
                whereClause.room_id = filters.roomId;
            }

            // Date range filtering
            if (filters.startDate || filters.endDate) {
                whereClause.analysis_date = {};

                if (filters.startDate) {
                    whereClause.analysis_date[Op.gte] = new Date(filters.startDate);
                }

                if (filters.endDate) {
                    whereClause.analysis_date[Op.lte] = new Date(filters.endDate);
                }
            }

            // Get all matching analyses (no pagination for export)
            const analyses = await db.Analysis.findAll({
                where: whereClause,
                include: includeOptions,
                order: [['analysis_date', 'ASC']],
                distinct: true
            });

            console.log(analyses)

            // Format analyses for export
            const formattedAnalyses = analyses.map(analysis => this._formatAnalysisForExport(analysis));

            // Apply filters for tracking
            const appliedFilters = {};
            if (filters.search) appliedFilters.search = filters.search;
            if (filters.status) appliedFilters.status = filters.status;
            if (filters.analysisType) appliedFilters.analysisType = filters.analysisType;
            if (filters.patientId) appliedFilters.patientId = filters.patientId;
            if (filters.doctorId) appliedFilters.doctorId = filters.doctorId;
            if (filters.roomId) appliedFilters.roomId = filters.roomId;
            if (filters.startDate) appliedFilters.startDate = filters.startDate;
            if (filters.endDate) appliedFilters.endDate = filters.endDate;

            // Prepare analysis-specific column headers and options
            const analysisExportOptions = {
                ...options,
                appliedFilters,
                defaultExcludedFields: [], // No sensitive fields to exclude for analyses
                columnHeaders: this._getAnalysisColumnHeaders(),
                sheetName: 'Analyses',
                exportTitle: 'BLOOD ANALYSIS MANAGEMENT\nData Export Report',
                metadata: {
                    exportType: 'analyses',
                    totalAnalyses: formattedAnalyses.length,
                    serviceFiltered: userContext && !this._canViewAllAnalyses(userContext)
                }
            };

            // Use the document service for export
            return await docService.exportData(formattedAnalyses, format, analysisExportOptions);

        } catch (error) {
            console.error('Export analyses error:', error);
            return {
                success: false,
                message: 'Failed to export analyses'
            };
        }
    }

    /**
     * Format analysis data for export (flatten associations)
     * @private
     * @param {Object} analysis - Analysis instance from database
     * @returns {Object} Formatted analysis data
     */
    _formatAnalysisForExport(analysis) {
        const analysisData = analysis.toJSON();

        return {
            id: analysisData.id,
            analysisDate: analysisData.analysis_date,
            status: analysisData.status,
            analysisType: analysisData.analysis_type,
            notes: analysisData.notes,
            patientId: analysisData.patient_id,
            patientName: analysisData.patient ? analysisData.patient.name : null,
            patientMatricule: analysisData.patient ? analysisData.patient.matricule_national : null,
            doctorId: analysisData.doctor_id,
            doctorName: analysisData.doctor ? analysisData.doctor.name : null,
            doctorSpecialization: analysisData.doctor ? analysisData.doctor.specialization : null,
            roomId: analysisData.room_id,
            roomNumber: analysisData.room ? analysisData.room.room_number : null,
            serviceName: analysisData.room?.service ? analysisData.room.service.name : null,
            serviceId: analysisData.room ? analysisData.room.service_id : null,
            createdAt: analysisData.created_at,
            updatedAt: analysisData.updated_at,
            completedAt: analysisData.completed_at,
            createdBy: analysisData.creator ? analysisData.creator.username : null,
            createdById: analysisData.created_by,
            completedBy: analysisData.completedBy ? analysisData.completedBy.username : null,
            completedById: analysisData.completed_by
        };
    }

    /**
     * Get analysis-specific column headers for export
     * @private
     * @returns {Object} Column header mappings
     */
    _getAnalysisColumnHeaders() {
        return {
            id: 'Analysis ID',
            analysisDate: 'Analysis Date',
            status: 'Status',
            analysisType: 'Analysis Type',
            notes: 'Notes',
            patientId: 'Patient ID',
            patientName: 'Patient Name',
            patientMatricule: 'Patient Matricule',
            doctorId: 'Doctor ID',
            doctorName: 'Doctor Name',
            roomId: 'Room ID',
            roomNumber: 'Room Number',
            serviceName: 'Service Name',
            serviceId: 'Service ID',
            createdAt: 'Created At',
            updatedAt: 'Updated At',
            completedAt: 'Completed At',
            createdBy: 'Created By',
            createdById: 'Created By ID',
            completedBy: 'Completed By',
            completedById: 'Completed By ID'
        };
    }

    /**
     * Update analysis status
     * @param {number} analysisId - Analysis ID
     * @param {string} status - New status (Pending, Delayed, In Progress, Completed, Cancelled)
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Update result
     */
    async updateAnalysisStatus(analysisId, status, userId, context, userContext = null) {
        try {
            // First check if user can access this analysis
            const analysisCheck = await this.getAnalysisById(analysisId, userContext);
            if (!analysisCheck.success) {
                return analysisCheck; // Return the same error (not found or permission denied)
            }

            const analysis = analysisCheck.data;
            const oldStatus = analysis.status;

            // Update status
            analysis.status = status;

            // Handle completion
            if (status === 'Completed') {
                analysis.completed_at = new Date();
                analysis.completed_by = userId;
            }

            await analysis.save();

            // Log the status change
            await logService.auditLog({
                eventType: 'analysis.status_updated',
                userId,
                targetId: analysisId,
                targetType: 'analysis',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    oldStatus,
                    newStatus: status,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Analysis status updated successfully'
            };
        } catch (error) {
            console.error('Update analysis status error:', error);
            return {
                success: false,
                message: 'Failed to update analysis status'
            };
        }
    }

    /**
     * Postpone an analysis to the next available date
     * @param {number} analysisId - Analysis ID
     * @param {number} userId - User ID performing the postponement
     * @param {Object} context - Request context
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Postponement result
     */
    async postponeAnalysis(analysisId, userId, context, userContext = null) {
        try {
            // First check if user can access this analysis
            const analysisCheck = await this.getAnalysisById(analysisId, userContext);
            if (!analysisCheck.success) {
                return analysisCheck; // Return the same error (not found or permission denied)
            }

            // Use database function to postpone analysis
            const result = await db.sequelize.query(
                'SELECT postpone_analysis_by_service(:analysisId, :userId) as new_date',
                {
                    replacements: { analysisId, userId },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            const newDate = result[0].new_date;

            return {
                success: true,
                newDate,
                message: `Analysis postponed to ${new Date(newDate).toLocaleDateString()}`
            };
        } catch (error) {
            console.error('Postpone analysis error:', error);

            // Handle specific database errors
            if (error.message.includes('not found')) {
                return {
                    success: false,
                    message: 'Analysis not found'
                };
            }

            if (error.message.includes('Cannot postpone')) {
                return {
                    success: false,
                    message: 'Cannot postpone analysis with current status'
                };
            }

            return {
                success: false,
                message: 'Failed to postpone analysis'
            };
        }
    }

    /**
     * Cancel an analysis
     * @param {number} analysisId - Analysis ID
     * @param {string} reason - Cancellation reason
     * @param {number} userId - User ID performing the cancellation
     * @param {Object} context - Request context
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelAnalysis(analysisId, reason, userId, context, userContext = null) {
        try {
            // First check if user can access this analysis
            const analysisCheck = await this.getAnalysisById(analysisId, userContext);
            if (!analysisCheck.success) {
                return analysisCheck; // Return the same error (not found or permission denied)
            }

            const analysis = analysisCheck.data;

            if (analysis.status === 'Completed') {
                return {
                    success: false,
                    message: 'Cannot cancel completed analysis'
                };
            }

            const oldStatus = analysis.status;
            analysis.status = 'Cancelled';
            analysis.notes = (analysis.notes || '') + `\n[CANCELLED: ${reason}]`;
            await analysis.save();

            // Log the cancellation
            await logService.auditLog({
                eventType: 'analysis.cancelled',
                userId,
                targetId: analysisId,
                targetType: 'analysis',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    oldStatus,
                    reason,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Analysis cancelled successfully'
            };
        } catch (error) {
            console.error('Cancel analysis error:', error);
            return {
                success: false,
                message: 'Failed to cancel analysis'
            };
        }
    }

    /**
     * Get analysis statistics
     * @param {Date} [startDate] - Start date for statistics
     * @param {Date} [endDate] - End date for statistics
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Statistics data
     */
    async getAnalysisStatistics(startDate = null, endDate = null, userContext = null) {
        try {
            // Use default dates if not provided (last 30 days)
            if (!startDate) {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
            }

            if (!endDate) {
                endDate = new Date();
            }

            let query = 'SELECT * FROM get_analysis_statistics(:startDate, :endDate)';
            let replacements = {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            };

            // If user is service-restricted, add service filtering to statistics
            if (userContext && !this._canViewAllAnalyses(userContext)) {
                query = `
                    SELECT * FROM get_analysis_statistics_for_service(
                            :startDate,
                            :endDate,
                            :serviceId
                                  )
                `;
                replacements.serviceId = userContext.serviceId;
            }

            const stats = await db.sequelize.query(query, {
                replacements,
                type: db.Sequelize.QueryTypes.SELECT
            });

            return {
                success: true,
                statistics: stats[0],
                serviceFiltered: userContext && !this._canViewAllAnalyses(userContext)
            };
        } catch (error) {
            console.error('Get analysis statistics error:', error);
            return {
                success: false,
                message: 'Failed to retrieve statistics'
            };
        }
    }

    /**
     * Get dashboard view of analyses
     * @param {Object} [userContext] - User context for filtering
     * @returns {Promise<Object>} Dashboard data
     */
    async getDashboard(userContext = null) {
        try {
            let query = 'SELECT * FROM analysis_dashboard LIMIT 50';
            let replacements = {};

            // If user is service-restricted, filter dashboard by service
            if (userContext && !this._canViewAllAnalyses(userContext)) {
                query = `
                    SELECT * FROM analysis_dashboard
                    WHERE room_service_id = :serviceId
                        LIMIT 50
                `;
                replacements.serviceId = userContext.serviceId;
            }

            const dashboard = await db.sequelize.query(query, {
                replacements,
                type: db.Sequelize.QueryTypes.SELECT
            });

            return {
                success: true,
                dashboard,
                serviceFiltered: userContext && !this._canViewAllAnalyses(userContext)
            };
        } catch (error) {
            console.error('Get dashboard error:', error);
            return {
                success: false,
                message: 'Failed to retrieve dashboard data'
            };
        }
    }

    /**
     * Get next available date for scheduling
     * @param {Date} [startDate] - Start date to check from
     * @returns {Promise<Object>} Next available date
     */
    async getNextAvailableDate(startDate = null) {
        try {
            if (!startDate) {
                startDate = new Date();
            }

            const result = await db.sequelize.query(
                'SELECT find_next_available_date(:startDate) as next_date',
                {
                    replacements: { startDate: startDate.toISOString().split('T')[0] },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            return {
                success: true,
                nextAvailableDate: result[0].next_date
            };
        } catch (error) {
            console.error('Get next available date error:', error);
            return {
                success: false,
                message: 'Failed to get next available date'
            };
        }
    }

    /**
     * Check if user can view all analyses (admin or service with special permission)
     * @private
     * @param {Object} userContext - User context
     * @returns {boolean} True if user can view all analyses
     */
    _canViewAllAnalyses(userContext) {
        if (!userContext) return false;
        
        // System admin can view all analyses
        if (userContext.role === 'system_admin') {
            return true;
        }
        
        // Regular admins can view all analyses
        if (userContext.role === 'admin' || (userContext.permissions && userContext.permissions.includes('admin'))) {
            return true;
        }

        // Services with special permission can view all analyses
        if (userContext.service && userContext.service.can_view_all_analyses) {
            return true;
        }

        return false;
    }

    /**
     * Get organization setting value
     * @private
     * @param {string} settingKey - Setting key
     * @returns {Promise<string|null>} Setting value
     */
    async _getOrganizationSetting(settingKey) {
        try {
            const result = await db.sequelize.query(
                'SELECT get_organization_setting(:settingKey) as value',
                {
                    replacements: { settingKey },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            return result[0].value;
        } catch (error) {
            console.error('Get organization setting error:', error);
            return null;
        }
    }
}

module.exports = new AnalysisService();