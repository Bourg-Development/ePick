// db/models/ScheduledMaintenance.js
module.exports = (sequelize, DataTypes) => {
    const ScheduledMaintenance = sequelize.define('ScheduledMaintenance', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: [1, 255]
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        scheduled_start: {
            type: DataTypes.DATE,
            allowNull: false
        },
        scheduled_end: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                isAfterStart(value) {
                    if (value <= this.scheduled_start) {
                        throw new Error('End time must be after start time');
                    }
                }
            }
        },
        actual_start: {
            type: DataTypes.DATE,
            allowNull: true
        },
        actual_end: {
            type: DataTypes.DATE,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'scheduled'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
            allowNull: false,
            defaultValue: 'medium'
        },
        maintenance_type: {
            type: DataTypes.ENUM('system_update', 'security_patch', 'infrastructure', 'feature_deployment', 'database_maintenance', 'other'),
            allowNull: false,
            defaultValue: 'system_update'
        },
        affects_availability: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        estimated_duration_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1
            }
        },
        notification_sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        notification_scheduled_for: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reminder_sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reminder_scheduled_for: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        updated_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        cancelled_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        cancellation_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
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
        tableName: 'scheduled_maintenance',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['scheduled_start']
            },
            {
                fields: ['scheduled_end']
            },
            {
                fields: ['status']
            },
            {
                fields: ['priority']
            },
            {
                fields: ['created_by']
            },
            {
                fields: ['notification_scheduled_for']
            },
            {
                fields: ['reminder_scheduled_for']
            }
        ]
    });

    return ScheduledMaintenance;
};