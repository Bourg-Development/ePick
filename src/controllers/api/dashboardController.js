// controllers/api/dashboardController.js
const db = require('../../db');
const { Op } = require('sequelize');

/**
 * Dashboard API controller for real-time dashboard data
 */
class DashboardController {
    /**
     * Get dashboard metrics and statistics
     */
    async getDashboardMetrics(req, res) {
        try {
            const { userId, service_id } = req.auth;
            const { 
                startDate = this._getDateDaysAgo(7),
                endDate = this._getCurrentDate()
            } = req.query;

            // Base where clause for service filtering
            const serviceWhere = service_id ? { service_id } : {};

            // Get analyses metrics
            const analysesMetrics = await this._getAnalysesMetrics(serviceWhere, startDate, endDate);
            
            // Get rooms metrics
            const roomsMetrics = await this._getRoomsMetrics(serviceWhere);
            
            // Get patients metrics
            const patientsMetrics = await this._getPatientsMetrics(serviceWhere);
            
            // Get service metrics
            const serviceMetrics = await this._getServiceMetrics(service_id);

            return res.status(200).json({
                success: true,
                data: {
                    analyses: analysesMetrics,
                    rooms: roomsMetrics,
                    patients: patientsMetrics,
                    service: serviceMetrics,
                    dateRange: { startDate, endDate }
                }
            });

        } catch (error) {
            console.error('Get dashboard metrics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve dashboard metrics'
            });
        }
    }

    /**
     * Get today's schedule
     */
    async getTodaySchedule(req, res) {
        try {
            const { service_id } = req.auth;
            const today = new Date().toISOString().split('T')[0];

            const whereClause = {
                analysis_date: {
                    [Op.gte]: today + ' 00:00:00',
                    [Op.lte]: today + ' 23:59:59'
                }
            };

            // Add service filter if user is not system admin
            if (service_id) {
                whereClause.service_id = service_id;
            }

            const schedule = await db.Analysis.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.Patient,
                        as: 'patient',
                        attributes: ['id', 'name', 'matricule_national']
                    },
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name', 'specialization']
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        attributes: ['id', 'room_number']
                    }
                ],
                order: [['analysis_date', 'ASC']],
                limit: 50
            });

            const formattedSchedule = schedule.map(analysis => ({
                id: analysis.id,
                analysis_date: analysis.analysis_date,
                type: analysis.type,
                status: analysis.status,
                patient_name: analysis.patient?.name,
                doctor_name: analysis.doctor?.name,
                room_number: analysis.room?.room_number,
                notes: analysis.notes
            }));

            return res.status(200).json({
                success: true,
                data: formattedSchedule
            });

        } catch (error) {
            console.error('Get today schedule error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve today\'s schedule'
            });
        }
    }

    /**
     * Get recent activity/audit logs
     */
    async getRecentActivity(req, res) {
        try {
            const { service_id } = req.auth;
            const { limit = 20 } = req.query;

            const whereClause = {};

            // Add service filter if user is not system admin
            if (service_id) {
                whereClause.service_id = service_id;
            }

            // Filter to only meaningful events for dashboard
            const meaningfulPatterns = [
                'analysis%',
                'patient%', 
                'doctor%',
                'room%',
                'user%',
                'system_update%'
            ];
            
            // Exclude technical/system events
            const excludePatterns = [
                'http.%',
                'auth.%',
                'token.%',
                'session.%',
                'security.%',
                'api.%',
                'request.%',
                'response.%',
                'login.%',
                'logout.%'
            ];
            
            whereClause.event_type = {
                [Op.and]: [
                    {
                        [Op.or]: meaningfulPatterns.map(pattern => ({
                            [Op.like]: pattern
                        }))
                    },
                    {
                        [Op.and]: excludePatterns.map(pattern => ({
                            [Op.notLike]: pattern
                        }))
                    }
                ]
            };

            const activity = await db.AuditLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.User,
                        as: 'User',
                        attributes: ['id', 'username', 'full_name']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit)
            });

            // Enrich metadata with patient names for analysis-related logs
            const enrichedActivity = await Promise.all(activity.map(async (log) => {
                let enrichedMetadata = { ...log.metadata };
                
                // For analysis-related events that have a patientId, fetch patient name
                if (log.event_type.includes('analysis') && log.metadata && log.metadata.patientId) {
                    try {
                        const patient = await db.Patient.findByPk(log.metadata.patientId, {
                            attributes: ['name']
                        });
                        
                        if (patient) {
                            enrichedMetadata.patient_name = patient.name;
                        }
                    } catch (error) {
                        console.error('Error fetching patient for dashboard activity:', error);
                        // Continue without patient name if lookup fails
                    }
                }
                
                return {
                    id: log.id,
                    event_type: log.event_type,
                    target_type: log.target_type,
                    target_id: log.target_id,
                    user_name: log.User?.full_name || log.User?.username,
                    created_at: log.created_at,
                    metadata: enrichedMetadata
                };
            }));

            return res.status(200).json({
                success: true,
                data: enrichedActivity
            });

        } catch (error) {
            console.error('Get recent activity error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve recent activity'
            });
        }
    }

    /**
     * Get performance chart data
     */
    async getPerformanceData(req, res) {
        try {
            const { service_id } = req.auth;
            const { days = 7 } = req.query;

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            const whereClause = {
                analysis_date: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            };

            if (service_id) {
                whereClause.service_id = service_id;
            }

            const analyses = await db.Analysis.findAll({
                where: whereClause,
                attributes: ['analysis_date', 'status'],
                order: [['analysis_date', 'ASC']]
            });

            // Group by date and status
            const performanceData = this._groupAnalysesByDate(analyses, parseInt(days));

            return res.status(200).json({
                success: true,
                data: performanceData
            });

        } catch (error) {
            console.error('Get performance data error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve performance data'
            });
        }
    }

    /**
     * Get analysis types distribution
     */
    async getAnalysisTypesDistribution(req, res) {
        try {
            const { service_id } = req.auth;
            const { 
                startDate = this._getDateDaysAgo(30),
                endDate = this._getCurrentDate()
            } = req.query;

            const whereClause = {
                analysis_date: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            };

            if (service_id) {
                whereClause.service_id = service_id;
            }

            const distribution = await db.Analysis.findAll({
                where: whereClause,
                attributes: [
                    'type',
                    [db.sequelize.fn('COUNT', db.sequelize.col('type')), 'count']
                ],
                group: ['type'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('type')), 'DESC']]
            });

            const formattedDistribution = distribution.map(item => ({
                type: item.type,
                count: parseInt(item.dataValues.count),
                label: this._getAnalysisTypeLabel(item.type)
            }));

            return res.status(200).json({
                success: true,
                data: formattedDistribution
            });

        } catch (error) {
            console.error('Get analysis types distribution error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve analysis types distribution'
            });
        }
    }

    // Private helper methods
    async _getAnalysesMetrics(serviceWhere, startDate, endDate) {
        const today = new Date().toISOString().split('T')[0];
        
        const [totalCount, todayCount, statusCounts, completionRate] = await Promise.all([
            // Total analyses in date range
            db.Analysis.count({
                where: {
                    ...serviceWhere,
                    analysis_date: {
                        [Op.gte]: startDate,
                        [Op.lte]: endDate
                    }
                }
            }),
            
            // Today's analyses
            db.Analysis.count({
                where: {
                    ...serviceWhere,
                    analysis_date: {
                        [Op.gte]: today + ' 00:00:00',
                        [Op.lte]: today + ' 23:59:59'
                    }
                }
            }),
            
            // Status distribution
            db.Analysis.findAll({
                where: {
                    ...serviceWhere,
                    analysis_date: {
                        [Op.gte]: startDate,
                        [Op.lte]: endDate
                    }
                },
                attributes: [
                    'status',
                    [db.sequelize.fn('COUNT', db.sequelize.col('status')), 'count']
                ],
                group: ['status']
            }),
            
            // Calculate completion rate
            this._calculateCompletionRate(serviceWhere, startDate, endDate)
        ]);

        const statusData = {};
        statusCounts.forEach(item => {
            statusData[item.status] = parseInt(item.dataValues.count);
        });

        return {
            total: totalCount,
            today: todayCount,
            pending: statusData.pending || 0,
            completed: statusData.completed || 0,
            delayed: statusData.delayed || 0,
            cancelled: statusData.cancelled || 0,
            completionRate: completionRate
        };
    }

    async _getRoomsMetrics(serviceWhere) {
        const [totalRooms, occupiedRooms] = await Promise.all([
            db.Room.count({ where: serviceWhere }),
            db.Room.count({ 
                where: {
                    ...serviceWhere,
                    // Assuming we have a way to determine occupied rooms
                    // This would need to be adjusted based on your business logic
                }
            })
        ]);

        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        return {
            total: totalRooms,
            occupied: occupiedRooms,
            available: totalRooms - occupiedRooms,
            occupancyRate: occupancyRate
        };
    }

    async _getPatientsMetrics(serviceWhere) {
        const [totalPatients, activePatients] = await Promise.all([
            db.Patient.count({ where: serviceWhere }),
            db.Patient.count({ 
                where: {
                    ...serviceWhere,
                    is_active: true
                }
            })
        ]);

        return {
            total: totalPatients,
            active: activePatients,
            inactive: totalPatients - activePatients
        };
    }

    async _getServiceMetrics(serviceId) {
        if (!serviceId) return null;

        const [userCount, roomCount] = await Promise.all([
            db.User.count({ where: { service_id: serviceId } }),
            db.Room.count({ where: { service_id: serviceId } })
        ]);

        return {
            users: userCount,
            rooms: roomCount
        };
    }

    async _calculateCompletionRate(serviceWhere, startDate, endDate) {
        const [completed, total] = await Promise.all([
            db.Analysis.count({
                where: {
                    ...serviceWhere,
                    status: 'completed',
                    analysis_date: {
                        [Op.gte]: startDate,
                        [Op.lte]: endDate
                    }
                }
            }),
            db.Analysis.count({
                where: {
                    ...serviceWhere,
                    analysis_date: {
                        [Op.gte]: startDate,
                        [Op.lte]: endDate
                    }
                }
            })
        ]);

        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    _groupAnalysesByDate(analyses, days) {
        const result = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];

            const dayAnalyses = analyses.filter(a => 
                a.analysis_date.toISOString().split('T')[0] === dateString
            );

            result.push({
                date: dateString,
                completed: dayAnalyses.filter(a => a.status === 'completed').length,
                pending: dayAnalyses.filter(a => ['pending', 'delayed'].includes(a.status)).length,
                total: dayAnalyses.length
            });
        }

        return result;
    }

    _getAnalysisTypeLabel(type) {
        const typeLabels = {
            'XY': 'XY Analysis',
            'YZ': 'YZ Analysis', 
            'ZG': 'ZG Analysis',
            'HG': 'HG Analysis'
        };
        return typeLabels[type] || type;
    }

    _getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    _getDateDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }
}

module.exports = new DashboardController();