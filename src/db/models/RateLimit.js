// db/models/RateLimit.js
module.exports = (sequelize, DataTypes) => {
    const RateLimit = sequelize.define('RateLimit', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        key_type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['ip', 'user', 'service']]
            }
        },
        key_value: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        counter: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        first_request: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        last_request: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        reset_at: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        tableName: 'rate_limits',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['key_type', 'key_value']
            },
            {
                fields: ['reset_at']
            }
        ]
    });

    return RateLimit;
};