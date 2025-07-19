// services/mailingListService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const emailService = require('./emailService');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { BASE_URL, EMAIL_FROM, EMAIL_FROM_NAME } = require('../config/environment');

/**
 * Service for mailing list management operations
 */
class MailingListService {

    /**
     * Create a new mailing list
     * @param {Object} listData - Mailing list creation data
     * @param {string} listData.name - List name
     * @param {string} [listData.description] - List description
     * @param {boolean} [listData.is_internal] - Is internal list
     * @param {string[]} [listData.auto_subscribe_roles] - Roles to auto-subscribe
     * @param {string} [listData.sender_email] - Custom sender email
     * @param {string} [listData.sender_name] - Custom sender name
     * @param {number} [listData.max_subscribers] - Maximum subscribers
     * @param {boolean} [listData.subscription_requires_approval] - Requires approval
     * @param {number} createdBy - User ID creating the list
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Creation result
     */
    async createMailingList(listData, createdBy, context) {
        try {
            const {
                name,
                description,
                is_internal = false,
                auto_subscribe_roles = [],
                sender_email,
                sender_name,
                max_subscribers,
                subscription_requires_approval = false
            } = listData;

            // Validate name uniqueness
            const existingList = await db.MailingList.findOne({
                where: { name: name.trim() }
            });

            if (existingList) {
                return {
                    success: false,
                    message: 'Mailing list with this name already exists'
                };
            }

            // Get the creator's information for default sender name
            const creator = await db.User.findByPk(createdBy, {
                attributes: ['full_name', 'username']
            });

            // Use creator's name as default sender name if not provided
            const defaultSenderName = creator.full_name + ' | System';

            // Create mailing list
            const mailingList = await db.MailingList.create({
                name: name.trim(),
                description: description?.trim(),
                is_internal,
                auto_subscribe_roles,
                sender_email,
                sender_name: defaultSenderName,
                max_subscribers,
                subscription_requires_approval,
                created_by: createdBy
            });

            // Auto-subscribe users with specified roles
            if (auto_subscribe_roles && auto_subscribe_roles.length > 0) {
                await this._autoSubscribeUsersByRole(mailingList.id, auto_subscribe_roles, context);
            }

            // Log creation
            await logService.auditLog({
                eventType: 'mailing_list.created',
                userId: createdBy,
                targetId: mailingList.id,
                targetType: 'mailing_list',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listName: mailingList.name,
                    isInternal: is_internal,
                    autoSubscribeRoles: auto_subscribe_roles,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                data: mailingList,
                message: 'Mailing list created successfully'
            };
        } catch (error) {
            console.error('Create mailing list error:', error);
            return {
                success: false,
                message: 'Failed to create mailing list'
            };
        }
    }

    /**
     * Get all mailing lists with pagination and filtering
     * @param {Object} options - Query options
     * @param {number} [options.page=1] - Page number
     * @param {number} [options.limit=10] - Items per page
     * @param {string} [options.search] - Search term
     * @param {boolean} [options.is_active] - Filter by active status
     * @param {boolean} [options.is_internal] - Filter by internal status
     * @returns {Promise<Object>} Lists with pagination info
     */
    async getMailingLists(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                is_active,
                is_internal
            } = options;

            const offset = (page - 1) * limit;
            const whereClause = {};

            // Apply filters
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }

            if (is_active !== undefined) {
                whereClause.is_active = is_active;
            }

            if (is_internal !== undefined) {
                whereClause.is_internal = is_internal;
            }

