// db/models/Patient.js
const EncryptionHooks = require('../../utils/encryptionHooks');

module.exports = (sequelize, DataTypes) => {
    const Patient = sequelize.define('Patient', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        matricule_national: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        date_of_birth: {
            type: DataTypes.DATE,
            allowNull: true
        },
        gender: {
            type: DataTypes.STRING(20),
            allowNull: true,
            validate: {
                isIn: [['Male', 'Female', 'Other']]
            }
        },
        phone: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        room_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'rooms',
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
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
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
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        name_hash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'SHA-256 hash of name for encrypted search'
        },
        matricule_hash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'SHA-256 hash of matricule_national for encrypted search'
        },
        first_name_hash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'SHA-256 hash of first name for partial search'
        },
        last_name_hash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'SHA-256 hash of last name for partial search'
        },
        name_parts_json: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'JSON array of hashed name parts for partial matching'
        }
    }, {
        tableName: 'patients',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['matricule_national']
            },
            {
                fields: ['name']
            },
            {
                fields: ['doctor_id']
            },
            {
                fields: ['room_id']
            },
            {
                fields: ['active']
            },
            {
                fields: ['created_by']
            },
            {
                fields: ['date_of_birth']
            },
            {
                fields: ['name_hash']
            },
            {
                fields: ['matricule_hash']
            },
            {
                fields: ['first_name_hash']
            },
            {
                fields: ['last_name_hash']
            }
        ]
    });

    // Add encryption for sensitive patient data fields
    const encryptedFields = [
        'name',              // Patient's full name
        'matricule_national', // National ID number  
        'phone',             // Phone number
        'address'            // Home address
    ];
    
    EncryptionHooks.addEncryptionHooks(Patient, encryptedFields);

    return Patient;
};