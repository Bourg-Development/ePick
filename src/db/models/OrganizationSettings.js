// db/models/OrganizationSettings.js
module.exports = (sequelize, DataTypes) => {
    const OrganizationSettings = sequelize.define('OrganizationSettings', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        setting_key: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        setting_value: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        data_type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'string',
            validate: {
                isIn: [['string', 'integer', 'decimal', 'boolean', 'json']]
            }
        },
        description: {
            type: DataTypes.TEXT,
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
        updated_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'organization_settings',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['setting_key']
            },
            {
                fields: ['data_type']
            },
            {
                fields: ['updated_by']
            }
        ]
    });

    return OrganizationSettings;
};