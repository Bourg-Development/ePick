const db = require('../db');
const logService = require('./logService');
const notificationService = require('./notificationService');

class PrescriptionService {
    /**
     * Validate that a prescription was received for a recurring analysis
     * This is called by agents to confirm they received a physical prescription
     */
    async validatePrescriptionReceived(data, userId) {
        const transaction = await db.sequelize.transaction();

        try {
            const {
                recurringAnalysisId,
                prescriptionNumber,
                validFrom,
                validUntil,
                totalAnalysesPrescribed,
                validationNotes = null,
                analysisDate = null, // Analysis date for specific dismissal
                analysisId = null // Analysis ID for specific dismissal
            } = data;

            console.log(`[DEBUG] validatePrescriptionReceived called with data:`, {
                recurringAnalysisId,
                analysisDate,
                analysisId,
                analysisDateType: typeof analysisDate,
                fullData: data
            });

            // Get the recurring analysis to validate
            const recurringAnalysis = await db.RecurringAnalysis.findByPk(recurringAnalysisId, {
                include: [
                    { model: db.Patient, as: 'Patient' },
                    { model: db.Doctor, as: 'Doctor' }
                ]
            });

            if (!recurringAnalysis) {
                throw new Error('Recurring analysis not found');
            }

            // Allow prescription validation for inactive recurring analyses
            // This will also reactivate the recurring analysis if it's inactive
            if (!recurringAnalysis.is_active) {
                await db.RecurringAnalysis.update(
                    { is_active: true },
                    { where: { id: recurringAnalysisId } }
                );
            }

            // Check if prescription number already exists
            const existingPrescription = await db.Prescription.findOne({
                where: { prescription_number: prescriptionNumber }
            });

            if (existingPrescription) {
                throw new Error('Prescription number already exists');
            }

            // Create the prescription record (validated by agent)
            const prescription = await db.Prescription.create({
                recurring_analysis_id: recurringAnalysisId,
                patient_id: recurringAnalysis.patient_id,
                doctor_id: recurringAnalysis.doctor_id,
                prescribed_by: userId,
                prescription_number: prescriptionNumber,
                valid_from: validFrom,
                valid_until: validUntil,
                remaining_analyses: totalAnalysesPrescribed,
                total_analyses_prescribed: totalAnalysesPrescribed,
                notes: validationNotes,
                status: 'Active',
                verified_at: new Date()
            }, { transaction });

            await transaction.commit();

            // Dismiss any existing prescription validation notifications for this recurring analysis
            // If analysisId is provided, only dismiss notifications for that specific analysis (most precise)
            // If analysisDate is provided, only dismiss notifications for that specific date
            const prescriptionNotificationService = require('./prescriptionNotificationService');
            await prescriptionNotificationService.dismissPrescriptionNotifications(recurringAnalysisId, analysisDate, analysisId);

            // Log the validation
            await logService.auditLog({
                eventType: 'prescription_validated',
                userId: userId,
                targetId: prescription.id,
                targetType: 'Prescription',
                metadata: {
                    recurringAnalysisId,
                    patientId: recurringAnalysis.patient_id,
                    prescriptionNumber,
                    totalAnalysesPrescribed,
                    validFrom,
                    validUntil,
                    validatedBy: userId
                }
            });

            return prescription;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Check if a specific analysis has a valid prescription
     */
    async hasValidPrescription(recurringAnalysisId, analysisDate) {
        try {
            // Get the specific analysis that needs validation
            const analysis = await db.Analysis.findOne({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    analysis_date: analysisDate
                }
            });

            if (!analysis) {
                return false;
            }

            // Check if this specific analysis already has a prescription
            const existingPrescription = await db.Prescription.findOne({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    status: 'Active',
                    remaining_analyses: {
                        [db.Sequelize.Op.gt]: 0
                    },
                    valid_from: {
                        [db.Sequelize.Op.lte]: analysisDate
                    },
                    valid_until: {
                        [db.Sequelize.Op.gte]: analysisDate
                    }
                }
            });

            if (!existingPrescription) {
                return false;
            }

            // Check if this analysis is already covered by counting how many analyses
            // in this recurring series have been processed since the prescription was created
            const analysesProcessedSincePresciption = await db.Analysis.count({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    analysis_date: {
                        [db.Sequelize.Op.gte]: existingPrescription.valid_from,
                        [db.Sequelize.Op.lte]: analysisDate
                    },
                    status: {
                        [db.Sequelize.Op.in]: ['Completed', 'Validated']
                    }
                }
            });

            // Return true only if this analysis falls within the prescription coverage
            return analysesProcessedSincePresciption <= existingPrescription.total_analyses_prescribed;
        } catch (error) {
            console.error('Error checking prescription validity:', error);
            return false;
        }
    }

    /**
     * Consume one analysis from a prescription
     */
    async consumePrescriptionAnalysis(recurringAnalysisId, analysisDate) {
        const transaction = await db.sequelize.transaction();

        try {
            // Find the valid prescription
            const prescription = await db.Prescription.findOne({
                where: {
                    recurring_analysis_id: recurringAnalysisId,
                    status: 'Active',
                    remaining_analyses: {
                        [db.Sequelize.Op.gt]: 0
                    },
                    valid_from: {
                        [db.Sequelize.Op.lte]: analysisDate
                    },
                    valid_until: {
                        [db.Sequelize.Op.gte]: analysisDate
                    }
                },
                transaction
            });

            if (!prescription) {
                throw new Error('No valid prescription found for this analysis');
            }

            // Decrease remaining analyses
            const newRemainingAnalyses = prescription.remaining_analyses - 1;
            const newStatus = newRemainingAnalyses === 0 ? 'Exhausted' : 'Active';

            await prescription.update({
                remaining_analyses: newRemainingAnalyses,
                status: newStatus
            }, { transaction });

            await transaction.commit();

            // Log the consumption
            await logService.auditLog({
                eventType: 'prescription_analysis_consumed',
                userId: null,
                targetId: prescription.id,
                targetType: 'Prescription',
                metadata: {
                    recurringAnalysisId,
                    analysisDate: analysisDate.toISOString(),
                    remainingAnalyses: newRemainingAnalyses,
                    prescriptionNumber: prescription.prescription_number
                }
            });

            return prescription;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Get active prescriptions for a recurring analysis
     */
    async getPrescriptionsForRecurringAnalysis(recurringAnalysisId) {
        try {
            const prescriptions = await db.Prescription.findAll({
                where: {
                    recurring_analysis_id: recurringAnalysisId
                },
                include: [
                    {
                        model: db.User,
                        as: 'prescriber',
                        attributes: ['id', 'username', 'full_name']
                    },
                    {
                        model: db.Patient,
                        as: 'patient',
                        attributes: ['id', 'name', 'matricule_national']
                    },
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name', 'specialization']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            return prescriptions;
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            throw error;
        }
    }

    /**
     * Update prescription status (expire, cancel, etc.)
     */
    async updatePrescriptionStatus(prescriptionId, newStatus, reason, userId) {
        const transaction = await db.sequelize.transaction();

        try {
            const prescription = await db.Prescription.findByPk(prescriptionId, { transaction });

            if (!prescription) {
                throw new Error('Prescription not found');
            }

            const oldStatus = prescription.status;
            
            await prescription.update({
                status: newStatus,
                notes: prescription.notes ? 
                    `${prescription.notes}\n\nStatus changed to ${newStatus}: ${reason}` : 
                    `Status changed to ${newStatus}: ${reason}`
            }, { transaction });

            await transaction.commit();

            // Log the status change
            await logService.auditLog({
                eventType: 'prescription_status_updated',
                userId: userId,
                targetId: prescriptionId,
                targetType: 'Prescription',
                metadata: {
                    oldStatus,
                    newStatus,
                    reason,
                    prescriptionNumber: prescription.prescription_number
                }
            });

            return prescription;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Check for analyses that need prescription verification
     * Since all analyses are created upfront, we check existing analyses
     * "Upcoming" means analyses due within the next 3 days
     */
    async checkPrescriptionRequirements() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            threeDaysFromNow.setHours(23, 59, 59, 999);

            // Find analyses that are part of recurring patterns and due in the next 3 days
            const upcomingAnalyses = await db.Analysis.findAll({
                where: {
                    recurring_analysis_id: {
                        [db.Sequelize.Op.not]: null
                    },
                    analysis_date: {
                        [db.Sequelize.Op.between]: [today, threeDaysFromNow]
                    },
                    status: 'Pending' // Only check pending analyses
                },
                include: [
                    {
                        model: db.Patient,
                        as: 'Patient',
                        attributes: ['id', 'name', 'room_id']
                    },
                    {
                        model: db.RecurringAnalysis,
                        as: 'recurringAnalysis',
                        include: [
                            {
                                model: db.Prescription,
                                as: 'prescriptions',
                                where: {
                                    status: 'Active',
                                    remaining_analyses: {
                                        [db.Sequelize.Op.gt]: 0
                                    }
                                },
                                required: false
                            }
                        ]
                    }
                ],
                order: [['analysis_date', 'ASC']]
            });

            const notificationsCreated = [];
            const analysesNeedingPrescription = [];
            const recurringPatternsChecked = new Set();

            for (const analysis of upcomingAnalyses) {
                const recurringPattern = analysis.recurringAnalysis;
                
                // Check if we've already processed this recurring pattern
                if (recurringPatternsChecked.has(recurringPattern.id)) {
                    continue;
                }
                recurringPatternsChecked.add(recurringPattern.id);
                
                // Check if prescription exists and covers this analysis date
                const hasValidPrescription = recurringPattern.prescriptions && 
                    recurringPattern.prescriptions.some(p => 
                        new Date(p.valid_from) <= analysis.analysis_date &&
                        new Date(p.valid_until) >= analysis.analysis_date &&
                        p.remaining_analyses > 0
                    );
                
                if (!hasValidPrescription) {
                    analysesNeedingPrescription.push({
                        recurringAnalysisId: recurringPattern.id,
                        analysisId: analysis.id,
                        patientName: analysis.Patient.name,
                        analysisDate: analysis.analysis_date,
                        occurrenceNumber: analysis.occurrence_number,
                        daysUntilDue: Math.ceil((analysis.analysis_date - today) / (1000 * 60 * 60 * 24))
                    });
                    
                    // Create notification for this recurring pattern
                    const notifications = await notificationService.createPrescriptionVerificationNotifications(
                        recurringPattern,
                        analysis.analysis_date
                    );
                    notificationsCreated.push(...notifications);
                }
            }

            console.log(`Prescription check completed:
                - Checked ${upcomingAnalyses.length} upcoming analyses
                - Found ${recurringPatternsChecked.size} unique recurring patterns
                - Found ${analysesNeedingPrescription.length} analyses needing prescriptions
                - Created ${notificationsCreated.length} notifications`);

            if (analysesNeedingPrescription.length > 0) {
                console.log('Analyses needing prescriptions:', analysesNeedingPrescription);
            }

            return {
                checkedAnalyses: upcomingAnalyses.length,
                uniquePatterns: recurringPatternsChecked.size,
                analysesNeedingPrescription: analysesNeedingPrescription.length,
                notificationsCreated: notificationsCreated.length,
                details: analysesNeedingPrescription,
                notifications: notificationsCreated
            };
        } catch (error) {
            console.error('Error checking prescription requirements:', error);
            throw error;
        }
    }
}

module.exports = new PrescriptionService();