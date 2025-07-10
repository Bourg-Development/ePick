'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('recurring_analyses', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            patient_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'patients',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            doctor_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'doctors',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'rooms',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            analysis_type: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['XY', 'YZ', 'ZG', 'HG']]
                }
            },
            recurrence_pattern: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['daily', 'weekly', 'monthly', 'custom']]
                }
            },
            interval_days: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
                comment: 'Number of days between recurrences'
            },
            total_occurrences: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Total number of analyses to schedule'
            },
            completed_occurrences: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of analyses already scheduled'
            },
            next_due_date: {
                type: Sequelize.DATE,
                allowNull: false,
                comment: 'Next date when analysis should be scheduled'
            },
            last_scheduled_date: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Date when last analysis was scheduled'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            notes: {
                type: Sequelize.TEXT,
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
        await queryInterface.addIndex('recurring_analyses', ['patient_id']);
        await queryInterface.addIndex('recurring_analyses', ['next_due_date']);
        await queryInterface.addIndex('recurring_analyses', ['is_active']);
        await queryInterface.addIndex('recurring_analyses', ['created_by']);
        await queryInterface.addIndex('recurring_analyses', ['recurrence_pattern']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('recurring_analyses');
    }
};