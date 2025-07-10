const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Create system_updates table
            await queryInterface.createTable('system_updates', {
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
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
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
                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updated_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                }
            });

            // Create user_update_acknowledgments table
            await queryInterface.createTable('user_update_acknowledgments', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                user_id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                    comment: 'User who acknowledged the update'
                },
                update_id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'system_updates',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                    comment: 'System update that was acknowledged'
                },
                acknowledged_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
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
                },
                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updated_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                }
            });

            // Create indexes for system_updates
            await queryInterface.addIndex('system_updates', ['status'], {
                name: 'idx_system_updates_status'
            });

            await queryInterface.addIndex('system_updates', ['published_at'], {
                name: 'idx_system_updates_published_at'
            });

            await queryInterface.addIndex('system_updates', ['priority'], {
                name: 'idx_system_updates_priority'
            });

            await queryInterface.addIndex('system_updates', ['version'], {
                name: 'idx_system_updates_version',
                unique: true
            });

            // Create indexes for user_update_acknowledgments
            await queryInterface.addIndex('user_update_acknowledgments', ['user_id', 'update_id'], {
                name: 'idx_user_update_ack_user_update',
                unique: true
            });

            await queryInterface.addIndex('user_update_acknowledgments', ['user_id'], {
                name: 'idx_user_update_ack_user_id'
            });

            await queryInterface.addIndex('user_update_acknowledgments', ['update_id'], {
                name: 'idx_user_update_ack_update_id'
            });

            await queryInterface.addIndex('user_update_acknowledgments', ['acknowledged_at'], {
                name: 'idx_user_update_ack_acknowledged_at'
            });

            console.log('✅ System updates tables created successfully');

        } catch (error) {
            console.error('❌ Error creating system updates tables:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Drop foreign key constraints and indexes first
            await queryInterface.removeIndex('user_update_acknowledgments', 'idx_user_update_ack_acknowledged_at');
            await queryInterface.removeIndex('user_update_acknowledgments', 'idx_user_update_ack_update_id');
            await queryInterface.removeIndex('user_update_acknowledgments', 'idx_user_update_ack_user_id');
            await queryInterface.removeIndex('user_update_acknowledgments', 'idx_user_update_ack_user_update');

            await queryInterface.removeIndex('system_updates', 'idx_system_updates_version');
            await queryInterface.removeIndex('system_updates', 'idx_system_updates_priority');
            await queryInterface.removeIndex('system_updates', 'idx_system_updates_published_at');
            await queryInterface.removeIndex('system_updates', 'idx_system_updates_status');

            // Drop tables
            await queryInterface.dropTable('user_update_acknowledgments');
            await queryInterface.dropTable('system_updates');

            console.log('✅ System updates tables dropped successfully');

        } catch (error) {
            console.error('❌ Error dropping system updates tables:', error);
            throw error;
        }
    }
};