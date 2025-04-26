// db/seeders/20250101000001-init-roles-permissions.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert roles
        await queryInterface.bulkInsert('roles', [
            {
                name: 'admin',
                description: 'Full system access',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'staff',
                description: 'Standard staff access',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'userManager',
                description: 'User management access',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'security',
                description: 'Security monitoring access',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'readonly',
                description: 'Read-only access',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);

        // Insert permissions
        await queryInterface.bulkInsert('permissions', [
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
            }
        ]);

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

        // Define role permissions
        const rolePermissions = [
            // Admin role gets all permissions
            ...permissions.map(permission => ({
                role_id: roleMap.admin,
                permission_id: permission.id
            })),

            // Staff role permissions
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['read.users']
            },

            // User manager role permissions
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['read.users']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['write.users']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['manage.refcodes']
            },

            // Security role permissions
            {
                role_id: roleMap.security,
                permission_id: permissionMap['read.logs']
            },
            {
                role_id: roleMap.security,
                permission_id: permissionMap['access.security']
            },

            // Readonly role permissions
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['read.users']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['read.logs']
            }
        ];

        // Insert role permissions
        await queryInterface.bulkInsert('role_permissions', rolePermissions);

        // Insert default service
        await queryInterface.bulkInsert('services', [
            {
                name: 'Main Service',
                email: 'service@example.com',
                description: 'Default service for the system',
                active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove data in reverse order
        await queryInterface.bulkDelete('role_permissions', null, {});
        await queryInterface.bulkDelete('services', null, {});
        await queryInterface.bulkDelete('permissions', null, {});
        await queryInterface.bulkDelete('roles', null, {});
    }
};