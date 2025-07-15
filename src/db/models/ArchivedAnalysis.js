// db/models/ArchivedAnalysis.js
const EncryptionHooks = require('../../utils/encryptionHooks');

module.exports = (sequelize, DataTypes) => {
    const ArchivedAnalysis = sequelize.define('ArchivedAnalysis', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        original_analysis_id: {
            type: DataTypes.INTEGER,
            allowNull: false
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
        patient_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        doctor_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'doctors',
                key: 'id'
            }
        },
        doctor_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        room_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        room_number: {
            type: DataTypes.STRING(4),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['Pending', 'Delayed', 'In Progress', 'Completed', 'Cancelled']]
            }
        },
        analysis_type: {
            type: DataTypes.STRING(10),
            allowNull: false,
            validate: {
                isIn: [['XY', 'YZ', 'ZG', 'HG']]
            }
        },
        // priority: {
        //     type: DataTypes.STRING(20),
        //     allowNull: false,
        //     validate: {
        //         isIn: [['Low', 'Normal', 'High', 'Urgent']]
        //     }
        // },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // results: {
        //     type: DataTypes.JSONB,
        //     allowNull: true
        // },
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
        archived_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        archived_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
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
        }
    }, {
        tableName: 'archived_analyses',
        timestamps: false, // We handle timestamps manually for archived records
        indexes: [
            {
                fields: ['original_analysis_id']
            },
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
                fields: ['archived_at']
            },
            {
                fields: ['archived_by']
            },
            {
                fields: ['patient_name']
            },
            {
                fields: ['analysis_type', 'archived_at']
            }
        ]
    });

    // Add encryption for sensitive archived analysis data
    const encryptedFields = [
        'patient_name',    // Denormalized patient name
        'doctor_name',     // Doctor name
        'notes',           // Clinical notes
        'results'          // CRITICAL: Blood test results (JSONB)
    ];
    
    EncryptionHooks.addEncryptionHooks(ArchivedAnalysis, encryptedFields);

    return ArchivedAnalysis;
};