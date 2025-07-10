// services/patientService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const encryptedSearchService = require('./encryptedSearchService');

/**
 * Service for managing patients
 */
class PatientService {
    /**
     * Create a new patient
     * @param {Object} data - Patient data
     * @param {string} data.name - Patient name
     * @param {string} data.matriculeNational - National ID number
     * @param {Date} [data.dateOfBirth] - Date of birth
     * @param {string} [data.gender] - Gender (Male, Female, Other)
     * @param {string} [data.phone] - Phone number
     * @param {string} [data.address] - Address
     * @param {number} [data.roomId] - Room ID
     * @param {number} [data.doctorId] - Doctor ID
     * @param {number} data.createdBy - User ID creating the patient
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createPatient(data, context) {
        try {
            const {
                name,
                matriculeNational,
                dateOfBirth,
                gender,
                phone,
                address,
                roomId,
                doctorId,
                createdBy
            } = data;

            // Check if matricule national already exists
            const existingPatient = await db.Patient.findOne({
                where: { matricule_national: matriculeNational }
            });

            if (existingPatient) {
                return {
                    success: false,
                    message: 'Patient with this national ID already exists'
                };
            }

            // Validate room if provided
            if (roomId) {
                const room = await db.Room.findByPk(roomId);
                if (!room) {
                    return {
                        success: false,
                        message: 'Selected room not found'
                    };
                }
            }

            // Validate doctor if provided
            if (doctorId) {
                const doctor = await db.Doctor.findByPk(doctorId);
                if (!doctor || !doctor.active) {
                    return {
                        success: false,
                        message: 'Selected doctor not found or inactive'
                    };
                }
            }

            // Create search hashes for encrypted fields
            const searchHashes = encryptedSearchService.createPatientSearchHashes({
                name,
                matricule_national: matriculeNational
            });

            // Create the patient
            const patient = await db.Patient.create({
                name,
                matricule_national: matriculeNational,
                date_of_birth: dateOfBirth || null,
                gender: gender || null,
                phone: phone || null,
                address: address || null,
                room_id: roomId || null,
                doctor_id: doctorId || null,
                created_by: createdBy,
                ...searchHashes
            });

            // Log the creation
            await logService.auditLog({
                eventType: 'patient.created',
                userId: createdBy,
                targetId: patient.id,
                targetType: 'patient',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    // Don't log encrypted data in plain text
                    hasName: !!name,
                    hasMatricule: !!matriculeNational,
                    roomId,
                    doctorId,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                patientId: patient.id,
                message: 'Patient created successfully'
            };
        } catch (error) {
            console.error('Create patient error:', error);
            return {
                success: false,
                message: 'Failed to create patient'
            };
        }
    }

    /**
     * Get patient by ID with related data
     * @param {number} patientId - Patient ID
     * @returns {Promise<Object>} Patient data or error
     */
    async getPatientById(patientId) {
        try {
            const patient = await db.Patient.findByPk(patientId, {
                include: [
                    { association: 'doctor' },
                    { association: 'room' },
                    { association: 'creator', attributes: ['id', 'username'] },
                    {
                        association: 'analyses',
                        limit: 10,
                        order: [['analysis_date', 'DESC']]
                    }
                ]
            });

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            return {
                success: true,
                data: patient
            };
        } catch (error) {
            console.error('Get patient error:', error);
            return {
                success: false,
                message: 'Failed to retrieve patient'
            };
        }
    }

