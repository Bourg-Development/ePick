// db/models/Prescription.js
const EncryptionHooks = require('../../utils/encryptionHooks');

module.exports = (sequelize, DataTypes) => {
    const Prescription = sequelize.define('Prescription', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        recurring_analysis_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'recurring_analyses',
                key: 'id'
            }
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
        prescribed_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            comment: 'User who uploaded/verified the prescription'
        },
        prescription_number: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: 'Unique prescription reference number'
        },
        valid_from: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'Start date when prescription becomes valid'
        },
        valid_until: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'End date when prescription expires'
        },
        remaining_analyses: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: 'Number of analyses remaining on this prescription'
        },
        total_analyses_prescribed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Total number of analyses prescribed initially'
        },
        document_path: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Path to uploaded prescription document'
        },
        document_filename: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Original filename of prescription document'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Additional prescription notes or instructions'
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'Active',
            validate: {
                isIn: [['Active', 'Expired', 'Exhausted', 'Cancelled']]
            }
        },
        verified_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
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
        tableName: 'prescriptions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['recurring_analysis_id']
            },
            {
                fields: ['patient_id']
            },
            {
                fields: ['doctor_id']
            },
            {
                fields: ['prescribed_by']
            },
            {
                fields: ['prescription_number']
            },
            {
                fields: ['status']
            },
            {
                fields: ['valid_from', 'valid_until']
            },
            {
                fields: ['status', 'valid_until']
            }
        ]
    });

    // Add encryption for sensitive prescription data
    const encryptedFields = [
        'prescription_number',    // Prescription reference number
        'document_path',          // Path to prescription document
        'document_filename',      // Original filename
        'notes'                   // Prescription instructions
    ];
    
    EncryptionHooks.addEncryptionHooks(Prescription, encryptedFields);

    return Prescription;
};