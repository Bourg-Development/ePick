// db/migrations/scripts/026-add-caregiver-role.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert caregiver role
        await queryInterface.bulkInsert('roles', [
            {
                name: 'caregiver',
                description: 'Caregiver access without analysis scheduling',
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);

        // Get the caregiver role ID
        const [caregiverRole] = await queryInterface.sequelize.query(
            'SELECT id FROM roles WHERE name = ?',
            {
                replacements: ['caregiver'],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        // Get permission IDs for caregiver permissions
        const permissions = await queryInterface.sequelize.query(
            'SELECT id, name FROM permissions WHERE name IN (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            {
                replacements: [
                    'patients.view', 'patients.create', 'patients.update',
                    'doctors.view', 'rooms.view', 'analyses.view', 'analyses.update',
                    'services.view', 'recurring_analyses.view'
                ],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        // Create role-permission mappings for caregiver
        const caregiverPermissions = permissions.map(permission => ({
            role_id: caregiverRole.id,
            permission_id: permission.id
        }));

        // Insert caregiver role permissions
        await queryInterface.bulkInsert('role_permissions', caregiverPermissions);

        console.log('Caregiver role added successfully with permissions:', permissions.map(p => p.name));
    },

    down: async (queryInterface, Sequelize) => {
        // Get the caregiver role ID
        const [caregiverRole] = await queryInterface.sequelize.query(
            'SELECT id FROM roles WHERE name = ?',
            {
                replacements: ['caregiver'],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (caregiverRole) {
            // Remove caregiver role permissions
            await queryInterface.bulkDelete('role_permissions', {
                role_id: caregiverRole.id
            }, {});

            // Remove caregiver role
            await queryInterface.bulkDelete('roles', {
                name: 'caregiver'
            }, {});
        }

        console.log('Caregiver role removed successfully');
    }
};