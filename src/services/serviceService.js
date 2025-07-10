// services/serviceService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');

/**
 * Service management business logic
 */
class ServiceService {
    /**
     * Get services with optional filtering and pagination
     * @param {Object} filters - Filter criteria
     * @param {number} page - Page number
     * @param {number} limit - Results per page
     * @returns {Object} Services list with pagination
     */
    async getServices(filters = {}, page = 1, limit = 20) {
        try {
            const whereClause = {};

            // Apply filters
            if (filters.name) {
                whereClause.name = { [Op.iLike]: `%${filters.name}%` };
            }

            if (filters.email) {
                whereClause.email = { [Op.iLike]: `%${filters.email}%` };
            }

            if (filters.active !== null && filters.active !== undefined) {
                whereClause.active = filters.active;
            }

            const offset = (page - 1) * limit;

            // Get services with user count
            const { count, rows } = await db.Service.findAndCountAll({
                where: whereClause,
                attributes: [
                    'id',
                    'name',
                    'email',
                    'description',
                    'active',
                    'can_view_all_analyses',
                    'created_at',
                    'updated_at',
                    [
                        db.sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM users u 
                            WHERE u.service_id = "Service".id 
                        )`),
                        'userCount'
                    ],
                    [
                        db.sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM rooms r 
                            WHERE r.service_id = "Service".id
                        )`),
                        'roomCount'
                    ]
                ],
                order: [['name', 'ASC']],
                limit,
                offset
            });

