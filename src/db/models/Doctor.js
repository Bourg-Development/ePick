// db/models/Doctor.js
const EncryptionHooks = require('../../utils/encryptionHooks');

module.exports = (sequelize, DataTypes) => {
    const Doctor = sequelize.define('Doctor', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        specialization: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
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
        }
    }, {
        tableName: 'doctors',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['name']
            },
            {
                fields: ['specialization']
            },
            {
                fields: ['active']
            },
            {
                fields: ['created_by']
            },
            {
                fields: ['email']
            }
        ]
    });

    // Add encryption for sensitive doctor data
    const encryptedFields = [
        'name',             // Doctor's name
        'phone',            // Contact phone
        'email',            // Email address
        'specialization'    // Medical specialization
    ];
    
    EncryptionHooks.addEncryptionHooks(Doctor, encryptedFields);

    return Doctor;
};