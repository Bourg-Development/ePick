// config/roles.js

/**
 * Role definitions and permission mappings
 */
const roles = {
    // Admin role with all permissions
    admin: {
        name: 'admin',
        description: 'Full system access',
        permissions: [
            'read.all', 'write.all', 'read.users', 'write.users', 'read.logs',
            'manage.refcodes', 'manage.roles', 'access.security'
        ]
    },

    // System admin role with full system access (same as admin)
    system_admin: {
        name: 'system_admin',
        description: 'Full system administrator access',
        permissions: [
            'read.all', 'write.all', 'read.users', 'write.users', 'read.logs',
            'manage.refcodes', 'manage.roles', 'access.security'
        ]
    },

    // Staff role with limited permissions
    staff: {
        name: 'staff',
        description: 'Standard staff access',
        permissions: [
            'read.users'
        ]
    },

    // User manager role for user administration
    userManager: {
        name: 'userManager',
        description: 'User management access',
        permissions: [
            'read.users', 'write.users', 'manage.refcodes'
        ]
    },

    // Security role for log access and security operations
    security: {
        name: 'security',
        description: 'Security monitoring access',
        permissions: [
            'read.logs', 'access.security'
        ]
    },

    // Readonly role for reporting and viewing
    readonly: {
        name: 'readonly',
        description: 'Read-only access',
        permissions: [
            'read.users', 'read.logs'
        ]
    },

    // Caregiver role with nurse-like permissions but no analysis scheduling
    caregiver: {
        name: 'caregiver',
        description: 'Caregiver access without analysis scheduling',
        permissions: [
            'patients.view', 'patients.create', 'patients.update',
            'doctors.view', 'rooms.view', 'analyses.view', 'analyses.update',
            'services.view', 'recurring_analyses.view'
        ]
    }
};

/**
 * Available permissions with descriptions
 */
const permissions = {
    'read.all': 'Read access to all data',
    'write.all': 'Write access to all data',
    'read.users': 'Read access to user data',
    'write.users': 'Write access to user data',
    'read.logs': 'Read access to audit and security logs',
    'manage.refcodes': 'Create and manage reference codes',
    'manage.roles': 'Assign and manage user roles',
    'access.security': 'Access to security settings and anomaly data'
};

module.exports = {
    roles,
    permissions
};