const db = require('../db');
const logService = require('./logService');
const prescriptionService = require('./prescriptionService');
const analysisService = require('./analysisService');

class RecurringAnalysisService {
    /**
     * Validate recurring analysis dates against organization constraints
     */
    async _validateRecurringAnalysisDates(data) {
        const validationResults = [];
        let dates = [];
        
        // Use pre-calculated dates if provided (already adjusted for working days)
        if (data.calculatedDates && Array.isArray(data.calculatedDates)) {
            dates = data.calculatedDates.map(dateStr => new Date(dateStr));
        } else {
            // Fallback to generating dates (original behavior)
            let currentDate = new Date(data.analysisDate);
            
            for (let i = 0; i < data.totalOccurrences; i++) {
                dates.push(new Date(currentDate));
                if (i < data.totalOccurrences - 1) {
                    currentDate = this.calculateNextDueDate(currentDate, data.recurrencePattern, data.intervalDays);
                }
            }
        }

        // Get organization settings
        const maxAnalysesPerDay = await this._getOrganizationSetting('max_analyses_per_day');
        const workingDays = await this._getOrganizationSetting('working_days');
        const workingDaysArray = workingDays ? JSON.parse(workingDays) : null;

        // Check each date
        for (let i = 0; i < dates.length; i++) {
            const analysisDate = dates[i];
            const dayName = analysisDate.toLocaleDateString('en-US', { weekday: 'long' });

            // Check working days constraint
            if (workingDaysArray && !workingDaysArray.includes(dayName)) {
                validationResults.push({
                    occurrence: i + 1,
                    date: analysisDate,
                    issue: `${dayName} is not a working day`,
                    suggestion: `Skip this occurrence or adjust schedule`
                });
                continue;
            }

            // Check max analyses per day constraint
            if (maxAnalysesPerDay) {
                const analysisCount = await db.sequelize.query(
                    `SELECT COUNT(*) as count FROM analyses WHERE DATE(analysis_date) = DATE(:analysisDate)`,
                    {
                        replacements: { analysisDate: analysisDate.toDateString() },
                        type: db.Sequelize.QueryTypes.SELECT
                    }
                );

                if (analysisCount[0].count >= parseInt(maxAnalysesPerDay)) {
                    validationResults.push({
                        occurrence: i + 1,
                        date: analysisDate,
                        issue: `Maximum analyses per day (${maxAnalysesPerDay}) would be exceeded`,
                        suggestion: `Adjust interval or reduce occurrences`
                    });
                }
            }
        }

        return {
            isValid: validationResults.length === 0,
            issues: validationResults,
            totalDates: dates.length
        };
    }

    /**
     * Get organization setting value
     */
    async _getOrganizationSetting(settingKey) {
        try {
            const result = await db.sequelize.query(
                'SELECT get_organization_setting(:settingKey) as value',
                {
                    replacements: { settingKey },
                    type: db.Sequelize.QueryTypes.SELECT
                }
            );

            return result[0].value;
        } catch (error) {
            console.error(`Error getting organization setting ${settingKey}:`, error);
            return null;
        }
    }

