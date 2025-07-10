// db/models/SystemStatus.js
module.exports = (sequelize, DataTypes) => {
    const SystemStatus = sequelize.define('SystemStatus', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        component: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            comment: 'System component name (e.g., database, email, analysis-engine, etc.)'
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance']]
            },
            defaultValue: 'operational'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Human-readable description of the component'
        },
        last_checked: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        last_success: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last time component was confirmed operational'
        },
        last_failure: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last time component failed'
        },
        response_time: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Last response time in milliseconds'
        },
        error_message: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Last error message if component is not operational'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Additional component-specific data'
        },
        is_critical: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether this component is critical to system operation'
        },
        display_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Order for displaying components on status page'
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
        tableName: 'system_status',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['component'],
                unique: true
            },
            {
                fields: ['status']
            },
            {
                fields: ['is_critical']
            },
            {
                fields: ['display_order']
            },
            {
                fields: ['last_checked']
            }
        ]
    });

    return SystemStatus;
};