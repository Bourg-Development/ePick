module.exports = (sequelize, DataTypes) => {
    const UserUpdateAcknowledgment = sequelize.define('UserUpdateAcknowledgment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: 'User who acknowledged the update'
        },
        update_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'SystemUpdates',
                key: 'id'
            },
            comment: 'System update that was acknowledged'
        },
        acknowledged_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'When the user acknowledged the update'
        },
        popup_shown: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether popup was shown to user'
        },
        popup_shown_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When popup was first shown to user'
        }
    }, {
        tableName: 'user_update_acknowledgments',
        timestamps: true,
        underscored: true,
        paranoid: false,
        indexes: [
            {
                fields: ['user_id', 'update_id'],
                unique: true
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['update_id']
            },
            {
                fields: ['acknowledged_at']
            }
        ]
    });

    UserUpdateAcknowledgment.associate = function(models) {
        UserUpdateAcknowledgment.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        UserUpdateAcknowledgment.belongsTo(models.SystemUpdate, {
            foreignKey: 'update_id',
            as: 'update'
        });
    };

    return UserUpdateAcknowledgment;
};