            return {
                success: true,
                data: rows.map(service => ({
                    id: service.id,
                    name: service.name,
                    email: service.email,
                    description: service.description,
                    active: service.active,
                    canViewAllAnalyses: service.can_view_all_analyses,
                    userCount: parseInt(service.getDataValue('userCount')) || 0,
                    roomCount: parseInt(service.getDataValue('roomCount')) || 0,
                    created_at: service.created_at,
                    updated_at: service.updated_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            console.error('Get services error:', error);
            return {
                success: false,
                message: 'Failed to retrieve services'
            };
        }
    }

    /**
     * Get service by ID
     * @param {number} serviceId - Service ID
     * @returns {Object} Service data
     */
    async getServiceById(serviceId) {
        try {
            const service = await db.Service.findByPk(serviceId, {
                attributes: [
                    'id',
                    'name',
                    'email',
                    'description',
                    'active',
                    'can_view_all_analyses',
                    'created_at',
                    'updated_at',
                    [
                        db.sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM users u 
                            WHERE u.service_id = "Service".id 
                        )`),
                        'userCount'
                    ],
                    [
                        db.sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM rooms r 
                            WHERE r.service_id = "Service".id
                        )`),
                        'roomCount'
                    ]
                ]
            });

            if (!service) {
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            return {
                success: true,
                data: {
                    id: service.id,
                    name: service.name,
                    email: service.email,
                    description: service.description,
                    active: service.active,
                    canViewAllAnalyses: service.can_view_all_analyses,
                    userCount: parseInt(service.getDataValue('userCount')) || 0,
                    roomCount: parseInt(service.getDataValue('roomCount')) || 0,
                    created_at: service.created_at,
                    updated_at: service.updated_at
                }
            };
        } catch (error) {
            console.error('Get service error:', error);
            return {
                success: false,
                message: 'Failed to retrieve service'
            };
        }
    }

    /**
     * Create a new service
     * @param {Object} serviceData - Service data
     * @param {Object} context - Request context
     * @returns {Object} Creation result
     */
    async createService(serviceData, context) {
        const transaction = await db.sequelize.transaction();

        try {
            const { name, email, description, createdBy } = serviceData;

            // Check for duplicate name
            const nameExists = await db.Service.findOne({
                where: {
                    name,
                    active: true
                },
                transaction
            });

            if (nameExists) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service with this name already exists'
                };
            }

            // Check for duplicate email
            const emailExists = await db.Service.findOne({
                where: {
                    email,
                    active: true
                },
                transaction
            });

            if (emailExists) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service with this email already exists'
                };
            }

            // Create service
            const service = await db.Service.create({
                name,
                email,
                description,
                active: true,
                can_view_all_analyses: false // Default to false for security
            }, { transaction });

            // Log service creation
            await logService.auditLog({
                eventType: 'service.created',
                userId: createdBy,
                targetId: service.id,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    name,
                    email,
                    userAgent: context.userAgent
                }
            });

            await transaction.commit();

            return {
                success: true,
                serviceId: service.id,
                message: 'Service created successfully'
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Create service error:', error);
            return {
                success: false,
                message: 'Failed to create service'
            };
        }
    }

    /**
     * Update a service
     * @param {number} serviceId - Service ID
     * @param {Object} updateData - Update data
     * @param {Object} context - Request context
     * @returns {Object} Update result
     */
    async updateService(serviceId, updateData, context) {
        const transaction = await db.sequelize.transaction();

        try {
            // Check if service exists
            const service = await db.Service.findByPk(serviceId, { transaction });

            if (!service) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            const { name, email, description, active, canViewAllAnalyses, updatedBy } = updateData;

            // Check for duplicate name if name is being changed
            if (name && name !== service.name) {
                const nameExists = await db.Service.findOne({
                    where: {
                        name,
                        id: { [Op.ne]: serviceId },
                        active: true
                    },
                    transaction
                });

                if (nameExists) {
                    await transaction.rollback();
                    return {
                        success: false,
                        message: 'name already taken by another service'
                    };
                }
            }

            // Check for duplicate email if email is being changed
            if (email && email !== service.email) {
                const emailExists = await db.Service.findOne({
                    where: {
                        email,
                        id: { [Op.ne]: serviceId },
                        active: true
                    },
                    transaction
                });

                if (emailExists) {
                    await transaction.rollback();
                    return {
                        success: false,
                        message: 'email already taken by another service'
                    };
                }
            }

            // Build update object
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (email !== undefined) updates.email = email;
            if (description !== undefined) updates.description = description;
            if (active !== undefined) updates.active = active;
            if (canViewAllAnalyses !== undefined) updates.can_view_all_analyses = canViewAllAnalyses;
            if (updatedBy !== undefined) updates.updated_by = updatedBy;

            if (Object.keys(updates).length === 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'No updates provided'
                };
            }

            // Update service
            await service.update(updates, { transaction });

            // Log service update
            await logService.auditLog({
                eventType: 'service.updated',
                userId: updatedBy,
                targetId: serviceId,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    changes: updates,
                    userAgent: context.userAgent
                }
            });

            await transaction.commit();

            return {
                success: true,
                message: 'Service updated successfully'
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Update service error:', error);
            return {
                success: false,
                message: 'Failed to update service'
            };
        }
    }

    /**
     * Update service analysis permissions
     * @param {number} serviceId - Service ID
     * @param {boolean} canViewAllAnalyses - Whether service can view all analyses
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @returns {Object} Update result
     */
    async updateServiceAnalysisPermissions(serviceId, canViewAllAnalyses, adminId, context) {
        const transaction = await db.sequelize.transaction();

        try {
            // Check if service exists
            const service = await db.Service.findByPk(serviceId, { transaction });

            if (!service) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            const oldPermission = service.can_view_all_analyses;

            // Update permission
            await service.update({
                can_view_all_analyses: canViewAllAnalyses,
                updated_by: adminId
            }, { transaction });

            // Log permission change
            await logService.auditLog({
                eventType: 'service.analysis_permissions_updated',
                userId: adminId,
                targetId: serviceId,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    serviceName: service.name,
                    oldPermission,
                    newPermission: canViewAllAnalyses,
                    userAgent: context.userAgent
                }
            });

            // Log security event for permission elevation
            if (!oldPermission && canViewAllAnalyses) {
                await logService.securityLog({
                    eventType: 'service.elevated_analysis_access_granted',
                    severity: 'medium',
                    userId: adminId,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        serviceId,
                        serviceName: service.name,
                        userAgent: context.userAgent
                    }
                });
            }

            await transaction.commit();

            return {
                success: true,
                message: `Analysis permissions ${canViewAllAnalyses ? 'granted' : 'revoked'} successfully`
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Update service analysis permissions error:', error);
            return {
                success: false,
                message: 'Failed to update analysis permissions'
            };
        }
    }

    /**
     * Deactivate a service
     * @param {number} serviceId - Service ID
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @returns {Object} Deactivation result
     */
    async deactivateService(serviceId, adminId, context) {
        const transaction = await db.sequelize.transaction();

        try {
            // Check if service exists and is active
            const service = await db.Service.findByPk(serviceId, { transaction });

            if (!service) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            if (!service.active) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service is already inactive'
                };
            }

            // Check for active users
            const activeUserCount = await db.User.count({
                where: {
                    service_id: serviceId,
                    deleted_at: null
                },
                transaction
            });

            if (activeUserCount > 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: `Cannot deactivate service with ${activeUserCount} active user(s). Please reassign users first.`
                };
            }

            // Check for rooms
            const roomCount = await db.Room.count({
                where: {
                    service_id: serviceId
                },
                transaction
            });

            if (roomCount > 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: `Cannot deactivate service with ${roomCount} room(s). Please reassign rooms first.`
                };
            }

            // Deactivate service
            await service.update({
                active: false,
                updated_by: adminId
            }, { transaction });

            // Log service deactivation
            await logService.auditLog({
                eventType: 'service.deactivated',
                userId: adminId,
                targetId: serviceId,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    serviceName: service.name,
                    userAgent: context.userAgent
                }
            });

            await transaction.commit();

            return {
                success: true,
                message: 'Service deactivated successfully'
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Deactivate service error:', error);
            return {
                success: false,
                message: 'Failed to deactivate service'
            };
        }
    }

    /**
     * Reactivate a service
     * @param {number} serviceId - Service ID
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @returns {Object} Reactivation result
     */
    async reactivateService(serviceId, adminId, context) {
        const transaction = await db.sequelize.transaction();

        try {
            // Check if service exists
            const service = await db.Service.findByPk(serviceId, { transaction });

            if (!service) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            if (service.active) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Service is already active'
                };
            }

            // Check for conflicts with existing active services
            const conflicts = await db.Service.findOne({
                where: {
                    [Op.or]: [
                        { name: service.name },
                        { email: service.email }
                    ],
                    id: { [Op.ne]: serviceId },
                    active: true
                },
                transaction
            });

            if (conflicts) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Cannot reactivate: another active service already uses this name or email'
                };
            }

            // Reactivate service
            await service.update({
                active: true,
                updated_by: adminId
            }, { transaction });

            // Log service reactivation
            await logService.auditLog({
                eventType: 'service.reactivated',
                userId: adminId,
                targetId: serviceId,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    serviceName: service.name,
                    userAgent: context.userAgent
                }
            });

            await transaction.commit();

            return {
                success: true,
                message: 'Service reactivated successfully'
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Reactivate service error:', error);
            return {
                success: false,
                message: 'Failed to reactivate service'
            };
        }
    }

    /**
     * Get service statistics
     * @param {number} serviceId - Service ID
     * @returns {Object} Service statistics
     */
    async getServiceStatistics(serviceId) {
        try {
            // Check if service exists
            const service = await db.Service.findByPk(serviceId);

            if (!service) {
                return {
                    success: false,
                    message: 'Service not found'
                };
            }

            // Get user statistics
            const totalUsers = await db.User.count({
                where: { service_id: serviceId }
            });

            const activeUsers = await db.User.count({
                where: {
                    service_id: serviceId,
                    deleted_at: null
                }
            });

            const inactiveUsers = totalUsers - activeUsers;

            const recentActiveUsers = await db.User.count({
                where: {
                    service_id: serviceId,
                    deleted_at: null,
                    last_login_at: {
                        [Op.gte]: db.sequelize.literal("NOW() - INTERVAL '30 days'")
                    }
                }
            });

            // Get room statistics
            const totalRooms = await db.Room.count({
                where: { service_id: serviceId }
            });

            // Since rooms no longer have an active field, all rooms are considered active
            const activeRooms = totalRooms;

            // Get analysis statistics (last 30 days)
            const recentAnalyses = await db.Analysis.count({
                where: {
                    analysis_date: {
                        [Op.gte]: db.sequelize.literal("NOW() - INTERVAL '30 days'")
                    }
                },
                include: [{
                    model: db.Room,
                    as: 'room',
                    where: { service_id: serviceId },
                    attributes: []
                }]
            });

            // Get role distribution
            const roleDistribution = await db.User.findAll({
                where: {
                    service_id: serviceId,
                    deleted_at: null
                },
                include: [{
                    model: db.Role,
                    as: 'role',
                    attributes: ['name']
                }],
                attributes: [
                    [db.sequelize.col('role.name'), 'role'],
                    [db.sequelize.fn('COUNT', db.sequelize.col('User.id')), 'count']
                ],
                group: ['role.id', 'role.name'],
                order: [[db.sequelize.literal('count'), 'DESC']],
                raw: true
            });

            // Calculate activity rate
            const activityRate = activeUsers > 0 ? ((recentActiveUsers / activeUsers) * 100).toFixed(2) : '0.00';

            return {
                success: true,
                statistics: {
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        inactive: inactiveUsers,
                        recentActive: recentActiveUsers,
                        activityRate
                    },
                    rooms: {
                        total: totalRooms,
                        active: activeRooms
                    },
                    analyses: {
                        recentCount: recentAnalyses
                    },
                    roleDistribution: roleDistribution.map(row => ({
                        role: row.role,
                        count: parseInt(row.count)
                    })),
                    permissions: {
                        canViewAllAnalyses: service.can_view_all_analyses
                    }
                }
            };
        } catch (error) {
            console.error('Get service statistics error:', error);
            return {
                success: false,
                message: 'Failed to retrieve service statistics'
            };
        }
    }

    /**
     * Transfer users between services
     * @param {number} fromServiceId - Source service ID
     * @param {number} toServiceId - Target service ID
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @returns {Object} Transfer result
     */
    async transferUsers(fromServiceId, toServiceId, adminId, context) {
        const transaction = await db.sequelize.transaction();

        try {
            // Validate both services exist and are active
            const services = await db.Service.findAll({
                where: {
                    id: [fromServiceId, toServiceId]
                },
                transaction
            });

            if (services.length !== 2) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'One or both services not found'
                };
            }

            const serviceMap = {};
            services.forEach(service => {
                serviceMap[service.id] = service;
            });

            if (!serviceMap[fromServiceId].active || !serviceMap[toServiceId].active) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'Both services must be active for user transfer'
                };
            }

            // Count active users in source service
            const userCount = await db.User.count({
                where: {
                    service_id: fromServiceId,
                    deleted_at: null
                },
                transaction
            });

            if (userCount === 0) {
                await transaction.rollback();
                return {
                    success: false,
                    message: 'No active users to transfer'
                };
            }

            // Transfer users
            await db.User.update(
                { service_id: toServiceId },
                {
                    where: {
                        service_id: fromServiceId,
                        deleted_at: null
                    },
                    transaction
                }
            );

            // Log user transfer
            await logService.auditLog({
                eventType: 'users.transferred',
                userId: adminId,
                targetId: fromServiceId,
                targetType: 'service',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    fromServiceId,
                    toServiceId,
                    fromServiceName: serviceMap[fromServiceId].name,
                    toServiceName: serviceMap[toServiceId].name,
                    userCount,
                    userAgent: context.userAgent
                }
            });

            await transaction.commit();

            return {
                success: true,
                message: `Successfully transferred ${userCount} users from ${serviceMap[fromServiceId].name} to ${serviceMap[toServiceId].name}`,
                transferredCount: userCount
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Transfer users error:', error);
            return {
                success: false,
                message: 'Failed to transfer users'
            };
        }
    }

    /**
     * Get all services for export
     * @returns {Promise<Array>} All services
     */
    async getAllServices() {
        try {
            const services = await db.Service.findAll({
                attributes: [
                    'id',
                    'name',
                    'email',
                    'description',
                    'active',
                    'can_view_all_analyses',
                    'created_at',
                    'updated_at'
                ],
                include: [
                    {
                        model: db.User,
                        as: 'users',
                        attributes: [],
                        required: false
                    },
                    {
                        model: db.Room,
                        as: 'rooms',
                        attributes: [],
                        required: false
                    }
                ],
                order: [['name', 'ASC']],
                raw: false
            });

            return services.map(service => ({
                id: service.id,
                name: service.name,
                email: service.email,
                description: service.description,
                is_active: service.active,
                can_view_all_analyses: service.can_view_all_analyses,
                user_count: service.users ? service.users.length : 0,
                room_count: service.rooms ? service.rooms.length : 0,
                created_at: service.created_at,
                updated_at: service.updated_at
            }));
        } catch (error) {
            console.error('Get all services error:', error);
            throw error;
        }
    }

    /**
     * Search services by name or email
     * @param {string} term - Search term
     * @param {number} limit - Maximum results
     * @returns {Object} Search results
     */
    async searchServices(term, limit = 10) {
        try {
            const services = await db.Service.findAll({
                where: {
                    active: true,
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${term}%` } },
                        { email: { [Op.iLike]: `%${term}%` } }
                    ]
                },
                attributes: ['id', 'name', 'email', 'description', 'can_view_all_analyses'],
                order: [
                    // Prioritize exact matches at the beginning
                    [db.sequelize.literal(`CASE WHEN name ILIKE '${term}%' THEN 1 ELSE 2 END`), 'ASC'],
                    ['name', 'ASC']
                ],
                limit
            });

            return {
                success: true,
                services
            };
        } catch (error) {
            console.error('Search services error:', error);
            return {
                success: false,
                message: 'Failed to search services'
            };
        }
    }
}

module.exports = new ServiceService();