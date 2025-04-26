module.exports = {
    up: async (queryInterface, Sequelize) => {
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
            password_hash: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            password_salt: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: true
            },
            is_admin: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            mfa_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            mfa_secret: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            webauthn_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            last_password_change: {
                type: Sequelize.DATE,
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

        await queryInterface.addConstraint('users', {
            fields: ['username'],
            type: 'check',
            where: {
                username: {
                    [Sequelize.Op.regexp]: '^[0-9]{6}$'
                }
            }
        });

        await queryInterface.createTable('password_history', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
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
            salt: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('reference_codes', {
            code: {
                type: Sequelize.STRING(11),
                primaryKey: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                allowNull: true
            },
            username: {
                type: Sequelize.STRING(6),
                allowNull: false
            },
            role: {
                type: Sequelize.STRING,
                allowNull: false
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            used: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.addConstraint('reference_codes', {
            fields: ['code'],
            type: 'check',
            where: {
                code: {
                    [Sequelize.Op.regexp]: '^[0-9]{3}-[0-9]{3}-[0-9]{3}$'
                }
            }
        });

        await queryInterface.addConstraint('reference_codes', {
            fields: ['username'],
            type: 'check',
            where: {
                username: {
                    [Sequelize.Op.regexp]: '^[0-9]{6}$'
                }
            }
        });

        await queryInterface.createTable('roles', {
            name: {
                type: Sequelize.STRING,
                primaryKey: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            }
        });

        await queryInterface.createTable('permissions', {
            name: {
                type: Sequelize.STRING,
                primaryKey: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            }
        });

        await queryInterface.createTable('role_permissions', {
            role_name: {
                type: Sequelize.STRING,
                references: {
                    model: 'roles',
                    key: 'name'
                },
                onDelete: 'CASCADE',
                primaryKey: true
            },
            permission_name: {
                type: Sequelize.STRING,
                references: {
                    model: 'permissions',
                    key: 'name'
                },
                onDelete: 'CASCADE',
                primaryKey: true
            }
        });

        await queryInterface.createTable('user_roles', {
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                primaryKey: true
            },
            role_name: {
                type: Sequelize.STRING,
                references: {
                    model: 'roles',
                    key: 'name'
                },
                onDelete: 'CASCADE',
                primaryKey: true
            }
        });

        await queryInterface.createTable('sessions', {
            id: {
                type: Sequelize.TEXT,
                primaryKey: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            refresh_token: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            ip_address: {
                type: Sequelize.INET,
                allowNull: false
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            device_fingerprint: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('token_blacklist', {
            token: {
                type: Sequelize.TEXT,
                primaryKey: true
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            blacklisted_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('audit_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL',
                allowNull: true
            },
            action: {
                type: Sequelize.STRING,
                allowNull: false
            },
            entity_type: {
                type: Sequelize.STRING,
                allowNull: true
            },
            entity_id: {
                type: Sequelize.STRING,
                allowNull: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            ip_address: {
                type: Sequelize.INET,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('security_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL',
                allowNull: true
            },
            event_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            severity: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
                allowNull: false
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            ip_address: {
                type: Sequelize.INET,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.createTable('webauthn_credentials', {
            credential_id: {
                type: Sequelize.TEXT,
                primaryKey: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            public_key: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            counter: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            device_type: {
                type: Sequelize.ENUM('biometric', 'security_key'),
                allowNull: false
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
    },

    down: async (queryInterface) => {
        await queryInterface.dropAllTables();
    }
};