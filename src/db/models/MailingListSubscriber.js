// models/MailingListSubscriber.js
const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
    const MailingListSubscriber = sequelize.define('MailingListSubscriber', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        list_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'mailing_lists',
                key: 'id'
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            comment: 'Internal user subscription'
        },
        service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'services',
                key: 'id'
            },
            comment: 'Service subscription (uses service email)'
        },
        external_email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            },
            comment: 'External email subscription'
        },
        external_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            validate: {
                len: [1, 100]
            },
            comment: 'Name for external subscriber'
        },
        status: {
            type: DataTypes.ENUM('active', 'pending', 'unsubscribed', 'bounced'),
            defaultValue: 'active',
            allowNull: false
        },
        subscription_source: {
            type: DataTypes.ENUM('manual', 'api', 'auto_role', 'import', 'self_subscribe'),
            defaultValue: 'manual',
            allowNull: false
        },
        subscription_token: {
            type: DataTypes.STRING(64),
            allowNull: true,
            unique: true,
            comment: 'Token for unsubscribe links'
        },
        subscribed_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        unsubscribed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        last_email_sent: {
            type: DataTypes.DATE,
            allowNull: true
        },
        bounce_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        }
    }, {
        tableName: 'mailing_list_subscribers',
        timestamps: false,
        indexes: [
            {
                fields: ['list_id', 'user_id'],
                unique: true,
                name: 'unique_user_list_subscription',
                where: {
                    user_id: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                }
            },
            {
                fields: ['list_id', 'service_id'],
                unique: true,
                name: 'unique_service_list_subscription',
                where: {
                    service_id: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                }
            },
            {
                fields: ['list_id', 'external_email'],
                unique: true,
                name: 'unique_external_email_list_subscription',
                where: {
                    external_email: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                }
            },
            {
                fields: ['status']
            },
            {
                fields: ['subscription_token']
            }
        ],
        validate: {
            // Ensure exactly one of user_id, service_id, or external_email is set
            oneSubscriberTypeOnly() {
                const hasUser = this.user_id !== null && this.user_id !== undefined;
                const hasService = this.service_id !== null && this.service_id !== undefined;
                const hasExternal = this.external_email !== null && this.external_email !== undefined && this.external_email !== '';
                
                const count = [hasUser, hasService, hasExternal].filter(Boolean).length;
                
                if (count !== 1) {
                    throw new Error('Must have exactly one of: user_id, service_id, or external_email');
                }
            }
        },
        hooks: {
            beforeCreate: (subscriber) => {
                // Generate unsubscribe token if not provided
                if (!subscriber.subscription_token) {
                    subscriber.subscription_token = crypto.randomBytes(32).toString('hex');
                }
            }
        }
    });

    MailingListSubscriber.associate = (models) => {
        // Mailing list relationship
        MailingListSubscriber.belongsTo(models.MailingList, {
            foreignKey: 'list_id',
            as: 'mailingList'
        });

        // User relationship
        MailingListSubscriber.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        // Service relationship
        MailingListSubscriber.belongsTo(models.Service, {
            foreignKey: 'service_id',
            as: 'service'
        });

        // Campaign tracking relationship
        MailingListSubscriber.hasMany(models.CampaignTracking, {
            foreignKey: 'subscriber_id',
            as: 'campaignTracking'
        });
    };

    // Instance methods
    MailingListSubscriber.prototype.getEmailAddress = function() {
        if (this.user && this.user.email) {
            return this.user.email;
        }
        if (this.service && this.service.email) {
            return this.service.email;
        }
        if (this.external_email) {
            return this.external_email;
        }
        return null;
    };

    MailingListSubscriber.prototype.getDisplayName = function() {
        if (this.user && this.user.full_name) {
            return this.user.full_name;
        }
        if (this.service && this.service.name) {
            return this.service.name;
        }
        if (this.external_name) {
            return this.external_name;
        }
        return this.getEmailAddress();
    };

    return MailingListSubscriber;
};