    /**
     * Get patients with filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.name] - Filter by name
     * @param {string} [filters.matriculeNational] - Filter by national ID
     * @param {number} [filters.doctorId] - Filter by doctor
     * @param {number} [filters.roomId] - Filter by room
     * @param {boolean} [filters.active] - Filter by active status
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated patients
     */
    async getPatients(filters = {}, page = 1, limit = 20) {
        try {
            // If searching by name or matricule, use encrypted search
            if (filters.name || filters.matriculeNational) {
                const searchTerm = filters.name || filters.matriculeNational;
                const searchOptions = {
                    limit: limit * 2, // Get more results to account for filtering
                    activeOnly: filters.active !== false,
                    includeAssociations: true
                };

                // Add additional filters
                if (filters.doctorId) {
                    searchOptions.doctorId = filters.doctorId;
                }
                if (filters.roomId) {
                    searchOptions.roomId = filters.roomId;
                }

                const result = await encryptedSearchService.searchPatients(searchTerm, searchOptions);
                
                // Simulate pagination on filtered results
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedPatients = result.patients.slice(startIndex, endIndex);

                return {
                    success: true,
                    patients: paginatedPatients,
                    total: result.patients.length,
                    page,
                    totalPages: Math.ceil(result.patients.length / limit),
                    limit
                };
            }

            // Regular filtering for non-encrypted fields
            const whereClause = {};

            if (filters.doctorId) {
                whereClause.doctor_id = filters.doctorId;
            }

            if (filters.roomId) {
                whereClause.room_id = filters.roomId;
            }

            if (filters.active !== undefined) {
                whereClause.active = filters.active;
            }

            const offset = (page - 1) * limit;

            // Get patients with pagination - optimize for admin table view
            const { count, rows } = await db.Patient.findAndCountAll({
                where: whereClause,
                attributes: [
                    'id', 'name', 'matricule_national', 'date_of_birth', 
                    'gender', 'phone', 'active', 'created_at', 'doctor_id', 'room_id'
                ], // Only essential fields
                include: [
                    { 
                        association: 'doctor', 
                        attributes: ['id', 'name'],
                        required: false // LEFT JOIN to avoid filtering out patients without doctors
                    },
                    { 
                        association: 'room', 
                        attributes: ['id', 'room_number'],
                        required: false // LEFT JOIN to avoid filtering out patients without rooms
                    }
                ],
                order: [['id', 'DESC']], // Show newest first, by ID for performance
                limit,
                offset
            });

            return {
                success: true,
                patients: rows,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                limit
            };
        } catch (error) {
            console.error('Get patients error:', error);
            return {
                success: false,
                message: 'Failed to retrieve patients'
            };
        }
    }

