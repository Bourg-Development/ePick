'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('notifications', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            type: {
                type: Sequelize.STRING(50),
                allowNull: false,
                validate: {
                    isIn: [['prescription_verification', 'recurring_analysis_due', 'analysis_cancelled', 'system_update', 'maintenance']]
                }
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false,
                comment: 'Short notification title'
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'Full notification message'
            },
            priority: {
                type: Sequelize.STRING(10),
                allowNull: false,
                defaultValue: 'normal',
                validate: {
                    isIn: [['low', 'normal', 'high', 'urgent']]
                }
            },
            is_read: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            is_dismissed: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            action_required: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether this notification requires user action'
            },
            action_url: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: 'URL to redirect when notification is clicked'
            },
            related_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'ID of related entity (analysis, prescription, etc.)'
            },
            related_type: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: 'Type of related entity'
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'When this notification becomes irrelevant'
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true,
                comment: 'Additional data for the notification'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        // Add indexes for performance
        await queryInterface.addIndex('notifications', ['user_id']);
        await queryInterface.addIndex('notifications', ['type']);
        await queryInterface.addIndex('notifications', ['is_read']);
        await queryInterface.addIndex('notifications', ['is_dismissed']);
        await queryInterface.addIndex('notifications', ['action_required']);
        await queryInterface.addIndex('notifications', ['priority']);
        await queryInterface.addIndex('notifications', ['expires_at']);
        await queryInterface.addIndex('notifications', ['user_id', 'is_read', 'is_dismissed']);
        await queryInterface.addIndex('notifications', ['user_id', 'type', 'action_required']);
        await queryInterface.addIndex('notifications', ['related_type', 'related_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('notifications');
    }
};