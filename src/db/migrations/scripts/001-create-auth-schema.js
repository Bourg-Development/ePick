// db/migrations/001-create-auth-schema.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Enable pgcrypto extension
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

        // Create roles table
        await queryInterface.createTable('roles', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
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

        // Create permissions table
        await queryInterface.createTable('permissions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            }
        });

        // Create role_permissions table
        await queryInterface.createTable('role_permissions', {
            role_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'roles',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            permission_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'permissions',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            }
        });

        // Set the primary key for role_permissions
        await queryInterface.addConstraint('role_permissions', {
            fields: ['role_id', 'permission_id'],
            type: 'primary key',
            name: 'role_permissions_pkey'
        });

// Create services table (without updated_by foreign key initially)
        await queryInterface.createTable('services', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            can_view_all_analyses: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
        // Create users table
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            username: {
                type: Sequelize.STRING(6),
                allowNull: false,
                unique: true
            },
            full_name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            password_hash: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            salt: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            role_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'roles',
                    key: 'id'
                }
            },
            service_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'services',
                    key: 'id'
                }
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            totp_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            totp_secret: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            webauthn_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            webauthn_credentials: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            failed_login_attempts: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            last_login_attempt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            account_locked: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            account_locked_until: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            last_login: {
                type: Sequelize.DATE,
                allowNull: true
            },
            encrypted_recovery_email: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            encrypted_phone: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            last_ip_address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            last_device_fingerprint: {
                type: Sequelize.TEXT,
                allowNull: true
            }
        });

        // Add CHECK constraint for username format (6 digits)
        await queryInterface.sequelize.query(
            `ALTER TABLE users ADD CONSTRAINT check_username_format CHECK (username ~ '^[0-9]{6}$');`
        );

        // Add created_by column to users after users table exists
        await queryInterface.addColumn('users', 'created_by', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        });

        // Create password_history table
        await queryInterface.createTable('password_history', {
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
                onDelete: 'CASCADE'
            },
            password_hash: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            }
        });

        // Create reference_codes table
        await queryInterface.createTable('reference_codes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            code: {
                type: Sequelize.STRING(11),
                allowNull: false,
                unique: true
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
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            used_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            used_ip: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'active'
            },
            require_2fa: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            }
        });

        // Add CHECK constraint for reference code format (xxx-xxx-xxx)
        await queryInterface.sequelize.query(
            `ALTER TABLE reference_codes ADD CONSTRAINT check_code_format CHECK (code ~ '^[0-9]{3}-[0-9]{3}-[0-9]{3}$');`
        );

        // Add CHECK constraint for status values
        await queryInterface.sequelize.query(
            `ALTER TABLE reference_codes ADD CONSTRAINT check_status_values CHECK (status IN ('active', 'used', 'expired', 'revoked'));`
        );

        // Create sessions table
        await queryInterface.createTable('sessions', {
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
                onDelete: 'CASCADE'
            },
            token_id: {
                type: Sequelize.TEXT,
                allowNull: false,
                unique: true
            },
            refresh_token_id: {
                type: Sequelize.TEXT,
                allowNull: true,
                unique: true
            },
            ip_address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            device_fingerprint: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            refresh_token_expires_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_activity: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            is_valid: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            }
        });

        // Create blacklisted_tokens table
        await queryInterface.createTable('blacklisted_tokens', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            token_id: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            blacklisted_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            reason: {
                type: Sequelize.STRING(100),
                allowNull: false
            }
        });

        // Create user_preferences table
        await queryInterface.createTable('user_preferences', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            preferences: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
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

        // Create indexes for auth tables
        await queryInterface.addIndex('users', ['username']);
        await queryInterface.addIndex('users', ['role_id']);
        await queryInterface.addIndex('reference_codes', ['user_id']);
        await queryInterface.addIndex('reference_codes', ['status']);
        await queryInterface.addIndex('sessions', ['user_id']);
        await queryInterface.addIndex('sessions', ['token_id']);

        // Create trigger functions for updating timestamps
        await queryInterface.sequelize.query(`
            -- Create function for timestamp updates
            CREATE OR REPLACE FUNCTION update_modified_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            -- Apply triggers for timestamps
            CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_services_timestamp BEFORE UPDATE ON services 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_roles_timestamp BEFORE UPDATE ON roles 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
            CREATE TRIGGER update_user_preferences_timestamp BEFORE UPDATE ON user_preferences 
                FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Drop tables in reverse order to handle dependencies
        await queryInterface.dropTable('user_preferences');
        await queryInterface.dropTable('blacklisted_tokens');
        await queryInterface.dropTable('sessions');
        await queryInterface.dropTable('reference_codes');
        await queryInterface.dropTable('password_history');
        await queryInterface.dropTable('users');
        await queryInterface.dropTable('services');
        await queryInterface.dropTable('role_permissions');
        await queryInterface.dropTable('permissions');
        await queryInterface.dropTable('roles');

        // Drop trigger functions
        await queryInterface.sequelize.query(`
            DROP FUNCTION IF EXISTS update_modified_column();
        `);
    }
};