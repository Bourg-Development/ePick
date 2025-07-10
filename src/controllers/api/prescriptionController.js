const prescriptionService = require('../../services/prescriptionService');
const recurringAnalysisService = require('../../services/recurringAnalysisService');
const logService = require('../../services/logService');

class PrescriptionController {
    /**
     * Get prescription validation page data
     */
    async getValidationData(req, res) {
        try {
            const { recurringAnalysisId } = req.params;
            
            // Get recurring analysis details
            const recurringAnalysis = await recurringAnalysisService.getRecurringAnalysis(recurringAnalysisId);
            
            if (!recurringAnalysis) {
                return res.status(404).json({
                    success: false,
                    message: 'Recurring analysis not found'
                });
            }

            // Get existing prescriptions for this recurring analysis
            const existingPrescriptions = await prescriptionService.getPrescriptionsForRecurringAnalysis(recurringAnalysisId);
            
            res.json({
                success: true,
                data: {
                    recurringAnalysis: {
                        id: recurringAnalysis.id,
                        patientName: recurringAnalysis.Patient.name,
                        patientMatricule: recurringAnalysis.Patient.matricule_national,
                        doctorName: recurringAnalysis.Doctor.name,
                        analysisType: recurringAnalysis.analysis_type,
                        recurrencePattern: recurringAnalysis.recurrence_pattern,
                        totalOccurrences: recurringAnalysis.total_occurrences,
                        completedOccurrences: recurringAnalysis.completed_occurrences,
                        nextDueDate: recurringAnalysis.next_due_date,
                        isActive: recurringAnalysis.is_active
                    },
                    existingPrescriptions: existingPrescriptions.map(p => ({
                        id: p.id,
                        prescriptionNumber: p.prescription_number,
                        validFrom: p.valid_from,
                        validUntil: p.valid_until,
                        remainingAnalyses: p.remaining_analyses,
                        totalAnalysesPrescribed: p.total_analyses_prescribed,
                        status: p.status,
                        verifiedAt: p.verified_at,
                        verifiedBy: p.prescriber ? p.prescriber.full_name : 'Unknown'
                    }))
                }
            });

        } catch (error) {
            console.error('Error fetching validation data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch validation data',
                error: error.message
            });
        }
    }

    /**
     * Validate a prescription
     */
    async validatePrescription(req, res) {
        try {
            const { recurringAnalysisId } = req.params;
            const userId = req.auth.userId;
            const {
                prescriptionNumber,
                validFrom,
                validUntil,
                totalAnalysesPrescribed,
                validationNotes,
                analysisDate,
                analysisId
            } = req.body;

            // Validate the prescription
            const prescription = await prescriptionService.validatePrescriptionReceived({
                recurringAnalysisId,
                prescriptionNumber,
                validFrom,
                validUntil,
                totalAnalysesPrescribed,
                validationNotes,
                analysisDate,
                analysisId
            }, userId);

            res.json({
                success: true,
                message: 'Prescription validated successfully',
                data: prescription
            });

        } catch (error) {
            console.error('Error validating prescription:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to validate prescription',
                error: error.message
            });
        }
    }

    /**
     * Get all prescriptions for a recurring analysis
     */
    async getPrescriptions(req, res) {
        try {
            const { recurringAnalysisId } = req.params;
            
            const prescriptions = await prescriptionService.getPrescriptionsForRecurringAnalysis(recurringAnalysisId);
            
            res.json({
                success: true,
                data: prescriptions
            });

        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch prescriptions',
                error: error.message
            });
        }
    }

    /**
     * Update prescription status
     */
    async updatePrescriptionStatus(req, res) {
        try {
            const { prescriptionId } = req.params;
            const { status, reason } = req.body;
            const userId = req.auth.userId;

            const prescription = await prescriptionService.updatePrescriptionStatus(
                prescriptionId, 
                status, 
                reason, 
                userId
            );

            res.json({
                success: true,
                message: 'Prescription status updated successfully',
                data: prescription
            });

        } catch (error) {
            console.error('Error updating prescription status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update prescription status',
                error: error.message
            });
        }
    }

    /**
     * Check if prescription is needed for upcoming analyses
     */
    async checkPrescriptionNeeds(req, res) {
        try {
            const result = await prescriptionService.checkPrescriptionRequirements();
            
            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error checking prescription needs:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check prescription needs',
                error: error.message
            });
        }
    }
}

module.exports = new PrescriptionController();