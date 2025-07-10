// migrations/scripts/020-create-status-page-schema.js
module.exports = {
    up: async (queryInterface, Sequelize, transaction) => {
        // Create system_status table
        await queryInterface.createTable('system_status', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            component: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'operational'
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            last_checked: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            last_success: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_failure: {
                type: Sequelize.DATE,
                allowNull: true
            },
            response_time: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true
            },
            error_message: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            is_critical: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            display_order: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        }, { transaction });

        // Create status_incidents table
        await queryInterface.createTable('status_incidents', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'investigating'
            },
            severity: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'medium'
            },
            impact: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'minor'
            },
            affected_components: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                allowNull: true
            },
            started_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            resolved_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            is_public: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        }, { transaction });

        // Create status_incident_updates table
        await queryInterface.createTable('status_incident_updates', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            incident_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'status_incidents',
                    key: 'id'
                }
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            is_public: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        }, { transaction });

        // Helper functions to safely add indexes and constraints
        const addIndexSafely = async (tableName, columns, options = {}) => {
            try {
                await queryInterface.addIndex(tableName, columns, { ...options, transaction });
            } catch (error) {
                if (error.original && error.original.code === '42P07') {
                    console.log(`Index already exists for ${tableName}(${columns.join(', ')}), skipping`);
                } else {
                    throw error;
                }
            }
        };

        const addConstraintSafely = async (tableName, constraintOptions) => {
            try {
                await queryInterface.addConstraint(tableName, { ...constraintOptions, transaction });
            } catch (error) {
                if (error.original && (error.original.code === '23505' || error.original.code === '42710')) {
                    console.log(`Constraint ${constraintOptions.name} already exists for ${tableName}, skipping`);
                } else {
                    throw error;
                }
            }
        };

        // Add indexes safely
        await addIndexSafely('system_status', ['component'], { unique: true });
        await addIndexSafely('system_status', ['status']);
        await addIndexSafely('system_status', ['is_critical']);
        await addIndexSafely('system_status', ['display_order']);
        await addIndexSafely('system_status', ['last_checked']);

        await addIndexSafely('status_incidents', ['status']);
        await addIndexSafely('status_incidents', ['severity']);
        await addIndexSafely('status_incidents', ['impact']);
        await addIndexSafely('status_incidents', ['started_at']);
        await addIndexSafely('status_incidents', ['resolved_at']);
        await addIndexSafely('status_incidents', ['is_public']);
        await addIndexSafely('status_incidents', ['created_by']);

        await addIndexSafely('status_incident_updates', ['incident_id']);
        await addIndexSafely('status_incident_updates', ['status']);
        await addIndexSafely('status_incident_updates', ['is_public']);
        await addIndexSafely('status_incident_updates', ['created_at']);

        // Add foreign key constraints safely
        await addConstraintSafely('status_incidents', {
            fields: ['created_by'],
            type: 'foreign key',
            name: 'fk_status_incidents_created_by',
            references: {
                table: 'users',
                field: 'id'
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE'
        });

        await addConstraintSafely('status_incident_updates', {
            fields: ['incident_id'],
            type: 'foreign key',
            name: 'fk_status_incident_updates_incident_id',
            references: {
                table: 'status_incidents',
                field: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        await addConstraintSafely('status_incident_updates', {
            fields: ['created_by'],
            type: 'foreign key',
            name: 'fk_status_incident_updates_created_by',
            references: {
                table: 'users',
                field: 'id'
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE'
        });

        // Insert default system components (only if table is empty)
        const existingComponents = await queryInterface.sequelize.query(
            `SELECT component FROM system_status LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT, transaction }
        );

        if (existingComponents.length === 0) {
            const now = new Date();
            await queryInterface.bulkInsert('system_status', [
            {
                component: 'database',
                description: 'PostgreSQL Database Server',
                status: 'operational',
                is_critical: true,
                display_order: 1,
                last_checked: now,
                created_at: now,
                updated_at: now
            },
            {
                component: 'web_server',
                description: 'Web Application Server',
                status: 'operational',
                is_critical: true,
                display_order: 2,
                last_checked: now,
                created_at: now,
                updated_at: now
            },
            {
                component: 'email_service',
                description: 'Email Notification Service',
                status: 'operational',
                is_critical: false,
                display_order: 3,
                last_checked: now,
                created_at: now,
                updated_at: now
            },
            {
                component: 'analysis_engine',
                description: 'Blood Analysis Processing Engine',
                status: 'operational',
                is_critical: true,
                display_order: 4,
                last_checked: now,
                created_at: now,
                updated_at: now
            },
            {
                component: 'authentication',
                description: 'User Authentication System',
                status: 'operational',
                is_critical: true,
                display_order: 5,
                last_checked: now,
                created_at: now,
                updated_at: now
            },
            {
                component: 'notification_system',
                description: 'Internal Notification System',
                status: 'operational',
                is_critical: false,
                display_order: 6,
                last_checked: now,
                created_at: now,
                updated_at: now
            }
        ], { transaction });
            
            console.log('✓ Default system status components seeded');
        } else {
            console.log('✓ System status components already exist, skipping seed');
        }
    },

    down: async (queryInterface, Sequelize, transaction) => {
        // Drop foreign key constraints first
        await queryInterface.removeConstraint('status_incident_updates', 'fk_status_incident_updates_created_by', { transaction });
        await queryInterface.removeConstraint('status_incident_updates', 'fk_status_incident_updates_incident_id', { transaction });
        await queryInterface.removeConstraint('status_incidents', 'fk_status_incidents_created_by', { transaction });

        // Drop tables
        await queryInterface.dropTable('status_incident_updates', { transaction });
        await queryInterface.dropTable('status_incidents', { transaction });
        await queryInterface.dropTable('system_status', { transaction });
    }
};