// db/models/RolePermission.js
module.exports = (sequelize, DataTypes) => {
    const RolePermission = sequelize.define('RolePermission', {
        role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'roles',
                key: 'id'
            }
        },
        permission_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'permissions',
                key: 'id'
            }
        }
    }, {
        tableName: 'role_permissions',
        timestamps: false,
        indexes: [
            {
                fields: ['role_id']
            },
            {
                fields: ['permission_id']
            }
        ]
    });

    return RolePermission;
};