// migrations/scripts/025-add-import-export-permissions.js
const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        console.log('Adding import/export permissions...');

        // Add new permissions
        const permissions = [
            // Import permissions
            { name: 'patients.import', description: 'Import patient data from files' },
            { name: 'doctors.import', description: 'Import doctor data from files' },
            { name: 'analyses.import', description: 'Import analysis data from files' },
            { name: 'import.all', description: 'Import all types of data' },
            
            // Export permissions
            { name: 'patients.export', description: 'Export patient data to files' },
            { name: 'doctors.export', description: 'Export doctor data to files' },
            { name: 'rooms.export', description: 'Export room data to files' },
            { name: 'analyses.export', description: 'Export analysis data to files' },
            { name: 'export.all', description: 'Export all types of data' },
            { name: 'export.personal_data', description: 'Export sensitive personal data' },
            
            // Template permissions
            { name: 'import.templates', description: 'Download import templates' }
        ];

        // Insert permissions
        for (const permission of permissions) {
            await queryInterface.bulkInsert('permissions', [{
                ...permission,
                created_at: new Date()
            }], {
                ignoreDuplicates: true
            });
        }

        // Get permission IDs
        const insertedPermissions = await queryInterface.sequelize.query(
            `SELECT id, name FROM permissions WHERE name IN (${permissions.map(p => `'${p.name}'`).join(', ')})`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        // Get admin roles that should have these permissions
        const adminRoles = await queryInterface.sequelize.query(
            `SELECT id FROM roles WHERE name IN ('system_admin', 'admin')`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        // Assign all permissions to system_admin and basic permissions to admin
        for (const role of adminRoles) {
            for (const permission of insertedPermissions) {
                // System admin gets all permissions
                if (role.name === 'system_admin') {
                    await queryInterface.bulkInsert('role_permissions', [{
                        role_id: role.id,
                        permission_id: permission.id,
                        created_at: new Date(),
                    }], {
                        ignoreDuplicates: true
                    });
                }
                // Regular admin gets basic import/export but not personal data export
                else if (role.name === 'admin' && !permission.name.includes('personal_data')) {
                    await queryInterface.bulkInsert('role_permissions', [{
                        role_id: role.id,
                        permission_id: permission.id,
                        created_at: new Date(),
                    }], {
                        ignoreDuplicates: true
                    });
                }
            }
        }

        console.log('Import/export permissions added successfully');
    },

    async down(queryInterface) {
        console.log('Removing import/export permissions...');

        const permissionNames = [
            'patients.import', 'doctors.import', 'analyses.import', 'import.all',
            'patients.export', 'doctors.export', 'rooms.export', 'analyses.export', 'export.all',
            'export.personal_data', 'import.templates'
        ];

        // Remove role permissions first
        const permissions = await queryInterface.sequelize.query(
            `SELECT id FROM permissions WHERE name IN (${permissionNames.map(name => `'${name}'`).join(', ')})`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        if (permissions.length > 0) {
            await queryInterface.bulkDelete('role_permissions', {
                permission_id: permissions.map(p => p.id)
            });

            // Remove permissions
            await queryInterface.bulkDelete('permissions', {
                name: permissionNames
            });
        }

        console.log('Import/export permissions removed successfully');
    }
};