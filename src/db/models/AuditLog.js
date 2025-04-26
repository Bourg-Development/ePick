// db/models/AuditLog.js
module.exports = (sequelize, DataTypes) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        event_type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        target_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        target_type: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        device_fingerprint: {
            type: DataTypes.STRING,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        previous_hash: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        record_hash: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'audit_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['event_type']
            },
            {
                fields: ['created_at']
            },
            {
                fields: ['target_id', 'target_type']
            }
        ]
    });

    return AuditLog;
};

// db/models/SecurityLog.js
module.exports = (sequelize, DataTypes) => {
    const SecurityLog = sequelize.define('SecurityLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        event_type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        severity: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['low', 'medium', 'high', 'critical']]
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        device_fingerprint: {
            type: DataTypes.STRING,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        previous_hash: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        record_hash: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'security_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['event_type']
            },
            {
                fields: ['severity']
            },
            {
                fields: ['ip_address']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    return SecurityLog;
};