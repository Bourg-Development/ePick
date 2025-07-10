module.exports = (sequelize, DataTypes) => {
    const SystemUpdate = sequelize.define('SystemUpdate', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        version: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Version number or identifier'
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Update title/name'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Brief description of the update'
        },
        changes: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Array of change items with categories'
        },
        release_type: {
            type: DataTypes.ENUM('major', 'minor', 'patch', 'hotfix'),
            allowNull: false,
            defaultValue: 'minor',
            comment: 'Type of release'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
            allowNull: false,
            defaultValue: 'medium',
            comment: 'Update importance level'
        },
        status: {
            type: DataTypes.ENUM('draft', 'published', 'archived'),
            allowNull: false,
            defaultValue: 'draft',
            comment: 'Update publication status'
        },
        published_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the update was published'
        },
        published_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: 'User who published the update'
        },
        email_sent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether email notifications were sent'
        },
        email_sent_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When email notifications were sent'
        },
        requires_acknowledgment: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether users must acknowledge this update'
        },
        show_popup: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Whether to show popup notification to users'
        },
        popup_duration_days: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 7,
            comment: 'How many days to show popup for new logins'
        },
        github_release_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'GitHub release ID if imported from GitHub'
        },
        github_release_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'GitHub release URL'
        },
        github_tag_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'GitHub release tag name'
        },
        auto_imported: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this update was automatically imported from GitHub'
        }
    }, {
        tableName: 'system_updates',
        timestamps: true,
        underscored: true,
        paranoid: false,
        indexes: [
            {
                fields: ['status']
            },
            {
                fields: ['published_at']
            },
            {
                fields: ['priority']
            },
            {
                fields: ['version'],
                unique: true
            },
            {
                fields: ['github_release_id']
            },
            {
                fields: ['github_tag_name']
            }
        ]
    });

    SystemUpdate.associate = function(models) {
        SystemUpdate.belongsTo(models.User, {
            foreignKey: 'published_by',
            as: 'publisher'
        });

        SystemUpdate.hasMany(models.UserUpdateAcknowledgment, {
            foreignKey: 'update_id',
            as: 'acknowledgments'
        });
    };

    return SystemUpdate;
};