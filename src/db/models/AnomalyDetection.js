// db/models/AnomalyDetection.js
module.exports = (sequelize, DataTypes) => {
    const AnomalyDetection = sequelize.define('AnomalyDetection', {
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
        anomaly_type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        confidence: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            validate: {
                min: 0,
                max: 100
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        actions_taken: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        resolved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        resolved_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'anomaly_detections',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['anomaly_type']
            },
            {
                fields: ['confidence']
            },
            {
                fields: ['resolved']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    return AnomalyDetection;
};