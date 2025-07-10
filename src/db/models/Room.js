// db/models/Room.js
module.exports = (sequelize, DataTypes) => {
    const Room = sequelize.define('Room', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        room_number: {
            type: DataTypes.STRING(4),
            allowNull: false,
            unique: true,
            validate: {
                is: /^\d{4}$/ // 4-digit room number
            }
        },
        service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'services',
                key: 'id'
            }
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'rooms',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['room_number']
            },
            {
                fields: ['service_id']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    // Define associations
    Room.associate = function(models) {
        // Room belongs to Service
        Room.belongsTo(models.Service, {
            foreignKey: 'service_id',
            as: 'service'
        });

        // Room belongs to User (creator)
        Room.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });

        // Room has many Patients
        Room.hasMany(models.Patient, {
            foreignKey: 'room_id',
            as: 'patients'
        });

        // Room has many Analyses
        Room.hasMany(models.Analysis, {
            foreignKey: 'room_id',
            as: 'analyses'
        });
    };

    return Room;
};