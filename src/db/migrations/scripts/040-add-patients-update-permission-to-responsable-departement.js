'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add patients.update permission to responsable_departement role
        // Client request from Florence Marth
        
        await queryInterface.sequelize.query(`
            INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
            SELECT r.id, p.id, NOW(), NOW()
            FROM roles r, permissions p
            WHERE r.name = 'responsable_departement'
            AND p.name = 'patients.update'
            AND NOT EXISTS (
                SELECT 1 FROM role_permissions rp 
                WHERE rp.role_id = r.id AND rp.permission_id = p.id
            );
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove patients.update permission from responsable_departement role
        await queryInterface.sequelize.query(`
            DELETE FROM role_permissions 
            WHERE role_id = (SELECT id FROM roles WHERE name = 'responsable_departement')
            AND permission_id = (SELECT id FROM permissions WHERE name = 'patients.update');
        `);
    }
};