// services/schedulerService.js
const systemUpdateService = require('./systemUpdateService');
const recurringAnalysisService = require('./recurringAnalysisService');
const prescriptionService = require('./prescriptionService');
const prescriptionNotificationService = require('./prescriptionNotificationService');
const notificationService = require('./notificationService');
const organizationSettingsService = require('./organizationSettingsService');
const statusPageService = require('./statusPageService');
const cron = require('node-cron');
const { GITHUB_SYNC_ENABLED, GITHUB_SYNC_INTERVAL, GITHUB_AUTO_PUBLISH } = require('../config/environment');

/**
 * Service for running scheduled tasks
 */
class SchedulerService {
    
    constructor() {
        this.intervals = new Map();
        this.cronJobs = new Map();
        this.isRunning = false;
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.isRunning) {
            console.warn('Scheduler is already running');
            return;
        }

        console.log('Starting system scheduler...');

        // GitHub sync job if enabled
        if (GITHUB_SYNC_ENABLED) {
            const githubInterval = setInterval(async () => {
                try {
                    await this.processGitHubSync();
                } catch (error) {
                    console.error('Scheduled GitHub sync error:', error);
                }
            }, GITHUB_SYNC_INTERVAL);

            this.intervals.set('github', githubInterval);
            console.log(`GitHub sync scheduler started - checking every ${GITHUB_SYNC_INTERVAL / 1000} seconds`);

            // Run initial GitHub sync check after 30 seconds
            setTimeout(async () => {
                try {
                    await this.processGitHubSync();
                } catch (error) {
                    console.error('Initial GitHub sync error:', error);
                }
            }, 30000);
        }

        // Prescription verification job (runs at configurable intervals)
        this.setupPrescriptionVerificationJob();

        // System status checking job (runs every 5 minutes)
        this.setupStatusCheckingJob();

