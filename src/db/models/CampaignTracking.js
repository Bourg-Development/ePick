// models/CampaignTracking.js
const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
    const CampaignTracking = sequelize.define('CampaignTracking', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        campaign_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'email_campaigns',
                key: 'id'
            }
        },
        subscriber_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'mailing_list_subscribers',
                key: 'id'
            }
        },
        email_address: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        status: {
            type: DataTypes.ENUM('queued', 'sent', 'delivered', 'bounced', 'complained', 'unsubscribed'),
            defaultValue: 'queued',
            allowNull: false
        },
        sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        delivered_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        opened_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        clicked_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        bounced_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        bounce_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        tracking_id: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        }
    }, {
        tableName: 'campaign_tracking',
        timestamps: false,
        indexes: [
            {
                fields: ['campaign_id', 'status']
            },
            {
                fields: ['tracking_id'],
                unique: true
            },
            {
                fields: ['subscriber_id']
            },
            {
                fields: ['email_address']
            }
        ],
        hooks: {
            beforeCreate: (tracking) => {
                // Generate tracking ID if not provided
                if (!tracking.tracking_id) {
                    tracking.tracking_id = crypto.randomBytes(32).toString('hex');
                }
            }
        }
    });

    CampaignTracking.associate = (models) => {
        // Campaign relationship
        CampaignTracking.belongsTo(models.EmailCampaign, {
            foreignKey: 'campaign_id',
            as: 'campaign'
        });

        // Subscriber relationship
        CampaignTracking.belongsTo(models.MailingListSubscriber, {
            foreignKey: 'subscriber_id',
            as: 'subscriber'
        });
    };

    // Instance methods
    CampaignTracking.prototype.markSent = function() {
        this.status = 'sent';
        this.sent_at = new Date();
        return this.save();
    };

    CampaignTracking.prototype.markDelivered = function() {
        this.status = 'delivered';
        this.delivered_at = new Date();
        return this.save();
    };

    CampaignTracking.prototype.markBounced = function(reason) {
        this.status = 'bounced';
        this.bounced_at = new Date();
        this.bounce_reason = reason;
        return this.save();
    };

    CampaignTracking.prototype.markOpened = function() {
        if (!this.opened_at) {
            this.opened_at = new Date();
            return this.save();
        }
        return Promise.resolve(this);
    };

    CampaignTracking.prototype.markClicked = function() {
        if (!this.clicked_at) {
            this.clicked_at = new Date();
            return this.save();
        }
        return Promise.resolve(this);
    };

    return CampaignTracking;
};