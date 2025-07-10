const statusPageService = require('../../services/statusPageService');

class StatusAPIController {
    /**
     * Get public status data
     */
    async getPublicStatus(req, res) {
        try {
            const [systemStatus, activeIncidents, recentIncidents] = await Promise.all([
                statusPageService.getSystemStatus(),
                statusPageService.getActiveIncidents(),
                statusPageService.getRecentIncidents(7)
            ]);

            res.json({
                success: true,
                data: {
                    overall_status: systemStatus.overall_status,
                    components: systemStatus.components,
                    active_incidents: activeIncidents,
                    recent_incidents: recentIncidents,
                    last_updated: new Date()
                }
            });
        } catch (error) {
            console.error('Error getting public status:', error);
            res.status(500).json({
                success: false,
                message: 'Unable to retrieve status information'
            });
        }
    }

    /**
     * Check all system components (admin only)
     */
    async checkAllComponents(req, res) {
        try {
            const result = await statusPageService.checkAllComponents();
            
            res.json({
                success: true,
                message: `Checked ${result.checked} components (${result.successful} successful, ${result.failed} failed)`,
                data: result
            });
        } catch (error) {
            console.error('Error checking components:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking system components',
                error: error.message
            });
        }
    }

    /**
     * Check specific component (admin only)
     */
    async checkComponent(req, res) {
        try {
            const { component } = req.params;
            const result = await statusPageService.checkComponent(component);
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error(`Error checking component ${req.params.component}:`, error);
            res.status(500).json({
                success: false,
                message: `Error checking component ${req.params.component}`,
                error: error.message
            });
        }
    }

    /**
     * Update component status (admin only)
     */
    async updateComponentStatus(req, res) {
        try {
            const { component } = req.params;
            const { status, error_message, response_time, metadata } = req.body;

            if (!['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }

            await statusPageService.updateComponentStatus(
                component,
                status,
                error_message,
                response_time,
                metadata
            );

            res.json({
                success: true,
                message: `Component ${component} status updated to ${status}`
            });
        } catch (error) {
            console.error('Error updating component status:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating component status',
                error: error.message
            });
        }
    }

    /**
     * Get all incidents (admin only)
     */
    async getAllIncidents(req, res) {
        try {
            const { limit = 50, offset = 0, status } = req.query;
            
            let whereClause = {};
            if (status) {
                whereClause.status = status;
            }

            const incidents = await statusPageService.getAllIncidents({
                limit: parseInt(limit),
                offset: parseInt(offset),
                where: whereClause
            });

            res.json({
                success: true,
                data: incidents
            });
        } catch (error) {
            console.error('Error getting all incidents:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving incidents',
                error: error.message
            });
        }
    }

    /**
     * Create new incident (admin only)
     */
    async createIncident(req, res) {
        try {
            const userId = req.auth.userId;
            const {
                title,
                description,
                severity,
                impact,
                affected_components,
                is_public
            } = req.body;

            if (!title || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Title and description are required'
                });
            }

            const incident = await statusPageService.createIncident({
                title,
                description,
                severity,
                impact,
                affected_components,
                is_public
            }, userId);

            res.json({
                success: true,
                message: 'Incident created successfully',
                data: incident
            });
        } catch (error) {
            console.error('Error creating incident:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating incident',
                error: error.message
            });
        }
    }

    /**
     * Update incident (admin only)
     */
    async updateIncident(req, res) {
        try {
            const { incidentId } = req.params;
            const userId = req.auth.userId;
            const { status, message, is_public } = req.body;

            if (!status && !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Status or message is required'
                });
            }

            const incident = await statusPageService.updateIncident(
                incidentId,
                { status, message, is_public },
                userId
            );

            res.json({
                success: true,
                message: 'Incident updated successfully',
                data: incident
            });
        } catch (error) {
            console.error('Error updating incident:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating incident',
                error: error.message
            });
        }
    }

    /**
     * Get system health metrics
     */
    async getHealthMetrics(req, res) {
        try {
            const systemStatus = await statusPageService.getSystemStatus();
            const activeIncidents = await statusPageService.getActiveIncidents();

            const uptime = await this.calculateUptime();
            
            const metrics = {
                overall_status: systemStatus.overall_status,
                uptime_percentage: uptime.percentage,
                total_components: systemStatus.components.length,
                operational_components: systemStatus.components.filter(c => c.status === 'operational').length,
                critical_components: systemStatus.components.filter(c => c.is_critical).length,
                non_operational_critical: systemStatus.components.filter(c => c.is_critical && c.status !== 'operational').length,
                active_incidents: activeIncidents.length,
                critical_incidents: activeIncidents.filter(i => i.severity === 'critical').length,
                avg_response_time: this.calculateAverageResponseTime(systemStatus.components),
                last_updated: systemStatus.last_updated
            };

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('Error getting health metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving health metrics',
                error: error.message
            });
        }
    }

    /**
     * Calculate system uptime (simplified - based on recent incidents)
     */
    async calculateUptime() {
        try {
            // Simple uptime calculation based on incidents in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentIncidents = await statusPageService.getRecentIncidents(30);
            const criticalIncidents = recentIncidents.filter(i => i.severity === 'critical' && i.duration);
            
            const totalDowntimeMinutes = criticalIncidents.reduce((sum, incident) => sum + (incident.duration || 0), 0);
            const totalMinutesIn30Days = 30 * 24 * 60;
            const uptimePercentage = Math.max(0, ((totalMinutesIn30Days - totalDowntimeMinutes) / totalMinutesIn30Days) * 100);

            return {
                percentage: Math.round(uptimePercentage * 100) / 100,
                downtime_minutes: totalDowntimeMinutes,
                period_days: 30
            };
        } catch (error) {
            console.error('Error calculating uptime:', error);
            return { percentage: 99.9, downtime_minutes: 0, period_days: 30 };
        }
    }

    /**
     * Calculate average response time across components
     */
    calculateAverageResponseTime(components) {
        const componentsWithResponseTime = components.filter(c => c.response_time !== null);
        if (componentsWithResponseTime.length === 0) return null;

        const totalResponseTime = componentsWithResponseTime.reduce((sum, c) => sum + parseFloat(c.response_time), 0);
        return Math.round((totalResponseTime / componentsWithResponseTime.length) * 100) / 100;
    }
}

module.exports = new StatusAPIController();