// db/models/Session.js
module.exports = (sequelize, DataTypes) => {
    const Session = sequelize.define('Session', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        token_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        refresh_token_id: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        device_fingerprint: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        refresh_token_expires_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        last_activity: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        is_valid: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'sessions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['user_id']
            },
            {
                unique: true,
                fields: ['token_id']
            },
            {
                unique: true,
                fields: ['refresh_token_id']
            },
            {
                fields: ['expires_at']
            },
            {
                fields: ['is_valid']
            }
        ]
    });

    return Session;
};