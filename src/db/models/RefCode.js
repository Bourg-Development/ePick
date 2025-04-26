// db/models/RefCode.js
module.exports = (sequelize, DataTypes) => {
    const RefCode = sequelize.define('RefCode', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        code: {
            type: DataTypes.STRING(11),
            allowNull: false,
            unique: true,
            validate: {
                is: /^\d{3}-\d{3}-\d{3}$/ // Format: xxx-xxx-xxx
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        used_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        used_ip: {
            type: DataTypes.STRING,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'active',
            validate: {
                isIn: [['active', 'used', 'expired', 'revoked']]
            }
        },
        require_2fa: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'reference_codes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                unique: true,
                fields: ['code']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['created_by']
            },
            {
                fields: ['status']
            },
            {
                fields: ['expires_at']
            }
        ]
    });

    return RefCode;
};