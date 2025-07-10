// models/MailingList.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MailingList = sequelize.define('MailingList', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: true,
                len: [2, 100]
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        is_internal: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            comment: 'Internal lists for system notifications'
        },
        auto_subscribe_roles: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: [],
            allowNull: true,
            comment: 'Roles that are automatically subscribed'
        },
        sender_email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            },
            comment: 'Custom sender email for this list'
        },
        sender_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            validate: {
                len: [1, 100]
            },
            comment: 'Custom sender name for this list'
        },
        max_subscribers: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1
            },
            comment: 'Maximum number of subscribers (null = unlimited)'
        },
        subscription_requires_approval: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
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
        tableName: 'mailing_lists',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['name'],
                unique: true
            },
            {
                fields: ['is_active']
            },
            {
                fields: ['is_internal']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    MailingList.associate = (models) => {
        // Creator relationship
        MailingList.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });

        // Subscribers relationship
        MailingList.hasMany(models.MailingListSubscriber, {
            foreignKey: 'list_id',
            as: 'subscribers'
        });

        // Campaigns relationship
        MailingList.hasMany(models.EmailCampaign, {
            foreignKey: 'list_id',
            as: 'campaigns'
        });
    };

    return MailingList;
};