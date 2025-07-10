module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Adding maintenance permissions...');
            
            // Get the system_admin role ID
            const [systemAdminRole] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'system_admin'`,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            
            if (!systemAdminRole) {
                throw new Error('System admin role not found');
            }
            
            // Define maintenance permissions
            const maintenancePermissions = [
                { 
                    name: 'system.maintenance.manage', 
                    description: 'Manage system maintenance schedules and mode',
                    is_system: true
                }
            ];
            
            // Insert maintenance permissions
            for (const perm of maintenancePermissions) {
                // Check if permission already exists
                const [existing] = await queryInterface.sequelize.query(
                    `SELECT id FROM permissions WHERE name = :name`,
                    {
                        replacements: { name: perm.name },
                        transaction,
                        type: Sequelize.QueryTypes.SELECT
                    }
                );
                
                let permissionId;
                
                if (!existing) {
                    // Insert new permission
                    const [result] = await queryInterface.sequelize.query(
                        `INSERT INTO permissions (name, description, is_system, created_at) 
                         VALUES (:name, :description, :is_system, NOW()) 
                         RETURNING id`,
                        {
                            replacements: perm,
                            transaction,
                            type: Sequelize.QueryTypes.INSERT
                        }
                    );
                    permissionId = result[0].id;
                    console.log(`Created permission: ${perm.name}`);
                } else {
                    permissionId = existing.id;
                    console.log(`Permission already exists: ${perm.name}`);
                }
                
                // Assign to system_admin role
                const [rolePermExists] = await queryInterface.sequelize.query(
                    `SELECT 1 FROM role_permissions WHERE role_id = :roleId AND permission_id = :permId`,
                    {
                        replacements: {
                            roleId: systemAdminRole.id,
                            permId: permissionId
                        },
                        transaction,
                        type: Sequelize.QueryTypes.SELECT
                    }
                );
            
                if (!rolePermExists) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO role_permissions (role_id, permission_id) 
                         VALUES (:roleId, :permId)`,
                        {
                            replacements: {
                                roleId: systemAdminRole.id,
                                permId: permissionId
                            },
                            transaction
                        }
                    );
                    console.log(`Assigned ${perm.name} to system_admin role`);
                }
            }
            
            await transaction.commit();
            console.log('✅ Maintenance permissions added successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('Error adding maintenance permissions:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Remove the permissions we added
            const permissionNames = ['system.maintenance.manage'];
            
            // First remove from role_permissions
            await queryInterface.sequelize.query(
                `DELETE FROM role_permissions WHERE permission_id IN (
                    SELECT id FROM permissions WHERE name IN (:names)
                )`,
                {
                    replacements: { names: permissionNames },
                    transaction
                }
            );
            
            // Then remove the permissions
            await queryInterface.sequelize.query(
                `DELETE FROM permissions WHERE name IN (:names)`,
                {
                    replacements: { names: permissionNames },
                    transaction
                }
            );
            
            await transaction.commit();
            console.log('✅ Maintenance permissions removed successfully');
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};