// Migration: Add forensics and audit trail permissions
// File: 024-add-forensics-permissions.js

module.exports = {
    async up(queryInterface, Sequelize) {
        console.log('Adding forensics and audit trail permissions...');
        
        // Define new forensics permissions
        const forensicsPermissions = [
            {
                name: 'forensics.dashboard',
                description: 'Access security dashboard and real-time metrics',
                resource: 'forensics',
                action: 'dashboard'
            },
            {
                name: 'forensics.analyze',
                description: 'Analyze user behavior patterns for anomalies',
                resource: 'forensics',
                action: 'analyze'
            },
            {
                name: 'forensics.investigate',
                description: 'Investigate suspicious activity across the system',
                resource: 'forensics',
                action: 'investigate'
            },
            {
                name: 'forensics.audit_report',
                description: 'Generate comprehensive audit reports',
                resource: 'forensics',
                action: 'audit_report'
            },
            {
                name: 'forensics.verify_integrity',
                description: 'Verify audit log integrity and detect tampering',
                resource: 'forensics',
                action: 'verify_integrity'
            }
        ];

        // Insert forensics permissions
        for (const permission of forensicsPermissions) {
            try {
                await queryInterface.sequelize.query(`
                    INSERT INTO permissions (name, description, resource, action, created_at, updated_at)
                    VALUES (:name, :description, :resource, :action, NOW(), NOW())
                    ON CONFLICT (name) DO NOTHING
                `, {
                    replacements: permission
                });
                console.log(`Added permission: ${permission.name}`);
            } catch (error) {
                console.log(`Permission ${permission.name} may already exist, skipping...`);
            }
        }

        // Get system_admin role ID
        const [systemAdminRoles] = await queryInterface.sequelize.query(`
            SELECT id FROM roles WHERE name = 'system_admin'
        `);

        if (systemAdminRoles.length > 0) {
            const systemAdminRoleId = systemAdminRoles[0].id;

            // Grant all forensics permissions to system_admin role
            for (const permission of forensicsPermissions) {
                try {
                    const [permissions] = await queryInterface.sequelize.query(`
                        SELECT id FROM permissions WHERE name = :name
                    `, {
                        replacements: { name: permission.name }
                    });

                    if (permissions.length > 0) {
                        const permissionId = permissions[0].id;

                        await queryInterface.sequelize.query(`
                            INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
                            VALUES (:roleId, :permissionId, NOW(), NOW())
                            ON CONFLICT (role_id, permission_id) DO NOTHING
                        `, {
                            replacements: {
                                roleId: systemAdminRoleId,
                                permissionId: permissionId
                            }
                        });

                        console.log(`Granted ${permission.name} to system_admin role`);
                    }
                } catch (error) {
                    console.log(`Error granting ${permission.name} to system_admin:`, error.message);
                }
            }
        }

        // Grant basic forensics permissions to admin role
        const [adminRoles] = await queryInterface.sequelize.query(`
            SELECT id FROM roles WHERE name = 'admin'
        `);

        if (adminRoles.length > 0) {
            const adminRoleId = adminRoles[0].id;
            const basicForensicsPermissions = ['forensics.dashboard', 'forensics.audit_report'];

            for (const permissionName of basicForensicsPermissions) {
                try {
                    const [permissions] = await queryInterface.sequelize.query(`
                        SELECT id FROM permissions WHERE name = :name
                    `, {
                        replacements: { name: permissionName }
                    });

                    if (permissions.length > 0) {
                        const permissionId = permissions[0].id;

                        await queryInterface.sequelize.query(`
                            INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
                            VALUES (:roleId, :permissionId, NOW(), NOW())
                            ON CONFLICT (role_id, permission_id) DO NOTHING
                        `, {
                            replacements: {
                                roleId: adminRoleId,
                                permissionId: permissionId
                            }
                        });

                        console.log(`Granted ${permissionName} to admin role`);
                    }
                } catch (error) {
                    console.log(`Error granting ${permissionName} to admin:`, error.message);
                }
            }
        }

        console.log('Forensics permissions added successfully.');
    },

    async down(queryInterface, Sequelize) {
        console.log('Removing forensics permissions...');
        
        const forensicsPermissionNames = [
            'forensics.dashboard',
            'forensics.analyze',
            'forensics.investigate',
            'forensics.audit_report',
            'forensics.verify_integrity'
        ];

        // Remove role permissions first
        await queryInterface.sequelize.query(`
            DELETE FROM role_permissions 
            WHERE permission_id IN (
                SELECT id FROM permissions WHERE name IN (${forensicsPermissionNames.map(() => '?').join(',')})
            )
        `, {
            replacements: forensicsPermissionNames
        });

        // Remove permissions
        await queryInterface.sequelize.query(`
            DELETE FROM permissions WHERE name IN (${forensicsPermissionNames.map(() => '?').join(',')})
        `, {
            replacements: forensicsPermissionNames
        });

        console.log('Forensics permissions removed.');
    }
};