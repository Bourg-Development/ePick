const Analysis = require('../../models/Analysis');
const AnalysisType = require('../../models/AnalysisType');
const AnalysisSeries = require('../../models/AnalysisSeries');
const Patient = require('../../models/Patient');
const AuditLog = require('../../models/AuditLog');

class AnalysisService {
    async createAnalysis(analysisData, userId) {

        const patient = await Patient.getById(analysisData.patientId);

        if(!patient) {
            throw new Error('Patient not found');
        }

        const analysisType = await AnalysisType.getById(analysisData.analysisTypeId);
        if(!analysisType) {
            throw new Error('Analysis type not found');
        }

        let series = null;
        if (analysisData.seriesId){
            series = await AnalysisSeries.getById(analysisData.seriesId);
            if(!series) {
                throw new Error('Series not found');
            }
        }

        const analysis = await Analysis.create({
            ...analysisData,
            createdBy: userId,
        });

        if(series) {
            await AnalysisSeries.incrementCount(series.id);
        }

        await AuditLog.create({
            userId,
            tableName: 'analyses',
            recordId: analysis.id,
            operation: 'INSERT',
            changes: analysisData,
        });

        return analysis;
    }

}