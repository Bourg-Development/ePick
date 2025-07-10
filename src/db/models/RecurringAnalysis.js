// db/models/RecurringAnalysis.js
module.exports = (sequelize, DataTypes) => {
    const RecurringAnalysis = sequelize.define('RecurringAnalysis', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        patient_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'patients',
                key: 'id'
            }
        },
        doctor_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'doctors',
                key: 'id'
            }
        },
        room_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        analysis_type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['XY', 'YZ', 'ZG', 'HG']]
            }
        },
        recurrence_pattern: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['daily', 'weekly', 'monthly', 'custom']]
            }
        },
        interval_days: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: 'Number of days between recurrences'
        },
        total_occurrences: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Total number of analyses to schedule'
        },
        completed_occurrences: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Number of analyses already scheduled'
        },
        next_due_date: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'Next date when analysis should be scheduled'
        },
        last_scheduled_date: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Date when last analysis was scheduled'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        notes: {
            type: DataTypes.TEXT,
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
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'recurring_analyses',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['patient_id']
            },
            {
                fields: ['next_due_date']
            },
            {
                fields: ['is_active']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    return RecurringAnalysis;
};