// db/models/User.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING(6),
            allowNull: false,
            unique: true,
            validate: {
                is: /^\d{6}$/ // 6-digit numeric username
            }
        },
        password_hash: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        salt: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'roles',
                key: 'id'
            }
        },
        service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'services',
                key: 'id'
            }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        totp_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        totp_secret: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        webauthn_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        webauthn_credentials: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        failed_login_attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        last_login_attempt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        account_locked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        account_locked_until: {
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
        last_login: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        encrypted_recovery_email: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        encrypted_phone: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        last_ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_device_fingerprint: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['username']
            },
            {
                fields: ['role_id']
            },
            {
                fields: ['service_id']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    return User;
};