    /**
     * Create a new recurring analysis pattern and ALL future analyses
     */
    async createRecurringAnalysis(data, userId) {
        // Validate recurring analysis dates against organization constraints
        const validation = await this._validateRecurringAnalysisDates(data);
        
        if (!validation.isValid) {
            return {
                success: false,
                message: 'Recurring analysis validation failed',
                issues: validation.issues,
                totalConflicts: validation.issues.length
            };
        }

        const transaction = await db.sequelize.transaction();

        try {
            // Create the recurring analysis record
            const recurringAnalysis = await db.RecurringAnalysis.create({
                patient_id: data.patientId,
                doctor_id: data.doctorId,
                room_id: data.roomId,
                analysis_type: data.analysisType,
                recurrence_pattern: data.recurrencePattern,
                interval_days: data.intervalDays || this.getDefaultInterval(data.recurrencePattern),
                total_occurrences: data.totalOccurrences,
                completed_occurrences: 0,
                next_due_date: data.analysisDate, // Set to first date initially
                notes: data.notes,
                created_by: userId,
                is_active: true
            }, { transaction });

            // Create ALL analyses upfront using pre-calculated dates if available
            const analyses = [];
            let analysisDates = [];
            
            // Use pre-calculated dates if provided (already adjusted for working days)
            if (data.calculatedDates && Array.isArray(data.calculatedDates)) {
                analysisDates = data.calculatedDates.map(dateStr => new Date(dateStr));
            } else {
                // Fallback to generating dates (original behavior)
                let currentDate = new Date(data.analysisDate);
                for (let i = 0; i < data.totalOccurrences; i++) {
                    analysisDates.push(new Date(currentDate));
                    if (i < data.totalOccurrences - 1) {
                        currentDate = this.calculateNextDueDate(currentDate, data.recurrencePattern, data.intervalDays);
                    }
                }
            }
            
            for (let i = 0; i < data.totalOccurrences; i++) {
                const analysis = await db.Analysis.create({
                    analysis_date: analysisDates[i],
                    patient_id: data.patientId,
                    doctor_id: data.doctorId,
                    room_id: data.roomId,
                    analysis_type: data.analysisType,
                    status: 'Pending',
                    notes: `${data.notes || ''} [Recurring ${i + 1}/${data.totalOccurrences}]`.trim(),
                    created_by: userId,
                    recurring_analysis_id: recurringAnalysis.id,
                    occurrence_number: i + 1 // Track which occurrence this is
                }, { transaction });
                
                analyses.push(analysis);
            }

            // Create an initial prescription for ONLY the first analysis
            const firstAnalysis = analyses[0];
            
            // Generate a prescription number
            const prescriptionNumber = `AUTO-${recurringAnalysis.id}-${Date.now()}`;
            
            // Create the prescription directly within the same transaction
            // This prescription only covers the first analysis
            const prescription = await db.Prescription.create({
                recurring_analysis_id: recurringAnalysis.id,
                patient_id: recurringAnalysis.patient_id,
                doctor_id: recurringAnalysis.doctor_id,
                prescribed_by: userId,
                prescription_number: prescriptionNumber,
                valid_from: firstAnalysis.analysis_date,
                valid_until: firstAnalysis.analysis_date, // Only valid for the first analysis date
                remaining_analyses: 1, // Only covers 1 analysis
                total_analyses_prescribed: 1, // Only prescribed 1 analysis
                notes: 'Automatically created prescription for first analysis in recurring series',
                status: 'Active',
                verified_at: new Date()
            }, { transaction });

            // Update the recurring analysis to mark it as fully scheduled
            // Keep the last analysis date as next_due_date even though pattern is complete
            await recurringAnalysis.update({
                completed_occurrences: data.totalOccurrences,
                last_scheduled_date: analyses[analyses.length - 1].analysis_date,
                next_due_date: analyses[analyses.length - 1].analysis_date, // Keep last date instead of null
                is_active: false // Pattern is complete
            }, { transaction });

            await transaction.commit();

            // Log the creation
            await logService.auditLog({
                eventType: 'recurring_analysis_created',
                userId: userId,
                targetId: recurringAnalysis.id,
                targetType: 'RecurringAnalysis',
                metadata: {
                    pattern: data.recurrencePattern,
                    total_occurrences: data.totalOccurrences,
                    patient_id: data.patientId,
                    analyses_created: analyses.map(a => a.id),
                    auto_prescription_created: true
                }
            });

            return {
                success: true,
                recurringAnalysis,
                analyses
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Process due recurring analyses (to be called by scheduler)
     */
    async processDueRecurringAnalyses() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            // Find all active recurring analyses that are due
            const dueRecurringAnalyses = await db.RecurringAnalysis.findAll({
                where: {
                    is_active: true,
                    next_due_date: {
                        [db.Sequelize.Op.lte]: today
                    },
                    completed_occurrences: {
                        [db.Sequelize.Op.lt]: db.Sequelize.col('total_occurrences')
                    }
                },
                include: [
                    {
                        model: db.Patient,
                        as: 'Patient',
                        attributes: ['id', 'name']
                    },
                    {
                        model: db.User,
                        as: 'Creator',
                        include: [{
                            model: db.Service,
                            as: 'Service',
                            attributes: ['id', 'name']
                        }]
                    }
                ]
            });

            const results = [];
            
            for (const recurring of dueRecurringAnalyses) {
                try {
                    const result = await this.scheduleNextAnalysis(recurring);
                    results.push({ success: true, recurringId: recurring.id, result });
                } catch (error) {
                    console.error(`Failed to schedule analysis for recurring pattern ${recurring.id}:`, error);
                    results.push({ success: false, recurringId: recurring.id, error: error.message });
                }
            }

            return results;
        } catch (error) {
            console.error('Error processing due recurring analyses:', error);
            throw error;
        }
    }

    /**
     * Schedule the next analysis in a recurring pattern
     */
    async scheduleNextAnalysis(recurringAnalysis) {
        const transaction = await db.sequelize.transaction();

        try {
            // Check if we've reached the total occurrences
            if (recurringAnalysis.completed_occurrences >= recurringAnalysis.total_occurrences) {
                await recurringAnalysis.update({ is_active: false }, { transaction });
                await transaction.commit();
                return { message: 'Recurring pattern completed' };
            }

            // Calculate the analysis date (use next_due_date)
            const analysisDate = new Date(recurringAnalysis.next_due_date);

            // Check if there's a valid prescription for this analysis
            const hasValidPrescription = await prescriptionService.hasValidPrescription(
                recurringAnalysis.id,
                analysisDate
            );

            if (!hasValidPrescription) {
                // Skip this occurrence and schedule for next time
                const nextDueDate = this.calculateNextDueDate(
                    analysisDate,
                    recurringAnalysis.recurrence_pattern,
                    recurringAnalysis.interval_days
                );

                await recurringAnalysis.update({
                    next_due_date: nextDueDate
                }, { transaction });

                await transaction.commit();

                // Log the skipped analysis
                await logService.auditLog({
                    eventType: 'recurring_analysis_skipped_no_prescription',
                    userId: null,
                    targetId: recurringAnalysis.id,
                    targetType: 'RecurringAnalysis',
                    metadata: {
                        scheduledDate: analysisDate.toISOString(),
                        reason: 'No valid prescription available',
                        nextDueDate: nextDueDate.toISOString(),
                        patientId: recurringAnalysis.patient_id
                    }
                });

                return { 
                    message: 'Analysis skipped - no valid prescription',
                    skipped: true,
                    nextDueDate: nextDueDate,
                    reason: 'No valid prescription available'
                };
            }

            // Create the new analysis
            const newAnalysis = await db.Analysis.create({
                analysis_date: analysisDate,
                patient_id: recurringAnalysis.patient_id,
                doctor_id: recurringAnalysis.doctor_id,
                room_id: recurringAnalysis.room_id,
                analysis_type: recurringAnalysis.analysis_type,
                status: 'Pending',
                notes: recurringAnalysis.notes,
                created_by: recurringAnalysis.created_by,
                recurring_analysis_id: recurringAnalysis.id
            }, { transaction });

            // Calculate next due date
            const nextDueDate = this.calculateNextDueDate(
                analysisDate,
                recurringAnalysis.recurrence_pattern,
                recurringAnalysis.interval_days
            );

            // Update the recurring analysis
            const newCompletedCount = recurringAnalysis.completed_occurrences + 1;
            const isActive = newCompletedCount < recurringAnalysis.total_occurrences;

            await recurringAnalysis.update({
                completed_occurrences: newCompletedCount,
                last_scheduled_date: analysisDate,
                next_due_date: nextDueDate,
                is_active: isActive
            }, { transaction });

            await transaction.commit();

            // Consume one analysis from the prescription
            try {
                await prescriptionService.consumePrescriptionAnalysis(
                    recurringAnalysis.id,
                    analysisDate
                );
            } catch (error) {
                console.error('Error consuming prescription analysis:', error);
                // Don't fail the entire process if prescription consumption fails
            }

            // Send notification to service agents
            await this.sendRecurringAnalysisNotification(recurringAnalysis, newAnalysis);

            // Log the scheduling
            await logService.auditLog({
                eventType: 'recurring_analysis_scheduled',
                userId: recurringAnalysis.created_by,
                targetId: newAnalysis.id,
                targetType: 'Analysis',
                metadata: {
                    recurring_analysis_id: recurringAnalysis.id,
                    occurrence_number: newCompletedCount,
                    total_occurrences: recurringAnalysis.total_occurrences,
                    patient_id: recurringAnalysis.patient_id
                }
            });

            return {
                analysis: newAnalysis,
                occurrence: newCompletedCount,
                total: recurringAnalysis.total_occurrences,
                isCompleted: !isActive
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Send notification to service agents about due recurring analysis
     */
    async sendRecurringAnalysisNotification(recurringAnalysis, newAnalysis) {
        try {
            // Get users from the same service as the creator
            const serviceUsers = await db.User.findAll({
                where: {
                    service_id: recurringAnalysis.Creator.service_id,
                    active: true
                },
                attributes: ['id', 'username', 'full_name', 'email']
            });

            // TODO: Implement actual notification system (email, websocket, etc.)
            // For now, we'll log the notification
            console.log(`Notification: New recurring analysis scheduled for patient ${recurringAnalysis.Patient.name}`);
            console.log(`Analysis ID: ${newAnalysis.id}, Date: ${newAnalysis.analysis_date}`);
            console.log(`Service users to notify: ${serviceUsers.map(u => u.username).join(', ')}`);

            // Log notification event
            await logService.auditLog({
                eventType: 'recurring_analysis_notification_sent',
                userId: null,
                targetId: newAnalysis.id,
                targetType: 'Analysis',
                metadata: {
                    recurring_analysis_id: recurringAnalysis.id,
                    patient_id: recurringAnalysis.patient_id,
                    service_id: recurringAnalysis.Creator.service_id,
                    notified_users: serviceUsers.length
                }
            });

        } catch (error) {
            console.error('Failed to send recurring analysis notification:', error);
        }
    }

    /**
     * Calculate next due date based on pattern and interval
     */
    calculateNextDueDate(currentDate, pattern, intervalDays) {
        const nextDate = new Date(currentDate);

        switch (pattern) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'custom':
                nextDate.setDate(nextDate.getDate() + (intervalDays || 1));
                break;
            default:
                nextDate.setDate(nextDate.getDate() + (intervalDays || 1));
        }

        return nextDate;
    }

    /**
     * Get default interval for pattern
     */
    getDefaultInterval(pattern) {
        switch (pattern) {
            case 'daily': return 1;
            case 'weekly': return 7;
            case 'monthly': return 30;
            default: return 1;
        }
    }

    /**
     * Get recurring analysis with details
     */
    async getRecurringAnalysis(id) {
        return await db.RecurringAnalysis.findByPk(id, {
            include: [
                {
                    model: db.Patient,
                    as: 'Patient',
                    attributes: ['id', 'name', 'matricule_national']
                },
                {
                    model: db.Doctor,
                    as: 'Doctor',
                    attributes: ['id', 'name', 'specialization']
                },
                {
                    model: db.Room,
                    as: 'Room',
                    attributes: ['id', 'room_number', 'service_id']
                },
                {
                    model: db.User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'full_name']
                }
            ]
        });
    }

    /**
     * Deactivate recurring analysis
     */
    async deactivateRecurringAnalysis(id, userId, reason) {
        const transaction = await db.sequelize.transaction();

        try {
            const recurringAnalysis = await db.RecurringAnalysis.findByPk(id);
            if (!recurringAnalysis) {
                throw new Error('Recurring analysis not found');
            }

            await recurringAnalysis.update({
                is_active: false,
                notes: recurringAnalysis.notes ? 
                    `${recurringAnalysis.notes}\n\nDeactivated: ${reason}` : 
                    `Deactivated: ${reason}`
            }, { transaction });

            await transaction.commit();

            // Log the deactivation
            await logService.auditLog({
                eventType: 'recurring_analysis_deactivated',
                userId: userId,
                targetId: id,
                targetType: 'RecurringAnalysis',
                metadata: {
                    reason: reason,
                    patient_id: recurringAnalysis.patient_id
                }
            });

            return recurringAnalysis;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Get analyses for a recurring pattern
     */
    async getAnalysesForRecurringPattern(recurringId) {
        return await db.Analysis.findAll({
            where: {
                recurring_analysis_id: recurringId
            },
            order: [['analysis_date', 'ASC']],
            include: [
                {
                    model: db.Patient,
                    as: 'Patient',
                    attributes: ['id', 'name']
                }
            ]
        });
    }
}

module.exports = new RecurringAnalysisService();