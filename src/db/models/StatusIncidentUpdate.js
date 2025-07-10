// db/models/StatusIncidentUpdate.js
module.exports = (sequelize, DataTypes) => {
    const StatusIncidentUpdate = sequelize.define('StatusIncidentUpdate', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        incident_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'status_incidents',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['investigating', 'identified', 'monitoring', 'resolved', 'postmortem']]
            }
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Update message content'
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        is_public: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether update is visible on public status page'
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
        tableName: 'status_incident_updates',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['incident_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['is_public']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    // Define associations
    StatusIncidentUpdate.associate = function(models) {
        // Update belongs to incident
        StatusIncidentUpdate.belongsTo(models.StatusIncident, {
            foreignKey: 'incident_id',
            as: 'incident'
        });

        // Update created by user
        StatusIncidentUpdate.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });
    };

    return StatusIncidentUpdate;
};