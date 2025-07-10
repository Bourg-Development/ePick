// db/migrations/023-add-announcement-permissions.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if permissions already exist
        const existingPermissions = await queryInterface.sequelize.query(
            'SELECT name FROM permissions WHERE name IN (?, ?, ?, ?, ?)',
            {
                replacements: [
                    'announcements.view',
                    'announcements.create',
                    'announcements.update',
                    'announcements.delete',
                    'system.manage_announcements'
                ],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        const existingPermissionNames = existingPermissions.map(p => p.name);
        
        // Only add permissions that don't exist
        const permissionsToAdd = [
            {
                name: 'announcements.view',
                description: 'View system announcements',
                created_at: new Date()
            },
            {
                name: 'announcements.create',
                description: 'Create system announcements',
                created_at: new Date()
            },
            {
                name: 'announcements.update',
                description: 'Update system announcements',
                created_at: new Date()
            },
            {
                name: 'announcements.delete',
                description: 'Delete system announcements',
                created_at: new Date()
            },
            {
                name: 'system.manage_announcements',
                description: 'Full announcement management access',
                created_at: new Date()
            }
        ].filter(perm => !existingPermissionNames.includes(perm.name));

        if (permissionsToAdd.length > 0) {
            await queryInterface.bulkInsert('permissions', permissionsToAdd);
        }

        // Get role and permission IDs for role assignments
        const roles = await queryInterface.sequelize.query(
            'SELECT id, name FROM roles',
            { type: Sequelize.QueryTypes.SELECT }
        );

        const permissions = await queryInterface.sequelize.query(
            'SELECT id, name FROM permissions WHERE name IN (?, ?, ?, ?, ?)',
            {
                replacements: [
                    'announcements.view',
                    'announcements.create', 
                    'announcements.update',
                    'announcements.delete',
                    'system.manage_announcements'
                ],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        const roleMap = {};
        roles.forEach(role => roleMap[role.name] = role.id);

        const permissionMap = {};
        permissions.forEach(perm => permissionMap[perm.name] = perm.id);

        // Assign permissions to roles
        const rolePermissions = [];

        // Admin and system_admin get all announcement permissions
        ['admin', 'system_admin'].forEach(roleName => {
            if (roleMap[roleName]) {
                [
                    'announcements.view',
                    'announcements.create',
                    'announcements.update', 
                    'announcements.delete',
                    'system.manage_announcements'
                ].forEach(permName => {
                    if (permissionMap[permName]) {
                        rolePermissions.push({
                            role_id: roleMap[roleName],
                            permission_id: permissionMap[permName]
                        });
                    }
                });
            }
        });

        // All other roles get view permission
        [
            'staff', 'userManager', 'security', 'readonly', 
            'doctor', 'nurse', 'lab_tech', 'agent', 'service_manager'
        ].forEach(roleName => {
            if (roleMap[roleName] && permissionMap['announcements.view']) {
                rolePermissions.push({
                    role_id: roleMap[roleName],
                    permission_id: permissionMap['announcements.view']
                });
            }
        });

        // Insert role permissions if any exist
        if (rolePermissions.length > 0) {
            await queryInterface.bulkInsert('role_permissions', rolePermissions);
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Remove role permissions first
        await queryInterface.sequelize.query(`
            DELETE FROM role_permissions 
            WHERE permission_id IN (
                SELECT id FROM permissions 
                WHERE name IN (
                    'announcements.view',
                    'announcements.create', 
                    'announcements.update',
                    'announcements.delete',
                    'system.manage_announcements'
                )
            )
        `);

        // Remove permissions
        await queryInterface.bulkDelete('permissions', {
            name: [
                'announcements.view',
                'announcements.create',
                'announcements.update',
                'announcements.delete',
                'system.manage_announcements'
            ]
        });
    }
};