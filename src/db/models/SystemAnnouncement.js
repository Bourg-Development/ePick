// db/models/SystemAnnouncement.js
module.exports = (sequelize, DataTypes) => {
    const SystemAnnouncement = sequelize.define('SystemAnnouncement', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            validate: {
                len: [1, 200],
                notEmpty: true
            }
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                len: [1, 5000],
                notEmpty: true
            }
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'info',
            validate: {
                isIn: [['info', 'warning', 'critical', 'maintenance', 'success']]
            }
        },
        priority: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'normal',
            validate: {
                isIn: [['low', 'normal', 'high', 'critical']]
            }
        },
        target_audience: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'all',
            validate: {
                isIn: [['all', 'admins', 'staff', 'specific_role']]
            }
        },
        target_roles: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const value = this.getDataValue('target_roles');
                return value ? JSON.parse(value) : null;
            },
            set(value) {
                this.setDataValue('target_roles', value ? JSON.stringify(value) : null);
            }
        },
        scheduled_for: {
            type: DataTypes.DATE,
            allowNull: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        is_published: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        published_at: {
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
        }
    }, {
        tableName: 'system_announcements',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['is_active', 'is_published']
            },
            {
                fields: ['target_audience']
            },
            {
                fields: ['scheduled_for']
            },
            {
                fields: ['expires_at']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    SystemAnnouncement.associate = function(models) {
        // Association with User (creator)
        SystemAnnouncement.belongsTo(models.User, {
            foreignKey: 'created_by',
            as: 'creator'
        });

        // Association with AnnouncementView
        SystemAnnouncement.hasMany(models.AnnouncementView, {
            foreignKey: 'announcement_id',
            as: 'views'
        });
    };

    // Instance methods
    SystemAnnouncement.prototype.isVisible = function() {
        const now = new Date();
        
        // Check if announcement is active and published
        if (!this.is_active || !this.is_published) {
            return false;
        }
        
        // Check if it's scheduled for the future
        if (this.scheduled_for && this.scheduled_for > now) {
            return false;
        }
        
        // Check if it's expired
        if (this.expires_at && this.expires_at < now) {
            return false;
        }
        
        return true;
    };

    SystemAnnouncement.prototype.isTargetedToUser = function(user) {
        if (this.target_audience === 'all') {
            return true;
        }
        
        if (this.target_audience === 'admins') {
            return user.role === 'admin' || user.role === 'system_admin';
        }
        
        if (this.target_audience === 'staff') {
            return user.role !== 'admin' && user.role !== 'system_admin';
        }
        
        if (this.target_audience === 'specific_role' && this.target_roles) {
            return this.target_roles.includes(user.role);
        }
        
        return false;
    };

    return SystemAnnouncement;
};