    /**
     * Update patient information
     * @param {number} patientId - Patient ID
     * @param {Object} updateData - Fields to update
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updatePatient(patientId, updateData, userId, context) {
        try {
            const patient = await db.Patient.findByPk(patientId);

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            // Store old values for logging
            const oldValues = {
                name: patient.name,
                matricule_national: patient.matricule_national,
                date_of_birth: patient.date_of_birth,
                gender: patient.gender,
                phone: patient.phone,
                address: patient.address,
                room_id: patient.room_id,
                doctor_id: patient.doctor_id,
                active: patient.active
            };

            // Validate matricule national if being updated
            if (updateData.matriculeNational && updateData.matriculeNational !== patient.matricule_national) {
                const existingPatient = await db.Patient.findOne({
                    where: {
                        matricule_national: updateData.matriculeNational,
                        id: { [Op.ne]: patientId }
                    }
                });

                if (existingPatient) {
                    return {
                        success: false,
                        message: 'Patient with this national ID already exists'
                    };
                }
            }

            // Validate room if being updated
            if (updateData.roomId) {
                const room = await db.Room.findByPk(updateData.roomId);
                if (!room) {
                    return {
                        success: false,
                        message: 'Selected room not found'
                    };
                }
            }

            // Validate doctor if being updated
            if (updateData.doctorId) {
                const doctor = await db.Doctor.findByPk(updateData.doctorId);
                if (!doctor || !doctor.active) {
                    return {
                        success: false,
                        message: 'Selected doctor not found or inactive'
                    };
                }
            }

            // Update patient
            await patient.update({
                name: updateData.name || patient.name,
                matricule_national: updateData.matriculeNational || patient.matricule_national,
                date_of_birth: updateData.dateOfBirth !== undefined ? updateData.dateOfBirth : patient.date_of_birth,
                gender: updateData.gender !== undefined ? updateData.gender : patient.gender,
                phone: updateData.phone !== undefined ? updateData.phone : patient.phone,
                address: updateData.address !== undefined ? updateData.address : patient.address,
                room_id: updateData.roomId !== undefined ? updateData.roomId : patient.room_id,
                doctor_id: updateData.doctorId !== undefined ? updateData.doctorId : patient.doctor_id,
                active: updateData.active !== undefined ? updateData.active : patient.active
            });

            // Update search hashes if name or matricule changed
            if (updateData.name || updateData.matriculeNational) {
                await encryptedSearchService.updatePatientSearchHashes(patientId, {
                    name: updateData.name,
                    matricule_national: updateData.matriculeNational
                });
            }

            // Log the update
            await logService.auditLog({
                eventType: 'patient.updated',
                userId,
                targetId: patientId,
                targetType: 'patient',
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
                message: 'Patient updated successfully'
            };
        } catch (error) {
            console.error('Update patient error:', error);
            return {
                success: false,
                message: 'Failed to update patient'
            };
        }
    }

    /**
     * Deactivate a patient (soft delete)
     * @param {number} patientId - Patient ID
     * @param {number} userId - User ID performing the deactivation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Deactivation result
     */
    async deactivatePatient(patientId, userId, context) {
        try {
            const patient = await db.Patient.findByPk(patientId);

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            if (!patient.active) {
                return {
                    success: false,
                    message: 'Patient is already inactive'
                };
            }

            // Check for active analyses
            const activeAnalyses = await db.Analysis.findAll({
                where: {
                    patient_id: patientId,
                    status: { [Op.in]: ['Pending', 'Delayed', 'In Progress'] }
                }
            });

            if (activeAnalyses.length > 0) {
                return {
                    success: false,
                    message: `Cannot deactivate patient with ${activeAnalyses.length} active analysis(es)`
                };
            }

            // Deactivate patient
            patient.active = false;
            await patient.save();

            // Log the deactivation
            await logService.auditLog({
                eventType: 'patient.deactivated',
                userId,
                targetId: patientId,
                targetType: 'patient',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    patientName: patient.name,
                    matriculeNational: patient.matricule_national,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Patient deactivated successfully'
            };
        } catch (error) {
            console.error('Deactivate patient error:', error);
            return {
                success: false,
                message: 'Failed to deactivate patient'
            };
        }
    }

    /**
     * Reactivate a patient
     * @param {number} patientId - Patient ID
     * @param {number} userId - User ID performing the reactivation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Reactivation result
     */
    async reactivatePatient(patientId, userId, context) {
        try {
            const patient = await db.Patient.findByPk(patientId);

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            if (patient.active) {
                return {
                    success: false,
                    message: 'Patient is already active'
                };
            }

            // Reactivate patient
            patient.active = true;
            await patient.save();

            // Log the reactivation
            await logService.auditLog({
                eventType: 'patient.reactivated',
                userId,
                targetId: patientId,
                targetType: 'patient',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    patientName: patient.name,
                    matriculeNational: patient.matricule_national,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Patient reactivated successfully'
            };
        } catch (error) {
            console.error('Reactivate patient error:', error);
            return {
                success: false,
                message: 'Failed to reactivate patient'
            };
        }
    }

    /**
     * Get patient analysis history
     * @param {number} patientId - Patient ID
     * @param {number} [page=1] - Page number
     * @param {number} [limit=10] - Results per page
     * @returns {Promise<Object>} Patient analysis history
     */
    async getPatientAnalysisHistory(patientId, page = 1, limit = 10) {
        try {
            const patient = await db.Patient.findByPk(patientId);

            if (!patient) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            const offset = (page - 1) * limit;

            // Get current analyses
            const { count: currentCount, rows: currentAnalyses } = await db.Analysis.findAndCountAll({
                where: { patient_id: patientId },
                include: [
                    { association: 'doctor', attributes: ['id', 'name'] },
                    { association: 'room', attributes: ['id', 'room_number'] }
                ],
                order: [['analysis_date', 'DESC']],
                limit,
                offset
            });

            // Get archived analyses
            const { count: archivedCount, rows: archivedAnalyses } = await db.ArchivedAnalysis.findAndCountAll({
                where: { patient_id: patientId },
                include: [
                    { association: 'doctor', attributes: ['id', 'name'] },
                    { association: 'room', attributes: ['id', 'room_number'] }
                ],
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
                currentAnalyses: {
                    analyses: currentAnalyses,
                    total: currentCount,
                    page,
                    totalPages: Math.ceil(currentCount / limit)
                },
                archivedAnalyses: {
                    analyses: archivedAnalyses,
                    total: archivedCount,
                    page,
                    totalPages: Math.ceil(archivedCount / limit)
                }
            };
        } catch (error) {
            console.error('Get patient analysis history error:', error);
            return {
                success: false,
                message: 'Failed to retrieve patient analysis history'
            };
        }
    }

    /**
     * Search patients by name or national ID
     * @param {string} searchTerm - Search term
     * @param {number} [limit=10] - Maximum results
     * @returns {Promise<Object>} Search results
     */
    async searchPatients(searchTerm, limit = 10) {
        try {
            // Use encrypted search service for searching encrypted patient data
            const result = await encryptedSearchService.searchPatients(searchTerm, {
                limit,
                activeOnly: true,
                includeAssociations: true
            });

            return {
                success: true,
                patients: result.patients || []
            };
        } catch (error) {
            console.error('Search patients error:', error);
            return {
                success: false,
                message: 'Failed to search patients'
            };
        }
    }
}

module.exports = new PatientService();