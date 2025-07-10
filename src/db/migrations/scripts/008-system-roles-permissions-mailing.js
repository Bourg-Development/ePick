const Migration = {
    name: '008-system-roles-permissions-mailing',
    
    async up(queryInterface, Sequelize) {
        
        try {
            console.log('🚀 Starting consolidated system roles, permissions, and mailing list migration...');
            
            // ========================================
            // 1. ADD SYSTEM COLUMNS TO EXISTING TABLES
            // ========================================
            
            // Add is_system column to roles table
            await queryInterface.addColumn('roles', 'is_system', {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
                comment: 'Indicates if role can only be assigned by system'
            });
            console.log('✅ Added is_system column to roles table');
            
            // Add is_system column to permissions table
            await queryInterface.addColumn('permissions', 'is_system', {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
                comment: 'Indicates if permission is system-only'
            });
            console.log('✅ Added is_system column to permissions table');
            
            // ========================================
            // 2. CREATE MAILING LIST TABLES
            // ========================================
            
            // Mailing lists table
            await queryInterface.createTable('mailing_lists', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                name: {
                    type: Sequelize.STRING(100),
                    allowNull: false,
                    unique: true
                },
                description: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                is_active: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: true,
                    allowNull: false
                },
                is_internal: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false,
                    allowNull: false,
                    comment: 'Internal lists for system notifications'
                },
                auto_subscribe_roles: {
                    type: Sequelize.ARRAY(Sequelize.STRING),
                    defaultValue: [],
                    allowNull: true,
                    comment: 'Roles that are automatically subscribed'
                },
                sender_email: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    comment: 'Custom sender email for this list'
                },
                sender_name: {
                    type: Sequelize.STRING(100),
                    allowNull: true,
                    comment: 'Custom sender name for this list'
                },
                max_subscribers: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment: 'Maximum number of subscribers (null = unlimited)'
                },
                subscription_requires_approval: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false,
                    allowNull: false
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
                },
                created_by: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'SET NULL',
                    comment: 'User who created the list (null for system-created lists)'
                }
            });
            console.log('✅ Created mailing_lists table');
            
            // Mailing list subscribers table
            await queryInterface.createTable('mailing_list_subscribers', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                list_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'mailing_lists',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                user_id: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'CASCADE',
                    comment: 'Internal user subscription'
                },
                service_id: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'services',
                        key: 'id'
                    },
                    onDelete: 'CASCADE',
                    comment: 'Service subscription (uses service email)'
                },
                external_email: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    comment: 'External email subscription'
                },
                external_name: {
                    type: Sequelize.STRING(100),
                    allowNull: true,
                    comment: 'Name for external subscriber'
                },
                status: {
                    type: Sequelize.ENUM('active', 'pending', 'unsubscribed', 'bounced'),
                    defaultValue: 'active',
                    allowNull: false
                },
                subscription_source: {
                    type: Sequelize.ENUM('manual', 'api', 'auto_role', 'import', 'self_subscribe'),
                    defaultValue: 'manual',
                    allowNull: false
                },
                subscription_token: {
                    type: Sequelize.STRING(64),
                    allowNull: true,
                    unique: true,
                    comment: 'Token for unsubscribe links'
                },
                subscribed_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('NOW()')
                },
                unsubscribed_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                last_email_sent: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                bounce_count: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                }
            });
            console.log('✅ Created mailing_list_subscribers table');
            
            // Email campaigns table
            await queryInterface.createTable('email_campaigns', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                list_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'mailing_lists',
                        key: 'id'
                    },
                    onDelete: 'RESTRICT'
                },
                name: {
                    type: Sequelize.STRING(200),
                    allowNull: false
                },
                subject: {
                    type: Sequelize.STRING(255),
                    allowNull: false
                },
                content_html: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                content_text: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                sender_email: {
                    type: Sequelize.STRING(255),
                    allowNull: false
                },
                sender_name: {
                    type: Sequelize.STRING(100),
                    allowNull: false
                },
                reply_to: {
                    type: Sequelize.STRING(255),
                    allowNull: true
                },
                status: {
                    type: Sequelize.ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'),
                    defaultValue: 'draft',
                    allowNull: false
                },
                scheduled_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                sent_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                total_recipients: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                total_sent: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                total_delivered: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                total_bounced: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                total_opened: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                total_clicked: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                campaign_type: {
                    type: Sequelize.ENUM('newsletter', 'announcement', 'alert', 'system', 'marketing'),
                    defaultValue: 'newsletter',
                    allowNull: false
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
                },
                created_by: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'SET NULL',
                    comment: 'User who created the campaign (null for system-created campaigns)'
                }
            });
            console.log('✅ Created email_campaigns table');
            
            // Campaign tracking table
            await queryInterface.createTable('campaign_tracking', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                campaign_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'email_campaigns',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                subscriber_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'mailing_list_subscribers',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                email_address: {
                    type: Sequelize.STRING(255),
                    allowNull: false
                },
                status: {
                    type: Sequelize.ENUM('queued', 'sent', 'delivered', 'bounced', 'complained', 'unsubscribed'),
                    defaultValue: 'queued',
                    allowNull: false
                },
                sent_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                delivered_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                opened_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                clicked_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                bounced_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                bounce_reason: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                tracking_id: {
                    type: Sequelize.STRING(64),
                    allowNull: false,
                    unique: true
                }
            });
            console.log('✅ Created campaign_tracking table');
            
            // ========================================
            // 3. CREATE INDEXES FOR MAILING TABLES
            // ========================================
            
            // Unique constraint for user/list combinations
            await queryInterface.addConstraint('mailing_list_subscribers', {
                fields: ['list_id', 'user_id'],
                type: 'unique',
                name: 'unique_user_list_subscription',
                where: {
                    user_id: {
                        [Sequelize.Op.ne]: null
                    }
                }
            });
            
            // Unique constraint for service/list combinations
            await queryInterface.addConstraint('mailing_list_subscribers', {
                fields: ['list_id', 'service_id'],
                type: 'unique',
                name: 'unique_service_list_subscription',
                where: {
                    service_id: {
                        [Sequelize.Op.ne]: null
                    }
                }
            });
            
            // Unique constraint for external email/list combinations
            await queryInterface.addConstraint('mailing_list_subscribers', {
                fields: ['list_id', 'external_email'],
                type: 'unique',
                name: 'unique_external_email_list_subscription',
                where: {
                    external_email: {
                        [Sequelize.Op.ne]: null
                    }
                }
            });
            
            // Performance indexes
            await queryInterface.addIndex('mailing_list_subscribers', ['status']);
            await queryInterface.addIndex('mailing_list_subscribers', ['subscription_token']);
            await queryInterface.addIndex('email_campaigns', ['status']);
            await queryInterface.addIndex('email_campaigns', ['scheduled_at']);
            await queryInterface.addIndex('campaign_tracking', ['tracking_id']);
            await queryInterface.addIndex('campaign_tracking', ['campaign_id', 'status']);
            
            console.log('✅ Created mailing list indexes and constraints');
            
            // ========================================
            // 4. CREATE SYSTEM ADMINISTRATOR ROLE
            // ========================================
            
            const [systemAdminRole] = await queryInterface.sequelize.query(
                `INSERT INTO roles (name, description, is_system, created_at, updated_at) 
                 VALUES ('system_admin', 'System Administrator with full system access - can only be assigned by system', true, NOW(), NOW())
                 RETURNING id`,
                { type: Sequelize.QueryTypes.INSERT }
            );
            
            const systemAdminRoleId = systemAdminRole[0].id;
            console.log(`✅ Created System Administrator role with ID: ${systemAdminRoleId}`);
            
            // ========================================
            // 5. CREATE SYSTEM PERMISSIONS
            // ========================================
            
            const systemPermissions = [
                // System administration
                { name: 'system.manage_roles', description: 'Create, modify, and delete system roles' },
                { name: 'system.assign_system_roles', description: 'Assign system roles to users' },
                { name: 'system.bypass_restrictions', description: 'Bypass all system restrictions and validations' },
                { name: 'system.impersonate', description: 'Impersonate other users' },
                
                // Database and backup management
                { name: 'system.database_maintenance', description: 'Perform database maintenance operations' },
                { name: 'system.backup_restore', description: 'Create and restore system backups' },
                { name: 'system.purge_data', description: 'Permanently purge data from the system' },
                
                // Security and audit
                { name: 'system.modify_audit_logs', description: 'Modify or delete audit logs' },
                { name: 'system.view_all_sessions', description: 'View all user sessions across the system' },
                { name: 'system.terminate_sessions', description: 'Terminate any user session' },
                { name: 'system.reset_security', description: 'Reset security settings and configurations' },
                
                // Configuration
                { name: 'system.modify_config', description: 'Modify system configuration at runtime' },
                { name: 'system.access_env', description: 'Access and modify environment variables' },
                { name: 'system.debug_mode', description: 'Enable system debug mode and access debug information' },
                
                // Critical operations
                { name: 'system.emergency_shutdown', description: 'Perform emergency system shutdown' },
                { name: 'system.data_export_unrestricted', description: 'Export all data without restrictions' },
                { name: 'system.delete_protected_entities', description: 'Delete protected users, roles, and data' },
                
                // Mailing list system permissions
                { name: 'system.mailing_manage_all', description: 'Full control over all mailing lists and campaigns' },
                { name: 'system.mailing_access_internal', description: 'Access and modify internal system mailing lists' },
                { name: 'system.mailing_view_analytics', description: 'View detailed mailing analytics and tracking data' },
                { name: 'system.mailing_bulk_operations', description: 'Perform bulk operations on subscribers and campaigns' },
                { name: 'system.mailing_template_system', description: 'Manage system email templates and branding' }
            ];
            
            // Insert system permissions
            const insertedPermissions = [];
            for (const permission of systemPermissions) {
                const [result] = await queryInterface.sequelize.query(
                    `INSERT INTO permissions (name, description, is_system, created_at) 
                     VALUES (:name, :description, true, NOW()) RETURNING id`,
                    {
                        replacements: permission,
                        type: Sequelize.QueryTypes.INSERT
                    }
                );
                insertedPermissions.push(result[0].id);
            }
            
            console.log(`✅ Created ${systemPermissions.length} system-only permissions`);
            
            // ========================================
            // 6. CREATE REGULAR MAILING PERMISSIONS
            // ========================================
            
            const mailingPermissions = [
                { name: 'mailing.view_lists', description: 'View mailing lists' },
                { name: 'mailing.create_lists', description: 'Create new mailing lists' },
                { name: 'mailing.edit_lists', description: 'Edit mailing lists' },
                { name: 'mailing.delete_lists', description: 'Delete mailing lists' },
                { name: 'mailing.manage_subscribers', description: 'Add and remove subscribers' },
                { name: 'mailing.view_subscribers', description: 'View subscriber lists' },
                { name: 'mailing.create_campaigns', description: 'Create email campaigns' },
                { name: 'mailing.send_campaigns', description: 'Send email campaigns' },
                { name: 'mailing.view_campaigns', description: 'View campaign history and status' },
                { name: 'mailing.view_analytics', description: 'View basic campaign analytics' }
            ];
            
            const regularMailingPermissions = [];
            for (const permission of mailingPermissions) {
                const [result] = await queryInterface.sequelize.query(
                    `INSERT INTO permissions (name, description, is_system, created_at) 
                     VALUES (:name, :description, false, NOW()) RETURNING id`,
                    {
                        replacements: permission,
                        type: Sequelize.QueryTypes.INSERT
                    }
                );
                regularMailingPermissions.push(result[0].id);
            }
            
            console.log(`✅ Created ${mailingPermissions.length} regular mailing permissions`);
            
            // ========================================
            // 7. ASSIGN PERMISSIONS TO SYSTEM ADMIN
            // ========================================
            
            // Get all permissions (both system and regular)
            const allPermissions = await queryInterface.sequelize.query(
                'SELECT id FROM permissions',
                { type: Sequelize.QueryTypes.SELECT }
            );
            
            // Assign all permissions to system_admin role
            for (const permission of allPermissions) {
                await queryInterface.sequelize.query(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)
                     ON CONFLICT DO NOTHING`,
                    {
                        replacements: { roleId: systemAdminRoleId, permissionId: permission.id },
                        type: Sequelize.QueryTypes.INSERT
                    }
                );
            }
            
            console.log('✅ Assigned all permissions to system_admin role');
            
            // ========================================
            // 8. ASSIGN MAILING PERMISSIONS TO EXISTING ROLES
            // ========================================
            
            // Get existing roles
            const [adminRole] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'admin' AND (is_system = false OR is_system IS NULL)`,
                { type: Sequelize.QueryTypes.SELECT }
            );
            
            const [userManagerRole] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'userManager'`,
                { type: Sequelize.QueryTypes.SELECT }
            );
            
            // Admin gets most mailing permissions (except system ones)
            if (adminRole) {
                const adminMailingPerms = regularMailingPermissions.slice(); // All regular permissions
                for (const permId of adminMailingPerms) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)
                         ON CONFLICT DO NOTHING`,
                        {
                            replacements: { roleId: adminRole.id, permissionId: permId },
                            type: Sequelize.QueryTypes.INSERT
                        }
                    );
                }
                console.log('✅ Assigned mailing permissions to admin role');
            }
            
            // User manager gets basic mailing permissions
            if (userManagerRole) {
                const userManagerPerms = regularMailingPermissions.filter((_, index) => 
                    ['mailing.view_lists', 'mailing.view_subscribers', 'mailing.view_campaigns', 'mailing.view_analytics']
                        .includes(mailingPermissions[index].name)
                );
                
                for (const permId of userManagerPerms) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)
                         ON CONFLICT DO NOTHING`,
                        {
                            replacements: { roleId: userManagerRole.id, permissionId: permId },
                            type: Sequelize.QueryTypes.INSERT
                        }
                    );
                }
                console.log('✅ Assigned basic mailing permissions to userManager role');
            }
            
            // ========================================
            // 9. CREATE DEFAULT MAILING LISTS
            // ========================================
            
            // Get system user (created_by = 0 for system)
            const defaultMailingLists = [
                {
                    name: 'system_alerts',
                    description: 'Critical system alerts and notifications',
                    is_internal: true,
                    auto_subscribe_roles: ['admin', 'system_admin'],
                    sender_email: process.env.EMAIL_FROM || 'noreply@system.local',
                    sender_name: process.env.EMAIL_FROM_NAME || 'System Notifications'
                },
                {
                    name: 'security_notifications',
                    description: 'Security events and breach notifications',
                    is_internal: true,
                    auto_subscribe_roles: ['admin', 'system_admin', 'security'],
                    sender_email: process.env.EMAIL_FROM || 'security@system.local',
                    sender_name: process.env.EMAIL_FROM_NAME || 'Security Team'
                },
                {
                    name: 'staff_announcements',
                    description: 'General staff announcements and updates',
                    is_internal: false,
                    auto_subscribe_roles: ['admin', 'staff', 'doctor', 'nurse'],
                    sender_email: process.env.EMAIL_FROM || 'announcements@system.local',
                    sender_name: process.env.EMAIL_FROM_NAME || 'Management'
                }
            ];
            
            for (const list of defaultMailingLists) {
                // Convert array to PostgreSQL array format
                const rolesArray = `{${list.auto_subscribe_roles.map(role => `"${role}"`).join(',')}}`;
                
                await queryInterface.sequelize.query(
                    `INSERT INTO mailing_lists (name, description, is_internal, auto_subscribe_roles, sender_email, sender_name, created_by, created_at, updated_at)
                     VALUES (:name, :description, :is_internal, :auto_subscribe_roles, :sender_email, :sender_name, NULL, NOW(), NOW())`,
                    {
                        replacements: {
                            name: list.name,
                            description: list.description,
                            is_internal: list.is_internal,
                            auto_subscribe_roles: rolesArray,
                            sender_email: list.sender_email,
                            sender_name: list.sender_name
                        },
                        type: Sequelize.QueryTypes.INSERT
                    }
                );
            }
            
            console.log('✅ Created default mailing lists');
            
            // ========================================
            // 10. REMOVE SENSITIVE PERMISSIONS FROM REGULAR ADMIN
            // ========================================
            
            if (adminRole) {
                const restrictedPermissions = ['manage.roles', 'access.security'];
                
                for (const permName of restrictedPermissions) {
                    await queryInterface.sequelize.query(
                        `DELETE FROM role_permissions 
                         WHERE role_id = :roleId 
                         AND permission_id IN (SELECT id FROM permissions WHERE name = :permName)`,
                        {
                            replacements: { roleId: adminRole.id, permName },
                            type: Sequelize.QueryTypes.DELETE
                        }
                    );
                }
                
                console.log('✅ Removed sensitive permissions from regular admin role');
            }
            
            console.log('🎉 System roles, permissions, and mailing list migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Error in consolidated migration:', error);
            throw error;
        }
    },
    
    async down(queryInterface, Sequelize) {
        
        try {
            console.log('🔄 Rolling back consolidated migration...');
            
            // Drop mailing list tables (in reverse order due to foreign keys)
            await queryInterface.dropTable('campaign_tracking');
            await queryInterface.dropTable('email_campaigns');
            await queryInterface.dropTable('mailing_list_subscribers');
            await queryInterface.dropTable('mailing_lists');
            
            // Remove system permissions
            await queryInterface.sequelize.query(
                `DELETE FROM role_permissions 
                 WHERE permission_id IN (SELECT id FROM permissions WHERE is_system = true)`
            );
            
            await queryInterface.sequelize.query(
                `DELETE FROM permissions WHERE is_system = true OR name LIKE 'mailing.%'`
            );
            
            // Remove system admin role
            await queryInterface.sequelize.query(
                `DELETE FROM roles WHERE name = 'system_admin'`
            );
            
            // Restore permissions to admin role
            const [adminRole] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'admin'`,
                { type: queryInterface.sequelize.QueryTypes.SELECT }
            );
            
            if (adminRole) {
                const permissionsToRestore = ['manage.roles', 'access.security'];
                
                for (const permName of permissionsToRestore) {
                    const [permission] = await queryInterface.sequelize.query(
                        `SELECT id FROM permissions WHERE name = :permName`,
                        {
                            replacements: { permName },
                            type: queryInterface.sequelize.QueryTypes.SELECT
                        }
                    );
                    
                    if (permission) {
                        await queryInterface.sequelize.query(
                            `INSERT INTO role_permissions (role_id, permission_id) 
                             VALUES (:roleId, :permissionId)
                             ON CONFLICT DO NOTHING`,
                            {
                                replacements: { roleId: adminRole.id, permissionId: permission.id },
                                type: queryInterface.sequelize.QueryTypes.INSERT
                            }
                        );
                    }
                }
            }
            
            // Remove system columns
            await queryInterface.removeColumn('permissions', 'is_system');
            await queryInterface.removeColumn('roles', 'is_system');
            
            console.log('✅ Consolidated migration rolled back successfully');
        } catch (error) {
            console.error('❌ Error rolling back consolidated migration:', error);
            throw error;
        }
    }
};

module.exports = Migration;