// controllers/doctorController.js
const doctorService = require('../../services/doctorService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Doctor controller for managing doctors
 */
class DoctorController {

    /**
     * Create a new doctor
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createDoctor(req, res) {
        try {
            const { name, specialization, phone, email } = req.body;
            const { userId } = req.auth;

            // Validate required fields
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Doctor name is required'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await doctorService.createDoctor({
                name,
                specialization,
                phone,
                email,
                createdBy: userId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create doctor error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create doctor'
            });
        }
    }

    /**
     * Get doctor by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDoctorById(req, res) {
        try {
            const { id } = req.params;

            const result = await doctorService.getDoctorById(parseInt(id));

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Get doctor error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctor'
            });
        }
    }

    /**
     * Get doctors with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDoctors(req, res) {
        try {
            const {
                name,
                specialization,
                active,
                page = 1,
                limit = 20
            } = req.query;

            const filters = {
                name,
                specialization,
                active: active !== undefined ? active === 'true' : undefined
            };

            const result = await doctorService.getDoctors(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.doctors,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            console.error('Get doctors error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctors'
            });
        }
    }

    /**
     * Update doctor
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateDoctor(req, res) {
        try {
            const { id } = req.params;
            const { name, specialization, phone, email, active } = req.body;
            const { userId } = req.auth;

            const updateData = {
                name,
                specialization,
                phone,
                email,
                active: active !== undefined ? active : undefined
            };

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await doctorService.updateDoctor(
                parseInt(id),
                updateData,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update doctor error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update doctor'
            });
        }
    }

    /**
     * Deactivate doctor
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deactivateDoctor(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await doctorService.deactivateDoctor(
                parseInt(id),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Deactivate doctor error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to deactivate doctor'
            });
        }
    }

    /**
     * Reactivate doctor
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async reactivateDoctor(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await doctorService.reactivateDoctor(
                parseInt(id),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Reactivate doctor error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reactivate doctor'
            });
        }
    }

    /**
     * Get doctor's schedule
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDoctorSchedule(req, res) {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;

            const result = await doctorService.getDoctorSchedule(
                parseInt(id),
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get doctor schedule error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctor schedule'
            });
        }
    }

    /**
     * Get doctor statistics
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDoctorStatistics(req, res) {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;

            const result = await doctorService.getDoctorStatistics(
                parseInt(id),
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null
            );

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get doctor statistics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctor statistics'
            });
        }
    }

    /**
     * Search doctors
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async searchDoctors(req, res) {
        try {
            const { term } = req.params;
            const { limit = 10 } = req.query;

            const result = await doctorService.searchDoctors(term, parseInt(limit));

            return res.status(200).json(result);
        } catch (error) {
            console.error('Search doctors error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search doctors'
            });
        }
    }
}

module.exports = new DoctorController();