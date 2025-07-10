// services/emailService.js
const nodemailer = require('nodemailer');
const {
    EMAIL_FROM,
    EMAIL_FROM_NAME,
    REPLY_TO,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD,
    EMAIL_SECURE,
    NODE_ENV,
    FRONTEND_URL
} = require('../config/environment');
const path = require("node:path");
const fs = require('fs');
const handlebars = require('handlebars');
const { User, UserPreference } = require('../db');

/**
 * Service for handling email communications
 */
class EmailService {
    constructor() {
        // Create email transporter
        this.transporter = nodemailer.createTransport({
            host: EMAIL_HOST,
            port: EMAIL_PORT,
            secure: EMAIL_SECURE,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASSWORD
            }
        });

        // Test connection in non-production environments
        if (NODE_ENV !== 'production' && NODE_ENV !== 'test') {
            this._verifyConnection();
        }
    }

    /**
     * Verify email connection
     * @private
     */
    async _verifyConnection() {
        try {
            console.log('Testing email connection...');
            console.log('Email config:', {
                host: this.transporter.options.host,
                port: this.transporter.options.port,
                secure: this.transporter.options.secure,
                user: this.transporter.options.auth.user
            });
            
            await this.transporter.verify();
            console.log('Email service connected successfully');
        } catch (error) {
            console.error('Email service connection failed:', error.message);
            console.error('Full error:', error);
            console.warn('Emails will not be sent until connection is fixed');
        }
    }

    /**
     * Check if user has enabled a specific email notification type
     * @param {string|number} userIdentifier - User ID or email address
     * @param {string} notificationType - Type of notification to check
     * @returns {Promise<boolean>} Whether the notification is enabled
     */
    async checkUserEmailPreference(userIdentifier, notificationType) {
        try {
            // Find user by ID or email
            let user;
            if (typeof userIdentifier === 'number' || /^\d+$/.test(userIdentifier)) {
                user = await User.findByPk(userIdentifier);
            } else {
                user = await User.findOne({ where: { email: userIdentifier } });
            }

            if (!user) {
                console.warn(`User not found for identifier: ${userIdentifier}`);
                return false;
            }

            // Check if user has an email address
            if (!user.email || user.email.trim() === '') {
                console.log(`User ${user.id} has no email address - skipping email notification`);
                return false;
            }

            // Get user preferences
            const userPreference = await UserPreference.findOne({
                where: { user_id: user.id }
            });

            if (!userPreference || !userPreference.preferences) {
                // No preferences found - use default behavior (enabled for security, disabled for optional)
                const defaultEnabled = [
                    'loginAlerts', 'passwordChanges', 'twoFactorChanges', 'suspiciousActivity',
                    'maintenance', 'systemAlerts', 'analysisCompletion', 'dataExport', 'reportGeneration'
                ];
                return defaultEnabled.includes(notificationType);
            }

            const notifications = userPreference.preferences.notifications;
            if (!notifications) {
                // No notification preferences - use defaults
                const defaultEnabled = [
                    'loginAlerts', 'passwordChanges', 'twoFactorChanges', 'suspiciousActivity',
                    'maintenance', 'systemAlerts', 'analysisCompletion', 'dataExport', 'reportGeneration'
                ];
                return defaultEnabled.includes(notificationType);
            }

            // Check master email toggle first
            if (notifications.email === false) {
                console.log(`User ${user.id} has disabled all email notifications`);
                return false;
            }

            // Check specific notification type
            // Default to true if not explicitly set to false (except for feature updates)
            const isEnabled = notificationType === 'featureUpdates' 
                ? notifications[notificationType] === true
                : notifications[notificationType] !== false;

            console.log(`User ${user.id} email preference for ${notificationType}: ${isEnabled}`);
            return isEnabled;

        } catch (error) {
            console.error('Error checking user email preference:', error);
            // On error, default to enabled for critical notifications, disabled for optional
            const criticalNotifications = [
                'loginAlerts', 'passwordChanges', 'twoFactorChanges', 'suspiciousActivity',
                'systemAlerts'
            ];
            return criticalNotifications.includes(notificationType);
        }
    }

    /**
     * Send reference code to user
     * @param {Object} data - Email data
     * @param {string} data.email - Recipient email
     * @param {string} data.code - Reference code
     * @param {Date} data.expiresAt - Expiration date
     * @param {number} data.createdByUserId - Admin who created the code
     * @returns {Promise<boolean>} Success indicator
     */
    async sendReferenceCode(data) {
        try {
            const { email, code, expiresAt, createdByUserId } = data;

            // Format expiration date
            const expiryDate = expiresAt.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Load and compile email template
            const templatePath = path.join(__dirname, '../templates/emails/reference_code.html');
            const templateSource = fs.readFileSync(templatePath, 'utf-8');
            const template = handlebars.compile(templateSource);

            // Generate HTML content
            const html = template({
                code,
                expiryDate
            });

            // Email content
            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject: 'ePick Registration Code - Complete Your Account Setup',
                html
            };

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log('Reference code email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send reference code email error:', error);
            return false;
        }
    }

    /**
     * Send account created email
     * @param {Object} data - Email data
     * @param {string} data.email - Recipient email
     * @param {string} data.userName - User's full name
     * @param {string} data.role - User's role
     * @param {string} data.organization - Organization name
     * @param {Date} data.createdDate - Account creation date
     * @returns {Promise<boolean>} Success indicator
     */
    async sendAccountCreatedEmail(data) {
        try {
            const { email, userName, role, organization, createdDate } = data;

            // Format creation date
            const formattedDate = createdDate.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Load and compile email template
            const templatePath = path.join(__dirname, '../templates/emails/account_created.html');
            const templateSource = fs.readFileSync(templatePath, 'utf-8');
            const template = handlebars.compile(templateSource);

            // Generate HTML content
            const html = template({
                user_name: userName || 'User',
                email,
                role,
                organization,
                created_date: formattedDate,
                login_url: 'https://epick.fondation.lu/auth/login',
                help_url: 'https://support.bourg.dev/epick/getting-started'
            });

            // Email content
            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject: 'Welcome to ePick - Account Created',
                html
            };

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log('Account created email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send account created email error:', error);
            return false;
        }
    }

    /**
     * Send password reset code
     * @param {Object} data - Email data
     * @param {string} data.email - Recipient email
     * @param {string} data.code - Reference code for password reset
     * @param {Date} data.expiresAt - Expiration date
     * @param {number} data.resetByUserId - Admin who initiated the reset
     * @returns {Promise<boolean>} Success indicator
     */
    async sendPasswordResetCode(data) {
        try {
            const { email, code, expiresAt, resetByUserId } = data;

            // Format expiration date
            const expiryDate = expiresAt.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Load and compile email template
            const templatePath = path.join(__dirname, '../templates/emails/password_reset.html');
            const templateSource = fs.readFileSync(templatePath, 'utf-8');
            const template = handlebars.compile(templateSource);

            // Generate HTML content
            const html = template({
                code,
                expiryDate
            });

            // Email content
            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject: 'ePick Password Reset - Action Required',
                html
            }


            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Password reset email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send password reset email error:', error);
            return false;
        }
    }

    /**
     * Send security alert
     * @param {Object} data - Alert data
     * @param {string} data.email - Recipient email
     * @param {string} data.alertType - Type of security alert
     * @param {Object} data.eventDetails - Details of the security event
     * @param {number} [data.userId] - User ID (optional, will try to find by email if not provided)
     * @returns {Promise<boolean>} Success indicator
     */
    async sendSecurityAlert(data) {
        try {
            const { email, alertType, eventDetails, userId } = data;

            // Map alert types to notification preference types
            const notificationTypeMap = {
                'suspicious_login': 'loginAlerts',
                'password_changed': 'passwordChanges',
                'account_locked': 'suspiciousActivity',
                'two_factor_changed': 'twoFactorChanges'
            };

            const notificationType = notificationTypeMap[alertType] || 'suspiciousActivity';

            // Check user preferences before sending
            const userIdentifier = userId || email;
            const shouldSend = await this.checkUserEmailPreference(userIdentifier, notificationType);
            
            if (!shouldSend) {
                console.log(`Security alert ${alertType} not sent - user has disabled ${notificationType} notifications`);
                return true; // Return true as this is expected behavior, not an error
            }

            // Generate appropriate subject and content based on alert type
            let subject, html;

            switch (alertType) {
                case 'suspicious_login':
                    subject = 'Security Alert: Suspicious Login Detected';
                    html = `
            <h2>Suspicious Login Detected</h2>
            <p>We detected a login attempt to your account from an unusual location or device.</p>
            <p><strong>Details:</strong></p>
            <ul>
              <li>Time: ${new Date(eventDetails.timestamp).toLocaleString()}</li>
              <li>IP Address: ${eventDetails.ipAddress}</li>
              <li>Location: ${eventDetails.location || 'Unknown'}</li>
              <li>Device: ${eventDetails.device || 'Unknown'}</li>
            </ul>
            <p>If this was you, you can ignore this alert. If not, please contact your administrator immediately.</p>
          `;
                    break;

                case 'password_changed':
                    subject = 'Security Alert: Password Changed';
                    html = `
            <h2>Password Changed</h2>
            <p>The password for your account was recently changed.</p>
            <p><strong>Details:</strong></p>
            <ul>
              <li>Time: ${new Date(eventDetails.timestamp).toLocaleString()}</li>
              <li>IP Address: ${eventDetails.ipAddress}</li>
            </ul>
            <p>If you did not make this change, please contact your administrator immediately.</p>
          `;
                    break;

                case 'account_locked':
                    subject = `Account ${eventDetails.user_id} locked due to security reasons.`;
                    html = this._loadEmailTemplate('locked')(eventDetails);
                    break;

                default:
                    subject = 'Security Alert';
                    html = `
            <h2>Security Alert</h2>
            <p>A security event was detected related to your account.</p>
            <p>If you have any concerns, please contact your administrator.</p>
          `;
            }

            // Email content
            const mailOptions = {
                from: EMAIL_FROM,
                to: email,
                replyTo: REPLY_TO,
                subject,
                html: html
            };
            console.log(html)

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log('Security alert email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send security alert email error:', error);
            return false;
        }
    }

    /**
     * Send generic email (for campaigns and other uses)
     * @param {Object} emailData - Email data
     * @param {string} emailData.to - Recipient email address
     * @param {string} emailData.subject - Email subject
     * @param {string} [emailData.html] - HTML content
     * @param {string} [emailData.text] - Text content
     * @param {string} [emailData.from] - Sender email (defaults to EMAIL_FROM)
     * @param {string} [emailData.replyTo] - Reply-to email (defaults to REPLY_TO)
     * @param {string} [emailData.senderName] - Sender name
     * @returns {Promise<Object>} Send result with success status and message
     */
    async sendEmail(emailData) {
        try {
            const {
                to,
                subject,
                html,
                text,
                from = EMAIL_FROM,
                replyTo = REPLY_TO,
                senderName
            } = emailData;

            // Validate required fields
            if (!to || !subject || (!html && !text)) {
                return {
                    success: false,
                    message: 'Missing required email fields (to, subject, content)'
                };
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(to)) {
                return {
                    success: false,
                    message: 'Invalid recipient email address'
                };
            }

            // Build sender info
            let fromField = from;
            if (senderName) {
                fromField = `"${senderName}" <${from}>`;
            }

            // Email options
            const mailOptions = {
                from: fromField,
                to: to,
                replyTo: replyTo,
                subject: subject
            };

            // Add content
            if (html) {
                mailOptions.html = html;
            }
            if (text) {
                mailOptions.text = text;
            }

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - campaign email not sent:', {
                    to: to,
                    subject: subject
                });
                return {
                    success: true,
                    message: 'Email sent (test mode)',
                    messageId: 'test-' + Date.now()
                };
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log('Campaign email sent successfully:', {
                to: to,
                subject: subject,
                messageId: info.messageId
            });

            return {
                success: true,
                message: 'Email sent successfully',
                messageId: info.messageId
            };

        } catch (error) {
            console.error('Send email error:', error);
            
            // Return specific error messages for common issues
            let errorMessage = 'Failed to send email';
            
            if (error.code === 'EAUTH') {
                errorMessage = 'Email authentication failed';
            } else if (error.code === 'ECONNECTION') {
                errorMessage = 'Email server connection failed';
            } else if (error.responseCode === 550) {
                errorMessage = 'Recipient email address rejected';
            } else if (error.responseCode === 552) {
                errorMessage = 'Recipient mailbox full';
            }

            return {
                success: false,
                message: errorMessage,
                error: error.message
            };
        }
    }

    /**
     * Send account creation email
     * @param {Object} data - Email data
     * @param {string} data.email - Recipient email
     * @param {string} data.userName - User's full name
     * @param {string} data.role - User's role
     * @param {string} data.organization - User's organization
     * @param {Date} [data.createdDate] - Account creation date
     * @returns {Promise<boolean>} Success indicator
     */
    async sendAccountCreatedEmail(data) {
        try {
            const { email, userName, role, organization, createdDate = new Date() } = data;

            // Load and compile the template
            const template = this._loadEmailTemplate('account_created');

            // Prepare template data
            const templateData = {
                user_name: userName || 'User',
                email: email,
                role: role,
                organization: organization || 'ePick',
                created_date: createdDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                login_url: `${process.env.APP_URL || 'https://epick.fondation.lu'}/auth/login`,
                help_url: `${process.env.APP_URL || 'https://epick.fondation.lu'}/help`
            };

            // Generate HTML from template
            const html = template(templateData);

            // Email options
            const mailOptions = {
                from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject: 'Welcome to ePick - Your Account Has Been Created',
                html: html
            };

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - account creation email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            console.log('Account creation email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send account creation email error:', error);
            return false;
        }
    }

    /**
     * Send password change notification
     * @param {Object} data - Notification data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @param {Object} data.eventDetails - Details of the password change
     * @returns {Promise<boolean>} Success indicator
     */
    async sendPasswordChangeNotification(data) {
        try {
            const { email, userId, eventDetails } = data;

            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(userId || email, 'passwordChanges');
            if (!shouldSend) {
                console.log('Password change notification not sent - user has disabled passwordChanges notifications');
                return true;
            }

            return await this.sendSecurityAlert({
                email,
                userId,
                alertType: 'password_changed',
                eventDetails
            });
        } catch (error) {
            console.error('Send password change notification error:', error);
            return false;
        }
    }

    /**
     * Send two-factor authentication change notification
     * @param {Object} data - Notification data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @param {Object} data.eventDetails - Details of the 2FA change
     * @returns {Promise<boolean>} Success indicator
     */
    async sendTwoFactorChangeNotification(data) {
        try {
            const { email, userId, eventDetails } = data;

            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(userId || email, 'twoFactorChanges');
            if (!shouldSend) {
                console.log('Two-factor change notification not sent - user has disabled twoFactorChanges notifications');
                return true;
            }

            return await this.sendSecurityAlert({
                email,
                userId,
                alertType: 'two_factor_changed',
                eventDetails
            });
        } catch (error) {
            console.error('Send two-factor change notification error:', error);
            return false;
        }
    }

    /**
     * Send system maintenance notification
     * @param {Object} data - Notification data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @param {string} data.maintenanceTitle - Maintenance title
     * @param {Date} data.scheduledDate - Scheduled maintenance date
     * @param {string} data.description - Maintenance description
     * @returns {Promise<boolean>} Success indicator
     */
    async sendMaintenanceNotification(data) {
        try {
            const { 
                email, 
                userId, 
                title,
                description,
                scheduledStart,
                scheduledEnd,
                priority = 'medium',
                maintenanceType = 'system_update',
                affectsAvailability = true,
                estimatedDurationMinutes,
                notificationType = 'initial',
                notes 
            } = data;

            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(userId || email, 'maintenance');
            if (!shouldSend) {
                console.log('Maintenance notification not sent - user has disabled maintenance notifications');
                return true;
            }

            // Format dates
            const startDate = new Date(scheduledStart);
            const endDate = new Date(scheduledEnd);

            // Determine notification type content
            let badgeText, badgeClass, subjectPrefix, mainMessage, notificationTypeDescription;
            
            switch (notificationType) {
                case 'reminder':
                    badgeText = 'Reminder';
                    badgeClass = 'reminder';
                    subjectPrefix = 'Reminder: ';
                    mainMessage = 'This is a reminder that scheduled maintenance is approaching. Please save your work and prepare for potential service interruption.';
                    notificationTypeDescription = 'Maintenance Reminder - 24 Hours Notice';
                    break;
                case 'cancelled':
                    badgeText = 'Cancelled';
                    badgeClass = 'cancelled';
                    subjectPrefix = 'Cancelled: ';
                    mainMessage = 'The scheduled maintenance has been cancelled. Normal service will continue as usual.';
                    notificationTypeDescription = 'Maintenance Cancelled';
                    break;
                default:
                    badgeText = 'Scheduled';
                    badgeClass = '';
                    subjectPrefix = '';
                    mainMessage = 'We have scheduled system maintenance to improve performance and security. Please review the details below.';
                    notificationTypeDescription = 'Scheduled System Maintenance Notice';
            }

            // Format maintenance type for display
            const maintenanceTypeDisplay = maintenanceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Format estimated duration
            let estimatedDuration = null;
            if (estimatedDurationMinutes) {
                const hours = Math.floor(estimatedDurationMinutes / 60);
                const minutes = estimatedDurationMinutes % 60;
                if (hours > 0) {
                    estimatedDuration = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                } else {
                    estimatedDuration = `${minutes}m`;
                }
            }

            const subject = `${subjectPrefix}Maintenance: ${title}`;

            // Load and compile template
            const template = this._loadEmailTemplate('maintenance_notification');
            const html = template({
                title,
                description,
                scheduled_start: startDate.toLocaleString(),
                scheduled_end: endDate.toLocaleString(),
                priority,
                maintenance_type_display: maintenanceTypeDisplay,
                affects_availability: affectsAvailability,
                estimated_duration: estimatedDuration,
                notes,
                badge_text: badgeText,
                badge_class: badgeClass,
                main_message: mainMessage,
                notification_type_description: notificationTypeDescription,
                dashboard_url: `${FRONTEND_URL}/dashboard`
            });

            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject,
                html
            };

            if (NODE_ENV === 'test') {
                console.log('Test mode - maintenance email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Maintenance notification sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send maintenance notification error:', error);
            return false;
        }
    }

    /**
     * Send analysis completion notification
     * @param {Object} data - Notification data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @param {string} data.analysisId - Analysis ID
     * @param {string} data.patientName - Patient name
     * @returns {Promise<boolean>} Success indicator
     */
    async sendAnalysisCompletionNotification(data) {
        try {
            const { email, userId, analysisId, patientName } = data;

            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(userId || email, 'analysisCompletion');
            if (!shouldSend) {
                console.log('Analysis completion notification not sent - user has disabled analysisCompletion notifications');
                return true;
            }

            const subject = 'Blood Analysis Results Available';
            const html = `
                <h2>Analysis Results Ready</h2>
                <p>The blood analysis results for <strong>${patientName}</strong> are now available.</p>
                <p><strong>Analysis ID:</strong> ${analysisId}</p>
                <p>Please log in to your account to view the complete results.</p>
                <p><a href="${process.env.APP_URL || 'https://epick.fondation.lu'}/dashboard/analyses">View Results</a></p>
            `;

            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject,
                html
            };

            if (NODE_ENV === 'test') {
                console.log('Test mode - analysis completion email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Analysis completion notification sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send analysis completion notification error:', error);
            return false;
        }
    }

    /**
     * Send data export ready notification
     * @param {Object} data - Notification data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @param {string} data.exportType - Type of export
     * @param {string} data.downloadUrl - Download URL
     * @returns {Promise<boolean>} Success indicator
     */
    async sendDataExportNotification(data) {
        try {
            const { email, userId, exportType, downloadUrl } = data;

            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(userId || email, 'dataExport');
            if (!shouldSend) {
                console.log('Data export notification not sent - user has disabled dataExport notifications');
                return true;
            }

            const subject = 'Data Export Ready for Download';
            const html = `
                <h2>Export Complete</h2>
                <p>Your requested <strong>${exportType}</strong> export is ready for download.</p>
                <p><a href="${downloadUrl}">Download Export File</a></p>
                <p><strong>Note:</strong> This download link will expire in 24 hours for security reasons.</p>
            `;

            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject,
                html
            };

            if (NODE_ENV === 'test') {
                console.log('Test mode - data export email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Data export notification sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send data export notification error:', error);
            return false;
        }
    }

    /**
     * Send test notification (for user preference testing)
     * @param {Object} data - Test data
     * @param {string} data.email - Recipient email
     * @param {number} data.userId - User ID
     * @returns {Promise<boolean>} Success indicator
     */
    async sendTestNotification(data) {
        try {
            const { email, userId } = data;

            const subject = 'Test Notification - ePick';
            const html = `
                <h2>Test Notification</h2>
                <p>This is a test email to verify that your notification settings are working correctly.</p>
                <p>If you received this email, your email notifications are properly configured.</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            `;

            const mailOptions = {
                from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
                to: email,
                replyTo: REPLY_TO,
                subject,
                html
            };

            if (NODE_ENV === 'test') {
                console.log('Test mode - test notification email not sent:', {
                    to: email,
                    subject: mailOptions.subject
                });
                return true;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Test notification sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send test notification error:', error);
            return false;
        }
    }

    /**
     * Send system update notification
     * @param {Object} user - User object
     * @param {Object} update - System update object
     * @returns {Promise<boolean>} Success indicator
     */
    async sendSystemUpdateNotification(user, update) {
        try {
            // Check user preferences
            const shouldSend = await this.checkUserEmailPreference(user.id, 'system_updates');
            if (!shouldSend) {
                console.log('System update notification not sent - user has disabled system_updates notifications');
                return true;
            }

            // Format dates
            const formatDate = (dateString) => {
                return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            // Process changes data
            let processedChanges = null;
            if (update.changes && Array.isArray(update.changes)) {
                processedChanges = update.changes.map(changeGroup => ({
                    category: changeGroup.category,
                    category_display: this._getCategoryDisplay(changeGroup.category),
                    items: changeGroup.items || []
                }));
            }

            // Load and compile template
            const template = this._loadEmailTemplate('system_update_notification');

            // Prepare template data
            const templateData = {
                version: update.version,
                title: update.title,
                description: update.description ? update.description.replace(/\n/g, '<br>') : '',
                release_type: update.release_type,
                priority: update.priority,
                requires_acknowledgment: update.requires_acknowledgment,
                show_popup: update.show_popup,
                changes: processedChanges,
                user_name: user.full_name || 'User',
                dashboard_url: FRONTEND_URL || 'http://localhost:4000'
            };

            // Generate HTML from template
            const html = template(templateData);

            // Email options
            const mailOptions = {
                from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
                to: user.email,
                replyTo: REPLY_TO,
                subject: `ePick System Update: ${update.title} (${update.version})`,
                html: html
            };

            // Skip actual sending in test mode
            if (NODE_ENV === 'test') {
                console.log('Test mode - system update notification email not sent:', {
                    to: user.email,
                    subject: mailOptions.subject,
                    version: update.version
                });
                return true;
            }

            // Send email
            const info = await this.transporter.sendMail(mailOptions);
            console.log('System update notification sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Send system update notification error:', error);
            return false;
        }
    }

    /**
     * Get display name for change category
     * @param {string} category - Change category
     * @returns {string} Display name
     * @private
     */
    _getCategoryDisplay(category) {
        const categoryDisplayMap = {
            'new': 'New Features',
            'improved': 'Improvements',
            'fixed': 'Bug Fixes',
            'removed': 'Removed Features',
            'security': 'Security Updates',
            'performance': 'Performance Improvements',
            'ui': 'UI/UX Changes',
            'api': 'API Changes',
            'other': 'Other Changes'
        };
        return categoryDisplayMap[category] || 'Changes';
    }

    _loadEmailTemplate(name){
        const templatePath = path.join('./src/templates/emails', `${name}.html`);
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        return handlebars.compile(templateSource);
    }
}

module.exports = new EmailService();