// migrations/scripts/012-create-scheduled-maintenance.js
module.exports = {
    name: 'create-scheduled-maintenance',
    description: 'Create scheduled maintenance table for system maintenance scheduling',
    
    up: async (queryInterface, Sequelize) => {
        console.log('Creating scheduled_maintenance table...');
        
        await queryInterface.createTable('scheduled_maintenance', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            scheduled_start: {
                type: Sequelize.DATE,
                allowNull: false
            },
            scheduled_end: {
                type: Sequelize.DATE,
                allowNull: false
            },
            actual_start: {
                type: Sequelize.DATE,
                allowNull: true
            },
            actual_end: {
                type: Sequelize.DATE,
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
                allowNull: false,
                defaultValue: 'scheduled'
            },
            priority: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
                allowNull: false,
                defaultValue: 'medium'
            },
            maintenance_type: {
                type: Sequelize.ENUM('system_update', 'security_patch', 'infrastructure', 'feature_deployment', 'database_maintenance', 'other'),
                allowNull: false,
                defaultValue: 'system_update'
            },
            affects_availability: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            estimated_duration_minutes: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            notification_sent_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            notification_scheduled_for: {
                type: Sequelize.DATE,
                allowNull: true
            },
            reminder_sent_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            reminder_scheduled_for: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            updated_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            cancelled_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            cancellation_reason: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('NOW()')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('NOW()')
            }
        });

        // Create indexes
        await queryInterface.addIndex('scheduled_maintenance', ['scheduled_start']);
        await queryInterface.addIndex('scheduled_maintenance', ['scheduled_end']);
        await queryInterface.addIndex('scheduled_maintenance', ['status']);
        await queryInterface.addIndex('scheduled_maintenance', ['priority']);
        await queryInterface.addIndex('scheduled_maintenance', ['created_by']);
        await queryInterface.addIndex('scheduled_maintenance', ['notification_scheduled_for']);
        await queryInterface.addIndex('scheduled_maintenance', ['reminder_scheduled_for']);
        
        console.log('✓ scheduled_maintenance table created successfully');
    },
    
    down: async (queryInterface, Sequelize) => {
        console.log('Dropping scheduled_maintenance table...');
        await queryInterface.dropTable('scheduled_maintenance');
        console.log('✓ scheduled_maintenance table dropped');
    }
};