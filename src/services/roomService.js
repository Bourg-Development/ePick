// services/roomService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');

/**
 * Service for managing hospital rooms
 */
class RoomService {
    /**
     * Create a new room
     * @param {Object} data - Room data
     * @param {string} data.roomNumber - 4-digit room number
     * @param {number} [data.serviceId] - Service ID
     * @param {number} [data.capacity] - Room capacity (default: 1)
     * @param {number} data.createdBy - User ID creating the room
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createRoom(data, context) {
        try {
            const {
                roomNumber,
                serviceId,
                capacity = 1,
                createdBy
            } = data;

            // Validate room number format (4 digits)
            if (!roomNumber.match(/^\d{4}$/)) {
                return {
                    success: false,
                    message: 'Room number must be exactly 4 digits'
                };
            }

            // Check if room number already exists
            const existingRoom = await db.Room.findOne({
                where: { room_number: roomNumber }
            });

            if (existingRoom) {
                return {
                    success: false,
                    message: 'Room with this number already exists'
                };
            }

            // Validate capacity
            if (capacity < 1) {
                return {
                    success: false,
                    message: 'Room capacity must be at least 1'
                };
            }

            // Validate service exists if provided
            if (serviceId) {
                const service = await db.Service.findByPk(serviceId);
                if (!service) {
                    return {
                        success: false,
                        message: 'Service not found'
                    };
                }
                if (!service.active) {
                    return {
                        success: false,
                        message: 'Cannot assign room to inactive service'
                    };
                }
            }

            // Create the room
            const room = await db.Room.create({
                room_number: roomNumber,
                service_id: serviceId || null,
                capacity,
                created_by: createdBy
            });

            // Log the creation
            await logService.auditLog({
                eventType: 'room.created',
                userId: createdBy,
                targetId: room.id,
                targetType: 'room',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    roomNumber,
                    serviceId,
                    capacity,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                roomId: room.id,
                message: 'Room created successfully'
            };
        } catch (error) {
            console.error('Create room error:', error);
            return {
                success: false,
                message: 'Failed to create room'
            };
        }
    }

    /**
     * Get room by ID with related data
     * @param {number} roomId - Room ID
     * @returns {Promise<Object>} Room data or error
     */
    async getRoomById(roomId) {
        try {
            const room = await db.Room.findByPk(roomId, {
                include: [
                    {
                        association: 'creator',
                        attributes: ['id', 'username']
                    },
                    {
                        association: 'service',
                        attributes: ['id', 'name', 'email']
                    },
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

            if (!room) {
                return {
                    success: false,
                    message: 'Room not found'
                };
            }

            // Calculate occupancy
            const currentPatients = room.patients ? room.patients.length : 0;
            const occupancyRate = room.capacity > 0 ? (currentPatients / room.capacity * 100).toFixed(2) : 0;

            return {
                success: true,
                data: {
                    ...room.toJSON(),
                    currentPatients,
                    occupancyRate: parseFloat(occupancyRate)
                }
            };
        } catch (error) {
            console.error('Get room error:', error);
            return {
                success: false,
                message: 'Failed to retrieve room'
            };
        }
    }

    /**
     * Get rooms with filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {string} [filters.roomNumber] - Filter by room number
     * @param {number} [filters.serviceId] - Filter by service ID
     * @param {boolean} [filters.active] - Filter by active status
     * @param {number} [page=1] - Page number
     * @param {number} [limit=20] - Results per page
     * @returns {Promise<Object>} Paginated rooms
     */
    async getRooms(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            // Apply filters
            if (filters.roomNumber) {
                whereClause.room_number = { [Op.iLike]: `%${filters.roomNumber}%` };
            }

            if (filters.serviceId) {
                whereClause.service_id = filters.serviceId;
            }

            if (filters.active !== undefined) {
                whereClause.active = filters.active;
            }

            const offset = (page - 1) * limit;

            // Get rooms with pagination
            const { count, rows } = await db.Room.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        association: 'creator',
                        attributes: ['id', 'username']
                    },
                    {
                        association: 'service',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [['room_number', 'ASC']],
                limit,
                offset
            });

            return {
                success: true,
                data: rows,
                total: count,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    limit,
                    total: count
                }
            };
        } catch (error) {
            console.error('Get rooms error:', error);
            return {
                success: false,
                message: 'Failed to retrieve rooms'
            };
        }
    }

    /**
     * Update room information
     * @param {number} roomId - Room ID
     * @param {Object} updateData - Fields to update
     * @param {number} userId - User ID performing the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateRoom(roomId, updateData, userId, context) {
        try {
            const room = await db.Room.findByPk(roomId);

            if (!room) {
                return {
                    success: false,
                    message: 'Room not found'
                };
            }

            // Store old values for logging
            const oldValues = {
                room_number: room.room_number,
                service_id: room.service_id,
                capacity: room.capacity,
                active: room.active
            };

            // Validate room number format if being updated
            if (updateData.roomNumber && !updateData.roomNumber.match(/^\d{4}$/)) {
                return {
                    success: false,
                    message: 'Room number must be exactly 4 digits'
                };
            }

            // Check if room number is already taken by another room
            if (updateData.roomNumber && updateData.roomNumber !== room.room_number) {
                const existingRoom = await db.Room.findOne({
                    where: {
                        room_number: updateData.roomNumber,
                        id: { [Op.ne]: roomId }
                    }
                });

                if (existingRoom) {
                    return {
                        success: false,
                        message: 'Room number already taken'
                    };
                }
            }

            // Validate capacity
            if (updateData.capacity !== undefined && updateData.capacity < 1) {
                return {
                    success: false,
                    message: 'Room capacity must be at least 1'
                };
            }

            // Validate service exists if provided
            if (updateData.serviceId !== undefined && updateData.serviceId !== null) {
                const service = await db.Service.findByPk(updateData.serviceId);
                if (!service) {
                    return {
                        success: false,
                        message: 'Service not found'
                    };
                }
                if (!service.active) {
                    return {
                        success: false,
                        message: 'Cannot assign room to inactive service'
                    };
                }
            }

            // Check if reducing capacity would exceed current patient count
            if (updateData.capacity !== undefined && updateData.capacity < room.capacity) {
                const currentPatients = await db.Patient.count({
                    where: { room_id: roomId, active: true }
                });

                if (currentPatients > updateData.capacity) {
                    return {
                        success: false,
                        message: `Cannot reduce capacity to ${updateData.capacity}. Room currently has ${currentPatients} patients.`
                    };
                }
            }

            // Update room
            await room.update({
                room_number: updateData.roomNumber || room.room_number,
                service_id: updateData.serviceId !== undefined ? updateData.serviceId : room.service_id,
                capacity: updateData.capacity !== undefined ? updateData.capacity : room.capacity,
                active: updateData.active !== undefined ? updateData.active : room.active
            });

            // Log the update
            await logService.auditLog({
                eventType: 'room.updated',
                userId,
                targetId: roomId,
                targetType: 'room',
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
                message: 'Room updated successfully'
            };
        } catch (error) {
            console.error('Update room error:', error);
            return {
                success: false,
                message: 'Failed to update room'
            };
        }
    }

    /**
     * Delete a room (hard delete)
     * @param {number} roomId - Room ID
     * @param {number} userId - User ID performing the deletion
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Deletion result
     */
    async deleteRoom(roomId, userId, context) {
        try {
            const room = await db.Room.findByPk(roomId, {
                include: [{ association: 'service', attributes: ['name'] }]
            });

            if (!room) {
                return {
                    success: false,
                    message: 'Room not found'
                };
            }

            // Check for current patients
            const currentPatients = await db.Patient.findAll({
                where: { room_id: roomId, active: true }
            });

            if (currentPatients.length > 0) {
                return {
                    success: false,
                    message: `Cannot delete room with ${currentPatients.length} current patient(s)`
                };
            }

            // Check for active analyses
            const activeAnalyses = await db.Analysis.findAll({
                where: {
                    room_id: roomId,
                    status: { [Op.in]: ['Pending', 'Delayed', 'In Progress'] }
                }
            });

            if (activeAnalyses.length > 0) {
                return {
                    success: false,
                    message: `Cannot delete room with ${activeAnalyses.length} active analysis(es)`
                };
            }

            // Delete the room permanently
            await room.destroy();

            // Log the deletion
            await logService.auditLog({
                eventType: 'room.deleted',
                userId,
                targetId: roomId,
                targetType: 'room',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    roomNumber: room.room_number,
                    serviceName: room.service ? room.service.name : null,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Room deleted successfully'
            };
        } catch (error) {
            console.error('Delete room error:', error);
            return {
                success: false,
                message: 'Failed to delete room'
            };
        }
    }

    /**
     * Reactivate a room
     * @param {number} roomId - Room ID
     * @param {number} userId - User ID performing the reactivation
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Reactivation result
     */
    async reactivateRoom(roomId, userId, context) {
        try {
            const room = await db.Room.findByPk(roomId, {
                include: [{ association: 'service', attributes: ['name'] }]
            });

            if (!room) {
                return {
                    success: false,
                    message: 'Room not found'
                };
            }

            if (room.active) {
                return {
                    success: false,
                    message: 'Room is already active'
                };
            }

            // Reactivate room
            room.active = true;
            await room.save();

            // Log the reactivation
            await logService.auditLog({
                eventType: 'room.reactivated',
                userId,
                targetId: roomId,
                targetType: 'room',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    roomNumber: room.room_number,
                    serviceName: room.service ? room.service.name : null,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Room reactivated successfully'
            };
        } catch (error) {
            console.error('Reactivate room error:', error);
            return {
                success: false,
                message: 'Failed to reactivate room'
            };
        }
    }

    /**
     * Get room occupancy report
     * @param {number} [serviceId] - Filter by service ID
     * @returns {Promise<Object>} Occupancy report
     */
    async getRoomOccupancyReport(serviceId = null) {
        try {
            const whereClause = {};

            if (serviceId) {
                whereClause.service_id = serviceId;
            }

            const rooms = await db.Room.findAll({
                where: whereClause,
                include: [{
                    association: 'service',
                    attributes: ['id', 'name']
                }],
                order: [
                    [{ model: db.Service, as: 'service' }, 'name', 'ASC'],
                    ['room_number', 'ASC']
                ]
            });

            // Calculate occupancy for each room
            const occupancyReport = await Promise.all(
                rooms.map(async (room) => {
                    const currentPatients = await db.Patient.count({
                        where: { room_id: room.id, active: true }
                    });

                    const occupancyRate = room.capacity > 0 ? (currentPatients / room.capacity * 100).toFixed(2) : 0;

                    return {
                        id: room.id,
                        roomNumber: room.room_number,
                        service: room.service ? {
                            id: room.service.id,
                            name: room.service.name
                        } : null,
                        capacity: room.capacity,
                        currentPatients,
                        occupancyRate: parseFloat(occupancyRate),
                        status: currentPatients === 0 ? 'Empty' :
                            currentPatients < room.capacity ? 'Partially Occupied' : 'Full'
                    };
                })
            );

            // Calculate summary statistics
            const totalRooms = occupancyReport.length;
            const totalCapacity = occupancyReport.reduce((sum, room) => sum + room.capacity, 0);
            const totalOccupied = occupancyReport.reduce((sum, room) => sum + room.currentPatients, 0);
            const overallOccupancyRate = totalCapacity > 0 ? (totalOccupied / totalCapacity * 100).toFixed(2) : 0;

            const emptyRooms = occupancyReport.filter(room => room.currentPatients === 0).length;
            const fullRooms = occupancyReport.filter(room => room.currentPatients === room.capacity).length;

            return {
                success: true,
                occupancyReport,
                summary: {
                    totalRooms,
                    totalCapacity,
                    totalOccupied,
                    overallOccupancyRate: parseFloat(overallOccupancyRate),
                    emptyRooms,
                    fullRooms,
                    availableSpaces: totalCapacity - totalOccupied
                }
            };
        } catch (error) {
            console.error('Get room occupancy report error:', error);
            return {
                success: false,
                message: 'Failed to retrieve occupancy report'
            };
        }
    }

    /**
     * Search rooms by number or service name
     * @param {string} searchTerm - Search term
     * @param {number} [limit=10] - Maximum results
     * @returns {Promise<Object>} Search results
     */
    async searchRooms(searchTerm, limit = 10) {
        try {
            const rooms = await db.Room.findAll({
                where: {
                    [Op.or]: [
                        { room_number: { [Op.iLike]: `%${searchTerm}%` } }
                    ]
                },
                include: [
                    {
                        association: 'service',
                        attributes: ['id', 'name'],
                        where: {
                            [Op.or]: [
                                { name: { [Op.iLike]: `%${searchTerm}%` } }
                            ]
                        },
                        required: false
                    }
                ],
                attributes: ['id', 'room_number', 'capacity'],
                limit,
                order: [['room_number', 'ASC']]
            });

            return {
                success: true,
                rooms: rooms.map(room => ({
                    id: room.id,
                    roomNumber: room.room_number,
                    capacity: room.capacity,
                    service: room.service ? {
                        id: room.service.id,
                        name: room.service.name
                    } : null
                }))
            };
        } catch (error) {
            console.error('Search rooms error:', error);
            return {
                success: false,
                message: 'Failed to search rooms'
            };
        }
    }

    /**
     * Get available rooms for patient assignment
     * @param {number} [serviceId] - Filter by service ID
     * @returns {Promise<Object>} Available rooms
     */
    async getAvailableRooms(serviceId = null) {
        try {
            const whereClause = {};

            if (serviceId) {
                whereClause.service_id = serviceId;
            }

            const rooms = await db.Room.findAll({
                where: whereClause,
                include: [{
                    association: 'service',
                    attributes: ['id', 'name']
                }],
                order: [
                    [{ model: db.Service, as: 'service' }, 'name', 'ASC'],
                    ['room_number', 'ASC']
                ]
            });

            // Filter rooms with available capacity
            const availableRooms = await Promise.all(
                rooms.map(async (room) => {
                    const currentPatients = await db.Patient.count({
                        where: { room_id: room.id, active: true }
                    });

                    if (currentPatients < room.capacity) {
                        return {
                            id: room.id,
                            roomNumber: room.room_number,
                            service: room.service ? {
                                id: room.service.id,
                                name: room.service.name
                            } : null,
                            capacity: room.capacity,
                            currentPatients,
                            availableSpaces: room.capacity - currentPatients
                        };
                    }
                    return null;
                })
            );

            // Filter out null values (fully occupied rooms)
            const filteredRooms = availableRooms.filter(room => room !== null);

            return {
                success: true,
                availableRooms: filteredRooms
            };
        } catch (error) {
            console.error('Get available rooms error:', error);
            return {
                success: false,
                message: 'Failed to retrieve available rooms'
            };
        }
    }

    /**
     * Get services list (replaces getDepartments)
     * @returns {Promise<Object>} List of services
     */
    async getServices() {
        try {
            const services = await db.Service.findAll({
                attributes: [
                    'id',
                    'name',
                    [db.sequelize.fn('COUNT', db.sequelize.col('rooms.id')), 'roomCount']
                ],
                include: [
                    {
                        model: db.Room,
                        as: 'rooms',
                        attributes: [],
                        required: false
                    }
                ],
                group: ['Service.id', 'Service.name'],
                order: [['name', 'ASC']]
            });

            return {
                success: true,
                services: services.map(service => ({
                    id: service.id,
                    name: service.name,
                    roomCount: parseInt(service.dataValues.roomCount) || 0
                }))
            };
        } catch (error) {
            console.error('Get services error:', error);
            return {
                success: false,
                message: 'Failed to retrieve services'
            };
        }
    }
}

module.exports = new RoomService();