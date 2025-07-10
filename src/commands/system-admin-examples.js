// Example: How to use system-only permissions in your application

const { requirePermission } = require('../middleware/authorization');

// Example 1: Creating a route that only system administrators can access
// This could be in your routes file
router.post('/api/system/emergency-shutdown', 
    requirePermission('system.emergency_shutdown'),
    async (req, res) => {
        // Only users with system.emergency_shutdown permission can reach here
        // This means only system_admin role holders
        
        console.log('Emergency shutdown initiated by:', req.auth.username);
        // Perform emergency shutdown logic
        res.json({ success: true, message: 'System shutdown initiated' });
    }
);

// Example 2: Impersonation endpoint (system admin only)
router.post('/api/system/impersonate/:userId',
    requirePermission('system.impersonate'),
    async (req, res) => {
        const targetUserId = req.params.userId;
        // Logic to create session as another user
        // Only system admins can do this
    }
);

// Example 3: Unrestricted data export
router.post('/api/system/export-all-data',
    requirePermission('system.data_export_unrestricted'),
    async (req, res) => {
        // Export all data without any restrictions
        // Regular admins cannot access this
    }
);

// Example 4: Multiple system permissions
router.delete('/api/system/audit-logs/:id',
    requirePermission(['system.modify_audit_logs', 'system.bypass_restrictions']),
    async (req, res) => {
        // Delete audit logs - highly sensitive operation
        // Requires system permissions
    }
);

// Example 5: Checking permissions in service layer
class SystemService {
    async performSystemOperation(userId, userRole, userPermissions) {
        // Check if user has system permission
        if (!userPermissions.includes('system.database_maintenance')) {
            throw new Error('System permission required');
        }
        
        // Or check by role
        if (userRole !== 'system_admin') {
            throw new Error('Only system administrators can perform this operation');
        }
        
        // Perform system operation
    }
}

// Example 6: Mixed permissions (some system, some regular)
router.post('/api/admin/critical-operation',
    requirePermission(['write.users', 'system.bypass_restrictions']),
    async (req, res) => {
        // This requires BOTH regular permission AND system permission
        // Only system_admin can access this because of system.bypass_restrictions
    }
);

/* 
SYSTEM-ONLY PERMISSIONS AVAILABLE:

System Administration:
- system.manage_roles: Create, modify, and delete system roles
- system.assign_system_roles: Assign system roles to users
- system.bypass_restrictions: Bypass all system restrictions
- system.impersonate: Impersonate other users

Database & Backup:
- system.database_maintenance: Database maintenance operations
- system.backup_restore: Create and restore backups
- system.purge_data: Permanently purge data

Security & Audit:
- system.modify_audit_logs: Modify or delete audit logs
- system.view_all_sessions: View all user sessions
- system.terminate_sessions: Terminate any session
- system.reset_security: Reset security settings

Configuration:
- system.modify_config: Modify system configuration
- system.access_env: Access environment variables
- system.debug_mode: Enable debug mode

Critical Operations:
- system.emergency_shutdown: Emergency shutdown
- system.data_export_unrestricted: Export all data
- system.delete_protected_entities: Delete protected entities

IMPORTANT NOTES:
1. Regular admin role CANNOT access these permissions
2. Only system_admin role has these permissions
3. System permissions are logged with HIGH severity
4. Use with extreme caution
*/

module.exports = {
    // Export examples if needed
};