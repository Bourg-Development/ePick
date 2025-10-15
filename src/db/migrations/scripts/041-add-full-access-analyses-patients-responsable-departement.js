'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Ensure responsable_departement role exists
            await queryInterface.sequelize.query(`
                INSERT INTO roles (name, description, created_at, updated_at)
                VALUES ('responsable_departement', 'Department Manager', NOW(), NOW())
                ON CONFLICT (name) DO NOTHING;
            `, { transaction });

            // Define all analyses permissions (using correct naming convention from the system)
            const analysesPermissions = [
                { name: 'analyses.view', description: 'View analyses' },
                { name: 'analyses.create', description: 'Create analyses' },
                { name: 'analyses.update', description: 'Update analyses' },
                { name: 'analyses.delete', description: 'Delete analyses' },
                { name: 'analyses.cancel', description: 'Cancel analyses' },
                { name: 'analyses.manage', description: 'Manage analyses' },
                { name: 'analyses.export', description: 'Export analyses' },
                { name: 'analyses.import', description: 'Import analyses' },
                { name: 'analyses.view_audit_logs', description: 'View analysis audit logs' },
                { name: 'analyses.view_all_audit_logs', description: 'View all analysis audit logs' },
                { name: 'archived_analyses.view', description: 'View archived analyses' },
                { name: 'archived_analyses.export', description: 'Export archived analyses' },
                { name: 'archived_analyses.cleanup', description: 'Clean up archived analyses' },
                { name: 'recurring_analyses.view', description: 'View recurring analyses' },
                { name: 'recurring_analyses.create', description: 'Create recurring analyses' },
                { name: 'recurring_analyses.update', description: 'Update recurring analyses' },
                { name: 'recurring_analyses.delete', description: 'Delete recurring analyses' },
                { name: 'recurring_analyses.deactivate', description: 'Deactivate recurring analyses' }
            ];

            // Define all patients permissions (some may already exist)
            const patientsPermissions = [
                { name: 'patients.view', description: 'View patients' },
                { name: 'patients.create', description: 'Create patients' },
                { name: 'patients.update', description: 'Update patients' },
                { name: 'patients.delete', description: 'Delete patients' },
                { name: 'patients.manage', description: 'Manage patients' },
                { name: 'patients.export', description: 'Export patient data' },
                { name: 'patients.import', description: 'Import patient data' }
            ];

            // Define doctor permissions needed for patient creation process
            // Note: Only create permission is needed as they don't need to see the doctors tab
            const doctorPermissions = [
                { name: 'doctors.create', description: 'Create doctors' },
                { name: 'doctors.view', description: 'View doctors' }  // Needed for searching existing doctors during patient creation
            ];

            // Define room permissions needed for patient creation process
            const roomPermissions = [
                { name: 'rooms.create', description: 'Create rooms' },
                { name: 'rooms.view', description: 'View rooms' }  // Needed for searching existing rooms during patient creation
            ];

            // Combine all permissions
            const allPermissions = [...analysesPermissions, ...patientsPermissions, ...doctorPermissions, ...roomPermissions];

            // Insert permissions if they don't exist
            for (const perm of allPermissions) {
                await queryInterface.sequelize.query(`
                    INSERT INTO permissions (name, description, created_at)
                    VALUES (:name, :description, NOW())
                    ON CONFLICT (name) DO NOTHING;
                `, {
                    replacements: perm,
                    transaction
                });
            }

            // Grant all these permissions to responsable_departement role
            await queryInterface.sequelize.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = 'responsable_departement'
                AND p.name IN (
                    'analyses.view', 'analyses.create', 'analyses.update',
                    'analyses.delete', 'analyses.cancel', 'analyses.manage',
                    'analyses.export', 'analyses.import',
                    'analyses.view_audit_logs', 'analyses.view_all_audit_logs',
                    'archived_analyses.view', 'archived_analyses.export', 'archived_analyses.cleanup',
                    'recurring_analyses.view', 'recurring_analyses.create', 'recurring_analyses.update',
                    'recurring_analyses.delete', 'recurring_analyses.deactivate',
                    'patients.view', 'patients.create', 'patients.update',
                    'patients.delete', 'patients.manage', 'patients.export', 'patients.import',
                    'doctors.create', 'doctors.view',
                    'rooms.create', 'rooms.view'
                )
                ON CONFLICT (role_id, permission_id) DO NOTHING;
            `, { transaction });

            // Also grant these permissions to admin role to ensure admins have full access
            await queryInterface.sequelize.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = 'admin'
                AND p.name IN (
                    'analyses.view', 'analyses.create', 'analyses.update',
                    'analyses.delete', 'analyses.cancel', 'analyses.manage',
                    'analyses.export', 'analyses.import',
                    'analyses.view_audit_logs', 'analyses.view_all_audit_logs',
                    'archived_analyses.view', 'archived_analyses.export', 'archived_analyses.cleanup',
                    'recurring_analyses.view', 'recurring_analyses.create', 'recurring_analyses.update',
                    'recurring_analyses.delete', 'recurring_analyses.deactivate'
                )
                ON CONFLICT (role_id, permission_id) DO NOTHING;
            `, { transaction });

            await transaction.commit();
            console.log('Successfully granted full analyses and patients access to responsable_departement role');
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Remove permissions from responsable_departement role
            await queryInterface.sequelize.query(`
                DELETE FROM role_permissions
                WHERE role_id = (SELECT id FROM roles WHERE name = 'responsable_departement')
                AND permission_id IN (
                    SELECT id FROM permissions WHERE name IN (
                        'analyses.view', 'analyses.create', 'analyses.update',
                        'analyses.delete', 'analyses.cancel', 'analyses.manage',
                        'analyses.export', 'analyses.import',
                        'analyses.view_audit_logs', 'analyses.view_all_audit_logs',
                        'archived_analyses.view', 'archived_analyses.export', 'archived_analyses.cleanup',
                        'recurring_analyses.view', 'recurring_analyses.create', 'recurring_analyses.update',
                        'recurring_analyses.delete', 'recurring_analyses.deactivate',
                        'patients.view', 'patients.create', 'patients.update',
                        'patients.delete', 'patients.manage', 'patients.export', 'patients.import',
                        'doctors.create', 'doctors.view',
                        'rooms.create', 'rooms.view'
                    )
                );
            `, { transaction });

            // Don't delete permissions as they might be used by other roles

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};