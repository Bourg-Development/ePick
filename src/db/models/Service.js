// db/models/Service.js
module.exports = (sequelize, DataTypes) => {
    const Service = sequelize.define('Service', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        can_view_all_analyses: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
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
        tableName: 'services',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['name']
            },
            {
                fields: ['email']
            },
            {
                fields: ['active']
            }
        ]
    });

    // Define associations
    Service.associate = function(models) {
        // Service has many Users
        Service.hasMany(models.User, {
            foreignKey: 'service_id',
            as: 'users'
        });

        // Service has many Rooms
        Service.hasMany(models.Room, {
            foreignKey: 'service_id',
            as: 'rooms'
        });
    };

    return Service;
};