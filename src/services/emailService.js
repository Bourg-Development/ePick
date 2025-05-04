// services/emailService.js
const nodemailer = require('nodemailer');
const {
    EMAIL_FROM,
    REPLY_TO,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD,
    EMAIL_SECURE,
    NODE_ENV
} = require('../config/environment');
const path = require("node:path");
const fs = require('fs');
const handlebars = require('handlebars');

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
            await this.transporter.verify();
            console.log('Email service connected successfully');
        } catch (error) {
            console.warn('Email service connection failed:', error.message);
            console.warn('Emails will not be sent');
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
            const expiryDate = expiresAt.toLocaleDateString();

            // Email content
            const mailOptions = {
                from: EMAIL_FROM,
                to: email,
                subject: 'Your Authentication System Reference Code',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Reference Code</h2>
            <p>You have been granted access to the secure authentication system.</p>
            <p>Please use the following reference code to complete your registration:</p>
            
            <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${code}
            </div>
            
            <p><strong>This code will expire on ${expiryDate}.</strong></p>
            
            <p>To complete your registration:</p>
            <ol>
              <li>Go to the registration page</li>
              <li>Enter the reference code above</li>
              <li>Create your password</li>
              <li>Follow any additional security steps as prompted</li>
            </ol>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is an automated message. Please do not reply to this email.
              If you did not expect this code or need assistance, please contact your system administrator.
            </p>
          </div>
        `
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
            const expiryDate = expiresAt.toLocaleDateString();

            // Email content
            const mailOptions = {
                from: EMAIL_FROM,
                to: email,
                subject: 'Password Reset Code',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>A password reset has been initiated for your account.</p>
            <p>Please use the following reference code to reset your password:</p>
            
            <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${code}
            </div>
            
            <p><strong>This code will expire on ${expiryDate}.</strong></p>
            
            <p>To reset your password:</p>
            <ol>
              <li>Go to the password reset page</li>
              <li>Enter the reference code above</li>
              <li>Create your new password</li>
              <li>Follow any additional security steps as prompted</li>
            </ol>
            
            <p style="color: #d20000; font-weight: bold;">If you did not request a password reset, please contact your administrator immediately.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
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
     * @returns {Promise<boolean>} Success indicator
     */
    async sendSecurityAlert(data) {
        try {
            const { email, alertType, eventDetails } = data;

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
    _loadEmailTemplate(name){
        const templatePath = path.join('./src/templates/emails', `${name}.html`);
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        return handlebars.compile(templateSource);
    }
}

module.exports = new EmailService();