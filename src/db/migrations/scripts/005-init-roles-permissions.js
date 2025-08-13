// db/seeders/005-init-roles-permissions-simplified.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert only essential roles - admin and system_admin (with conflict handling)
        await queryInterface.sequelize.query(`
            INSERT INTO roles (name, description, created_at, updated_at)
            VALUES ('admin', 'Full system access', NOW(), NOW())
            ON CONFLICT (name) DO NOTHING;
        `);

        // Insert comprehensive permissions (with conflict handling)
        const permissions = [
            // General permissions
            {
                name: 'read.all',
                description: 'Read access to all data',
                created_at: new Date()
            },
            {
                name: 'write.all',
                description: 'Write access to all data',
                created_at: new Date()
            },
            {
                name: 'read.users',
                description: 'Read access to user data',
                created_at: new Date()
            },
            {
                name: 'write.users',
                description: 'Write access to user data',
                created_at: new Date()
            },
            {
                name: 'read.logs',
                description: 'Read access to all logs',
                created_at: new Date()
            },
            {
                name: 'manage.refcodes',
                description: 'Can create and manage reference codes',
                created_at: new Date()
            },
            {
                name: 'manage.roles',
                description: 'Can assign and manage roles',
                created_at: new Date()
            },
            {
                name: 'access.security',
                description: 'Access to security settings and anomaly data',
                created_at: new Date()
            },
            {
                name: 'admin',
                description: 'Administrative access to all features',
                created_at: new Date()
            },

            // Patient permissions
            {
                name: 'patients.view',
                description: 'View patient information',
                created_at: new Date()
            },
            {
                name: 'patients.create',
                description: 'Create new patients',
                created_at: new Date()
            },
            {
                name: 'patients.update',
                description: 'Update patient information',
                created_at: new Date()
            },
            {
                name: 'patients.delete',
                description: 'Deactivate patients',
                created_at: new Date()
            },

            // Doctor permissions
            {
                name: 'doctors.view',
                description: 'View doctor information',
                created_at: new Date()
            },
            {
                name: 'doctors.create',
                description: 'Create new doctors',
                created_at: new Date()
            },
            {
                name: 'doctors.update',
                description: 'Update doctor information',
                created_at: new Date()
            },
            {
                name: 'doctors.delete',
                description: 'Deactivate doctors',
                created_at: new Date()
            },

            // Room permissions
            {
                name: 'rooms.view',
                description: 'View room information',
                created_at: new Date()
            },
            {
                name: 'rooms.create',
                description: 'Create new rooms',
                created_at: new Date()
            },
            {
                name: 'rooms.update',
                description: 'Update room information',
                created_at: new Date()
            },
            {
                name: 'rooms.delete',
                description: 'Deactivate rooms',
                created_at: new Date()
            },

            // Analysis permissions
            {
                name: 'analyses.view',
                description: 'View blood analyses',
                created_at: new Date()
            },
            {
                name: 'analyses.create',
                description: 'Create new analyses',
                created_at: new Date()
            },
            {
                name: 'analyses.update',
                description: 'Update analysis status and results',
                created_at: new Date()
            },
            {
                name: 'analyses.cancel',
                description: 'Cancel analyses',
                created_at: new Date()
            },
            {
                name: 'analyses.export',
                description: 'Export analyses data',
                created_at: new Date()
            },
            {
                name: 'analyses.view_audit_logs',
                description: 'View audit logs for analyses',
                created_at: new Date()
            },
            {
                name: 'analyses.view_all_audit_logs',
                description: 'View all audit logs for analyses',
                created_at: new Date()
            },

            // Archived analyses permissions
            {
                name: 'archived_analyses.view',
                description: 'View archived analyses',
                created_at: new Date()
            },
            {
                name: 'archived_analyses.export',
                description: 'Export archived analyses data',
                created_at: new Date()
            },
            {
                name: 'archived_analyses.cleanup',
                description: 'Delete old archived analyses',
                created_at: new Date()
            },

            // Organization settings permissions
            {
                name: 'organization_settings.view',
                description: 'View organization settings',
                created_at: new Date()
            },
            {
                name: 'organization_settings.create',
                description: 'Create new organization settings',
                created_at: new Date()
            },
            {
                name: 'organization_settings.update',
                description: 'Update organization settings',
                created_at: new Date()
            },
            {
                name: 'organization_settings.delete',
                description: 'Delete organization settings',
                created_at: new Date()
            },

            // Service management permissions
            {
                name: 'services.view',
                description: 'View services',
                created_at: new Date()
            },
            {
                name: 'services.create',
                description: 'Create new services',
                created_at: new Date()
            },
            {
                name: 'services.update',
                description: 'Update service information',
                created_at: new Date()
            },
            {
                name: 'services.delete',
                description: 'Deactivate services',
                created_at: new Date()
            },
            {
                name: 'services.manage_users',
                description: 'Transfer users between services',
                created_at: new Date()
            },

            // Recurring analysis permissions
            {
                name: 'recurring_analyses.view',
                description: 'View recurring analysis patterns',
                created_at: new Date()
            },
            {
                name: 'recurring_analyses.create',
                description: 'Create recurring analysis patterns',
                created_at: new Date()
            },
            {
                name: 'recurring_analyses.update',
                description: 'Update recurring analysis patterns',
                created_at: new Date()
            },
            {
                name: 'recurring_analyses.deactivate',
                description: 'Deactivate recurring analysis patterns',
                created_at: new Date()
            }
        ];

        // Insert permissions with conflict handling
        for (const permission of permissions) {
            await queryInterface.sequelize.query(`
                INSERT INTO permissions (name, description, created_at)
                VALUES ('${permission.name}', '${permission.description}', NOW())
                ON CONFLICT (name) DO NOTHING;
            `);
        }

        // Get role and permission IDs
        const roles = await queryInterface.sequelize.query(
            'SELECT id, name FROM roles',
            { type: Sequelize.QueryTypes.SELECT }
        );

        const permissions = await queryInterface.sequelize.query(
            'SELECT id, name FROM permissions',
            { type: Sequelize.QueryTypes.SELECT }
        );

        // Map roles and permissions by name for easier reference
        const roleMap = {};
        roles.forEach(role => {
            roleMap[role.name] = role.id;
        });

        const permissionMap = {};
        permissions.forEach(permission => {
            permissionMap[permission.name] = permission.id;
        });

        // Admin role gets all permissions
        const rolePermissions = permissions.map(permission => ({
            role_id: roleMap.admin,
            permission_id: permission.id
        }));

        // Insert role permissions
        // Insert role permissions with conflict handling
        for (const rolePermission of rolePermissions) {
            await queryInterface.sequelize.query(`
                INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
                VALUES (${rolePermission.role_id}, ${rolePermission.permission_id}, NOW(), NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING;
            `);
        }

        // Insert default service with conflict handling
        await queryInterface.sequelize.query(`
            INSERT INTO services (name, email, description, active, created_at, updated_at)
            VALUES ('Blood Analysis Laboratory', 'lab@hospital.com', 'Blood Analysis Management Service', true, NOW(), NOW())
            ON CONFLICT (name) DO NOTHING;
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove data in reverse order
        await queryInterface.bulkDelete('role_permissions', null, {});
        await queryInterface.bulkDelete('services', null, {});
        await queryInterface.bulkDelete('permissions', null, {});
        await queryInterface.bulkDelete('roles', null, {});
    }
};