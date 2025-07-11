const recurringAnalysisService = require('../../services/recurringAnalysisService');
const db = require('../../db');

class RecurringAnalysisController {
    /**
     * Create a new recurring analysis pattern
     */
    async createRecurringAnalysis(req, res) {
        try {
            const {
                analysisDate,
                patientId,
                doctorId,
                roomId,
                analysisType,
                recurrencePattern,
                totalOccurrences,
                intervalDays,
                calculatedDates,
                notes
            } = req.body;

            const userId = req.auth.userId;

            // Validate that entities exist
            const patient = await db.Patient.findByPk(patientId);
            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Patient not found'
                });
            }

            const doctor = await db.Doctor.findByPk(doctorId);
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            const room = await db.Room.findByPk(roomId);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            // Create the recurring analysis
            const result = await recurringAnalysisService.createRecurringAnalysis({
                analysisDate,
                patientId,
                doctorId,
                roomId,
                analysisType,
                recurrencePattern,
                totalOccurrences,
                intervalDays,
                calculatedDates,
                notes
            }, userId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json({
                success: true,
                message: 'Recurring analysis created successfully',
                data: {
                    recurringAnalysis: result.recurringAnalysis,
                    analyses: result.analyses
                }
            });

        } catch (error) {
            console.error('Error creating recurring analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create recurring analysis',
                error: error.message
            });
        }
    }

    /**
     * Get recurring analysis details
     */
    async getRecurringAnalysis(req, res) {
        try {
            const { id } = req.params;

            const recurringAnalysis = await recurringAnalysisService.getRecurringAnalysis(id);

            if (!recurringAnalysis) {
                return res.status(404).json({
                    success: false,
                    message: 'Recurring analysis not found'
                });
            }

            res.json({
                success: true,
                data: recurringAnalysis
            });

        } catch (error) {
            console.error('Error fetching recurring analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recurring analysis',
                error: error.message
            });
        }
    }

    /**
     * Get analyses for a recurring pattern
     */
    async getAnalysesForPattern(req, res) {
        try {
            const { id } = req.params;

            const analyses = await recurringAnalysisService.getAnalysesForRecurringPattern(id);

            res.json({
                success: true,
                data: analyses
            });

        } catch (error) {
            console.error('Error fetching analyses for pattern:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch analyses for recurring pattern',
                error: error.message
            });
        }
    }

    /**
     * Deactivate a recurring analysis
     */
    async deactivateRecurringAnalysis(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.auth.userId;

            const recurringAnalysis = await recurringAnalysisService.deactivateRecurringAnalysis(id, userId, reason);

            res.json({
                success: true,
                message: 'Recurring analysis deactivated successfully',
                data: recurringAnalysis
            });

        } catch (error) {
            console.error('Error deactivating recurring analysis:', error);
            
            if (error.message === 'Recurring analysis not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to deactivate recurring analysis',
                error: error.message
            });
        }
    }

    /**
     * Process due recurring analyses (admin function)
     */
    async processDueAnalyses(req, res) {
        try {
            const results = await recurringAnalysisService.processDueRecurringAnalyses();

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            res.json({
                success: true,
                message: `Processed ${results.length} recurring analyses`,
                data: {
                    total: results.length,
                    successful,
                    failed,
                    results
                }
            });

        } catch (error) {
            console.error('Error processing due recurring analyses:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process due recurring analyses',
                error: error.message
            });
        }
    }

    /**
     * Get user's recurring analyses
     */
    async getUserRecurringAnalyses(req, res) {
        try {
            const userId = req.auth.userId;
            const { active = true, limit = 20, offset = 0 } = req.query;

            const whereClause = {
                created_by: userId
            };

            if (active !== undefined) {
                whereClause.is_active = active === 'true';
            }

            const recurringAnalyses = await db.RecurringAnalysis.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']],
                include: [
                    {
                        model: db.Patient,
                        as: 'Patient',
                        attributes: ['id', 'name', 'matricule']
                    },
                    {
                        model: db.Doctor,
                        as: 'Doctor',
                        attributes: ['id', 'name', 'specialization']
                    },
                    {
                        model: db.Room,
                        as: 'Room',
                        attributes: ['id', 'number'],
                        include: [{
                            model: db.Service,
                            as: 'Service',
                            attributes: ['id', 'name']
                        }]
                    }
                ]
            });

            res.json({
                success: true,
                data: recurringAnalyses.rows,
                pagination: {
                    total: recurringAnalyses.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    pages: Math.ceil(recurringAnalyses.count / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching user recurring analyses:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recurring analyses',
                error: error.message
            });
        }
    }
}

module.exports = new RecurringAnalysisController();