        this.isRunning = true;
        console.log('System scheduler started');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.warn('Scheduler is not running');
            return;
        }

        console.log('Stopping system scheduler...');

        // Clear all intervals
        for (const [name, interval] of this.intervals) {
            clearInterval(interval);
            console.log(`Cleared ${name} interval`);
        }

        // Stop all cron jobs
        for (const [name, job] of this.cronJobs) {
            job.stop();
            console.log(`Stopped ${name} cron job`);
        }

        this.intervals.clear();
        this.cronJobs.clear();
        this.isRunning = false;

        console.log('System scheduler stopped');
    }

    /**
     * Setup the recurring analysis processing job
     * Runs every day at 6:05 AM to check for due recurring analyses
     * NOTE: Runs 5 minutes after prescription verification to ensure prescriptions are checked first
     */
    setupRecurringAnalysisJob() {
        const jobName = 'process-recurring-analyses';
        
        // Run every day at 6:05 AM (5 minutes after prescription check)
        const job = cron.schedule('5 6 * * *', async () => {
            console.log('Starting scheduled recurring analysis processing...');
            
            try {
                const results = await recurringAnalysisService.processDueRecurringAnalyses();
                
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                
                console.log(`Recurring analysis processing completed: ${successful} successful, ${failed} failed out of ${results.length} total`);
                
                if (failed > 0) {
                    console.warn('Some recurring analyses failed to process:', {
                        failedResults: results.filter(r => !r.success)
                    });
                }
            } catch (error) {
                console.error('Error in scheduled recurring analysis processing:', error);
            }
        }, {
            scheduled: false,
            timezone: "America/New_York"
        });

        this.cronJobs.set(jobName, job);
        job.start();
        
        console.log(`Scheduled job '${jobName}' created and started (runs daily at 6:05 AM)`);
    }

    /**
     * Manually trigger recurring analysis processing (for testing/admin use)
     */
    async triggerRecurringAnalysisProcessing() {
        console.log('Manually triggering recurring analysis processing...');
        
        try {
            const results = await recurringAnalysisService.processDueRecurringAnalyses();
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`Manual recurring analysis processing completed: ${successful} successful, ${failed} failed out of ${results.length} total`);
            
            return {
                success: true,
                results,
                summary: {
                    total: results.length,
                    successful,
                    failed
                }
            };
        } catch (error) {
            console.error('Error in manual recurring analysis processing:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Setup prescription verification job
     * Runs at configurable intervals to check for prescription requirements
     */
    async setupPrescriptionVerificationJob() {
        const jobName = 'prescription-verification-check';
        
        try {
            // Get the check interval from organization settings
            const valueResult = await organizationSettingsService.getSetting('prescription_check_interval_value', 4);
            const unitResult = await organizationSettingsService.getSetting('prescription_check_interval_unit', 'hours');
            
            const intervalValue = valueResult.success ? parseInt(valueResult.setting.value) : 4;
            const intervalUnit = unitResult.success ? unitResult.setting.value : 'hours';
            
            let cronPattern;
            let displayText;
            
            if (intervalUnit === 'minutes') {
                // Validate minutes (1-1440 minutes = 24 hours)
                const validMinutes = Math.max(1, Math.min(1440, intervalValue));
                if (validMinutes !== intervalValue) {
                    console.warn(`Invalid prescription check interval (${intervalValue} minutes), using ${validMinutes} minutes instead`);
                }
                
                if (validMinutes >= 60 && validMinutes % 60 === 0) {
                    // If it's a whole number of hours, use hourly pattern
                    const hours = validMinutes / 60;
                    cronPattern = `0 */${hours} * * *`;
                    displayText = `${hours} hour${hours > 1 ? 's' : ''}`;
                } else {
                    // Use minute-based pattern
                    cronPattern = `*/${validMinutes} * * * *`;
                    displayText = `${validMinutes} minute${validMinutes > 1 ? 's' : ''}`;
                }
            } else {
                // Validate hours (1-24 hours)
                const validHours = Math.max(1, Math.min(24, intervalValue));
                if (validHours !== intervalValue) {
                    console.warn(`Invalid prescription check interval (${intervalValue} hours), using ${validHours} hours instead`);
                }
                
                cronPattern = `0 */${validHours} * * *`;
                displayText = `${validHours} hour${validHours > 1 ? 's' : ''}`;
            }
            
            // Stop existing job if it exists
            if (this.cronJobs.has(jobName)) {
                this.cronJobs.get(jobName).stop();
                this.cronJobs.delete(jobName);
                console.log('Stopped existing prescription verification job');
            }
            
            const job = cron.schedule(cronPattern, async () => {
                console.log('Starting prescription verification notification check...');
                
                try {
                    await prescriptionNotificationService.checkAndNotifyPrescriptionValidation();
                    
                    console.log('Prescription verification notification check completed');
                    
                    // Also clean up expired notifications
                    await notificationService.cleanupExpiredNotifications();
                    
                } catch (error) {
                    console.error('Error in prescription verification notification check:', error);
                }
            }, {
                scheduled: false,
                timezone: "America/New_York"
            });

            this.cronJobs.set(jobName, job);
            job.start();
            
            console.log(`Scheduled job '${jobName}' created and started (runs every ${displayText})`);
            
        } catch (error) {
            console.error('Error setting up prescription verification job:', error);
            // Fallback to default 4-hour interval
            this.setupPrescriptionVerificationJobFallback();
        }
    }

    /**
     * Fallback method for prescription verification job with default interval
     * @private
     */
    setupPrescriptionVerificationJobFallback() {
        const jobName = 'prescription-verification-check';
        
        const job = cron.schedule('0 */4 * * *', async () => {
            console.log('Starting prescription verification notification check (fallback)...');
            
            try {
                await prescriptionNotificationService.checkAndNotifyPrescriptionValidation();
                console.log('Prescription verification notification check completed');
                await notificationService.cleanupExpiredNotifications();
            } catch (error) {
                console.error('Error in prescription verification notification check:', error);
            }
        }, {
            scheduled: false,
            timezone: "America/New_York"
        });

        this.cronJobs.set(jobName, job);
        job.start();
        
        console.log(`Scheduled job '${jobName}' created with fallback (runs every 4 hours)`);
    }

    /**
     * Process GitHub synchronization
     * @private
     */
    async processGitHubSync() {
        try {
            console.log('Processing GitHub sync...');

            // Sync with GitHub to check for new releases
            const syncResult = await systemUpdateService.syncWithGitHub();
            
            let publishResult = { success: true, data: { published: 0, errors: 0 } };
            
            // Auto-publish releases if enabled and new releases were created
            if (GITHUB_AUTO_PUBLISH && syncResult.success && syncResult.data.created > 0) {
                publishResult = await systemUpdateService.autoPublishGitHubReleases();
            }

            const totalProcessed = (syncResult.data?.created || 0) + (publishResult.data?.published || 0);

            if (totalProcessed > 0) {
                console.log(`Processed ${totalProcessed} GitHub tasks:`, {
                    synced: syncResult.data?.created || 0,
                    skipped: syncResult.data?.skipped || 0,
                    published: publishResult.data?.published || 0,
                    errors: (syncResult.data?.errors || 0) + (publishResult.data?.errors || 0)
                });
            }

            return {
                success: true,
                sync: syncResult,
                publish: publishResult
            };
        } catch (error) {
            console.error('Process GitHub sync error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        const cronJobsStatus = {};
        for (const [name, job] of this.cronJobs) {
            cronJobsStatus[name] = {
                running: job.running,
                scheduled: job.scheduled
            };
        }

        return {
            running: this.isRunning,
            intervals: Array.from(this.intervals.keys()),
            cronJobs: cronJobsStatus,
            uptime: this.isRunning ? process.uptime() : 0
        };
    }

    /**
     * Manually trigger GitHub sync
     */
    async triggerGitHubSync() {
        console.log('Manually triggering GitHub sync...');
        return await this.processGitHubSync();
    }

    /**
     * Reconfigure prescription verification job with new interval
     * Called when prescription check interval setting is updated
     */
    async reconfigurePrescriptionVerificationJob() {
        console.log('Reconfiguring prescription verification job...');
        
        try {
            await this.setupPrescriptionVerificationJob();
            console.log('Prescription verification job reconfigured successfully');
            return { success: true };
        } catch (error) {
            console.error('Error reconfiguring prescription verification job:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Setup system status checking job
     * Runs every 5 minutes to check all system components
     */
    setupStatusCheckingJob() {
        const jobName = 'status-checking';
        
        // Stop existing job if it exists
        if (this.cronJobs.has(jobName)) {
            this.cronJobs.get(jobName).stop();
            this.cronJobs.delete(jobName);
        }

        // Run every 5 minutes
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('Running scheduled system status check...');
                const result = await statusPageService.checkAllComponents();
                console.log(`Status check completed: ${result.successful} successful, ${result.failed} failed out of ${result.checked} components`);
                
                if (result.failed > 0) {
                    console.warn(`Status check found ${result.failed} failing components:`, 
                        result.components.filter(c => c.status !== 'operational').map(c => ({ 
                            component: c.component, 
                            status: c.status, 
                            error: c.error 
                        }))
                    );
                }
            } catch (error) {
                console.error('Error in scheduled status check:', error);
            }
        }, {
            scheduled: false,
            timezone: "America/New_York"
        });

        this.cronJobs.set(jobName, job);
        job.start();
        
        console.log(`Scheduled job '${jobName}' created and started (runs every 5 minutes)`);
    }
}

module.exports = new SchedulerService();