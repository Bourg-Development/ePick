const { Pool } = require('pg');

async function addPermissionToRole() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost/epick'
    });

    try {
        // Check if the role exists
        const roleCheck = await pool.query('SELECT id, name FROM roles WHERE name = $1', ['responsable_departement']);
        if (roleCheck.rows.length === 0) {
            console.error('Role "responsable_departement" not found');
            process.exit(1);
        }

        // Check if the permission exists
        const permissionCheck = await pool.query('SELECT id, name FROM permissions WHERE name = $1', ['patients.update']);
        if (permissionCheck.rows.length === 0) {
            console.error('Permission "patients.update" not found');
            process.exit(1);
        }

        const roleId = roleCheck.rows[0].id;
        const permissionId = permissionCheck.rows[0].id;

        // Check if the role already has this permission
        const existingPermission = await pool.query(
            'SELECT * FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
            [roleId, permissionId]
        );

        if (existingPermission.rows.length > 0) {
            console.log('Permission "patients.update" already assigned to role "responsable_departement"');
            return;
        }

        // Add the permission to the role
        await pool.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [roleId, permissionId]
        );

        console.log('Successfully added "patients.update" permission to "responsable_departement" role');
        console.log(`Role ID: ${roleId}, Permission ID: ${permissionId}`);

    } catch (error) {
        console.error('Error adding permission to role:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the script
addPermissionToRole();