'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('prescriptions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            recurring_analysis_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'recurring_analyses',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            patient_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'patients',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            doctor_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'doctors',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            prescribed_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'User who uploaded/verified the prescription'
            },
            prescription_number: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true,
                comment: 'Unique prescription reference number'
            },
            valid_from: {
                type: Sequelize.DATE,
                allowNull: false,
                comment: 'Start date when prescription becomes valid'
            },
            valid_until: {
                type: Sequelize.DATE,
                allowNull: false,
                comment: 'End date when prescription expires'
            },
            remaining_analyses: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
                comment: 'Number of analyses remaining on this prescription'
            },
            total_analyses_prescribed: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Total number of analyses prescribed initially'
            },
            document_path: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: 'Path to uploaded prescription document'
            },
            document_filename: {
                type: Sequelize.STRING(255),
                allowNull: true,
                comment: 'Original filename of prescription document'
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Additional prescription notes or instructions'
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'Active',
                validate: {
                    isIn: [['Active', 'Expired', 'Exhausted', 'Cancelled']]
                }
            },
            verified_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
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
        await queryInterface.addIndex('prescriptions', ['recurring_analysis_id']);
        await queryInterface.addIndex('prescriptions', ['patient_id']);
        await queryInterface.addIndex('prescriptions', ['doctor_id']);
        await queryInterface.addIndex('prescriptions', ['prescribed_by']);
        await queryInterface.addIndex('prescriptions', ['prescription_number']);
        await queryInterface.addIndex('prescriptions', ['status']);
        await queryInterface.addIndex('prescriptions', ['valid_from', 'valid_until']);
        await queryInterface.addIndex('prescriptions', ['status', 'valid_until']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('prescriptions');
    }
};