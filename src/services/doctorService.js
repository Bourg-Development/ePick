// services/doctorService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');

/**
 * Service for managing doctors
 */
class DoctorService {
    /**
     * Create a new doctor
     * @param {Object} data - Doctor data
     * @param {string} data.name - Doctor name
     * @param {string} [data.specialization] - Medical specialization
     * @param {string} [data.phone] - Phone number
     * @param {string} [data.email] - Email address
     * @param {number} data.createdBy - User ID creating the doctor
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createDoctor(data, context) {
        try {
            const {
                name,
                specialization,
                phone,
                email,
                createdBy
            } = data;

            // Validate email format if provided
            if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return {
                    success: false,
                    message: 'Invalid email format'
                };
            }

            // Check if doctor with same email already exists
            if (email) {
                const existingDoctor = await db.Doctor.findOne({
                    where: { email, active: true }
                });

                if (existingDoctor) {
                    return {
                        success: false,
                        message: 'Doctor with this email already exists'
                    };
                }
            }

            // Create the doctor
            const doctor = await db.Doctor.create({
                name,
                specialization: specialization || null,
                phone: phone || null,
                email: email || null,
                created_by: createdBy
            });

            // Log the creation
            await logService.auditLog({
                eventType: 'doctor.created',
                userId: createdBy,
                targetId: doctor.id,
                targetType: 'doctor',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    name,
                    specialization,
                    email,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                doctorId: doctor.id,
                message: 'Doctor created successfully'
            };
        } catch (error) {
            console.error('Create doctor error:', error);
            return {
                success: false,
                message: 'Failed to create doctor'
            };
        }
    }

    /**
     * Get doctor by ID with related data
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Object>} Doctor data or error
     */
    async getDoctorById(doctorId) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId, {
                include: [
                    { association: 'creator', attributes: ['id', 'username'] },
                    {
                        association: 'patients',
                        where: { active: true },
                        required: false,
                        limit: 10,
                        order: [['name', 'ASC']]
                    },
                    {
                        association: 'analyses',
                        where: { status: { [Op.in]: ['Pending', 'Delayed', 'In Progress'] } },
                        required: false,
                        limit: 10,
                        order: [['analysis_date', 'ASC']],
                        include: [
                            { association: 'patient', attributes: ['id', 'name'] }
                        ]
                    }
                ]
            });

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            return {
                success: true,
                data: doctor
            };
        } catch (error) {
            console.error('Get doctor error:', error);
            return {
                success: false,
                message: 'Failed to retrieve doctor'
            };
        }
    }

    /**
     * Get doctors with filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.name] - Filter by name
     * @param {string} [filters.specialization] - Filter by specialization
     * @param {boolean} [filters.active] - Filter by active status
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated doctors
     */
    async getDoctors(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            // Apply filters
            if (filters.name) {
                whereClause.name = { [Op.iLike]: `%${filters.name}%` };
            }

            if (filters.specialization) {
                whereClause.specialization = { [Op.iLike]: `%${filters.specialization}%` };
            }

            if (filters.active !== undefined) {
                whereClause.active = filters.active;
            }

            const offset = (page - 1) * limit;

            // Get doctors with pagination
            const { count, rows } = await db.Doctor.findAndCountAll({
                where: whereClause,
                include: [
                    { association: 'creator', attributes: ['id', 'username'] }
                ],
                order: [['name', 'ASC']],
                limit,
                offset
            });

            // Add patient and analysis counts for each doctor
            const doctorsWithCounts = await Promise.all(
                rows.map(async (doctor) => {
                    const patientCount = await db.Patient.count({
                        where: { doctor_id: doctor.id, active: true }
                    });

                    const activeAnalysesCount = await db.Analysis.count({
                        where: {
                            doctor_id: doctor.id,
                            status: { [Op.in]: ['Pending', 'Delayed', 'In Progress'] }
                        }
                    });

                    return {
                        ...doctor.toJSON(),
                        patientCount,
                        activeAnalysesCount
                    };
                })
            );

            return {
                success: true,
                doctors: doctorsWithCounts,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get doctors error:', error);
            return {
                success: false,
                message: 'Failed to retrieve doctors'
            };
        }
    }

    /**
     * Update doctor information
     * @param {number} doctorId - Doctor ID
     * @param {Object} updateData - Fields to update
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateDoctor(doctorId, updateData, userId, context) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            // Store old values for logging
            const oldValues = {
                name: doctor.name,
                specialization: doctor.specialization,
                phone: doctor.phone,
                email: doctor.email,
                active: doctor.active
            };

            // Validate email format if being updated
            if (updateData.email && !updateData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return {
                    success: false,
                    message: 'Invalid email format'
                };
            }

            // Check if email is already taken by another doctor
            if (updateData.email && updateData.email !== doctor.email) {
                const existingDoctor = await db.Doctor.findOne({
                    where: {
                        email: updateData.email,
                        active: true,
                        id: { [Op.ne]: doctorId }
                    }
                });

                if (existingDoctor) {
                    return {
                        success: false,
                        message: 'Email already taken by another doctor'
                    };
                }
            }

            // Update doctor
            await doctor.update({
                name: updateData.name || doctor.name,
                specialization: updateData.specialization !== undefined ? updateData.specialization : doctor.specialization,
                phone: updateData.phone !== undefined ? updateData.phone : doctor.phone,
                email: updateData.email !== undefined ? updateData.email : doctor.email,
                active: updateData.active !== undefined ? updateData.active : doctor.active
            });

            // Log the update
            await logService.auditLog({
                eventType: 'doctor.updated',
                userId,
                targetId: doctorId,
                targetType: 'doctor',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    oldValues,
                    newValues: updateData,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Doctor updated successfully'
            };
        } catch (error) {
            console.error('Update doctor error:', error);
            return {
                success: false,
                message: 'Failed to update doctor'
            };
        }
    }

    /**
     * Deactivate a doctor (soft delete)
     * @param {number} doctorId - Doctor ID
     * @param {number} userId - User ID performing the deactivation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Deactivation result
     */
    async deactivateDoctor(doctorId, userId, context) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            if (!doctor.active) {
                return {
                    success: false,
                    message: 'Doctor is already inactive'
                };
            }

            // Check for active analyses
            const activeAnalyses = await db.Analysis.findAll({
                where: {
                    doctor_id: doctorId,
                    status: { [Op.in]: ['Pending', 'Delayed', 'In Progress'] }
                }
            });

            if (activeAnalyses.length > 0) {
                return {
                    success: false,
                    message: `Cannot deactivate doctor with ${activeAnalyses.length} active analysis(es)`
                };
            }

            // Deactivate doctor
            doctor.active = false;
            await doctor.save();

            // Log the deactivation
            await logService.auditLog({
                eventType: 'doctor.deactivated',
                userId,
                targetId: doctorId,
                targetType: 'doctor',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    doctorName: doctor.name,
                    specialization: doctor.specialization,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Doctor deactivated successfully'
            };
        } catch (error) {
            console.error('Deactivate doctor error:', error);
            return {
                success: false,
                message: 'Failed to deactivate doctor'
            };
        }
    }

    /**
     * Reactivate a doctor
     * @param {number} doctorId - Doctor ID
     * @param {number} userId - User ID performing the reactivation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Reactivation result
     */
    async reactivateDoctor(doctorId, userId, context) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            if (doctor.active) {
                return {
                    success: false,
                    message: 'Doctor is already active'
                };
            }

            // Reactivate doctor
            doctor.active = true;
            await doctor.save();

            // Log the reactivation
            await logService.auditLog({
                eventType: 'doctor.reactivated',
                userId,
                targetId: doctorId,
                targetType: 'doctor',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    doctorName: doctor.name,
                    specialization: doctor.specialization,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Doctor reactivated successfully'
            };
        } catch (error) {
            console.error('Reactivate doctor error:', error);
            return {
                success: false,
                message: 'Failed to reactivate doctor'
            };
        }
    }

    /**
     * Get doctor's schedule and workload
     * @param {number} doctorId - Doctor ID
     * @param {Date} [startDate] - Start date for schedule
     * @param {Date} [endDate] - End date for schedule
     * @returns {Promise<Object>} Doctor schedule
     */
    async getDoctorSchedule(doctorId, startDate = null, endDate = null) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            // Default to current week if no dates provided
            if (!startDate) {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
            }

            if (!endDate) {
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6); // End of week
            }

            // Get analyses in date range
            const analyses = await db.Analysis.findAll({
                where: {
                    doctor_id: doctorId,
                    analysis_date: {
                        [Op.between]: [startDate, endDate]
                    }
                },
                include: [
                    { association: 'patient', attributes: ['id', 'name'] },
                    { association: 'room', attributes: ['id', 'room_number'] }
                ],
                order: [['analysis_date', 'ASC'], ['priority', 'ASC']]
            });

            // Group analyses by date
            const schedule = {};
            analyses.forEach(analysis => {
                const dateKey = analysis.analysis_date.toISOString().split('T')[0];
                if (!schedule[dateKey]) {
                    schedule[dateKey] = [];
                }
                schedule[dateKey].push(analysis);
            });

            // Get workload statistics
            const totalAnalyses = analyses.length;
            const pendingCount = analyses.filter(a => a.status === 'Pending').length;
            const delayedCount = analyses.filter(a => a.status === 'Delayed').length;
            const completedCount = analyses.filter(a => a.status === 'Completed').length;

            return {
                success: true,
                doctor: {
                    id: doctor.id,
                    name: doctor.name,
                    specialization: doctor.specialization
                },
                schedule,
                statistics: {
                    totalAnalyses,
                    pendingCount,
                    delayedCount,
                    completedCount
                },
                dateRange: {
                    startDate,
                    endDate
                }
            };
        } catch (error) {
            console.error('Get doctor schedule error:', error);
            return {
                success: false,
                message: 'Failed to retrieve doctor schedule'
            };
        }
    }

    /**
     * Search doctors by name or specialization
     * Note: Due to data encryption, this search has limitations
     * @param {string} searchTerm - Search term
     * @param {number} [limit=10] - Maximum results
     * @returns {Promise<Object>} Search results
     */
    async searchDoctors(searchTerm, limit = 10) {
        try {
            // Since doctor data is encrypted but we don't have search hashes yet,
            // we'll return all active doctors and let the client filter
            // This is a temporary solution until we implement doctor search hashes
            
            const doctors = await db.Doctor.findAll({
                where: {
                    active: true
                },
                attributes: ['id', 'name', 'specialization', 'email'],
                limit: Math.min(limit * 3, 50), // Get more results since we can't filter efficiently
                order: [['created_at', 'DESC']]
            });

            return {
                success: true,
                doctors
            };
        } catch (error) {
            console.error('Search doctors error:', error);
            return {
                success: false,
                message: 'Failed to search doctors'
            };
        }
    }

    /**
     * Get doctor statistics
     * @param {number} doctorId - Doctor ID
     * @param {Date} [startDate] - Start date for statistics
     * @param {Date} [endDate] - End date for statistics
     * @returns {Promise<Object>} Doctor statistics
     */
    async getDoctorStatistics(doctorId, startDate = null, endDate = null) {
        try {
            const doctor = await db.Doctor.findByPk(doctorId);

            if (!doctor) {
                return {
                    success: false,
                    message: 'Doctor not found'
                };
            }

            // Default to last 30 days if no dates provided
            if (!startDate) {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
            }

            if (!endDate) {
                endDate = new Date();
            }

            // Get analysis statistics
            const totalAnalyses = await db.Analysis.count({
                where: {
                    doctor_id: doctorId,
                    analysis_date: { [Op.between]: [startDate, endDate] }
                }
            });

            const completedAnalyses = await db.Analysis.count({
                where: {
                    doctor_id: doctorId,
                    status: 'Completed',
                    analysis_date: { [Op.between]: [startDate, endDate] }
                }
            });

            const analysisTypes = await db.Analysis.findAll({
                where: {
                    doctor_id: doctorId,
                    analysis_date: { [Op.between]: [startDate, endDate] }
                },
                attributes: [
                    'analysis_type',
                    [db.sequelize.fn('COUNT', db.sequelize.col('analysis_type')), 'count']
                ],
                group: ['analysis_type'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('analysis_type')), 'DESC']]
            });

            const patientCount = await db.Patient.count({
                where: { doctor_id: doctorId, active: true }
            });

            return {
                success: true,
                statistics: {
                    totalAnalyses,
                    completedAnalyses,
                    completionRate: totalAnalyses > 0 ? (completedAnalyses / totalAnalyses * 100).toFixed(2) : 0,
                    analysisTypes: analysisTypes.map(at => ({
                        type: at.analysis_type,
                        count: parseInt(at.dataValues.count)
                    })),
                    patientCount
                },
                dateRange: {
                    startDate,
                    endDate
                }
            };
        } catch (error) {
            console.error('Get doctor statistics error:', error);
            return {
                success: false,
                message: 'Failed to retrieve doctor statistics'
            };
        }
    }
}

module.exports = new DoctorService();