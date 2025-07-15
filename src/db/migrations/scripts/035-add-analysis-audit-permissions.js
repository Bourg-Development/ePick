// Migration: Add permissions for analysis audit logs viewing
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Adding analysis audit log permissions...');
            
            // Add new permissions
            await queryInterface.bulkInsert('permissions', [
                {
                    name: 'analyses.view_audit_logs',
                    description: 'View audit logs for analyses',
                    created_at: new Date()
                },
                {
                    name: 'analyses.view_all_audit_logs',
                    description: 'View all audit logs across all analyses',
                    created_at: new Date()
                }
            ], { transaction });
            
            console.log('Analysis audit log permissions added successfully');
            
            // Get role and permission IDs
            const roles = await queryInterface.sequelize.query(
                'SELECT id, name FROM roles',
                { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
            );

            const permissions = await queryInterface.sequelize.query(
                'SELECT id, name FROM permissions WHERE name IN (?, ?)',
                {
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                    replacements: ['analyses.view_audit_logs', 'analyses.view_all_audit_logs'],
                    transaction
                }
            );

            // Map roles and permissions by name
            const roleMap = {};
            roles.forEach(role => {
                roleMap[role.name] = role.id;
            });

            const permissionMap = {};
            permissions.forEach(permission => {
                permissionMap[permission.name] = permission.id;
            });

            // Define role permissions for audit logs
            const rolePermissions = [];

            // Admin role gets all audit log permissions
            if (roleMap.admin) {
                rolePermissions.push({
                    role_id: roleMap.admin,
                    permission_id: permissionMap['analyses.view_audit_logs']
                });
                rolePermissions.push({
                    role_id: roleMap.admin,
                    permission_id: permissionMap['analyses.view_all_audit_logs']
                });
            }

            // Doctor role gets basic audit log permission (can view their own actions)
            if (roleMap.doctor) {
                rolePermissions.push({
                    role_id: roleMap.doctor,
                    permission_id: permissionMap['analyses.view_audit_logs']
                });
            }

            // Staff role gets basic audit log permission (can view their own actions)
            if (roleMap.staff) {
                rolePermissions.push({
                    role_id: roleMap.staff,
                    permission_id: permissionMap['analyses.view_audit_logs']
                });
            }

            // Security role gets all audit log permissions
            if (roleMap.security) {
                rolePermissions.push({
                    role_id: roleMap.security,
                    permission_id: permissionMap['analyses.view_audit_logs']
                });
                rolePermissions.push({
                    role_id: roleMap.security,
                    permission_id: permissionMap['analyses.view_all_audit_logs']
                });
            }

            // Insert role permissions
            if (rolePermissions.length > 0) {
                await queryInterface.bulkInsert('role_permissions', rolePermissions, { transaction });
                console.log('Audit log permissions assigned to roles successfully');
            }
            
            await transaction.commit();
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error adding analysis audit log permissions:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Removing analysis audit log permissions...');
            
            // Remove role permissions first
            await queryInterface.sequelize.query(
                'DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name IN (?, ?))',
                {
                    type: queryInterface.sequelize.QueryTypes.DELETE,
                    replacements: ['analyses.view_audit_logs', 'analyses.view_all_audit_logs'],
                    transaction
                }
            );
            
            // Remove the permissions
            await queryInterface.bulkDelete('permissions', {
                name: {
                    [Sequelize.Op.in]: [
                        'analyses.view_audit_logs',
                        'analyses.view_all_audit_logs'
                    ]
                }
            }, { transaction });
            
            console.log('Analysis audit log permissions removed successfully');
            
            await transaction.commit();
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error removing analysis audit log permissions:', error);
            throw error;
        }
    }
};