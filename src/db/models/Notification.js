// db/models/Notification.js
module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['prescription_verification', 'recurring_analysis_due', 'analysis_cancelled', 'system_update', 'maintenance', 'system_announcement']]
            }
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            comment: 'Short notification title'
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Full notification message'
        },
        priority: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'normal',
            validate: {
                isIn: [['low', 'normal', 'high', 'urgent']]
            }
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        is_dismissed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        action_required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this notification requires user action'
        },
        action_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'URL to redirect when notification is clicked'
        },
        related_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'ID of related entity (analysis, prescription, etc.)'
        },
        related_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Type of related entity'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When this notification becomes irrelevant'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Additional data for the notification'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'notifications',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['type']
            },
            {
                fields: ['is_read']
            },
            {
                fields: ['is_dismissed']
            },
            {
                fields: ['action_required']
            },
            {
                fields: ['priority']
            },
            {
                fields: ['expires_at']
            },
            {
                fields: ['user_id', 'is_read', 'is_dismissed']
            },
            {
                fields: ['user_id', 'type', 'action_required']
            },
            {
                fields: ['related_type', 'related_id']
            }
        ]
    });

    return Notification;
};