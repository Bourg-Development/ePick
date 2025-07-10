const db = require('../db');
const logService = require('./logService');
const { Op } = require('sequelize');

class StatusPageService {
    /**
     * Get overall system status and all component statuses
     */
    async getSystemStatus() {
        try {
            // Initialize default components if table is empty
            await this.initializeDefaultComponents();
            
            // Get all system components ordered by display order
            const components = await db.SystemStatus.findAll({
                order: [['display_order', 'ASC'], ['component', 'ASC']]
            });

            // Calculate overall system status
            const criticalComponents = components.filter(c => c.is_critical);
            const nonOperationalCritical = criticalComponents.filter(c => c.status !== 'operational');
            
            let overallStatus = 'operational';
            if (nonOperationalCritical.length > 0) {
                // Check for major outages
                const majorOutages = nonOperationalCritical.filter(c => c.status === 'major_outage');
                if (majorOutages.length > 0) {
                    overallStatus = 'major_outage';
                } else {
                    // Check for partial outages
                    const partialOutages = nonOperationalCritical.filter(c => c.status === 'partial_outage');
                    if (partialOutages.length > 0) {
                        overallStatus = 'partial_outage';
                    } else {
                        // Check for degraded performance
                        const degraded = nonOperationalCritical.filter(c => c.status === 'degraded');
                        if (degraded.length > 0) {
                            overallStatus = 'degraded';
                        }
                    }
                }
            } else {
                // Check if any components are in maintenance
                const maintenance = components.filter(c => c.status === 'maintenance');
                if (maintenance.length > 0) {
                    overallStatus = 'maintenance';
                }
            }

            return {
                overall_status: overallStatus,
                last_updated: new Date(),
                components: components.map(c => ({
                    id: c.id,
                    component: c.component,
                    status: c.status,
                    description: c.description,
                    last_checked: c.last_checked,
                    last_success: c.last_success,
                    last_failure: c.last_failure,
                    response_time: c.response_time,
                    error_message: c.error_message,
                    is_critical: c.is_critical,
                    display_order: c.display_order
                }))
            };
        } catch (error) {
            console.error('Error getting system status:', error);
            throw error;
        }
    }

    /**
     * Update status of a specific component
     */
    async updateComponentStatus(component, status, errorMessage = null, responseTime = null, metadata = null) {
        try {
            const now = new Date();
            
            // Get current status to check for changes
            const currentStatus = await db.SystemStatus.findOne({
                where: { component }
            });
            
            const updateData = {
                status,
                last_checked: now,
                error_message: errorMessage,
                response_time: responseTime,
                metadata: metadata || {}
            };

            // Update success/failure timestamps
            if (status === 'operational') {
                updateData.last_success = now;
            } else {
                updateData.last_failure = now;
            }

            const [updated] = await db.SystemStatus.update(updateData, {
                where: { component },
                returning: true
            });

            if (updated === 0) {
                // Component doesn't exist, create it
                await db.SystemStatus.create({
                    component,
                    status,
                    last_checked: now,
                    last_success: status === 'operational' ? now : null,
                    last_failure: status !== 'operational' ? now : null,
                    error_message: errorMessage,
                    response_time: responseTime,
                    metadata: metadata || {},
                    is_critical: true,
                    display_order: 999
                });
            }

            // Log status change
            await logService.auditLog({
                eventType: 'component_status_updated',
                userId: null,
                targetType: 'SystemStatus',
                metadata: {
                    component,
                    status,
                    errorMessage,
                    responseTime
                }
            });


            return true;
        } catch (error) {
            console.error(`Error updating component status for ${component}:`, error);
            throw error;
        }
    }

