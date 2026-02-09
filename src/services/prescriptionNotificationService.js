// services/prescriptionNotificationService.js
const db = require('../db');
const notificationService = require('./notificationService');
const organizationSettingsService = require('./organizationSettingsService');
const DateFormatter = require('../utils/dateFormatter');
const userService = require('./userService');
const cryptoService = require('./cryptoService');
const { Op } = require('sequelize');

class PrescriptionNotificationService {
    /**
     * Check for recurring analyses that need prescription validation and send notifications
     */
    async checkAndNotifyPrescriptionValidation() {
        try {
            // Check if prescription notifications are enabled
            const notificationsEnabledResult = await organizationSettingsService.getSetting('prescription_notification_enabled', true);
            const notificationsEnabled = notificationsEnabledResult.success ? notificationsEnabledResult.setting.value : true;
            if (!notificationsEnabled) {
                console.log('Prescription validation notifications are disabled');
                return;
            }

            // Get the notification timeframe (hours)
            const notificationHoursResult = await organizationSettingsService.getSetting('prescription_validation_notification_hours', 24);
            const notificationHours = notificationHoursResult.success ? notificationHoursResult.setting.value : 24;
            const notificationTime = new Date(Date.now() + (notificationHours * 60 * 60 * 1000));

            // Find recurring analyses that are due within the notification timeframe
            // and don't have valid prescriptions
            const upcomingAnalyses = await db.Analysis.findAll({
                where: {
                    analysis_date: {
                        [Op.between]: [new Date(), notificationTime]
                    },
                    recurring_analysis_id: {
                        [Op.not]: null
                    },
                    status: {
                        [Op.in]: ['Scheduled', 'Pending']
                    }
                },
                include: [
                    {
                        model: db.RecurringAnalysis,
                        as: 'recurringPattern',
                        required: false, // Don't filter out if recurring pattern is missing
                        include: [
                            {
                                model: db.Prescription,
                                as: 'prescriptions',
                                required: false,
                                where: {
                                    status: 'Active',
                                    remaining_analyses: {
                                        [Op.gt]: 0
                                    }
                                }
                            }
                        ]
                    },
                    {
                        model: db.Patient,
                        as: 'patient',
                        attributes: ['id', 'name'],
                        required: false
                    },
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name'],
                        required: false
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        required: false,
                        include: [
                            {
                                model: db.Service,
                                as: 'service',
                                attributes: ['id', 'name'],
                                required: false
                            }
                        ]
                    }
                ]
            });

            console.log(`Found ${upcomingAnalyses.length} upcoming recurring analyses to check`);
            console.log('Search criteria:', {
                dateRange: `${new Date().toISOString()} to ${notificationTime.toISOString()}`,
                notificationHours: notificationHours
            });
            
            // Debug: let's also check total analyses and recurring analyses
            const totalAnalyses = await db.Analysis.count({
                where: {
                    recurring_analysis_id: { [Op.not]: null }
                }
            });
            console.log(`Total analyses with recurring_analysis_id: ${totalAnalyses}`);
            
            // Debug: check what analyses exist in the next week
            const nextWeek = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
            const upcomingDebug = await db.Analysis.findAll({
                where: {
                    recurring_analysis_id: { [Op.not]: null },
                    analysis_date: { [Op.between]: [new Date(), nextWeek] }
                },
                attributes: ['id', 'analysis_date', 'status', 'recurring_analysis_id'],
                limit: 5
            });
            console.log(`Sample upcoming recurring analyses:`, upcomingDebug.map(a => ({
                id: a.id,
                date: a.analysis_date,
                status: a.status,
                recurringId: a.recurring_analysis_id
            })));
            
            // Debug: Check the RecurringAnalysis record status
            const recurringPattern = await db.RecurringAnalysis.findOne({
                where: { id: 42 }, // Using the recurring ID from the sample data
                attributes: ['id', 'is_active', 'patient_id', 'doctor_id']
            });
            console.log('RecurringAnalysis record:', recurringPattern ? {
                id: recurringPattern.id,
                is_active: recurringPattern.is_active,
                patient_id: recurringPattern.patient_id,
                doctor_id: recurringPattern.doctor_id
            } : 'Not found');

            for (const analysis of upcomingAnalyses) {
                // Check if this analysis has a valid prescription
                const hasValidPrescription = await this.hasValidPrescriptionForAnalysis(
                    analysis.recurring_analysis_id, 
                    analysis.analysis_date
                );

                if (!hasValidPrescription) {
                    await this.sendPrescriptionValidationNotification(analysis);
                }
            }

        } catch (error) {
            console.error('Error checking prescription validation notifications:', error);
        }
    }

    /**
     * Check if a specific analysis has a valid prescription
     */
    async hasValidPrescriptionForAnalysis(recurringAnalysisId, analysisDate) {
        try {
            const validPrescription = await db.Prescription.findOne({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    status: 'Active',
                    remaining_analyses: {
                        [Op.gt]: 0
                    },
                    valid_from: {
                        [Op.lte]: analysisDate
                    },
                    valid_until: {
                        [Op.gte]: analysisDate
                    }
                }
            });

            if (!validPrescription) {
                return false;
            }

            // Check if this analysis is covered by counting processed analyses
            const analysesProcessed = await db.Analysis.count({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    analysis_date: {
                        [Op.gte]: validPrescription.valid_from,
                        [Op.lte]: analysisDate
                    },
                    status: {
                        [Op.in]: ['Completed', 'Validated']
                    }
                }
            });

            return analysesProcessed <= validPrescription.total_analyses_prescribed;
        } catch (error) {
            console.error('Error checking prescription validity:', error);
            return false;
        }
    }

    /**
     * Send prescription validation notification to agents in the service
     */
    async sendPrescriptionValidationNotification(analysis) {
        try {
            // Prevent duplicate notifications - check if we already sent one for this analysis
            const existingNotification = await db.Notification.findOne({
                where: {
                    type: 'prescription_verification',
                    related_type: 'Analysis',
                    related_id: analysis.id,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
                    }
                }
            });

            if (existingNotification) {
                console.log(`Notification already sent for analysis ${analysis.id}`);
                return;
            }

            // Get all agents (users with agent role) in the service
            const serviceId = analysis.room?.service?.id;
            if (!serviceId) {
                console.log(`No service found for analysis ${analysis.id}`);
                return;
            }

            const agents = await db.User.findAll({
                include: [
                    {
                        model: db.Role,
                        as: 'role',
                        where: {
                            name: {
                                [Op.in]: ['system_admin', 'admin', 'userManager', 'staff']
                            }
                        }
                    },
                    {
                        model: db.Service,
                        as: 'service',
                        where: {
                            id: serviceId
                        }
                    }
                ],
                where: {
                    account_locked: false
                }
            });

            console.log(`Found ${agents.length} agents in service ${analysis.room.service.name}`);

            // Send notifications to all agents in the service
            for (const agent of agents) {
                
                // Get user's date format preference
                const userPreferencesResult = await userService.getUserDisplayPreferences(agent.id);
                const dateFormat = userPreferencesResult.preferences?.dateFormat || 'DD/MM/YYYY';
                
                // Format the date according to user's preference
                const formattedDate = DateFormatter.formatDate(analysis.analysis_date, dateFormat);
                
                // Decrypt patient name for notification
                const decryptedPatientName = await cryptoService.decrypt(analysis.patient.name);
                
                const notificationData = {
                    userIds: agent.id,  // Changed from user_id to userIds
                    type: 'prescription_verification',
                    title: 'Prescription Validation Required',
                    message: `A recurring analysis for patient ${decryptedPatientName} is scheduled for ${formattedDate} and requires prescription validation.`,
                    priority: 'high',
                    actionRequired: true,  // Changed from action_required to actionRequired
                    actionUrl: `/restricted/dashboard/analyses?analysis=${analysis.id}`,  // Changed from action_url to actionUrl
                    relatedId: analysis.id,  // Changed from related_id to relatedId
                    relatedType: 'Analysis',  // Changed from related_type to relatedType
                    expiresAt: analysis.analysis_date,  // Changed from expires_at to expiresAt
                    metadata: {
                        recurring_analysis_id: analysis.recurring_analysis_id,
                        patient_id: analysis.patient_id,
                        service_id: serviceId,
                        service_name: analysis.room.service.name,
                        analysis_date: analysis.analysis_date,
                        patient_name: analysis.patient.name,
                        doctor_name: analysis.doctor.name
                    }
                };

                await notificationService.createNotification(notificationData);
            }

            console.log(`Sent prescription validation notifications for analysis ${analysis.id} to ${agents.length} agents`);

        } catch (error) {
            console.error('Error sending prescription validation notification:', error);
        }
    }

    /**
     * Dismiss prescription validation notifications when a prescription is validated
     * @param {number} recurringAnalysisId - The recurring analysis ID  
     * @param {string|Date} analysisDate - Optional: specific analysis date to dismiss
     * @param {number} analysisId - Optional: specific analysis ID to dismiss (more precise than date)
     */
    async dismissPrescriptionNotifications(recurringAnalysisId, analysisDate = null, analysisId = null) {
        try {
            console.log(`[DEBUG] Attempting to dismiss prescription notifications for recurring analysis ID: ${recurringAnalysisId}${analysisId ? `, analysis ID: ${analysisId}` : ''}${analysisDate ? `, analysis date: ${analysisDate}` : ' (all dates)'}`);
            
            // First, let's see ALL prescription notifications to understand what we're working with
            const allNotifications = await db.Notification.findAll({
                where: {
                    type: 'prescription_verification',
                    related_type: 'Analysis',
                    is_dismissed: false
                },
                attributes: ['id', 'metadata', 'related_id']
            });

            console.log(`[DEBUG] ALL active prescription notifications (${allNotifications.length}):`, 
                allNotifications.map(n => ({ 
                    id: n.id, 
                    related_id: n.related_id,
                    recurringAnalysisId: n.metadata?.recurring_analysis_id,
                    analysisDate: n.metadata?.analysis_date,
                    patientName: n.metadata?.patient_name
                })));

            // Build the where clause for finding notifications to dismiss
            let whereClause;
            
            if (analysisId) {
                // Most precise: dismiss by specific analysis ID
                whereClause = {
                    type: 'prescription_verification',
                    related_type: 'Analysis',
                    related_id: analysisId,
                    is_dismissed: false
                };
                console.log(`[DEBUG] Using analysis ID ${analysisId} for precise targeting`);
            } else {
                // Less precise: use recurring analysis ID and possibly date
                whereClause = {
                    type: 'prescription_verification',
                    related_type: 'Analysis',
                    is_dismissed: false,
                    [db.Sequelize.Op.and]: [
                        db.Sequelize.where(
                            db.Sequelize.literal("metadata->>'recurring_analysis_id'"),
                            recurringAnalysisId.toString()
                        )
                    ]
                };

                // If a specific analysis date is provided, only dismiss notifications for that date
                if (analysisDate) {
                    const dateStr = analysisDate instanceof Date ? analysisDate.toISOString() : new Date(analysisDate).toISOString();
                    whereClause[db.Sequelize.Op.and].push(
                        db.Sequelize.where(
                            db.Sequelize.literal("metadata->>'analysis_date'"),
                            dateStr
                        )
                    );
                    console.log(`[DEBUG] Using date filtering with date: ${dateStr}`);
                }
            }
            
            // Find notifications to dismiss
            const notificationsToUpdate = await db.Notification.findAll({
                where: whereClause,
                attributes: ['id', 'metadata', 'related_id']
            });

            console.log(`[DEBUG] Found ${notificationsToUpdate.length} notifications to dismiss:`, 
                notificationsToUpdate.map(n => ({ 
                    id: n.id, 
                    related_id: n.related_id,
                    recurringAnalysisId: n.metadata?.recurring_analysis_id,
                    analysisDate: n.metadata?.analysis_date,
                    patientName: n.metadata?.patient_name
                })));
                
            // If we found notifications to dismiss, log which strategy was used
            if (notificationsToUpdate.length > 0) {
                if (analysisId) {
                    console.log(`[DEBUG] Using ANALYSIS ID strategy - should dismiss only 1 notification for analysis ID ${analysisId}`);
                } else if (analysisDate) {
                    console.log(`[DEBUG] Using ANALYSIS DATE strategy - should dismiss notifications for date ${analysisDate}`);
                } else {
                    console.log(`[DEBUG] Using RECURRING ANALYSIS ID strategy - may dismiss ALL notifications for recurring analysis ${recurringAnalysisId}`);
                }
            }

            if (notificationsToUpdate.length > 0) {
                // Update notifications using the IDs we found
                const [updatedCount] = await db.Notification.update(
                    { is_dismissed: true },
                    {
                        where: {
                            id: {
                                [db.Sequelize.Op.in]: notificationsToUpdate.map(n => n.id)
                            }
                        }
                    }
                );

                console.log(`Successfully dismissed ${updatedCount} prescription validation notifications`);
            } else {
                console.log(`No prescription validation notifications found to dismiss`);
            }
        } catch (error) {
            console.error('Error dismissing prescription notifications:', error);
        }
    }
}

module.exports = new PrescriptionNotificationService();