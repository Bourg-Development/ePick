module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Get the admin role ID
            const [adminRole] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'admin'`,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            
            if (!adminRole) {
                throw new Error('Admin role not found');
            }
            
            // Define missing permissions
            const missingPermissions = [
                // Room management
                { name: 'rooms.manage', description: 'Manage rooms' },
                { name: 'rooms.create', description: 'Create rooms' },
                { name: 'rooms.update', description: 'Update rooms' },
                { name: 'rooms.delete', description: 'Delete rooms' },
                { name: 'rooms.view', description: 'View rooms' },
                
                // Service management
                { name: 'services.manage', description: 'Manage services' },
                { name: 'services.create', description: 'Create services' },
                { name: 'services.update', description: 'Update services' },
                { name: 'services.delete', description: 'Delete services' },
                { name: 'services.view', description: 'View services' },
                
                // Patient management
                { name: 'patients.manage', description: 'Manage patients' },
                { name: 'patients.create', description: 'Create patients' },
                { name: 'patients.update', description: 'Update patients' },
                { name: 'patients.delete', description: 'Delete patients' },
                { name: 'patients.view', description: 'View patients' },
                
                // Reference code management
                { name: 'manage.refcodes', description: 'Manage reference codes' },
                
                // Role management
                { name: 'manage.roles', description: 'Manage user roles' }
            ];
            
            // Insert missing permissions
            for (const perm of missingPermissions) {
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
                        `INSERT INTO permissions (name, description, created_at) 
                         VALUES (:name, :description, NOW()) 
                         RETURNING id`,
                        {
                            replacements: {
                                name: perm.name,
                                description: perm.description
                            },
                            transaction,
                            type: Sequelize.QueryTypes.INSERT
                        }
                    );
                    permissionId = result[0].id;
                } else {
                    permissionId = existing.id;
                }
                
                // Check if admin role has this permission
                if (adminRole) {
                    const [rolePermExists] = await queryInterface.sequelize.query(
                        `SELECT 1 FROM role_permissions WHERE role_id = :roleId AND permission_id = :permId`,
                        {
                            replacements: {
                                roleId: adminRole.id,
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
                                    roleId: adminRole.id,
                                    permId: permissionId
                                },
                                transaction
                            }
                        );
                    }
                }
            }
            
            await transaction.commit();
            console.log('Missing permissions added successfully');
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Remove the permissions we added
            const permissionNames = [
                'rooms.manage', 'rooms.create', 'rooms.update', 'rooms.delete', 'rooms.view',
                'services.manage', 'services.create', 'services.update', 'services.delete', 'services.view',
                'patients.manage', 'patients.create', 'patients.update', 'patients.delete', 'patients.view',
                'manage.refcodes', 'manage.roles'
            ];
            
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
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};