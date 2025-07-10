// db/models/StatusIncident.js
module.exports = (sequelize, DataTypes) => {
    const StatusIncident = sequelize.define('StatusIncident', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            comment: 'Brief incident title'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Detailed incident description'
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['investigating', 'identified', 'monitoring', 'resolved', 'postmortem']]
            },
            defaultValue: 'investigating'
        },
        severity: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['low', 'medium', 'high', 'critical']]
            },
            defaultValue: 'medium'
        },
        impact: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['none', 'minor', 'major', 'critical']]
            },
            defaultValue: 'minor'
        },
        affected_components: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            comment: 'List of affected system components'
        },
        started_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true
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
            comment: 'Whether incident is visible on public status page'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Additional incident data'
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
        tableName: 'status_incidents',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['status']
            },
            {
                fields: ['severity']
            },
            {
                fields: ['impact']
            },
            {
                fields: ['started_at']
            },
            {
                fields: ['resolved_at']
            },
            {
                fields: ['is_public']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    // Define associations
    StatusIncident.associate = function(models) {
        // Incident created by user
        StatusIncident.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });

        // Incident has many updates
        StatusIncident.hasMany(models.StatusIncidentUpdate, {
            foreignKey: 'incident_id',
            as: 'updates'
        });
    };

    return StatusIncident;
};