// controllers/patientController.js
const patientService = require('../../services/patientService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Patient controller for managing patients
 */
class PatientController {

    /**
     * Create a new patient
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createPatient(req, res) {
        try {
            const {
                firstName,
                lastName,
                matriculeNational,
                dateOfBirth,
                gender,
                phone,
                address,
                roomId,
                doctorId
            } = req.body;
            const { userId } = req.auth;

            // Validate required fields
            if (!firstName || !matriculeNational) {
                return res.status(400).json({
                    success: false,
                    message: 'Patient first name and national ID are required'
                });
            }

            // Validate gender if provided
            if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid gender value'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await patientService.createPatient({
                firstName,
                lastName,
                matriculeNational,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                phone,
                address,
                roomId: roomId ? parseInt(roomId) : null,
                doctorId: doctorId ? parseInt(doctorId) : null,
                createdBy: userId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create patient'
            });
        }
    }

    /**
     * Get patient by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPatientById(req, res) {
        try {
            const { id } = req.params;

            const result = await patientService.getPatientById(parseInt(id));

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Get patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patient'
            });
        }
    }

    /**
     * Get patients with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPatients(req, res) {
        try {
            const {
                search,
                name,
                matriculeNational,
                doctorId,
                roomId,
                active,
                page = 1,
                limit = 20
            } = req.query;

            const filters = {
                search,
                name,
                matriculeNational,
                doctorId: doctorId ? parseInt(doctorId) : undefined,
                roomId: roomId ? parseInt(roomId) : undefined,
                active: active !== undefined ? active === 'true' : undefined
            };

            const result = await patientService.getPatients(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.patients,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get patients error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patients'
            });
        }
    }

    /**
     * Update patient
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updatePatient(req, res) {
        try {
            const { id } = req.params;
            const {
                firstName,
                lastName,
                matriculeNational,
                dateOfBirth,
                gender,
                phone,
                address,
                roomId,
                doctorId,
                active
            } = req.body;
            const { userId } = req.auth;

            // Validate gender if provided
            if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid gender value'
                });
            }

            const updateData = {
                firstName,
                lastName,
                matriculeNational,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                gender,
                phone,
                address,
                roomId: roomId ? parseInt(roomId) : undefined,
                doctorId: doctorId ? parseInt(doctorId) : undefined,
                active: active !== undefined ? active : undefined
            };

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await patientService.updatePatient(
                parseInt(id),
                updateData,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update patient'
            });
        }
    }

    /**
     * Deactivate patient
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deactivatePatient(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await patientService.deactivatePatient(
                parseInt(id),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Deactivate patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to deactivate patient'
            });
        }
    }

    /**
     * Reactivate patient
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async reactivatePatient(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await patientService.reactivatePatient(
                parseInt(id),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Reactivate patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reactivate patient'
            });
        }
    }

    /**
     * Get patient's analysis history
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPatientAnalysisHistory(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const result = await patientService.getPatientAnalysisHistory(
                parseInt(id),
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                patient: result.patient,
                currentAnalyses: result.currentAnalyses,
                archivedAnalyses: result.archivedAnalyses
            });
        } catch (error) {
            console.error('Get patient analysis history error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patient analysis history'
            });
        }
    }

    /**
     * Search patients
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async searchPatients(req, res) {
        try {
            const { term } = req.params;
            const { limit = 10 } = req.query;

            const result = await patientService.searchPatients(term, parseInt(limit));

            return res.status(200).json(result);
        } catch (error) {
            console.error('Search patients error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search patients'
            });
        }
    }
}

module.exports = new PatientController();