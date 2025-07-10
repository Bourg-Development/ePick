// db/models/AnnouncementView.js
module.exports = (sequelize, DataTypes) => {
    const AnnouncementView = sequelize.define('AnnouncementView', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        announcement_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'system_announcements',
                key: 'id'
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        viewed_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        is_acknowledged: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        acknowledged_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'announcement_views',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['announcement_id', 'user_id'],
                name: 'unique_announcement_user_view'
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['is_acknowledged']
            }
        ]
    });

    AnnouncementView.associate = function(models) {
        // Association with SystemAnnouncement
        AnnouncementView.belongsTo(models.SystemAnnouncement, {
            foreignKey: 'announcement_id',
            as: 'announcement'
        });

        // Association with User
        AnnouncementView.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    return AnnouncementView;
};