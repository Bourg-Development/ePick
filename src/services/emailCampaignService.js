// services/emailCampaignService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const emailService = require('./emailService');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

/**
 * Service for email campaign management and sending
 */
class EmailCampaignService {

    /**
     * Create a new email campaign
     * @param {Object} campaignData - Campaign creation data
     * @param {number} campaignData.list_id - Mailing list ID
     * @param {string} campaignData.name - Campaign name
     * @param {string} campaignData.subject - Email subject
     * @param {string} [campaignData.content_html] - HTML content
     * @param {string} [campaignData.content_text] - Text content
     * @param {string} [campaignData.sender_email] - Sender email
     * @param {string} [campaignData.sender_name] - Sender name
     * @param {string} [campaignData.reply_to] - Reply-to email
     * @param {string} [campaignData.campaign_type] - Campaign type
     * @param {Date} [campaignData.scheduled_at] - Schedule date
     * @param {number} createdBy - User ID creating the campaign
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createCampaign(campaignData, createdBy, context) {
        try {
            const {
                list_id,
                name,
                subject,
                content_html,
                content_text,
                sender_email,
                sender_name,
                reply_to,
                campaign_type = 'announcement',
                scheduled_at
            } = campaignData;

            // Validate mailing list exists and is active
            const mailingList = await db.MailingList.findByPk(list_id);
            if (!mailingList) {
                return {
                    success: false,
                    message: 'Mailing list not found'
                };
            }

            if (!mailingList.is_active) {
                return {
                    success: false,
                    message: 'Cannot create campaign for inactive mailing list'
                };
            }

            // Get the user creating the campaign for sender name
            const creator = await db.User.findByPk(createdBy, {
                attributes: ['full_name', 'username']
            });

            // Use list defaults if sender info not provided
            const finalSenderEmail = sender_email || mailingList.sender_email || process.env.EMAIL_FROM;
            const creatorFullName = creator?.full_name || 'System User';
            const finalSenderName = `${creatorFullName} | ePick Systems`;

            if (!finalSenderEmail || !finalSenderName) {
                return {
                    success: false,
                    message: 'Sender email and name are required'
                };
            }

            // Validate at least one content type is provided
            if (!content_html && !content_text) {
                return {
                    success: false,
                    message: 'Either HTML or text content is required'
                };
            }

            // Get recipient count for initial stats
            const recipientCount = await db.MailingListSubscriber.count({
                where: {
                    list_id,
                    status: 'active'
                }
            });

            // Create campaign
            const campaign = await db.EmailCampaign.create({
                list_id,
                name: name.trim(),
                subject: subject.trim(),
                content_html,
                content_text,
                sender_email: finalSenderEmail,
                sender_name: finalSenderName,
                reply_to,
                campaign_type,
                scheduled_at,
                total_recipients: recipientCount,
                created_by: createdBy
            });

            // Log creation
            await logService.auditLog({
                eventType: 'email_campaign.created',
                userId: createdBy,
                targetId: campaign.id,
                targetType: 'email_campaign',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    campaignName: campaign.name,
                    listId: list_id,
                    listName: mailingList.name,
                    campaignType: campaign_type,
                    totalRecipients: recipientCount,
                    scheduled: !!scheduled_at,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                data: campaign,
                message: 'Email campaign created successfully'
            };
        } catch (error) {
            console.error('Create campaign error:', error);
            return {
                success: false,
                message: 'Failed to create email campaign'
            };
        }
    }

    /**
     * Send campaign immediately or schedule for later
     * @param {number} campaignId - Campaign ID
     * @param {number} sentBy - User ID sending the campaign
     * @param {Object} context - Request context
     * @param {boolean} [sendNow=true] - Send immediately or schedule
     * @returns {Promise<Object>} Send result
     */
    async sendCampaign(campaignId, sentBy, context, sendNow = true) {
        try {
            const campaign = await db.EmailCampaign.findByPk(campaignId, {
                include: [
                    {
                        model: db.MailingList,
                        as: 'mailingList',
                        include: [{
                            model: db.MailingListSubscriber,
                            as: 'subscribers',
                            where: { status: 'active' },
                            required: false,
                            include: [
                                {
                                    model: db.User,
                                    as: 'user',
                                    attributes: ['id', 'username', 'full_name', 'email']
                                },
                                {
                                    model: db.Service,
                                    as: 'service',
                                    attributes: ['id', 'name', 'email']
                                }
                            ]
                        }]
                    }
                ]
            });

            if (!campaign) {
                return {
                    success: false,
                    message: 'Campaign not found'
                };
            }

            if (!campaign.canSend()) {
                return {
                    success: false,
                    message: 'Campaign cannot be sent in its current state'
                };
            }

            const subscribers = campaign.mailingList.subscribers || [];
            if (subscribers.length === 0) {
                return {
                    success: false,
                    message: 'No active subscribers found'
                };
            }

            if (sendNow) {
                // Send immediately
                campaign.status = 'sending';
                campaign.sent_at = new Date();
                await campaign.save();

                // Create tracking records for all recipients
                const trackingRecords = [];
                for (const subscriber of subscribers) {
                    const emailAddress = subscriber.getEmailAddress();
                    if (emailAddress) {
                        trackingRecords.push({
                            campaign_id: campaignId,
                            subscriber_id: subscriber.id,
                            email_address: emailAddress,
                            status: 'queued',
                            tracking_id: crypto.randomBytes(32).toString('hex')
                        });
                    }
                }

                if (trackingRecords.length > 0) {
                    await db.CampaignTracking.bulkCreate(trackingRecords);
                }

                // Send emails asynchronously
                this._sendCampaignEmails(campaign, subscribers, context).catch(error => {
                    console.error('Background email sending error:', error);
                });

                // Log sending
                await logService.auditLog({
                    eventType: 'email_campaign.sent',
                    userId: sentBy,
                    targetId: campaignId,
                    targetType: 'email_campaign',
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        campaignName: campaign.name,
                        listId: campaign.list_id,
                        recipientCount: subscribers.length,
                        userAgent: context.userAgent
                    }
                });

                return {
                    success: true,
                    message: `Campaign is being sent to ${subscribers.length} recipients`
                };
            } else {
                // Schedule for later
                campaign.status = 'scheduled';
                await campaign.save();

                return {
                    success: true,
                    message: 'Campaign scheduled successfully'
                };
            }
        } catch (error) {
            console.error('Send campaign error:', error);
            return {
                success: false,
                message: 'Failed to send campaign'
            };
        }
    }

    /**
     * Get campaigns with pagination and filtering
     * @param {Object} options - Query options
     * @param {number} [options.page=1] - Page number
     * @param {number} [options.limit=10] - Items per page
     * @param {string} [options.search] - Search term
     * @param {string} [options.status] - Filter by status
     * @param {number} [options.list_id] - Filter by list ID
     * @param {string} [options.campaign_type] - Filter by type
     * @returns {Promise<Object>} Campaigns with pagination info
     */
    async getCampaigns(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                status,
                list_id,
                campaign_type
            } = options;

            const offset = (page - 1) * limit;
            const whereClause = {};

            // Apply filters
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { subject: { [Op.iLike]: `%${search}%` } }
                ];
            }

            if (status) {
                whereClause.status = status;
            }

            if (list_id) {
                whereClause.list_id = list_id;
            }

            if (campaign_type) {
                whereClause.campaign_type = campaign_type;
            }

            const { count, rows } = await db.EmailCampaign.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: db.MailingList,
                        as: 'mailingList',
                        attributes: ['id', 'name']
                    },
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Add computed fields
            const campaignsWithStats = rows.map(campaign => {
                const campaignData = campaign.toJSON();
                campaignData.open_rate = campaign.getOpenRate();
                campaignData.click_rate = campaign.getClickRate();
                campaignData.bounce_rate = campaign.getBounceRate();
                return campaignData;
            });

            return {
                success: true,
                data: {
                    campaigns: campaignsWithStats,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        pages: Math.ceil(count / limit)
                    }
                }
            };
        } catch (error) {
            console.error('Get campaigns error:', error);
            return {
                success: false,
                message: 'Failed to retrieve campaigns'
            };
        }
    }

    /**
     * Get campaign by ID with detailed tracking information
     * @param {number} campaignId - Campaign ID
     * @returns {Promise<Object>} Campaign details
     */
    async getCampaignById(campaignId) {
        try {
            const campaign = await db.EmailCampaign.findByPk(campaignId, {
                include: [
                    {
                        model: db.MailingList,
                        as: 'mailingList',
                        attributes: ['id', 'name', 'description']
                    },
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    },
                    {
                        model: db.CampaignTracking,
                        as: 'tracking',
                        include: [{
                            model: db.MailingListSubscriber,
                            as: 'subscriber',
                            include: [
                                {
                                    model: db.User,
                                    as: 'user',
                                    attributes: ['id', 'username', 'full_name']
                                },
                                {
                                    model: db.Service,
                                    as: 'service',
                                    attributes: ['id', 'name']
                                }
                            ]
                        }]
                    }
                ]
            });

            if (!campaign) {
                return {
                    success: false,
                    message: 'Campaign not found'
                };
            }

            const campaignData = campaign.toJSON();
            campaignData.open_rate = campaign.getOpenRate();
            campaignData.click_rate = campaign.getClickRate();
            campaignData.bounce_rate = campaign.getBounceRate();

            return {
                success: true,
                data: campaignData
            };
        } catch (error) {
            console.error('Get campaign by ID error:', error);
            return {
                success: false,
                message: 'Failed to retrieve campaign'
            };
        }
    }

    /**
     * Cancel a scheduled or sending campaign
     * @param {number} campaignId - Campaign ID
     * @param {number} cancelledBy - User ID cancelling the campaign
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelCampaign(campaignId, cancelledBy, context) {
        try {
            const campaign = await db.EmailCampaign.findByPk(campaignId);

            if (!campaign) {
                return {
                    success: false,
                    message: 'Campaign not found'
                };
            }

            if (!campaign.canCancel()) {
                return {
                    success: false,
                    message: 'Campaign cannot be cancelled in its current state'
                };
            }

            campaign.status = 'cancelled';
            await campaign.save();

            // Log cancellation
            await logService.auditLog({
                eventType: 'email_campaign.cancelled',
                userId: cancelledBy,
                targetId: campaignId,
                targetType: 'email_campaign',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    campaignName: campaign.name,
                    listId: campaign.list_id,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Campaign cancelled successfully'
            };
        } catch (error) {
            console.error('Cancel campaign error:', error);
            return {
                success: false,
                message: 'Failed to cancel campaign'
            };
        }
    }

    /**
     * Send campaign emails (background process)
     * @private
     * @param {Object} campaign - Campaign instance
     * @param {Array} subscribers - List of subscribers
     * @param {Object} context - Request context
     * @returns {Promise<void>}
     */
    async _sendCampaignEmails(campaign, subscribers, context) {
        try {
            let sentCount = 0;
            let deliveredCount = 0;
            let bouncedCount = 0;

            for (const subscriber of subscribers) {
                try {
                    const emailAddress = subscriber.getEmailAddress();
                    const displayName = subscriber.getDisplayName();

                    if (!emailAddress) {
                        continue;
                    }

                    // Get tracking record
                    const tracking = await db.CampaignTracking.findOne({
                        where: {
                            campaign_id: campaign.id,
                            subscriber_id: subscriber.id
                        }
                    });

                    if (!tracking) {
                        continue;
                    }

                    // Prepare email content with tracking
                    const emailContent = await this._prepareEmailContent(campaign, tracking, subscriber, displayName);

                    // Send email
                    console.log(`[DEBUG] Sending email to: ${emailAddress}, subject: ${campaign.subject}`);
                    console.log(`[DEBUG] Email content preview - HTML length: ${emailContent.html?.length || 0}, Text length: ${emailContent.text?.length || 0}`);
                    console.log(`[DEBUG] Email HTML content:`, emailContent.html?.substring(0, 200) + '...');
                    
                    const sendResult = await emailService.sendEmail({
                        to: emailAddress,
                        subject: campaign.subject,
                        html: emailContent.html,
                        text: emailContent.text,
                        from: campaign.sender_email,
                        senderName: emailContent.senderName, // Use the formatted sender name from email content
                        replyTo: campaign.reply_to
                    });
                    
                    console.log(`[DEBUG] Email send result for ${emailAddress}:`, sendResult);

                    if (sendResult.success) {
                        await tracking.markSent();
                        sentCount++;

                        // Simulate delivery status (in real implementation, this would come from email provider webhooks)
                        setTimeout(async () => {
                            try {
                                await tracking.markDelivered();
                                deliveredCount++;
                            } catch (error) {
                                console.error('Mark delivered error:', error);
                            }
                        }, Math.random() * 5000); // Random delay 0-5 seconds

                    } else {
                        await tracking.markBounced(sendResult.message || 'Unknown error');
                        bouncedCount++;
                    }

                    // Small delay between emails to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`Error sending email to subscriber ${subscriber.id}:`, error);
                    bouncedCount++;
                }
            }

            // Update campaign statistics
            campaign.status = 'sent';
            campaign.total_sent = sentCount;
            campaign.total_delivered = deliveredCount;
            campaign.total_bounced = bouncedCount;
            await campaign.save();

            // Log completion
            await logService.auditLog({
                eventType: 'email_campaign.completed',
                userId: 0, // System
                targetId: campaign.id,
                targetType: 'email_campaign',
                ipAddress: '127.0.0.1',
                deviceFingerprint: 'system',
                metadata: {
                    campaignName: campaign.name,
                    totalSent: sentCount,
                    totalDelivered: deliveredCount,
                    totalBounced: bouncedCount
                }
            });

        } catch (error) {
            console.error('Send campaign emails error:', error);
            
            // Mark campaign as failed
            campaign.status = 'failed';
            await campaign.save();
        }
    }

    /**
     * Prepare email content with tracking pixels and unsubscribe links
     * @private
     * @param {Object} campaign - Campaign instance
     * @param {Object} tracking - Tracking instance
     * @param {Object} subscriber - Subscriber instance
     * @param {string} displayName - Recipient display name
     * @returns {Object} Prepared email content
     */
    async _prepareEmailContent(campaign, tracking, subscriber, displayName) {
        const trackingPixelUrl = `${process.env.BASE_URL}/api/mailing/track/open/${tracking.tracking_id}`;
        const unsubscribeUrl = `${process.env.BASE_URL}/api/mailing/unsubscribe/${subscriber.subscription_token}`;

        try {
            // Get sender information and role
            const sender = await db.User.findByPk(campaign.created_by, {
                include: [{
                    model: db.Role,
                    as: 'role',
                    attributes: ['name']
                }],
                attributes: ['full_name', 'username']
            });

            // Format sender name and role
            const fullName = sender?.full_name || 'System User';
            const senderName = campaign.sender_name || `${fullName} | ePick Systems`;
            const senderRole = this._formatRole(sender?.role?.name || 'team_member');

            // Load the email template
            const templatePath = path.join(__dirname, '../templates/emails/campaign_template.html');
            const templateSource = fs.readFileSync(templatePath, 'utf8');
            const template = handlebars.compile(templateSource);

            // Replace variables in campaign content first
            let processedHtmlContent = campaign.content_html || '';
            let processedTextContent = campaign.content_text || '';
            
            // Define replacements for user variables
            const userReplacements = {
                '{{name}}': displayName,
                '{{recipient_name}}': displayName,
                '{{unsubscribe_url}}': unsubscribeUrl
            };
            
            // Replace variables in the content
            Object.entries(userReplacements).forEach(([placeholder, value]) => {
                processedHtmlContent = processedHtmlContent.replace(new RegExp(placeholder, 'g'), value);
                processedTextContent = processedTextContent.replace(new RegExp(placeholder, 'g'), value);
            });

            // Prepare template data
            const templateData = {
                campaign_name: campaign.name,
                campaign_subject: campaign.subject,
                campaign_type: campaign.campaign_type || 'Announcement',
                campaign_content: processedHtmlContent || processedTextContent || '',
                unsubscribe_url: unsubscribeUrl,
                tracking_pixel_url: trackingPixelUrl,
                recipient_name: displayName,
                sender_name: senderName,
                signature_name: fullName,
                sender_role: senderRole
            };

            // Render the HTML email with template
            const html = template(templateData);

            // Create text version by stripping HTML and adding basic formatting
            let text = processedTextContent || '';
            if (!text && processedHtmlContent) {
                // Basic HTML to text conversion
                text = processedHtmlContent
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
                    .replace(/&amp;/g, '&') // Replace HTML entities
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();
            }

            // Add campaign info to text version
            if (text) {
                text = `${campaign.name}\n${'='.repeat(campaign.name.length)}\n\n${text}`;
                
                // Add unsubscribe link to text if not already present
                if (!text.includes(unsubscribeUrl)) {
                    text += `\n\n---\nTo unsubscribe from this mailing list, visit: ${unsubscribeUrl}`;
                }
            }

            return { html, text, senderName };

        } catch (error) {
            console.error('Template rendering error:', error);
            
            // Fallback to original behavior if template fails
            let html = campaign.content_html || '';
            let text = campaign.content_text || '';

            // Replace placeholders
            const replacements = {
                '{{name}}': displayName,
                '{{unsubscribe_url}}': unsubscribeUrl
            };

            Object.entries(replacements).forEach(([placeholder, value]) => {
                html = html.replace(new RegExp(placeholder, 'g'), value);
                text = text.replace(new RegExp(placeholder, 'g'), value);
            });

            // Add tracking pixel to HTML
            if (html) {
                html += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />`;
            }

            // Add unsubscribe link to text if not already present
            if (text && !text.includes(unsubscribeUrl)) {
                text += `\n\nTo unsubscribe, visit: ${unsubscribeUrl}`;
            }

            // For fallback, also create a formatted sender name
            const fallbackSender = await db.User.findByPk(campaign.created_by, {
                attributes: ['full_name']
            });
            const fallbackSenderName = `${fallbackSender?.full_name || 'System User'} | ePick Systems`;

            return { html, text, senderName: fallbackSenderName };
        }
    }

    /**
     * Track email open
     * @param {string} trackingId - Tracking ID
     * @returns {Promise<Object>} Tracking result
     */
    async trackOpen(trackingId) {
        try {
            const tracking = await db.CampaignTracking.findOne({
                where: { tracking_id: trackingId },
                include: [{
                    model: db.EmailCampaign,
                    as: 'campaign'
                }]
            });

            if (!tracking) {
                return { success: false, message: 'Tracking record not found' };
            }

            await tracking.markOpened();

            // Update campaign statistics
            if (tracking.campaign) {
                const openCount = await db.CampaignTracking.count({
                    where: {
                        campaign_id: tracking.campaign.id,
                        opened_at: { [Op.ne]: null }
                    }
                });

                tracking.campaign.total_opened = openCount;
                await tracking.campaign.save();
            }

            return { success: true };
        } catch (error) {
            console.error('Track open error:', error);
            return { success: false, message: 'Failed to track open' };
        }
    }

    /**
     * Track email click
     * @param {string} trackingId - Tracking ID
     * @param {string} url - Clicked URL
     * @returns {Promise<Object>} Tracking result
     */
    async trackClick(trackingId, url) {
        try {
            const tracking = await db.CampaignTracking.findOne({
                where: { tracking_id: trackingId },
                include: [{
                    model: db.EmailCampaign,
                    as: 'campaign'
                }]
            });

            if (!tracking) {
                return { success: false, message: 'Tracking record not found' };
            }

            await tracking.markClicked();

            // Update campaign statistics
            if (tracking.campaign) {
                const clickCount = await db.CampaignTracking.count({
                    where: {
                        campaign_id: tracking.campaign.id,
                        clicked_at: { [Op.ne]: null }
                    }
                });

                tracking.campaign.total_clicked = clickCount;
                await tracking.campaign.save();
            }

            return { success: true, redirectUrl: url };
        } catch (error) {
            console.error('Track click error:', error);
            return { success: false, message: 'Failed to track click' };
        }
    }

    /**
     * Format role name for display in signature
     * @private
     * @param {string} roleName - Raw role name
     * @returns {string} Formatted role name
     */
    _formatRole(roleName) {
        if (!roleName) return 'Team Member';
        
        // Replace underscores with spaces and capitalize first letter of each word
        return roleName
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}

module.exports = new EmailCampaignService();