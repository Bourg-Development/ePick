module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Insert initial roles and permissions
        await queryInterface.bulkInsert('permissions', [
            { name: 'admin', description: 'Full administrative access' },
            { name: 'write.all', description: 'Write access to all resources' },
            { name: 'read.all', description: 'Read access to all resources' },
            { name: 'manage.users', description: 'Create, update, and delete users' },
            { name: 'manage.roles', description: 'Assign and modify roles' },
            { name: 'read.users', description: 'View user information' },
            { name: 'write.self', description: 'Modify own user data' },
            { name: 'read.self', description: 'View own user data' },
            { name: 'read.logs', description: 'Access system logs' }
        ]);

        await queryInterface.bulkInsert('roles', [
            { name: 'admin', description: 'Full system access' },
            { name: 'user_manager', description: 'User management access' },
            { name: 'auditor', description: 'Audit log access' },
            { name: 'standard_user', description: 'Basic user permissions' }
        ]);

        // Associate permissions with roles
        await queryInterface.bulkInsert('role_permissions', [
            // Admin role gets all permissions
            { role_name: 'admin', permission_name: 'admin' },
            { role_name: 'admin', permission_name: 'write.all' },
            { role_name: 'admin', permission_name: 'read.all' },
            { role_name: 'admin', permission_name: 'manage.users' },
            { role_name: 'admin', permission_name: 'manage.roles' },
            { role_name: 'admin', permission_name: 'read.users' },
            { role_name: 'admin', permission_name: 'write.self' },
            { role_name: 'admin', permission_name: 'read.self' },
            { role_name: 'admin', permission_name: 'read.logs' },

            // User manager role
            { role_name: 'user_manager', permission_name: 'manage.users' },
            { role_name: 'user_manager', permission_name: 'read.users' },

            // Auditor role
            { role_name: 'auditor', permission_name: 'read.logs' },

            // Standard user role
            { role_name: 'standard_user', permission_name: 'write.self' },
            { role_name: 'standard_user', permission_name: 'read.self' }
        ]);

        // Create initial admin user
        const adminPassword = require('crypto').randomBytes(16).toString('hex');
        const salt = require('crypto').randomBytes(16).toString('hex');
        const hashedPassword = await require('argon2').hash(
            adminPassword + process.env.AUTH_PEPPER,
            {
                type: require('argon2').argon2id,
                salt: Buffer.from(salt, 'hex'),
                timeCost: 3,
                memoryCost: 65536,
                parallelism: 4,
                hashLength: 32
            }
        );

        const [adminUser] = await queryInterface.bulkInsert('users', [{
            username: '000001',
            password_hash: hashedPassword,
            password_salt: salt,
            is_admin: true,
            created_at: new Date(),
            updated_at: new Date()
        }], { returning: ['id'] });

        const adminId = adminUser.id;

        await queryInterface.bulkInsert('user_roles', [
            { user_id: adminId, role_name: 'admin' }
        ]);

        console.log('========================================');
        console.log('Initial admin user created:');
        console.log(`Username: 000001`);
        console.log(`Password: ${adminPassword}`);
        console.log('IMPORTANT: This password will not be shown again!');
        console.log('========================================');
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('user_roles', null, {});
        await queryInterface.bulkDelete('role_permissions', null, {});
        await queryInterface.bulkDelete('users', null, {});
        await queryInterface.bulkDelete('roles', null, {});
        await queryInterface.bulkDelete('permissions', null, {});
    }
};