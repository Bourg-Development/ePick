'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('uuid_generate_v4()'),
                primaryKey: true,
                allowNull: false,
            },
            username: {
                type: Sequelize.STRING(6),
                unique: true,
                allowNull: false,
            },
            password_hash: {
                type: Sequelize.STRING,
                allowNull: false
            },
            role: {
                type: Sequelize.ENUM('read', 'write', 'admin'),
                allowNull: false,
                defaultValue: 'read',
            },
            last_login: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            login_attempts: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            is_locked: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        })

        await queryInterface.createTable('tokens', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('uuid_generate_v4()'),
                primaryKey: true,
                allowNull: false
            },
            token: {
                type: Sequelize.STRING(512),
                allowNull: false
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            type: {
                type: Sequelize.ENUM('refresh', 'reset'),
                allowNull: false
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            is_revoked: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        })
        await queryInterface.createTable('audit_logs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('uuid_generate_v4()'),
                primaryKey: true,
                allowNull: false
            },
            action: {
                type: Sequelize.STRING,
                allowNull: false
            },
            entity_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            entity_id: {
                type: Sequelize.STRING,
                allowNull: false
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            ip_address: {
                type: Sequelize.STRING(45),
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('SUCCESS', 'FAILURE', 'PENDING'),
                allowNull: false,
                defaultValue: 'SUCCESS'
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true,
                defaultValue: {}
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });
        await queryInterface.addIndex('users', ['username'], { unique: true });
        await queryInterface.addIndex('tokens', ['token'], { unique: true });
        await queryInterface.addIndex('tokens', ['user_id']);
        await queryInterface.addIndex('tokens', ['expires_at']);
        await queryInterface.addIndex('audit_logs', ['action']);
        await queryInterface.addIndex('audit_logs', ['entity_type']);
        await queryInterface.addIndex('audit_logs', ['entity_id']);
        await queryInterface.addIndex('audit_logs', ['user_id']);
        await queryInterface.addIndex('audit_logs', ['created_at']);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('audit_logs');
        await queryInterface.dropTable('tokens');
        await queryInterface.dropTable('users');
        await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
    }
}