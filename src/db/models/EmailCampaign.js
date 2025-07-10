// models/EmailCampaign.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const EmailCampaign = sequelize.define('EmailCampaign', {
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
        name: {
            type: DataTypes.STRING(200),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 200]
            }
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 255]
            }
        },
        content_html: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        content_text: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        sender_email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        sender_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 100]
            }
        },
        reply_to: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        status: {
            type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'),
            defaultValue: 'draft',
            allowNull: false
        },
        scheduled_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        total_recipients: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        total_sent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        total_delivered: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        total_bounced: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        total_opened: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        total_clicked: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            validate: {
                min: 0
            }
        },
        campaign_type: {
            type: DataTypes.ENUM('newsletter', 'announcement', 'alert', 'system', 'marketing'),
            defaultValue: 'announcement',
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'email_campaigns',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['list_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['scheduled_at']
            },
            {
                fields: ['campaign_type']
            },
            {
                fields: ['created_by']
            }
        ],
        validate: {
            // Ensure at least one content type is provided
            hasContent() {
                if (!this.content_html && !this.content_text) {
                    throw new Error('Campaign must have either HTML or text content');
                }
            },
            // Validate scheduled date is in future
            scheduledInFuture() {
                if (this.scheduled_at && this.scheduled_at <= new Date()) {
                    throw new Error('Scheduled date must be in the future');
                }
            }
        }
    });

    EmailCampaign.associate = (models) => {
        // Mailing list relationship
        EmailCampaign.belongsTo(models.MailingList, {
            foreignKey: 'list_id',
            as: 'mailingList'
        });

        // Creator relationship
        EmailCampaign.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });

        // Campaign tracking relationship
        EmailCampaign.hasMany(models.CampaignTracking, {
            foreignKey: 'campaign_id',
            as: 'tracking'
        });
    };

    // Instance methods
    EmailCampaign.prototype.canEdit = function() {
        return ['draft', 'scheduled'].includes(this.status);
    };

    EmailCampaign.prototype.canSend = function() {
        return this.status === 'draft' && this.content_html || this.content_text;
    };

    EmailCampaign.prototype.canCancel = function() {
        return ['scheduled', 'sending'].includes(this.status);
    };

    EmailCampaign.prototype.getOpenRate = function() {
        if (this.total_delivered === 0) return 0;
        return (this.total_opened / this.total_delivered * 100).toFixed(2);
    };

    EmailCampaign.prototype.getClickRate = function() {
        if (this.total_delivered === 0) return 0;
        return (this.total_clicked / this.total_delivered * 100).toFixed(2);
    };

    EmailCampaign.prototype.getBounceRate = function() {
        if (this.total_recipients === 0) return 0;
        return (this.total_bounced / this.total_recipients * 100).toFixed(2);
    };

    return EmailCampaign;
};