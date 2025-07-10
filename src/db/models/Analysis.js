// db/models/Analysis.js
const EncryptionHooks = require('../../utils/encryptionHooks');

module.exports = (sequelize, DataTypes) => {
    const Analysis = sequelize.define('Analysis', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        analysis_date: {
            type: DataTypes.DATE,
            allowNull: false
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
            allowNull: false,
            references: {
                model: 'doctors',
                key: 'id'
            }
        },
        room_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'Pending',
            validate: {
                isIn: [['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled']]
            }
        },
        analysis_type: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        completed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        postponed_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        original_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        completed_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        recurring_analysis_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'recurring_analyses',
                key: 'id'
            },
            comment: 'Links to recurring pattern if this analysis is part of a series'
        },
        occurrence_number: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Which occurrence this is in the recurring series (1, 2, 3, etc.)'
        }
    }, {
        tableName: 'analyses',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['analysis_date']
            },
            {
                fields: ['patient_id']
            },
            {
                fields: ['doctor_id']
            },
            {
                fields: ['room_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['analysis_type']
            },
            {
                fields: ['created_by']
            },
            {
                fields: ['completed_by']
            },
            {
                fields: ['recurring_analysis_id']
            },
            {
                fields: ['status', 'analysis_date']
            },
            {
                fields: ['analysis_type', 'status']
            }
        ]
    });

    // Add encryption for sensitive analysis data
    const encryptedFields = [
        'notes'           // Clinical notes about the analysis
    ];
    
    EncryptionHooks.addEncryptionHooks(Analysis, encryptedFields);

    return Analysis;
};