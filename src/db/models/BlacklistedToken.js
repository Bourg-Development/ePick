// db/models/BlacklistedToken.js
module.exports = (sequelize, DataTypes) => {
    const BlacklistedToken = sequelize.define('BlacklistedToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token_id: {
            type: DataTypes.TEXT,
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
        blacklisted_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        reason: {
            type: DataTypes.STRING(100),
            allowNull: false
        }
    }, {
        tableName: 'blacklisted_tokens',
        timestamps: true,
        createdAt: 'blacklisted_at',
        updatedAt: false,
        indexes: [
            {
                unique: true,
                fields: ['token_id']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['blacklisted_at']
            }
        ]
    });

    return BlacklistedToken;
};