            const { count, rows } = await db.MailingList.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    },
                    {
                        model: db.MailingListSubscriber,
                        as: 'subscribers',
                        attributes: ['id', 'status'],
                        required: false
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Add subscriber count to each list
            const listsWithCounts = rows.map(list => {
                const listData = list.toJSON();
                listData.subscriber_count = list.subscribers?.filter(s => s.status === 'active').length || 0;
                listData.total_subscribers = list.subscribers?.length || 0;
                delete listData.subscribers; // Remove detailed subscriber data
                return listData;
            });

            return {
                success: true,
                data: {
                    lists: listsWithCounts,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        pages: Math.ceil(count / limit)
                    }
                }
            };
        } catch (error) {
            console.error('Get mailing lists error:', error);
            return {
                success: false,
                message: 'Failed to retrieve mailing lists'
            };
        }
    }

    /**
     * Get mailing list by ID with detailed information
     * @param {number} listId - Mailing list ID
     * @returns {Promise<Object>} Mailing list details
     */
    async getMailingListById(listId) {
        try {
            const mailingList = await db.MailingList.findByPk(listId, {
                include: [
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username', 'full_name']
                    },
                    {
                        model: db.MailingListSubscriber,
                        as: 'subscribers',
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
                    },
                    {
                        model: db.EmailCampaign,
                        as: 'campaigns',
                        attributes: ['id', 'name', 'status', 'created_at', 'total_recipients'],
                        limit: 5,
                        order: [['created_at', 'DESC']]
                    }
                ]
            });

            if (!mailingList) {
                return {
                    success: false,
                    message: 'Mailing list not found'
                };
            }

            return {
                success: true,
                data: mailingList
            };
        } catch (error) {
            console.error('Get mailing list by ID error:', error);
            return {
                success: false,
                message: 'Failed to retrieve mailing list'
            };
        }
    }

    /**
     * Update mailing list
     * @param {number} listId - Mailing list ID
     * @param {Object} updateData - Update data
     * @param {number} updatedBy - User ID making the update
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update result
     */
    async updateMailingList(listId, updateData, updatedBy, context) {
        try {
            const mailingList = await db.MailingList.findByPk(listId);

            if (!mailingList) {
                return {
                    success: false,
                    message: 'Mailing list not found'
                };
            }

            // Store old values for logging
            const oldValues = {
                name: mailingList.name,
                description: mailingList.description,
                is_active: mailingList.is_active,
                auto_subscribe_roles: mailingList.auto_subscribe_roles
            };

            // Update allowed fields
            const allowedFields = [
                'name', 'description', 'is_active', 'auto_subscribe_roles',
                'sender_email', 'sender_name', 'max_subscribers', 'subscription_requires_approval'
            ];

            const updates = {};
            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    updates[field] = updateData[field];
                }
            });

            // Check name uniqueness if updating name
            if (updates.name && updates.name !== mailingList.name) {
                const existingList = await db.MailingList.findOne({
                    where: { 
                        name: updates.name.trim(),
                        id: { [Op.ne]: listId }
                    }
                });

                if (existingList) {
                    return {
                        success: false,
                        message: 'Mailing list with this name already exists'
                    };
                }
            }

            // Update the list
            await mailingList.update(updates);

            // Handle auto-subscribe role changes
            if (updates.auto_subscribe_roles) {
                await this._handleAutoSubscribeRoleChanges(
                    listId, 
                    oldValues.auto_subscribe_roles, 
                    updates.auto_subscribe_roles,
                    context
                );
            }

            // Log update
            await logService.auditLog({
                eventType: 'mailing_list.updated',
                userId: updatedBy,
                targetId: listId,
                targetType: 'mailing_list',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listName: mailingList.name,
                    oldValues,
                    newValues: updates,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                data: mailingList,
                message: 'Mailing list updated successfully'
            };
        } catch (error) {
            console.error('Update mailing list error:', error);
            return {
                success: false,
                message: 'Failed to update mailing list'
            };
        }
    }

    /**
     * Add subscriber to mailing list
     * @param {number} listId - Mailing list ID
     * @param {Object} subscriberData - Subscriber data
     * @param {number} [subscriberData.user_id] - User ID
     * @param {number} [subscriberData.service_id] - Service ID
     * @param {string} [subscriberData.external_email] - External email
     * @param {string} [subscriberData.external_name] - External name
     * @param {number} addedBy - User ID adding the subscriber
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Addition result
     */
    async addSubscriber(listId, subscriberData, addedBy, context) {
        try {
            const mailingList = await db.MailingList.findByPk(listId);

            if (!mailingList) {
                return {
                    success: false,
                    message: 'Mailing list not found'
                };
            }

            if (!mailingList.is_active) {
                return {
                    success: false,
                    message: 'Cannot add subscribers to inactive mailing list'
                };
            }

            const { user_id, service_id, external_email, external_name } = subscriberData;

            // Validate that exactly one subscriber type is provided
            const subscriberTypes = [user_id, service_id, external_email].filter(Boolean);
            if (subscriberTypes.length !== 1) {
                return {
                    success: false,
                    message: 'Must specify exactly one of: user_id, service_id, or external_email'
                };
            }

            // Check restrictions for internal lists
            if (mailingList.is_internal && external_email) {
                return {
                    success: false,
                    message: 'Internal mailing lists can only have internal users and services, not external email addresses'
                };
            }

            // Check for existing subscription
            const whereClause = { list_id: listId };
            if (user_id) whereClause.user_id = user_id;
            if (service_id) whereClause.service_id = service_id;
            if (external_email) whereClause.external_email = external_email;

            const existingSubscriber = await db.MailingListSubscriber.findOne({
                where: whereClause
            });

            if (existingSubscriber) {
                if (existingSubscriber.status === 'active') {
                    return {
                        success: false,
                        message: 'Already subscribed to this mailing list'
                    };
                } else {
                    // Reactivate subscription
                    existingSubscriber.status = 'active';
                    existingSubscriber.subscribed_at = new Date();
                    existingSubscriber.unsubscribed_at = null;
                    await existingSubscriber.save();

                    return {
                        success: true,
                        data: existingSubscriber,
                        message: 'Subscription reactivated successfully'
                    };
                }
            }

            // Check subscriber limit
            if (mailingList.max_subscribers) {
                const activeSubscribers = await db.MailingListSubscriber.count({
                    where: { 
                        list_id: listId,
                        status: 'active'
                    }
                });

                if (activeSubscribers >= mailingList.max_subscribers) {
                    return {
                        success: false,
                        message: 'Mailing list has reached maximum subscriber limit'
                    };
                }
            }

            // Validate user/service exists if specified
            if (user_id) {
                const user = await db.User.findByPk(user_id);
                if (!user) {
                    return {
                        success: false,
                        message: 'User not found'
                    };
                }
                if (!user.email) {
                    return {
                        success: false,
                        message: 'User does not have an email address'
                    };
                }
            }

            if (service_id) {
                const service = await db.Service.findByPk(service_id);
                if (!service) {
                    return {
                        success: false,
                        message: 'Service not found'
                    };
                }
                if (!service.email) {
                    return {
                        success: false,
                        message: 'Service does not have an email address'
                    };
                }
            }

            // Create subscription
            const status = mailingList.subscription_requires_approval ? 'pending' : 'active';
            
            const subscriber = await db.MailingListSubscriber.create({
                list_id: listId,
                user_id: user_id || null,
                service_id: service_id || null,
                external_email: external_email || null,
                external_name: external_name || null,
                status,
                subscription_source: 'manual'
            });

            // Log addition
            await logService.auditLog({
                eventType: 'mailing_list.subscriber_added',
                userId: addedBy,
                targetId: subscriber.id,
                targetType: 'mailing_list_subscriber',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listId,
                    listName: mailingList.name,
                    subscriberType: user_id ? 'user' : service_id ? 'service' : 'external',
                    subscriberId: user_id || service_id || external_email,
                    status,
                    userAgent: context.userAgent
                }
            });

            // Send notification email if subscription is active
            if (status === 'active') {
                await this._sendSubscriptionNotification(mailingList, subscriber, user_id, service_id);
            }

            return {
                success: true,
                data: subscriber,
                message: status === 'pending' ? 
                    'Subscriber added and pending approval' : 
                    'Subscriber added successfully'
            };
        } catch (error) {
            console.error('Add subscriber error:', error);
            return {
                success: false,
                message: 'Failed to add subscriber'
            };
        }
    }

    /**
     * Remove subscriber from mailing list
     * @param {number} listId - Mailing list ID
     * @param {number} subscriberId - Subscriber ID
     * @param {number} removedBy - User ID removing the subscriber
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Removal result
     */
    async removeSubscriber(listId, subscriberId, removedBy, context) {
        try {
            const subscriber = await db.MailingListSubscriber.findOne({
                where: {
                    id: subscriberId,
                    list_id: listId
                },
                include: [
                    {
                        model: db.MailingList,
                        as: 'mailingList',
                        attributes: ['name']
                    }
                ]
            });

            if (!subscriber) {
                return {
                    success: false,
                    message: 'Subscriber not found'
                };
            }

            // Mark as unsubscribed instead of deleting
            subscriber.status = 'unsubscribed';
            subscriber.unsubscribed_at = new Date();
            await subscriber.save();

            // Log removal
            await logService.auditLog({
                eventType: 'mailing_list.subscriber_removed',
                userId: removedBy,
                targetId: subscriberId,
                targetType: 'mailing_list_subscriber',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listId,
                    listName: subscriber.mailingList.name,
                    subscriberType: subscriber.user_id ? 'user' : subscriber.service_id ? 'service' : 'external',
                    subscriberId: subscriber.user_id || subscriber.service_id || subscriber.external_email,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Subscriber removed successfully'
            };
        } catch (error) {
            console.error('Remove subscriber error:', error);
            return {
                success: false,
                message: 'Failed to remove subscriber'
            };
        }
    }

    /**
     * Auto-subscribe users by role
     * @private
     * @param {number} listId - Mailing list ID
     * @param {string[]} roles - Roles to subscribe
     * @param {Object} context - Request context
     * @returns {Promise<void>}
     */
    async _autoSubscribeUsersByRole(listId, roles, context) {
        try {
            const users = await db.User.findAll({
                include: [{
                    model: db.Role,
                    as: 'role',
                    where: { name: { [Op.in]: roles } }
                }],
                where: {
                    email: { [Op.ne]: null }
                }
            });

            for (const user of users) {
                // Check if already subscribed
                const existingSubscriber = await db.MailingListSubscriber.findOne({
                    where: {
                        list_id: listId,
                        user_id: user.id
                    }
                });

                if (!existingSubscriber) {
                    const subscriber = await db.MailingListSubscriber.create({
                        list_id: listId,
                        user_id: user.id,
                        status: 'active',
                        subscription_source: 'auto_role'
                    });
                    
                    // Send notification email for auto-subscribed users
                    const mailingList = await db.MailingList.findByPk(listId);
                    await this._sendSubscriptionNotification(mailingList, subscriber, user.id, null);
                }
            }
        } catch (error) {
            console.error('Auto-subscribe users by role error:', error);
        }
    }

    /**
     * Handle auto-subscribe role changes
     * @private
     * @param {number} listId - Mailing list ID
     * @param {string[]} oldRoles - Old roles
     * @param {string[]} newRoles - New roles
     * @param {Object} context - Request context
     * @returns {Promise<void>}
     */
    async _handleAutoSubscribeRoleChanges(listId, oldRoles, newRoles, context) {
        try {
            const addedRoles = newRoles.filter(role => !oldRoles.includes(role));
            const removedRoles = oldRoles.filter(role => !newRoles.includes(role));

            // Add users from new roles
            if (addedRoles.length > 0) {
                await this._autoSubscribeUsersByRole(listId, addedRoles, context);
            }

            // Remove users from removed roles (only if they were auto-subscribed)
            if (removedRoles.length > 0) {
                const usersToRemove = await db.User.findAll({
                    include: [{
                        model: db.Role,
                        as: 'role',
                        where: { name: { [Op.in]: removedRoles } }
                    }]
                });

                for (const user of usersToRemove) {
                    await db.MailingListSubscriber.update({
                        status: 'unsubscribed',
                        unsubscribed_at: new Date()
                    }, {
                        where: {
                            list_id: listId,
                            user_id: user.id,
                            subscription_source: 'auto_role'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Handle auto-subscribe role changes error:', error);
        }
    }

    /**
     * Get available users for subscription (not already subscribed)
     * @param {number} listId - Mailing list ID
     * @param {string} [search] - Search term
     * @returns {Promise<Object>} Available users
     */
    async getAvailableUsers(listId, search) {
        try {
            const whereClause = {
                email: { [Op.ne]: null }
            };

            if (search) {
                whereClause[Op.or] = [
                    { username: { [Op.iLike]: `%${search}%` } },
                    { full_name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }

            // Get users not already subscribed to this list
            const users = await db.User.findAll({
                where: {
                    ...whereClause,
                    id: {
                        [Op.notIn]: db.sequelize.literal(`(
                            SELECT user_id FROM mailing_list_subscribers 
                            WHERE list_id = ${listId} AND user_id IS NOT NULL AND status = 'active'
                        )`)
                    }
                },
                attributes: ['id', 'username', 'full_name', 'email'],
                include: [{
                    model: db.Role,
                    as: 'role',
                    attributes: ['name']
                }],
                limit: 50,
                order: [['full_name', 'ASC']]
            });

            return {
                success: true,
                data: users
            };
        } catch (error) {
            console.error('Get available users error:', error);
            return {
                success: false,
                message: 'Failed to retrieve available users'
            };
        }
    }

    /**
     * Get available services for subscription (not already subscribed)
     * @param {number} listId - Mailing list ID
     * @param {string} [search] - Search term
     * @returns {Promise<Object>} Available services
     */
    async getAvailableServices(listId, search) {
        try {
            const whereClause = {
                email: { [Op.ne]: null }
            };

            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }

            // Get services not already subscribed to this list
            const services = await db.Service.findAll({
                where: {
                    ...whereClause,
                    id: {
                        [Op.notIn]: db.sequelize.literal(`(
                            SELECT service_id FROM mailing_list_subscribers 
                            WHERE list_id = ${listId} AND service_id IS NOT NULL AND status = 'active'
                        )`)
                    }
                },
                attributes: ['id', 'name', 'email'],
                limit: 50,
                order: [['name', 'ASC']]
            });

            return {
                success: true,
                data: services
            };
        } catch (error) {
            console.error('Get available services error:', error);
            return {
                success: false,
                message: 'Failed to retrieve available services'
            };
        }
    }

    /**
     * Send subscription notification email
     * @private
     * @param {Object} mailingList - Mailing list object
     * @param {Object} subscriber - Subscriber object
     * @param {number} userId - User ID if subscriber is a user
     * @param {number} serviceId - Service ID if subscriber is a service
     * @returns {Promise<void>}
     */
    async _sendSubscriptionNotification(mailingList, subscriber, userId, serviceId) {
        try {
            let recipientEmail, recipientName;

            // Get recipient details based on subscriber type
            let isExternalEmail = false;
            if (userId) {
                const user = await db.User.findByPk(userId);
                recipientEmail = user.email;
                recipientName = user.full_name || user.username;
                
                // Skip sending email if user has no email address
                if (!recipientEmail) {
                    console.log(`Skipping subscription notification for user ${user.username} (ID: ${userId}) - no email address`);
                    return;
                }
            } else if (serviceId) {
                const service = await db.Service.findByPk(serviceId);
                recipientEmail = service.email;
                recipientName = service.name;
                
                // Skip sending email if service has no email address
                if (!recipientEmail) {
                    console.log(`Skipping subscription notification for service ${service.name} (ID: ${serviceId}) - no email address`);
                    return;
                }
            } else {
                // This is an external email subscriber
                isExternalEmail = true;
                recipientEmail = subscriber.external_email;
                recipientName = subscriber.external_name || 'Subscriber';
            }

            // Load the appropriate email template based on subscriber type
            let template;
            try {
                if (isExternalEmail) {
                    try {
                        template = this._loadEmailTemplate('mailing_list_subscription_external');
                    } catch (error) {
                        // Fallback to regular template if external template doesn't exist
                        console.log('External template not found, using regular template with conditional content');
                        template = this._loadEmailTemplate('mailing_list_subscription');
                    }
                } else {
                    template = this._loadEmailTemplate('mailing_list_subscription');
                }
            } catch (error) {
                console.error('Failed to load email template:', error);
                throw new Error('Email template not available');
            }
            
            // The subscription_token is automatically generated by the model hook
            const unsubscribeToken = subscriber.subscription_token;

            // Prepare template data - different for external vs internal users
            const templateData = {
                recipient_name: recipientName,
                list_name: mailingList.name,
                list_description: mailingList.description || 'No description provided',
                subscription_date: new Date().toLocaleDateString(),
                email_address: recipientEmail,
                unsubscribe_url: `${BASE_URL}/api/mailing/unsubscribe/${unsubscribeToken}`
            };

            // Add account settings URL only for internal users (not external emails)
            if (!isExternalEmail) {
                templateData.account_settings_url = `${BASE_URL}/user/settings/notifications?list=${mailingList.id}&highlight=true#mailing-lists`;
            }

            // Render the email HTML
            const emailHtml = template(templateData);

            // Send the email
            console.log(`Attempting to send subscription notification to ${recipientEmail} for list "${mailingList.name}"`);
            const result = await emailService.sendEmail({
                to: recipientEmail,
                subject: `You've been added to "${mailingList.name}" mailing list`,
                html: emailHtml,
                from: mailingList.sender_email || EMAIL_FROM,
                senderName: mailingList.sender_name || EMAIL_FROM_NAME
            });

            if (result.success) {
                console.log(`✅ Subscription notification sent successfully to ${recipientEmail} for list "${mailingList.name}"`);
            } else {
                console.error(`❌ Failed to send subscription notification to ${recipientEmail}:`, result.message);
            }
        } catch (error) {
            console.error('Error sending subscription notification:', error);
            // Don't throw the error - we don't want to fail the subscription if email fails
        }
    }

    /**
     * Load email template
     * @private
     * @param {string} templateName - Template name
     * @returns {Function} Compiled handlebars template
     */
    _loadEmailTemplate(templateName) {
        const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        return handlebars.compile(templateSource);
    }

    /**
     * Delete mailing list
     * @param {number} listId - Mailing list ID
     * @param {number} deletedBy - User ID deleting the list
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Deletion result
     */
    async deleteMailingList(listId, deletedBy, context) {
        try {
            const mailingList = await db.MailingList.findByPk(listId, {
                include: [
                    {
                        model: db.EmailCampaign,
                        as: 'campaigns',
                        where: { status: { [Op.in]: ['scheduled', 'sending'] } },
                        required: false
                    }
                ]
            });

            if (!mailingList) {
                return {
                    success: false,
                    message: 'Mailing list not found'
                };
            }

            // Check for active campaigns
            if (mailingList.campaigns && mailingList.campaigns.length > 0) {
                return {
                    success: false,
                    message: 'Cannot delete mailing list with active or scheduled campaigns'
                };
            }

            // Instead of hard delete, mark as inactive
            await mailingList.update({ is_active: false });

            // Log deletion
            await logService.auditLog({
                eventType: 'mailing_list.deleted',
                userId: deletedBy,
                targetId: listId,
                targetType: 'mailing_list',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listName: mailingList.name,
                    isInternal: mailingList.is_internal,
                    userAgent: context.userAgent
                }
            });

            return {
                success: true,
                message: 'Mailing list deactivated successfully'
            };
        } catch (error) {
            console.error('Delete mailing list error:', error);
            return {
                success: false,
                message: 'Failed to delete mailing list'
            };
        }
    }
}

module.exports = new MailingListService();