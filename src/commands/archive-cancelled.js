#!/usr/bin/env node

/**
 * Admin command to manually trigger cancelled analysis archiving
 * Usage: node src/commands/archive-cancelled.js
 */

const db = require('../db');
const schedulerService = require('../services/schedulerService');

async function archiveCancelledAnalyses() {
    try {
        console.log('=== Manual Cancelled Analysis Archiving ===');
        console.log('Starting at:', new Date().toISOString());
        console.log('');

        // First, check current settings
        const settings = await db.OrganizationSettings.findAll({
            where: {
                setting_key: ['auto_archive_enabled', 'cancelled_analysis_archive_delay']
            }
        });

        console.log('Current settings:');
        settings.forEach(setting => {
            console.log(`- ${setting.setting_key}: ${setting.setting_value}`);
        });
        console.log('');

        // Check for cancelled analyses that should be archived
        // Use date-based comparison: analyses cancelled on day X will be archived on day X+delay
        const archiveDelay = settings.find(s => s.setting_key === 'cancelled_analysis_archive_delay')?.setting_value || 1;
        
        const candidateAnalyses = await db.Analysis.findAll({
            where: {
                status: 'Cancelled',
                [db.Sequelize.Op.and]: [
                    db.Sequelize.literal(`DATE("Analysis"."updated_at") <= CURRENT_DATE - INTERVAL '${archiveDelay} days'`)
                ]
            },
            include: [
                { model: db.Patient, as: 'patient', attributes: ['name'] },
                { model: db.Doctor, as: 'doctor', attributes: ['name'] },
                { model: db.Room, as: 'room', attributes: ['room_number'] }
            ]
        });

        console.log(`Found ${candidateAnalyses.length} cancelled analyses older than ${archiveDelay} day(s)`);
        
        if (candidateAnalyses.length > 0) {
            console.log('\nCandidates for archiving:');
            candidateAnalyses.forEach(analysis => {
                console.log(`- ID: ${analysis.id}, Date: ${analysis.analysis_date}, Patient: ${analysis.patient?.name || 'N/A'}, Updated: ${analysis.updated_at}`);
            });
        }

        console.log('\nTriggering archiving process...');
        
        // Use the scheduler service to trigger archiving
        const result = await schedulerService.triggerCancelledAnalysisArchiving();
        
        if (result.success) {
            console.log(`\nArchiving completed successfully!`);
            console.log(`Archived ${result.archivedCount} analyses`);
        } else {
            console.error('\nArchiving failed:', result.error);
        }

        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the command
archiveCancelledAnalyses();