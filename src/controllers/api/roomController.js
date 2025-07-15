// controllers/roomController.js
const roomService = require('../../services/roomService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Room controller for managing hospital rooms
 */
class RoomController {

    /**
     * Create a new room
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createRoom(req, res) {
        try {
            const { roomNumber, serviceId, capacity } = req.body;
            const { userId } = req.auth;

            // Validate required fields
            if (!roomNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Room number is required'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.createRoom({
                roomNumber,
                serviceId: serviceId ? parseInt(serviceId) : null,
                capacity: capacity ? parseInt(capacity) : 1,
                createdBy: userId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create room'
            });
        }
    }

    /**
     * Get room by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getRoomById(req, res) {
        try {
            const { id } = req.params;

            // Validate room ID
            const roomId = parseInt(id);
            if (isNaN(roomId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid room ID'
                });
            }

            const result = await roomService.getRoomById(roomId);

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Get room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve room'
            });
        }
    }

    /**
     * Get rooms with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getRooms(req, res) {
        try {
            const {
                roomNumber,
                serviceId,
                active,
                page = 1,
                limit = 20
            } = req.query;

            const filters = {
                roomNumber,
                serviceId: serviceId ? parseInt(serviceId) : null,
                active: active !== undefined ? active === 'true' : undefined
            };

            const result = await roomService.getRooms(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve rooms'
            });
        }
    }

    /**
     * Update room
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateRoom(req, res) {
        try {
            const { id } = req.params;
            const { roomNumber, serviceId, capacity, active } = req.body;
            const { userId } = req.auth;

            // Validate room ID
            const roomId = parseInt(id);
            if (isNaN(roomId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid room ID'
                });
            }

            const updateData = {
                roomNumber,
                serviceId: serviceId !== undefined ? (serviceId ? parseInt(serviceId) : null) : undefined,
                capacity: capacity ? parseInt(capacity) : undefined,
                active: active !== undefined ? active : undefined
            };

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.updateRoom(
                roomId,
                updateData,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update room'
            });
        }
    }

    /**
     * Deactivate room
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deactivateRoom(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            // Validate room ID
            const roomId = parseInt(id);
            if (isNaN(roomId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid room ID'
                });
            }

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.deactivateRoom(
                roomId,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Deactivate room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to deactivate room'
            });
        }
    }

    /**
     * Reactivate room
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async reactivateRoom(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.auth;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.reactivateRoom(
                parseInt(id),
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Reactivate room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reactivate room'
            });
        }
    }

    /**
     * Get room occupancy report
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getRoomOccupancyReport(req, res) {
        try {
            const { serviceId } = req.query;

            const result = await roomService.getRoomOccupancyReport(
                serviceId ? parseInt(serviceId) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get room occupancy report error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve occupancy report'
            });
        }
    }

    /**
     * Search rooms
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async searchRooms(req, res) {
        try {
            const { term } = req.params;
            const { limit = 10 } = req.query;

            const result = await roomService.searchRooms(term, parseInt(limit));

            return res.status(200).json(result);
        } catch (error) {
            console.error('Search rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search rooms'
            });
        }
    }

    /**
     * Get available rooms
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAvailableRooms(req, res) {
        try {
            const { serviceId } = req.query;

            const result = await roomService.getAvailableRooms(
                serviceId ? parseInt(serviceId) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get available rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve available rooms'
            });
        }
    }

    /**
     * Get services list (replaces getDepartments)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getServices(req, res) {
        try {
            const result = await roomService.getServices();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get services error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve services'
            });
        }
    }
}

module.exports = new RoomController();