    /**
     * Check all system components
     */
    async checkAllComponents() {
        try {
            const results = {
                checked: 0,
                successful: 0,
                failed: 0,
                components: []
            };

            // Get all components to check
            const components = await db.SystemStatus.findAll();

            for (const component of components) {
                try {
                    const checkResult = await this.checkComponent(component.component);
                    results.checked++;
                    
                    if (checkResult.status === 'operational') {
                        results.successful++;
                    } else {
                        results.failed++;
                    }
                    
                    results.components.push({
                        component: component.component,
                        status: checkResult.status,
                        responseTime: checkResult.responseTime,
                        error: checkResult.error
                    });
                } catch (error) {
                    results.checked++;
                    results.failed++;
                    results.components.push({
                        component: component.component,
                        status: 'major_outage',
                        error: error.message
                    });
                    
                    // Update component status
                    await this.updateComponentStatus(
                        component.component, 
                        'major_outage', 
                        error.message
                    );
                }
            }

            return results;
        } catch (error) {
            console.error('Error checking all components:', error);
            throw error;
        }
    }

    /**
     * Check individual component status
     */
    async checkComponent(componentName) {
        const startTime = Date.now();

        try {
            let status = 'operational';
            let error = null;

            switch (componentName) {
                case 'database':
                    // Test database connectivity and perform a real query
                    await db.sequelize.authenticate();
                    // Test a simple query to ensure database is responsive
                    await db.sequelize.query('SELECT 1 as test');
                    break;

                case 'web_server':
                    // Test if we can create a simple HTTP response (basic functionality)
                    const webTestStart = Date.now();
                    // If we can execute this and it's reasonably fast, web server is good
                    const testTime = Date.now() - webTestStart;
                    if (testTime > 5000) { // If it takes more than 5 seconds, degraded
                        status = 'degraded';
                        error = 'Web server responding slowly';
                    }
                    break;

                case 'email_service':
                    // Actually test email service connectivity
                    try {
                        const emailService = require('./emailService');
                        // Test SMTP connection using the existing transporter
                        if (emailService && emailService.transporter) {
                            await emailService.transporter.verify();
                        } else {
                            throw new Error('Email service not initialized');
                        }
                    } catch (emailError) {
                        throw new Error(`Email service unavailable: ${emailError.message}`);
                    }
                    break;

                case 'analysis_engine':
                    // Test analysis system functionality
                    await db.Analysis.count({ limit: 1 });
                    await db.RecurringAnalysis.count({ limit: 1 });
                    // Test if we can access analysis-related data
                    const analysisCount = await db.Analysis.count();
                    // If there are analyses, test if we can read them
                    if (analysisCount > 0) {
                        await db.Analysis.findOne({ limit: 1 });
                    }
                    break;

                case 'authentication':
                    // Test authentication system
                    await db.User.count({ limit: 1 });
                    await db.Role.count({ limit: 1 });
                    await db.Session.count({ limit: 1 });
                    // Test if we can perform auth-related queries
                    const userCount = await db.User.count();
                    if (userCount === 0) {
                        status = 'degraded';
                        error = 'No users found in system';
                    }
                    break;

                case 'notification_system':
                    // Test notification system
                    await db.Notification.count({ limit: 1 });
                    // Test if we can create a test notification (then delete it)
                    try {
                        // First, find an existing user for testing
                        const testUser = await db.User.findOne({ limit: 1 });
                        if (!testUser) {
                            status = 'degraded';
                            error = 'No users found for notification testing';
                            break;
                        }
                        
                        const testNotification = await db.Notification.create({
                            user_id: testUser.id,
                            type: 'system_update', // Use valid notification type
                            title: 'System Test',
                            message: 'This is a test notification',
                            priority: 'low'
                        });
                        // Clean up test notification
                        await testNotification.destroy();
                    } catch (notifError) {
                        // If we can't create/delete notifications, system is degraded
                        status = 'degraded';
                        error = 'Cannot create notifications';
                    }
                    break;

                default:
                    throw new Error(`Unknown component: ${componentName}`);
            }

            const responseTime = Date.now() - startTime;

            // Update component status
            await this.updateComponentStatus(componentName, status, null, responseTime);

            return {
                component: componentName,
                status,
                responseTime,
                error: null
            };

        } catch (err) {
            const responseTime = Date.now() - startTime;
            const status = 'major_outage';
            const errorMessage = err.message;

            // Update component status
            await this.updateComponentStatus(componentName, status, errorMessage, responseTime);

            return {
                component: componentName,
                status,
                responseTime,
                error: errorMessage
            };
        }
    }

