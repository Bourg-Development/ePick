// db/migrations/022-create-system-announcements.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create system_announcements table
        await queryInterface.createTable('system_announcements', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false,
                comment: 'Announcement title'
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Announcement content'
            },
            type: {
                type: Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'info',
                comment: 'Announcement type: info, warning, critical, maintenance'
            },
            priority: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'normal',
                comment: 'Priority level: low, normal, high, critical'
            },
            target_audience: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'all',
                comment: 'Target audience: all, admins, staff, specific_role'
            },
            target_roles: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JSON array of specific roles if target_audience is specific_role'
            },
            scheduled_for: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'When to publish the announcement (null for immediate)'
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'When the announcement expires'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                comment: 'Whether the announcement is currently active'
            },
            is_published: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                comment: 'Whether the announcement has been published'
            },
            published_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'When the announcement was published'
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            }
        });

        // Create announcement_views table to track who has seen announcements
        await queryInterface.createTable('announcement_views', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            announcement_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'system_announcements',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            viewed_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            is_acknowledged: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                comment: 'Whether user acknowledged the announcement'
            },
            acknowledged_at: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        // Add CHECK constraints
        await queryInterface.sequelize.query(`
            ALTER TABLE system_announcements ADD CONSTRAINT check_announcement_type_values
                CHECK (type IN ('info', 'warning', 'critical', 'maintenance', 'success'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE system_announcements ADD CONSTRAINT check_priority_values
                CHECK (priority IN ('low', 'normal', 'high', 'critical'));
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE system_announcements ADD CONSTRAINT check_target_audience_values
                CHECK (target_audience IN ('all', 'admins', 'staff', 'specific_role'));
        `);

        // Create indexes
        await queryInterface.addIndex('system_announcements', ['is_active', 'is_published']);
        await queryInterface.addIndex('system_announcements', ['target_audience']);
        await queryInterface.addIndex('system_announcements', ['scheduled_for']);
        await queryInterface.addIndex('system_announcements', ['expires_at']);
        await queryInterface.addIndex('system_announcements', ['created_by']);
        
        await queryInterface.addIndex('announcement_views', ['announcement_id', 'user_id'], {
            unique: true,
            name: 'unique_announcement_user_view'
        });
        await queryInterface.addIndex('announcement_views', ['user_id']);
        await queryInterface.addIndex('announcement_views', ['is_acknowledged']);

        // Add timestamp triggers
        await queryInterface.sequelize.query(`
            CREATE TRIGGER update_system_announcements_timestamp BEFORE UPDATE ON system_announcements 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
        `);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('announcement_views');
        await queryInterface.dropTable('system_announcements');
    }
};