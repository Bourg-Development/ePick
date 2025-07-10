const statusPageService = require('../services/statusPageService');

class StatusController {
    /**
     * Render public status page
     */
    async statusPage(req, res) {
        try {
            // Get system status and incidents
            const [systemStatus, activeIncidents, recentIncidents] = await Promise.all([
                statusPageService.getSystemStatus(),
                statusPageService.getActiveIncidents(),
                statusPageService.getRecentIncidents(7)
            ]);

            // Use proper layout with corporate identity
            res.render('public/status', {
                title: 'ePick System Status',
                layout: 'layouts/public',
                systemStatus,
                activeIncidents,
                recentIncidents,
                currentDate: new Date(),
                user: req.auth || null,
                // Helper functions for the template (defined inline)
                helpers: {
                    getStatusText: function(status) {
                        const statusMap = {
                            'operational': 'All Systems Operational',
                            'degraded': 'Degraded Performance',
                            'partial_outage': 'Partial Outage',
                            'major_outage': 'Major Outage',
                            'maintenance': 'Maintenance Mode'
                        };
                        return statusMap[status] || status;
                    },
                    getStatusDescription: function(status) {
                        const descMap = {
                            'operational': 'All systems are functioning normally',
                            'degraded': 'Some systems may be running slower than usual',
                            'partial_outage': 'Some systems are currently unavailable',
                            'major_outage': 'Most systems are currently unavailable',
                            'maintenance': 'System maintenance is in progress'
                        };
                        return descMap[status] || 'Status unknown';
                    },
                    formatComponentName: function(component) {
                        return component.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    },
                    formatRelativeTime: function(dateStr) {
                        const date = new Date(dateStr);
                        const now = new Date();
                        const diffMs = now - date;
                        const diffMins = Math.floor(diffMs / 60000);
                        
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                        
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                        
                        const diffDays = Math.floor(diffHours / 24);
                        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    },
                    formatDuration: function(minutes) {
                        if (minutes < 60) return `${minutes} min`;
                        const hours = Math.floor(minutes / 60);
                        const remainingMins = minutes % 60;
                        return `${hours}h ${remainingMins}m`;
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering status page:', error);
            
            // Simple HTML fallback
            res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>ePick System Status</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; }
                        .error { color: #e74c3c; background: #fadbd8; padding: 20px; border-radius: 4px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>ePick System Status</h1>
                        <div class="error">
                            <h3>Status Page Error</h3>
                            <p>Unable to load the full status page. Please try refreshing or contact support.</p>
                            <p><strong>Error:</strong> ${error.message}</p>
                        </div>
                        <p><a href="/status/data">View raw status data (JSON)</a></p>
                    </div>
                </body>
                </html>
            `);
        }
    }

    /**
     * Get status data as JSON (for API calls or AJAX updates)
     */
    async getStatusData(req, res) {
        try {
            const [systemStatus, activeIncidents, recentIncidents] = await Promise.all([
                statusPageService.getSystemStatus(),
                statusPageService.getActiveIncidents(),
                statusPageService.getRecentIncidents(7)
            ]);

            res.json({
                success: true,
                data: {
                    system_status: systemStatus,
                    active_incidents: activeIncidents,
                    recent_incidents: recentIncidents,
                    last_updated: new Date()
                }
            });
        } catch (error) {
            console.error('Error getting status data:', error);
            res.status(500).json({
                success: false,
                message: 'Unable to retrieve status data',
                error: error.message
            });
        }
    }

    /**
     * Check all system components (admin only)
     */
    async checkComponents(req, res) {
        try {
            const result = await statusPageService.checkAllComponents();
            
            res.json({
                success: true,
                message: `Checked ${result.checked} components`,
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
     * Update component status (admin only)
     */
    async updateComponentStatus(req, res) {
        try {
            const { component } = req.params;
            const { status, error_message, response_time, metadata } = req.body;

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
     * Create new incident (admin only)
     */
    async createIncident(req, res) {
        try {
            const userId = req.auth.userId;
            const incident = await statusPageService.createIncident(req.body, userId);

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
            
            const incident = await statusPageService.updateIncident(
                incidentId,
                req.body,
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
     * Get system metrics for dashboard
     */
    async getMetrics(req, res) {
        try {
            const systemStatus = await statusPageService.getSystemStatus();
            const activeIncidents = await statusPageService.getActiveIncidents();

            const metrics = {
                overall_status: systemStatus.overall_status,
                total_components: systemStatus.components.length,
                operational_components: systemStatus.components.filter(c => c.status === 'operational').length,
                critical_components: systemStatus.components.filter(c => c.is_critical).length,
                active_incidents: activeIncidents.length,
                critical_incidents: activeIncidents.filter(i => i.severity === 'critical').length,
                last_updated: systemStatus.last_updated
            };

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('Error getting metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving metrics',
                error: error.message
            });
        }
    }

    // Helper functions for templates
    getStatusText(status) {
        const statusMap = {
            'operational': 'All Systems Operational',
            'degraded': 'Degraded Performance',
            'partial_outage': 'Partial Outage',
            'major_outage': 'Major Outage',
            'maintenance': 'Maintenance Mode'
        };
        return statusMap[status] || status;
    }

    getStatusDescription(status) {
        const descMap = {
            'operational': 'All systems are functioning normally',
            'degraded': 'Some systems may be running slower than usual',
            'partial_outage': 'Some systems are currently unavailable',
            'major_outage': 'Most systems are currently unavailable',
            'maintenance': 'System maintenance is in progress'
        };
        return descMap[status] || 'Status unknown';
    }

    formatComponentName(component) {
        return component.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    formatDuration(minutes) {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    }
}

module.exports = new StatusController();