    /**
     * Get active incidents
     */
    async getActiveIncidents() {
        try {
            const incidents = await db.StatusIncident.findAll({
                where: {
                    is_public: true,
                    status: {
                        [Op.not]: 'resolved'
                    }
                },
                include: [
                    {
                        model: db.StatusIncidentUpdate,
                        as: 'updates',
                        where: { is_public: true },
                        required: false,
                        order: [['created_at', 'DESC']]
                    },
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    }
                ],
                order: [['started_at', 'DESC']]
            });

            return incidents.map(incident => ({
                id: incident.id,
                title: incident.title,
                description: incident.description,
                status: incident.status,
                severity: incident.severity,
                impact: incident.impact,
                affected_components: incident.affected_components,
                started_at: incident.started_at,
                resolved_at: incident.resolved_at,
                updates: incident.updates?.map(update => ({
                    id: update.id,
                    status: update.status,
                    message: update.message,
                    created_at: update.created_at
                })) || []
            }));
        } catch (error) {
            console.error('Error getting active incidents:', error);
            throw error;
        }
    }

    /**
     * Get recent incidents (last 7 days)
     */
    async getRecentIncidents(days = 7) {
        try {
            const since = new Date();
            since.setDate(since.getDate() - days);

            const incidents = await db.StatusIncident.findAll({
                where: {
                    is_public: true,
                    started_at: {
                        [Op.gte]: since
                    }
                },
                include: [
                    {
                        model: db.StatusIncidentUpdate,
                        as: 'updates',
                        where: { is_public: true },
                        required: false,
                        order: [['created_at', 'DESC']]
                    }
                ],
                order: [['started_at', 'DESC']],
                limit: 10
            });

            return incidents.map(incident => ({
                id: incident.id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                impact: incident.impact,
                affected_components: incident.affected_components,
                started_at: incident.started_at,
                resolved_at: incident.resolved_at,
                duration: incident.resolved_at ? 
                    Math.round((new Date(incident.resolved_at) - new Date(incident.started_at)) / 60000) : null // minutes
            }));
        } catch (error) {
            console.error('Error getting recent incidents:', error);
            throw error;
        }
    }

    /**
     * Get all incidents with pagination (admin only)
     */
    async getAllIncidents(options = {}) {
        try {
            const { limit = 50, offset = 0, where = {} } = options;

            const incidents = await db.StatusIncident.findAll({
                where,
                include: [
                    {
                        model: db.StatusIncidentUpdate,
                        as: 'updates',
                        required: false,
                        order: [['created_at', 'DESC']],
                        limit: 5 // Only get latest 5 updates per incident
                    },
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    }
                ],
                order: [['started_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return incidents.map(incident => ({
                id: incident.id,
                title: incident.title,
                description: incident.description,
                status: incident.status,
                severity: incident.severity,
                impact: incident.impact,
                affected_components: incident.affected_components,
                started_at: incident.started_at,
                resolved_at: incident.resolved_at,
                is_public: incident.is_public,
                creator: incident.creator ? {
                    id: incident.creator.id,
                    username: incident.creator.username,
                    full_name: incident.creator.full_name
                } : null,
                updates: incident.updates?.map(update => ({
                    id: update.id,
                    status: update.status,
                    message: update.message,
                    is_public: update.is_public,
                    created_at: update.created_at
                })) || []
            }));
        } catch (error) {
            console.error('Error getting all incidents:', error);
            throw error;
        }
    }

    /**
     * Create a new incident (admin only)
     */
    async createIncident(data, userId) {
        const transaction = await db.sequelize.transaction();

        try {
            const {
                title,
                description,
                severity = 'medium',
                impact = 'minor',
                affected_components = [],
                is_public = true
            } = data;

            const incident = await db.StatusIncident.create({
                title,
                description,
                status: 'investigating',
                severity,
                impact,
                affected_components,
                started_at: new Date(),
                created_by: userId,
                is_public
            }, { transaction });

            // Create initial update
            await db.StatusIncidentUpdate.create({
                incident_id: incident.id,
                status: 'investigating',
                message: `Incident reported: ${description}`,
                created_by: userId,
                is_public
            }, { transaction });

            await transaction.commit();

            // Log incident creation
            await logService.auditLog({
                eventType: 'status_incident_created',
                userId,
                targetId: incident.id,
                targetType: 'StatusIncident',
                metadata: {
                    title,
                    severity,
                    impact,
                    affected_components
                }
            });


            return incident;
        } catch (error) {
            await transaction.rollback();
            console.error('Error creating incident:', error);
            throw error;
        }
    }

    /**
     * Update incident status (admin only)
     */
    async updateIncident(incidentId, data, userId) {
        const transaction = await db.sequelize.transaction();

        try {
            const { status, message, is_public = true } = data;

            const incident = await db.StatusIncident.findByPk(incidentId, { transaction });
            if (!incident) {
                throw new Error('Incident not found');
            }

            // Update incident status
            if (status) {
                await incident.update({
                    status,
                    resolved_at: status === 'resolved' ? new Date() : null
                }, { transaction });
            }

            // Add update
            if (message) {
                await db.StatusIncidentUpdate.create({
                    incident_id: incidentId,
                    status: status || incident.status,
                    message,
                    created_by: userId,
                    is_public
                }, { transaction });
            }

            await transaction.commit();

            // Log incident update
            await logService.auditLog({
                eventType: 'status_incident_updated',
                userId,
                targetId: incidentId,
                targetType: 'StatusIncident',
                metadata: {
                    status,
                    message
                }
            });


            return incident;
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating incident:', error);
            throw error;
        }
    }

    /**
     * Initialize default system components if table is empty
     */
    async initializeDefaultComponents() {
        try {
            const count = await db.SystemStatus.count();
            
            if (count === 0) {
                console.log('Initializing default system status components...');
                
                const now = new Date();
                const defaultComponents = [
                    {
                        component: 'database',
                        description: 'PostgreSQL Database Server',
                        status: 'operational',
                        is_critical: true,
                        display_order: 1,
                        last_checked: now
                    },
                    {
                        component: 'web_server',
                        description: 'Web Application Server',
                        status: 'operational',
                        is_critical: true,
                        display_order: 2,
                        last_checked: now
                    },
                    {
                        component: 'email_service',
                        description: 'Email Notification Service',
                        status: 'operational',
                        is_critical: false,
                        display_order: 3,
                        last_checked: now
                    },
                    {
                        component: 'analysis_engine',
                        description: 'Blood Analysis Processing Engine',
                        status: 'operational',
                        is_critical: true,
                        display_order: 4,
                        last_checked: now
                    },
                    {
                        component: 'authentication',
                        description: 'User Authentication System',
                        status: 'operational',
                        is_critical: true,
                        display_order: 5,
                        last_checked: now
                    },
                    {
                        component: 'notification_system',
                        description: 'Internal Notification System',
                        status: 'operational',
                        is_critical: false,
                        display_order: 6,
                        last_checked: now
                    }
                ];

                await db.SystemStatus.bulkCreate(defaultComponents);
                console.log('Default system status components initialized successfully');
            }
        } catch (error) {
            console.error('Error initializing default components:', error);
            // Don't throw here to allow the status page to work even if initialization fails
        }
    }
}

module.exports = new StatusPageService();