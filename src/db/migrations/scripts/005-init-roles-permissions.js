// db/seeders/005-init-roles-permissions.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert basic roles
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
            },
            {
                name: 'doctor',
                description: 'Doctor access to patient data and analyses',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'nurse',
                description: 'Nursing staff access',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'technician',
                description: 'Laboratory technician access',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);

        // Insert comprehensive permissions
        await queryInterface.bulkInsert('permissions', [
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

            // Staff role permissions (general staff access)
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['read.users']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['patients.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['patients.create']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['patients.update']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['analyses.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['analyses.create']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['analyses.update']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['archived_analyses.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['services.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['recurring_analyses.view']
            },
            {
                role_id: roleMap.staff,
                permission_id: permissionMap['recurring_analyses.create']
            },

            // Doctor role permissions
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['patients.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['patients.create']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['patients.update']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['analyses.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['analyses.create']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['analyses.update']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['analyses.cancel']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['archived_analyses.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['services.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['recurring_analyses.view']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['recurring_analyses.create']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['recurring_analyses.update']
            },
            {
                role_id: roleMap.doctor,
                permission_id: permissionMap['recurring_analyses.deactivate']
            },

            // Nurse role permissions
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['patients.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['patients.create']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['patients.update']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['analyses.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['analyses.create']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['analyses.update']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['services.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['recurring_analyses.view']
            },
            {
                role_id: roleMap.nurse,
                permission_id: permissionMap['recurring_analyses.create']
            },

            // Technician role permissions
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['patients.view']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['analyses.view']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['analyses.update']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['archived_analyses.view']
            },
            {
                role_id: roleMap.technician,
                permission_id: permissionMap['services.view']
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
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['manage.roles']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['doctors.create']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['doctors.update']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['doctors.delete']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['rooms.create']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['rooms.update']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['rooms.delete']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['organization_settings.view']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['organization_settings.update']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['services.view']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['services.create']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['services.update']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['services.delete']
            },
            {
                role_id: roleMap.userManager,
                permission_id: permissionMap['services.manage_users']
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
            {
                role_id: roleMap.security,
                permission_id: permissionMap['read.users']
            },
            {
                role_id: roleMap.security,
                permission_id: permissionMap['archived_analyses.view']
            },
            {
                role_id: roleMap.security,
                permission_id: permissionMap['archived_analyses.export']
            },
            {
                role_id: roleMap.security,
                permission_id: permissionMap['archived_analyses.cleanup']
            },
            {
                role_id: roleMap.security,
                permission_id: permissionMap['services.view']
            },

            // Readonly role permissions
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['read.users']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['read.logs']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['patients.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['doctors.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['rooms.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['analyses.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['archived_analyses.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['organization_settings.view']
            },
            {
                role_id: roleMap.readonly,
                permission_id: permissionMap['services.view']
            }
        ];

        // Insert role permissions
        await queryInterface.bulkInsert('role_permissions', rolePermissions);

        // Insert default service
        await queryInterface.bulkInsert('services', [
            {
                name: 'Blood Analysis Laboratory',
                email: 'lab@hospital.com',
                description: 'Blood Analysis Management Service',
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