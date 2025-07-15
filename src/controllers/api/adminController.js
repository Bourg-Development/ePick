// controllers/adminController.js
const userService = require('../../services/userService');
const referenceCodeService = require('../../services/referenceCodeService');
const serviceService = require('../../services/serviceService');
const logService = require('../../services/logService');
const authService = require('../../services/authService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Format event types for user-friendly display
 * @param {string} eventType - Raw event type
 * @returns {string} User-friendly event name
 */
function formatEventTypeForDisplay(eventType) {
    const eventMap = {
        // Analysis events (underscore and dot notation)
        'analysis_created': 'Created Analysis',
        'analysis.created': 'Created Analysis',
        'analysis_updated': 'Updated Analysis',
        'analysis.updated': 'Updated Analysis',
        'analysis_completed': 'Marked Analysis as Complete',
        'analysis.completed': 'Marked Analysis as Complete',
        'analysis_postponed': 'Postponed Analysis',
        'analysis.postponed': 'Postponed Analysis',
        'analysis_cancelled': 'Cancelled Analysis',
        'analysis.cancelled': 'Cancelled Analysis',
        'analysis_resumed': 'Resumed Analysis',
        'analysis.resumed': 'Resumed Analysis',
        'analysis_status_changed': 'Changed Analysis Status',
        'analysis.status_changed': 'Changed Analysis Status',
        
        // Patient events
        'patient_created': 'Added New Patient',
        'patient.created': 'Added New Patient',
        'patient_updated': 'Updated Patient Info',
        'patient.updated': 'Updated Patient Info',
        'patient_deleted': 'Removed Patient',
        'patient.deleted': 'Removed Patient',
        
        // Doctor events
        'doctor_created': 'Added New Doctor',
        'doctor.created': 'Added New Doctor',
        'doctor_updated': 'Updated Doctor Info',
        'doctor.updated': 'Updated Doctor Info',
        'doctor_deleted': 'Removed Doctor',
        'doctor.deleted': 'Removed Doctor',
        
        // Room events
        'room_created': 'Created Room',
        'room.created': 'Created Room',
        'room_updated': 'Updated Room',
        'room.updated': 'Updated Room',
        'room_deleted': 'Deleted Room',
        'room.deleted': 'Deleted Room',
        
        // User events
        'user_created': 'Created User Account',
        'user.created': 'Created User Account',
        'user_updated': 'Updated User Account',
        'user.updated': 'Updated User Account',
        'user_role_changed': 'Changed User Role',
        'user.role_changed': 'Changed User Role',
        'user_locked': 'Locked User Account',
        'user.locked': 'Locked User Account',
        'user_unlocked': 'Unlocked User Account',
        'user.unlocked': 'Unlocked User Account',
        
        // System events
        'system_update_published': 'Published System Update',
        'system.update_published': 'Published System Update'
    };

    return eventMap[eventType] || eventType.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format audit log details for user-friendly display
 * @param {string} eventType - The event type
 * @param {Object} metadata - Event metadata
 * @param {string} targetType - Target resource type
 * @param {number} targetId - Target resource ID
 * @returns {string} User-friendly description
 */
function formatDetailsForDisplay(eventType, metadata, targetType, targetId) {
    if (!metadata || typeof metadata !== 'object') {
        return `Affected ${targetType || 'item'} #${targetId || 'unknown'}`;
    }

    // Extract common fields from metadata - check multiple possible field names
    const {
        patient_name,
        patientName,
        patient_id,
        patientId,
        doctor_name,
        doctorName,
        doctor_id,
        doctorId,
        room_number,
        roomNumber,
        room_id,
        roomId,
        analysis_type,
        analysisType,
        priority,
        status,
        old_status,
        oldStatus,
        new_status,
        newStatus,
        username,
        full_name,
        fullName,
        role,
        old_role,
        oldRole,
        new_role,
        newRole,
        reason,
        notes,
        version,
        title,
        // Additional common fields
        changes,
        updatedFields,
        updated_fields,
        previous_value,
        previousValue,
        new_value,
        newValue,
        description
    } = metadata;

    // Helper function to get value from multiple possible field names
    const getValue = (...fieldNames) => {
        for (const field of fieldNames) {
            if (metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== '') {
                return metadata[field];
            }
        }
        return null;
    };

    // Format based on event type
    if (eventType.includes('analysis')) {
        let details = [];
        
        // Get contextual information
        const patientName = getValue('patient_name', 'patientName');
        const analysisType = getValue('analysis_type', 'analysisType', 'type');
        const analysisPriority = getValue('priority');
        const analysisReason = getValue('reason');
        const analysisNotes = getValue('notes', 'description');
        
        // For analysis creation events, prioritize patient name over analysis type
        if (eventType.includes('created')) {
            if (patientName) {
                details.push(`Patient: ${patientName}`);
                // Add analysis type as secondary info
                if (analysisType) details.push(`Type: ${analysisType}`);
            } else if (analysisType) {
                details.push(`Type: ${analysisType}`);
            }
        } else {
            // For other analysis events, show status changes first
            const oldStat = getValue('old_status', 'oldStatus', 'previous_value', 'previousValue');
            const newStat = getValue('new_status', 'newStatus', 'new_value', 'newValue', 'status');
            
            if (oldStat && newStat) {
                details.push(`Changed from "${oldStat}" to "${newStat}"`);
            } else if (newStat) {
                details.push(`Set to: ${newStat}`);
            }
            
            // Add contextual information
            if (patientName) details.push(`Patient: ${patientName}`);
            if (analysisType) details.push(`Type: ${analysisType}`);
        }
        
        // Add additional details for all analysis events
        if (analysisPriority) details.push(`Priority: ${analysisPriority}`);
        if (analysisReason) details.push(`Reason: ${analysisReason}`);
        if (analysisNotes) {
            const truncatedNotes = analysisNotes.length > 80 ? 
                analysisNotes.substring(0, 80) + '...' : analysisNotes;
            details.push(`Notes: ${truncatedNotes}`);
        }
        
        return details.length > 0 ? details.join(' • ') : 'No additional details';
    }
    
    if (eventType.includes('patient')) {
        let details = [];
        
        // Show what changed if it's an update
        if (eventType.includes('updated') && metadata.updated_fields) {
            details.push(`Updated: ${metadata.updated_fields.join(', ')}`);
        }
        
        // Add key identifiers
        if (patient_name || full_name) details.push(`Name: ${patient_name || full_name}`);
        if (metadata.matricule_national) details.push(`ID: ${metadata.matricule_national}`);
        
        // Add relevant details
        if (metadata.age) details.push(`Age: ${metadata.age}`);
        if (metadata.phone) details.push(`Phone: ${metadata.phone}`);
        
        return details.length > 0 ? details.join(' • ') : 'No additional details';
    }
    
    if (eventType.includes('doctor')) {
        let details = [];
        
        if (doctor_name || full_name) details.push(`Name: ${doctor_name || full_name}`);
        if (metadata.specialization) details.push(`Specialization: ${metadata.specialization}`);
        if (metadata.department) details.push(`Department: ${metadata.department}`);
        
        return details.length > 0 ? details.join(' • ') : `Doctor #${targetId}`;
    }
    
    if (eventType.includes('room')) {
        let details = [];
        
        if (room_number) details.push(`Room: ${room_number}`);
        if (metadata.service_name) details.push(`Service: ${metadata.service_name}`);
        
        return details.length > 0 ? details.join(' • ') : `Room #${targetId}`;
    }
    
    if (eventType.includes('user')) {
        let details = [];
        
        // Prioritize showing what changed
        if (old_role && new_role) {
            details.push(`Role: "${old_role}" → "${new_role}"`);
        } else if (role) {
            details.push(`Role set to: ${role}`);
        }
        
        // Show lock/unlock status if relevant
        if (eventType.includes('locked')) {
            details.push(`Account locked`);
        } else if (eventType.includes('unlocked')) {
            details.push(`Account unlocked`);
        }
        
        // Add user identification
        if (username) details.push(`Username: ${username}`);
        if (full_name) details.push(`Name: ${full_name}`);
        
        // Add reason if provided
        if (reason) details.push(`Reason: ${reason}`);
        
        return details.length > 0 ? details.join(' • ') : 'No additional details';
    }
    
    if (eventType.includes('system_update')) {
        let details = [];
        
        if (version) details.push(`Version: ${version}`);
        if (title) details.push(`Title: ${title}`);
        if (metadata.emailsSent) details.push(`Emails sent: ${metadata.emailsSent}`);
        
        return details.length > 0 ? details.join(' • ') : `System Update #${targetId}`;
    }
    
    // Debug: Log the actual metadata to see what's available
    console.log('Event type:', eventType, 'Metadata:', metadata);
    
    // Fallback: create a readable summary of available metadata
    const excludeKeys = [
        '_at', 'hash', 'token', 'ip', 'fingerprint', 'id', 'created_at', 'updated_at',
        'user_id', 'target_id', 'event_type', 'metadata', 'previous_hash', 'record_hash'
    ];
    
    const meaningfulFields = Object.entries(metadata)
        .filter(([key, value]) => {
            // Filter out empty/null values
            if (value === null || value === undefined || value === '') {
                return false;
            }
            
            // Filter out excluded keys
            if (excludeKeys.some(excludeKey => key.includes(excludeKey))) {
                return false;
            }
            
            // Filter out very long values (probably not useful for display)
            if (typeof value === 'string' && value.length > 200) {
                return false;
            }
            
            return true;
        })
        .slice(0, 4) // Show up to 4 fields
        .map(([key, value]) => {
            const friendlyKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Truncate long values
            let displayValue = value;
            if (typeof value === 'string' && value.length > 50) {
                displayValue = value.substring(0, 50) + '...';
            }
            
            return `${friendlyKey}: ${displayValue}`;
        })
        .join(' • ');
        
    return meaningfulFields || 'No additional details';
}

/**
 * Admin controller for managing users, roles, reference codes, and services
 */
class AdminController {
    /**
     * Generate a reference code for an existing user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generateReferenceCode(req, res) {
        try {
            // Only users with admin or write.users permission can generate reference codes
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('manage.refcodes')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const {
                userId,
                require2FA = false
            } = req.body;

            // Validate request
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Generate reference code
            const result = await referenceCodeService.generateReferenceCode({
                userId: parseInt(userId),
                require2FA,
                createdBy: adminId
            }, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Generate reference code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate reference code'
            });
        }
    }

    /**
     * Create a new user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createUser(req, res) {
        try {
            // Only users with admin or write.users permission can create users
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const {
                username,
                fullName,
                roleId,
                serviceId,
                email
            } = req.body;

            // Validate request
            if (!username || !roleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and role ID are required'
                });
            }

            // Validate username format (6 digits)
            if (!username.match(/^\d{6}$/)) {
                return res.status(400).json({
                    success: false,
                    message: 'Username must be exactly 6 digits'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Create user
            const result = await userService.createUser({
                username,
                fullName,
                roleId: parseInt(roleId),
                serviceId: serviceId ? parseInt(serviceId) : null,
                email,
                createdBy: adminId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create user error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    }

    /**
     * Export users to JSON format (simplified - uses docService internally)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportUsersJson(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('read.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AdminController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('json', adminId, context);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const unifiedFilters = {
                search: filters.search,
                roleId: filters.roleId ? parseInt(filters.roleId) : undefined,
                serviceId: filters.serviceId ? parseInt(filters.serviceId) : undefined
            };

            // Export users using the refactored service
            const result = await userService.exportUsers(unifiedFilters, 'json', {
                includeColumns,
                excludeColumns,
                allowedColumns: req.allowedColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AdminController()._logExportSuccess('json', adminId, result.dataCount, filters, context);

            // Set headers for file download
            const filename = `users_export_${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).json({
                success: true,
                exportDate: new Date().toISOString(),
                exportedBy: adminUsername,
                userCount: result.dataCount,
                filters: result.appliedFilters,
                users: result.data
            });
        } catch (error) {
            console.error('Export users JSON error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export users'
            });
        }
    }

    /**
     * Export users to CSV format (simplified - uses docService internally)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportUsersCsv(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('read.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AdminController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('csv', adminId, context);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const unifiedFilters = {
                search: filters.search,
                roleId: filters.roleId ? parseInt(filters.roleId) : undefined,
                serviceId: filters.serviceId ? parseInt(filters.serviceId) : undefined
            };

            // Export users using the refactored service
            const result = await userService.exportUsers(unifiedFilters, 'csv', {
                includeColumns,
                excludeColumns,
                allowedColumns: req.allowedColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AdminController()._logExportSuccess('csv', adminId, result.dataCount, filters, context);

            // Set headers for CSV download
            const filename = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.csvData);
        } catch (error) {
            console.error('Export users CSV error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export users'
            });
        }
    }

    /**
     * Export users to Excel format (simplified - uses docService internally)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportUsersExcel(req, res) {
        try {
            const { userId: adminId, username: adminUsername, permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('read.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for export'
                });
            }

            const context = new AdminController()._getRequestContext(req);

            // Verify admin's password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            if (!passwordValid.success) {
                await this._logExportFailure('excel', adminId, context);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }
            const unifiedFilters = {
                search: filters.search,        // Single search parameter
                roleId: filters.roleId ? parseInt(filters.roleId) : undefined,
                serviceId: filters.serviceId ? parseInt(filters.serviceId) : undefined
            };


            // Export users using the refactored service
            const result = await userService.exportUsers(unifiedFilters, 'excel', {
                includeColumns,
                excludeColumns,
                allowedColumns: req.allowedColumns
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Log the export
            await new AdminController()._logExportSuccess('excel', adminId, result.dataCount, filters, context);

            // Set headers for Excel download
            const filename = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            return res.status(200).send(result.excelBuffer);
        } catch (error) {
            console.error('Export users Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export users'
            });
        }
    }


    /**
     * List active reference codes
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async listReferenceCodes(req, res) {
        try {
            // Only users with admin, read.users, or manage.refcodes permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('read.users') &&
                !permissions.includes('admin') &&
                !permissions.includes('manage.refcodes')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Get filter by creator if param is provided
            const createdBy = req.query.createdBy ? parseInt(req.query.createdBy) : null;

            // For non-admin users, only show their own generated codes
            const filterCreator = !permissions.includes('admin') ? userId : createdBy;

            // List active reference codes
            const result = await referenceCodeService.listActiveCodes(filterCreator);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('List reference codes error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to list reference codes'
            });
        }
    }

    /**
     * Revoke a reference code
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async revokeReferenceCode(req, res) {
        try {
            // Only users with admin or manage.refcodes permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('manage.refcodes') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { code } = req.params;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: 'Reference code is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Revoke reference code
            const result = await referenceCodeService.revokeReferenceCode(
                code,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Revoke reference code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to revoke reference code'
            });
        }
    }

    /**
     * Generate a password reset code for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generatePasswordResetCode(req, res) {
        try {
            // Only users with admin or write.users permission
            const { userId, permissions } = req.auth;

            if (!permissions.includes('write.users') ) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { targetUserId, require2FA = false } = req.body;

            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Target user ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Generate password reset code
            const result = await referenceCodeService.generatePasswordResetCode(
                targetUserId,
                userId,
                require2FA,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Generate password reset code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate password reset code'
            });
        }
    }

    /**
     * Get list of users
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async listUsers(req, res) {
        try {
            // Only users with admin or read.users permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const filters = {
                search: req.query.search,
                roleId: req.query.roleId ? parseInt(req.query.roleId) : null,
                serviceId: req.query.serviceId ? parseInt(req.query.serviceId) : null
            };

            // Get users
            const result = await userService.getUsers(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('List users error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to list users'
            });
        }
    }

    /**
     * Get a specific user by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getUser(req, res) {
        try {
            // Only users with admin or read.users permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Get user
            const result = await userService.getUserById(parseInt(userId));

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get user error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get user'
            });
        }
    }

    /**
     * Update a user's full name
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateUserFullName(req, res) {
        try {
            // Only users with admin or write.users permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { fullName } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Update user full name
            const result = await userService.updateUserFullName(
                parseInt(userId),
                fullName,
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update user full name error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user full name'
            });
        }
    }

    /**
     * Update a user's role
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateUserRole(req, res) {
        try {
            // Only users with admin or manage.roles permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('manage.roles') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { roleId } = req.body;

            if (!userId || !roleId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and role ID are required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Update user role
            const result = await userService.updateUserRole(
                parseInt(userId),
                parseInt(roleId),
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update user role error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user role'
            });
        }
    }

    /**
     * Update a user's service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateUserService(req, res) {
        try {
            // Only users with admin or write.users permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('write.users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { serviceId } = req.body;

            if (!userId || serviceId === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and service ID are required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Update user service
            const result = await userService.updateUserService(
                parseInt(userId),
                serviceId ? parseInt(serviceId) : null,
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update user service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update user service'
            });
        }
    }

    /**
     * Update service analysis permissions
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateServiceAnalysisPermissions(req, res) {
        try {
            // Only users with admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;
            const { canViewAllAnalyses } = req.body;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            if (typeof canViewAllAnalyses !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'canViewAllAnalyses must be a boolean value'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);

            // Update service analysis permissions
            const result = await serviceService.updateServiceAnalysisPermissions(
                parseInt(serviceId),
                canViewAllAnalyses,
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update service analysis permissions error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update analysis permissions'
            });
        }
    }

    /**
     * Enable or disable 2FA for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async manageTwoFactor(req, res) {
        try {
            // Only users with admin permission
            const { userId: adminId, role } = req.auth;

            if (role !== 'admin' && role !== 'system_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const {
                totpEnabled = false,
                webauthnEnabled = false,
                require2FA = false
            } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Update 2FA settings
            const result = await userService.updateTwoFactorSettings(
                parseInt(userId),
                {
                    totpEnabled,
                    webauthnEnabled,
                    require2FA
                },
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Manage 2FA error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to manage 2FA settings'
            });
        }
    }

    /**
     * Lock or unlock a user account
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async toggleAccountLock(req, res) {
        try {
            // Only users with admin permission
            const { userId: adminId, permissions, role } = req.auth;

            if (role !== 'admin' && role !== 'system_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { userId } = req.params;
            const { locked, reason } = req.body;

            if (!userId || locked === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and lock status are required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Lock or unlock account
            const result = await userService.setAccountLockStatus(
                parseInt(userId),
                locked,
                reason || 'Administrative action',
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Toggle account lock error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update account lock status'
            });
        }
    }

    /**
     * Get services with filtering and pagination
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getServices(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
            const filters = {
                name: req.query.name,
                email: req.query.email,
                active: req.query.active !== undefined ? req.query.active === 'true' : null
            };

            // Get services
            const result = await serviceService.getServices(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get services error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve services'
            });
        }
    }

    /**
     * Get a specific service by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getService(req, res) {
        try {
            // Only users with services.view or admin permission
            const { permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            // Get service
            const result = await serviceService.getServiceById(parseInt(serviceId));

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Get service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve service'
            });
        }
    }

    /**
     * Create a new service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createService(req, res) {
        try {
            // Only users with services.create or admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('services.create') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { name, email, description } = req.body;

            // Validate required fields
            if (!name || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Service name and email are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Create service
            const result = await serviceService.createService({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                description: description ? description.trim() : null,
                createdBy: adminId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create service'
            });
        }
    }

    /**
     * Update a service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateService(req, res) {
        try {
            // Only users with services.update or admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('services.update') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;
            const { name, email, description, active } = req.body;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            // Validate email format if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid email format'
                    });
                }
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Update service
            const result = await serviceService.updateService(parseInt(serviceId), {
                name: name ? name.trim() : undefined,
                email: email ? email.trim().toLowerCase() : undefined,
                description: description !== undefined ? (description ? description.trim() : null) : undefined,
                active: active !== undefined ? active : undefined,
                updatedBy: adminId
            }, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update service'
            });
        }
    }

    /**
     * Deactivate a service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deactivateService(req, res) {
        try {
            // Only users with services.delete or admin permission
            const { userId: adminId, permissions, role } = req.auth;

            if (role !== 'admin' && role !== 'system_admin' && 
                !permissions.includes('services.delete') && !permissions.includes('write.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Deactivate service
            const result = await serviceService.deleteService(
                parseInt(serviceId),
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Deactivate service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to deactivate service'
            });
        }
    }

    /**
     * Reactivate a service
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async reactivateService(req, res) {
        try {
            // Only users with services.update or admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('services.update') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Reactivate service
            const result = await serviceService.reactivateService(
                parseInt(serviceId),
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Reactivate service error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reactivate service'
            });
        }
    }

    /**
     * Get service statistics
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getServiceStatistics(req, res) {
        try {
            // Only users with services.view or admin permission
            const { permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;

            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Service ID is required'
                });
            }

            // Get service statistics
            const result = await serviceService.getServiceStatistics(parseInt(serviceId));

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Get service statistics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve service statistics'
            });
        }
    }

    /**
     * Transfer users between services
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async transferUsers(req, res) {
        try {
            // Only users with services.manage_users or admin permission
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('services.manage_users') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params; // Source service ID
            const { toServiceId } = req.body;

            if (!serviceId || !toServiceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Source and target service IDs are required'
                });
            }

            if (parseInt(serviceId) === parseInt(toServiceId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot transfer users to the same service'
                });
            }

            // Extract request context
            const context = new AdminController()._getRequestContext(req);;

            // Transfer users
            const result = await serviceService.transferUsers(
                parseInt(serviceId),
                parseInt(toServiceId),
                adminId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Transfer users error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to transfer users'
            });
        }
    }

    /**
     * Search services by name or email
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async searchServices(req, res) {
        try {
            // Only users with services.view or admin permission
            const { permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { term } = req.params;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 results

            if (!term || term.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Search term must be at least 2 characters long'
                });
            }

            // Search services
            const result = await serviceService.searchServices(term.trim(), limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Search services error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search services'
            });
        }
    }

    /**
     * Get roles list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getRoles(req, res) {
        try {
            // All authenticated users can read roles
            const result = await userService.getRoles();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get roles error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get roles'
            });
        }
    }

    /**
     * Get audit logs
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAuditLogs(req, res) {
        try {
            // Only users with admin or read.logs permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.logs') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                userId: req.query.userId ? parseInt(req.query.userId) : null,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get audit logs
            const result = await logService.getAuditLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get audit logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve audit logs'
            });
        }
    }

    /**
     * Get security logs
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSecurityLogs(req, res) {
        try {
            // Only users with admin, read.logs, or access.security permission
            const { permissions } = req.auth;

            if (!permissions.includes('read.logs') &&
                !permissions.includes('admin') &&
                !permissions.includes('access.security')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                severity: req.query.severity,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get security logs
            const result = await logService.getSecurityLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get security logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve security logs'
            });
        }
    }

    /**
     * Verify log integrity
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyLogIntegrity(req, res) {
        try {
            // Only users with admin or access.security permission
            const { permissions } = req.auth;

            if (!permissions.includes('access.security') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { logType = 'audit', startId, endId } = req.query;

            // Verify log integrity
            const result = await logService.verifyLogIntegrity(
                logType,
                startId ? parseInt(startId) : null,
                endId ? parseInt(endId) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Verify log integrity error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify log integrity'
            });
        }
    }

    /**
     * Export services data
     */
    async exportServices(req, res) {
        try {
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, format = 'csv', filters = {} } = req.body;

            // Verify password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            const context = new AdminController()._getRequestContext(req);

            if (!passwordValid.success) {
                await this._logExportFailure(format, adminId, context, 'services');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Get services data (same method as frontend)
            const result = await serviceService.getServices({}, 1, 10000); // Get all services with high limit
            const services = result.data || [];
            
            await new AdminController()._logExportSuccess(format, adminId, services.length, filters, context, 'services');

            // Return appropriate format
            if (format === 'json') {
                // JSON format - return JSON with data
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                return res.json({
                    success: true,
                    data: JSON.stringify(services, null, 2),
                    filename: `ePick-Services-Export-${timestamp}.json`,
                    format: 'json'
                });
            } else {
                // CSV format - return JSON with CSV data
                const csv = new AdminController()._convertServicesToCSV(services);
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                return res.json({
                    success: true,
                    data: csv,
                    filename: `ePick-Services-Export-${timestamp}.csv`,
                    format: 'csv'
                });
            }
        } catch (error) {
            console.error('Export services error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export services'
            });
        }
    }

    /**
     * Get all rooms
     */
    async getRooms(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const roomService = require('../../services/roomService');
            const {
                roomNumber,
                serviceId,
                page = 1,
                limit = 1000
            } = req.query;

            const filters = {
                roomNumber,
                serviceId: serviceId ? parseInt(serviceId) : null
            };

            const result = await roomService.getRooms(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve rooms'
            });
        }
    }

    /**
     * Get room by ID
     */
    async getRoom(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { roomId } = req.params;
            const roomService = require('../../services/roomService');
            const room = await roomService.getRoomById(parseInt(roomId));

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: room
            });
        } catch (error) {
            console.error('Get room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve room'
            });
        }
    }

    /**
     * Create new room
     */
    async createRoom(req, res) {
        try {
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('rooms.manage') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { room_number, service_id } = req.body;

            const roomService = require('../../services/roomService');
            const context = new AdminController()._getRequestContext(req);

            const result = await roomService.createRoom({
                room_number,
                service_id: parseInt(service_id),
                created_by: adminId
            }, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create room'
            });
        }
    }

    /**
     * Update room
     */
    async updateRoom(req, res) {
        try {
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('rooms.manage') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { roomId } = req.params;
            const { room_number, service_id } = req.body;

            const roomService = require('../../services/roomService');
            const context = new AdminController()._getRequestContext(req);

            const result = await roomService.updateRoom(parseInt(roomId), {
                room_number,
                service_id: service_id ? parseInt(service_id) : undefined,
                updated_by: adminId
            }, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update room'
            });
        }
    }

    /**
     * Delete room (hard delete)
     */
    async deleteRoom(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            if (role !== 'admin' && role !== 'system_admin' && 
                !permissions.includes('rooms.manage') && !permissions.includes('write.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { roomId } = req.params;
            const roomService = require('../../services/roomService');
            const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
            
            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.deleteRoom(parseInt(roomId), adminId, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Delete room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete room'
            });
        }
    }

    /**
     * Export rooms (Legacy CSV/JSON Format)
     */
    async exportRooms(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            if (role !== 'system_admin' && !permissions.includes('rooms.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, format = 'csv', filters = {} } = req.body;

            // Verify password
            const passwordValid = await authService.verifyUserPassword(adminId, password);
            const context = new AdminController()._getRequestContext(req);

            if (!passwordValid.success) {
                await new AdminController()._logExportFailure(format, adminId, context, 'rooms');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            const roomService = require('../../services/roomService');
            const roomResult = await roomService.getRooms({}, 1, 10000); // Get all rooms with high limit
            const rooms = roomResult.data || [];
            
            await new AdminController()._logExportSuccess(format, adminId, rooms.length, filters, context, 'rooms');

            if (format === 'json') {
                // JSON format - return JSON with data
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                return res.json({
                    success: true,
                    data: JSON.stringify(rooms, null, 2),
                    filename: `ePick-Rooms-Export-${timestamp}.json`,
                    format: 'json'
                });
            } else {
                // CSV format - return JSON with CSV data
                const csv = new AdminController()._convertRoomsToCSV(rooms);
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                return res.json({
                    success: true,
                    data: csv,
                    filename: `ePick-Rooms-Export-${timestamp}.csv`,
                    format: 'csv'
                });
            }
        } catch (error) {
            console.error('Export rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export rooms'
            });
        }
    }

    /**
     * Search rooms
     */
    async searchRooms(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { term } = req.params;
            const { limit = 10 } = req.query;

            const roomService = require('../../services/roomService');
            const result = await roomService.searchRooms(term, parseInt(limit));

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                data: result.rooms
            });
        } catch (error) {
            console.error('Search rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to search rooms'
            });
        }
    }

    /**
     * Export rooms to Excel (Professional Format)
     */
    async exportRoomsExcel(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('rooms.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the professional doc service for formatted Excel export
            const docService = require('../../services/docService');
            const roomService = require('../../services/roomService');
            
            // Get room data
            const roomResult = await roomService.getRooms({}, 1, 10000); // Get all rooms with high limit
            
            if (!roomResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to retrieve room data'
                });
            }
            
            const rooms = roomResult.data;
            
            // Format room data for export
            const formattedRooms = rooms.map(room => {
                const formattedRoom = {};
                
                // Only include selected columns
                if (includeColumns) {
                    includeColumns.forEach(column => {
                        switch(column) {
                            case 'id':
                                formattedRoom.id = room.id;
                                break;
                            case 'roomNumber':
                                formattedRoom.roomNumber = room.room_number;
                                break;
                            case 'serviceName':
                                formattedRoom.serviceName = room.service?.name || room.Service?.name;
                                break;
                            case 'serviceId':
                                formattedRoom.serviceId = room.service_id;
                                break;
                            case 'floor':
                                formattedRoom.floor = room.floor;
                                break;
                            case 'department':
                                formattedRoom.department = room.department;
                                break;
                            case 'equipment':
                                formattedRoom.equipment = room.equipment;
                                break;
                            case 'notes':
                                formattedRoom.notes = room.notes;
                                break;
                            case 'createdAt':
                                formattedRoom.createdAt = room.created_at;
                                break;
                            case 'updatedAt':
                                formattedRoom.updatedAt = room.updated_at;
                                break;
                        }
                    });
                } else {
                    // Default columns if none specified
                    formattedRoom.id = room.id;
                    formattedRoom.roomNumber = room.room_number;
                    formattedRoom.serviceName = room.service?.name || room.Service?.name;
                    formattedRoom.floor = room.floor;
                    formattedRoom.department = room.department;
                    formattedRoom.createdAt = room.created_at;
                }
                
                return formattedRoom;
            });
            
            // Professional Excel export options
            const roomColumnHeaders = {
                id: 'Room ID',
                roomNumber: 'Room Number',
                serviceName: 'Service Name',
                serviceId: 'Service ID',
                floor: 'Floor',
                department: 'Department',
                equipment: 'Equipment',
                notes: 'Notes',
                status: 'Status',
                createdAt: 'Created Date',
                updatedAt: 'Last Modified'
            };
            
            const roomExportOptions = {
                columnHeaders: roomColumnHeaders,
                sheetName: 'Rooms',
                exportTitle: 'ROOM MANAGEMENT SYSTEM\nFacility Registry Export',
                metadata: {
                    exportType: 'rooms',
                    totalRooms: formattedRooms.length,
                    includeAllData: true
                }
            };
            
            const result = await docService.exportData(formattedRooms, 'excel', roomExportOptions);

            if (result.success) {
                // Set appropriate headers for direct buffer response
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                const filename = `ePick-Rooms-Export-${timestamp}.xlsx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', result.excelBuffer.length);

                // Send Excel buffer directly
                return res.send(result.excelBuffer);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Export rooms Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export rooms'
            });
        }
    }

    /**
     * Export services to Excel (Professional Format)
     */
    async exportServicesExcel(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('services.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the professional doc service for formatted Excel export
            const docService = require('../../services/docService');
            const serviceService = require('../../services/serviceService');
            
            // Get service data (same method as frontend)
            const result = await serviceService.getServices({}, 1, 10000); // Get all services with high limit
            const services = result.data || [];
            
            if (!services || !Array.isArray(services)) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to retrieve service data'
                });
            }
            
            // Format service data for export
            const formattedServices = services.map(service => {
                const formattedService = {};
                
                // Only include selected columns
                if (includeColumns) {
                    includeColumns.forEach(column => {
                        switch(column) {
                            case 'id':
                                formattedService.id = service.id;
                                break;
                            case 'name':
                                formattedService.serviceName = service.name;
                                break;
                            case 'description':
                                formattedService.description = service.description;
                                break;
                            case 'code':
                                formattedService.serviceCode = service.code;
                                break;
                            case 'department':
                                formattedService.department = service.department;
                                break;
                            case 'userCount':
                                formattedService.userCount = service.userCount || 0;
                                break;
                            case 'roomCount':
                                formattedService.roomCount = service.roomCount || 0;
                                break;
                            case 'canViewAllAnalyses':
                                formattedService.globalAccess = service.canViewAllAnalyses ? 'Yes' : 'No';
                                break;
                            case 'active':
                                formattedService.status = service.active ? 'Active' : 'Inactive';
                                break;
                            case 'createdAt':
                                formattedService.createdAt = service.created_at;
                                break;
                            case 'updatedAt':
                                formattedService.updatedAt = service.updated_at;
                                break;
                        }
                    });
                } else {
                    // Default columns if none specified
                    formattedService.id = service.id;
                    formattedService.serviceName = service.name;
                    formattedService.description = service.description;
                    formattedService.serviceCode = service.code;
                    formattedService.department = service.department;
                    formattedService.userCount = service.userCount || 0;
                    formattedService.roomCount = service.roomCount || 0;
                    formattedService.globalAccess = service.canViewAllAnalyses ? 'Yes' : 'No';
                    formattedService.status = service.active ? 'Active' : 'Inactive';
                    formattedService.createdAt = service.created_at;
                }
                
                return formattedService;
            });
            
            // Professional Excel export options
            const serviceColumnHeaders = {
                id: 'Service ID',
                serviceName: 'Service Name',
                description: 'Description',
                serviceCode: 'Service Code',
                department: 'Department',
                userCount: 'User Count',
                roomCount: 'Room Count',
                globalAccess: 'Global Access',
                status: 'Status',
                createdAt: 'Created Date',
                updatedAt: 'Last Modified'
            };
            
            const serviceExportOptions = {
                columnHeaders: serviceColumnHeaders,
                sheetName: 'Services',
                exportTitle: 'SERVICE MANAGEMENT SYSTEM\nOrganizational Units Export',
                metadata: {
                    exportType: 'services',
                    totalServices: formattedServices.length,
                    includeMetrics: true
                }
            };
            
            const exportResult = await docService.exportData(formattedServices, 'excel', serviceExportOptions);

            if (exportResult.success) {
                // Set appropriate headers for direct buffer response
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                const filename = `ePick-Services-Export-${timestamp}.xlsx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', exportResult.excelBuffer.length);

                // Send Excel buffer directly
                return res.send(exportResult.excelBuffer);
            } else {
                return res.status(400).json(exportResult);
            }
        } catch (error) {
            console.error('Export services Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export services'
            });
        }
    }

    /**
     * Export doctors to Excel (Professional Format)
     */
    async exportDoctorsExcel(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('doctors.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the professional doc service for formatted Excel export
            const docService = require('../../services/docService');
            const doctorService = require('../../services/doctorService');
            const cryptoService = require('../../services/cryptoService');
            
            // Get doctor data
            const doctorResult = await doctorService.getDoctors({
                search: filters.search,
                active: true
            }, 1, 10000); // Large limit to get all doctors
            
            if (!doctorResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to retrieve doctor data'
                });
            }
            
            // Helper function to safely decrypt data
            const safeDecrypt = async (encryptedText) => {
                if (!encryptedText) return '';
                
                // Check if the text looks like encrypted format (contains : separator)
                if (typeof encryptedText === 'string' && encryptedText.includes(':') && encryptedText.split(':').length === 2) {
                    try {
                        return await cryptoService.decrypt(encryptedText);
                    } catch (error) {
                        console.warn('Decryption failed, assuming plain text:', error.message);
                        return encryptedText; // Return as-is if decryption fails
                    }
                }
                
                // If it doesn't look encrypted, return as-is
                return encryptedText;
            };
            
            // Decrypt sensitive data for export
            for (const doctor of doctorResult.doctors) {
                // Decrypt doctor data
                if (doctor.name) {
                    doctor.name = await safeDecrypt(doctor.name);
                }
                if (doctor.email) {
                    doctor.email = await safeDecrypt(doctor.email);
                }
                if (doctor.phone) {
                    doctor.phone = await safeDecrypt(doctor.phone);
                }
                if (doctor.specialization) {
                    doctor.specialization = await safeDecrypt(doctor.specialization);
                }
            }
            
            // Format doctor data for export
            const formattedDoctors = doctorResult.doctors.map(doctor => {
                const formattedDoctor = {};
                
                // Only include selected columns
                if (includeColumns) {
                    includeColumns.forEach(column => {
                        switch(column) {
                            case 'id':
                                formattedDoctor.id = doctor.id;
                                break;
                            case 'fullName':
                                formattedDoctor.doctorName = doctor.name;
                                break;
                            case 'email':
                                formattedDoctor.email = doctor.email;
                                break;
                            case 'phone':
                                formattedDoctor.phone = doctor.phone;
                                break;
                            case 'specialization':
                                formattedDoctor.specialization = doctor.specialization;
                                break;
                            case 'licenseNumber':
                                formattedDoctor.licenseNumber = doctor.license_number;
                                break;
                            case 'department':
                                formattedDoctor.department = doctor.department;
                                break;
                            case 'active':
                                formattedDoctor.status = doctor.active ? 'Active' : 'Inactive';
                                break;
                            case 'createdAt':
                                formattedDoctor.createdAt = doctor.created_at;
                                break;
                            case 'updatedAt':
                                formattedDoctor.updatedAt = doctor.updated_at;
                                break;
                        }
                    });
                } else {
                    // Default columns if none specified
                    formattedDoctor.id = doctor.id;
                    formattedDoctor.doctorName = doctor.name;
                    formattedDoctor.email = doctor.email;
                    formattedDoctor.specialization = doctor.specialization;
                    formattedDoctor.licenseNumber = doctor.license_number;
                    formattedDoctor.department = doctor.department;
                    formattedDoctor.status = doctor.active ? 'Active' : 'Inactive';
                    formattedDoctor.createdAt = doctor.created_at;
                }
                
                return formattedDoctor;
            });
            
            // Professional Excel export options
            const doctorColumnHeaders = {
                id: 'Doctor ID',
                doctorName: 'Full Name',
                email: 'Email Address',
                phone: 'Phone Number',
                specialization: 'Specialization',
                licenseNumber: 'License Number',
                department: 'Department',
                status: 'Status',
                createdAt: 'Registration Date',
                updatedAt: 'Last Modified'
            };
            
            const doctorExportOptions = {
                columnHeaders: doctorColumnHeaders,
                sheetName: 'Doctors',
                exportTitle: 'MEDICAL STAFF MANAGEMENT\nDoctor Registry Export',
                metadata: {
                    exportType: 'doctors',
                    totalDoctors: formattedDoctors.length,
                    includePersonalData: true
                }
            };
            
            const result = await docService.exportData(formattedDoctors, 'excel', doctorExportOptions);

            if (result.success) {
                // Set appropriate headers for direct buffer response
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                const filename = `ePick-Doctors-Export-${timestamp}.xlsx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', result.excelBuffer.length);

                // Send Excel buffer directly
                return res.send(result.excelBuffer);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Export doctors Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export doctors'
            });
        }
    }

    /**
     * Get all patients
     */
    async getPatients(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Get pagination parameters from query
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20; // Much smaller default limit
            const search = req.query.search || '';

            const patientService = require('../../services/patientService');
            
            // Use search if provided, otherwise get all active patients
            let result;
            if (search) {
                result = await patientService.searchPatients(search, limit);
                // Transform search results to match expected format
                result = {
                    success: true,
                    patients: result.patients || [],
                    total: result.patients?.length || 0,
                    page: 1,
                    totalPages: 1,
                    limit
                };
            } else {
                result = await patientService.getPatients({ active: true }, page, limit);
            }

            return res.status(200).json({
                success: true,
                data: result.patients,
                pagination: {
                    totalPages: result.totalPages,
                    currentPage: result.page,
                    total: result.total,
                    limit: result.limit
                }
            });
        } catch (error) {
            console.error('Get patients error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patients'
            });
        }
    }

    /**
     * Get patient by ID
     */
    async getPatient(req, res) {
        try {
            const { permissions } = req.auth;

            if (!permissions.includes('patients.manage') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { patientId } = req.params;
            const patientService = require('../../services/patientService');
            const patient = await patientService.getPatientById(parseInt(patientId));

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: 'Patient not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: patient
            });
        } catch (error) {
            console.error('Get patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patient'
            });
        }
    }

    /**
     * Create new patient
     */
    async createPatient(req, res) {
        try {
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('patients.manage') && !permissions.includes('admin') && !permissions.includes('write.all') && !permissions.includes('system.bypass_restrictions')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const patientData = req.body;
            const patientService = require('../../services/patientService');
            const context = new AdminController()._getRequestContext(req);

            // Format patient data for service
            const formattedPatientData = {
                name: patientData.firstName && patientData.lastName 
                    ? `${patientData.firstName} ${patientData.lastName}`.trim()
                    : patientData.name,
                matriculeNational: patientData.matriculeNational,
                dateOfBirth: patientData.dateOfBirth,
                gender: patientData.gender,
                phone: patientData.phone,
                address: patientData.address,
                roomId: patientData.roomId,
                doctorId: patientData.doctorId,
                createdBy: adminId
            };

            const result = await patientService.createPatient(formattedPatientData, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create patient'
            });
        }
    }

    /**
     * Update patient
     */
    async updatePatient(req, res) {
        try {
            const { userId: adminId, permissions } = req.auth;

            if (!permissions.includes('patients.manage') && !permissions.includes('admin') && !permissions.includes('write.all') && !permissions.includes('system.bypass_restrictions')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { patientId } = req.params;
            const patientData = req.body;
            const patientService = require('../../services/patientService');
            const context = new AdminController()._getRequestContext(req);

            const result = await patientService.updatePatient(parseInt(patientId), {
                ...patientData,
                updated_by: adminId
            }, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update patient'
            });
        }
    }

    /**
     * Delete patient
     */
    async deletePatient(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            if (role !== 'admin' && role !== 'system_admin' && 
                !permissions.includes('patients.manage') && !permissions.includes('write.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { patientId } = req.params;
            const patientService = require('../../services/patientService');
            const context = new AdminController()._getRequestContext(req);

            const result = await patientService.deactivatePatient(parseInt(patientId), adminId, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Delete patient error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete patient'
            });
        }
    }

    /**
     * Get patient analysis history
     */
    async getPatientAnalyses(req, res) {
        try {
            const { permissions } = req.auth;

            if (!permissions.includes('patients.view') && !permissions.includes('patients.manage') && !permissions.includes('admin') && !permissions.includes('read.all') && !permissions.includes('system.bypass_restrictions')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { patientId } = req.params;
            const analysisService = require('../../services/analysisService');
            const analyses = await analysisService.getPatientAnalyses(parseInt(patientId));

            return res.status(200).json({
                success: true,
                data: analyses
            });
        } catch (error) {
            console.error('Get patient analyses error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve patient analyses'
            });
        }
    }

    /**
     * Export patients to CSV
     */
    async exportPatientsCsv(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('patients.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the new data export service
            const dataImportExportService = require('../../services/dataImportExportService');
            const result = await dataImportExportService.exportData({
                entityType: 'patients',
                format: 'csv',
                filters,
                userId: adminId,
                options: {
                    includePersonalData: true, // Admin export includes personal data
                    includeColumns,
                    excludeColumns
                }
            });

            if (result.success) {
                // Set appropriate headers
                const contentType = 'text/csv';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

                // Stream file to response
                const fs = require('fs');
                const fileStream = fs.createReadStream(result.filePath);
                fileStream.pipe(res);

                // Clean up file after sending
                fileStream.on('end', async () => {
                    try {
                        await fs.promises.unlink(result.filePath);
                    } catch (e) {
                        console.error('Error cleaning up export file:', e);
                    }
                });
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Export patients error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export patients'
            });
        }
    }

    /**
     * Export patients to Excel
     */
    async exportPatientsExcel(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('patients.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the professional doc service for formatted Excel export
            const docService = require('../../services/docService');
            const patientService = require('../../services/patientService');
            const cryptoService = require('../../services/cryptoService');
            
            // Get patient data - fetch all patients for export (no pagination)
            const patientResult = await patientService.getPatients({
                name: filters.search,
                active: true
            }, 1, 10000); // Large limit to get all patients
            
            if (!patientResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to retrieve patient data'
                });
            }
            
            // Helper function to calculate age
            const calculateAge = (birthDate) => {
                if (!birthDate) return null;
                const today = new Date();
                const birth = new Date(birthDate);
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                    age--;
                }
                
                return age;
            };
            
            // Helper function to safely decrypt data
            const safeDecrypt = async (encryptedText) => {
                if (!encryptedText) return '';
                
                // Check if the text looks like encrypted format (contains : separator)
                if (typeof encryptedText === 'string' && encryptedText.includes(':') && encryptedText.split(':').length === 2) {
                    try {
                        return await cryptoService.decrypt(encryptedText);
                    } catch (error) {
                        console.warn('Decryption failed, assuming plain text:', error.message);
                        return encryptedText; // Return as-is if decryption fails
                    }
                }
                
                // If it doesn't look encrypted, return as-is
                return encryptedText;
            };
            
            // Decrypt sensitive data for export
            for (const patient of patientResult.patients) {
                // Decrypt patient data
                if (patient.name) {
                    patient.name = await safeDecrypt(patient.name);
                }
                if (patient.matricule_national) {
                    patient.matricule_national = await safeDecrypt(patient.matricule_national);
                }
                if (patient.phone) {
                    patient.phone = await safeDecrypt(patient.phone);
                }
                if (patient.address) {
                    patient.address = await safeDecrypt(patient.address);
                }
                
                // Decrypt doctor data if present
                if (patient.doctor && patient.doctor.name) {
                    patient.doctor.name = await safeDecrypt(patient.doctor.name);
                }
            }
            
            // Format patient data for export
            const formattedPatients = patientResult.patients.map(patient => {
                const formattedPatient = {};
                
                // Only include selected columns
                if (includeColumns) {
                    includeColumns.forEach(column => {
                        switch(column) {
                            case 'id':
                                formattedPatient.id = patient.id;
                                break;
                            case 'fullName':
                                formattedPatient.patientName = patient.name;
                                break;
                            case 'matriculeNational':
                                formattedPatient.matriculeNational = patient.matricule_national;
                                break;
                            case 'dateOfBirth':
                                formattedPatient.dateOfBirth = patient.date_of_birth;
                                break;
                            case 'age':
                                formattedPatient.age = calculateAge(patient.date_of_birth);
                                break;
                            case 'gender':
                                formattedPatient.gender = patient.gender;
                                break;
                            case 'phone':
                                formattedPatient.phone = patient.phone;
                                break;
                            case 'address':
                                formattedPatient.address = patient.address;
                                break;
                            case 'roomNumber':
                                formattedPatient.roomNumber = patient.room?.room_number;
                                break;
                            case 'doctorName':
                                formattedPatient.doctorName = patient.doctor?.name;
                                break;
                            case 'active':
                                formattedPatient.status = patient.active ? 'Active' : 'Inactive';
                                break;
                            case 'createdAt':
                                formattedPatient.createdAt = patient.created_at;
                                break;
                            case 'updatedAt':
                                formattedPatient.updatedAt = patient.updated_at;
                                break;
                        }
                    });
                } else {
                    // Default columns if none specified
                    formattedPatient.id = patient.id;
                    formattedPatient.patientName = patient.name;
                    formattedPatient.age = calculateAge(patient.date_of_birth);
                    formattedPatient.gender = patient.gender;
                    formattedPatient.roomNumber = patient.room?.room_number;
                    formattedPatient.doctorName = patient.doctor?.name;
                    formattedPatient.status = patient.active ? 'Active' : 'Inactive';
                    formattedPatient.createdAt = patient.created_at;
                }
                
                return formattedPatient;
            });
            
            // Professional Excel export options
            const patientColumnHeaders = {
                id: 'Patient ID',
                patientName: 'Full Name',
                matriculeNational: 'National Matricule',
                dateOfBirth: 'Date of Birth',
                age: 'Age (Years)',
                gender: 'Gender',
                phone: 'Phone Number',
                address: 'Address',
                roomNumber: 'Room Number',
                doctorName: 'Assigned Doctor',
                status: 'Status',
                createdAt: 'Registration Date',
                updatedAt: 'Last Modified'
            };
            
            const patientExportOptions = {
                columnHeaders: patientColumnHeaders,
                sheetName: 'Patients',
                exportTitle: 'PATIENT MANAGEMENT SYSTEM\nPatient Registry Export',
                metadata: {
                    exportType: 'patients',
                    totalPatients: formattedPatients.length,
                    includePersonalData: true
                }
            };
            
            const result = await docService.exportData(formattedPatients, 'excel', patientExportOptions);

            if (result.success) {
                // Set appropriate headers for direct buffer response
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
                const filename = `ePick-Patients-Export-${timestamp}.xlsx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', result.excelBuffer.length);

                // Send Excel buffer directly
                return res.send(result.excelBuffer);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Export patients Excel error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export patients'
            });
        }
    }

    /**
     * Export patients to JSON
     */
    async exportPatientsJson(req, res) {
        try {
            const { userId: adminId, permissions, role } = req.auth;

            // Check permissions using new permission structure
            if (role !== 'system_admin' && !permissions.includes('patients.export') && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { password, filters = {}, includeColumns, excludeColumns } = req.body;

            // Verify password
            const passwordResult = await authService.verifyUserPassword(adminId, password);

            if (!passwordResult.success) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }

            // Use the new data export service
            const dataImportExportService = require('../../services/dataImportExportService');
            const result = await dataImportExportService.exportData({
                entityType: 'patients',
                format: 'json',
                filters,
                userId: adminId,
                options: {
                    includePersonalData: true, // Admin export includes personal data
                    includeColumns,
                    excludeColumns
                }
            });

            if (result.success) {
                // For JSON, return the data directly
                const fs = require('fs');
                const jsonData = await fs.promises.readFile(result.filePath, 'utf-8');
                const data = JSON.parse(jsonData);
                
                // Clean up file
                try {
                    await fs.promises.unlink(result.filePath);
                } catch (e) {
                    console.error('Error cleaning up export file:', e);
                }

                return res.json({
                    success: true,
                    data: data,
                    count: data.length,
                    exportDate: new Date().toISOString()
                });
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Export patients JSON error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to export patients'
            });
        }
    }

    /**
     * Get content type for format
     * @private
     */
    _getContentType(format) {
        const contentTypes = {
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json'
        };
        return contentTypes[format] || 'application/octet-stream';
    }

    /**
     * Get all doctors
     */
    async getDoctors(req, res) {
        try {
            const { permissions, role } = req.auth;

            // System admin and regular admin have full access
            if (role !== 'system_admin' && role !== 'admin' && 
                !permissions.includes('read.all') && !permissions.includes('read.users')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const doctorService = require('../../services/doctorService');
            const result = await doctorService.getDoctors({}, 1, 1000); // Get all doctors with high limit

            return res.status(200).json({
                success: true,
                data: result.doctors
            });
        } catch (error) {
            console.error('Get doctors error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve doctors'
            });
        }
    }

    /**
     * Get service users
     */
    async getServiceUsers(req, res) {
        try {
            const { permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;
            const users = await userService.getUsersByService(parseInt(serviceId));

            return res.status(200).json({
                success: true,
                data: users
            });
        } catch (error) {
            console.error('Get service users error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve service users'
            });
        }
    }

    /**
     * Get service rooms
     */
    async getServiceRooms(req, res) {
        try {
            const { permissions } = req.auth;

            if (!permissions.includes('services.view') && !permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { serviceId } = req.params;
            const roomService = require('../../services/roomService');
            const rooms = await roomService.getRoomsByService(parseInt(serviceId));

            return res.status(200).json({
                success: true,
                data: rooms
            });
        } catch (error) {
            console.error('Get service rooms error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve service rooms'
            });
        }
    }

    /**
     * Convert services to CSV
     */
    _convertServicesToCSV(services) {
        if (!services || services.length === 0) return 'No data available';


        const headers = ['ID', 'Name', 'Email', 'Active', 'Can View All Analyses', 'Users', 'Rooms', 'Created At'];
        const csvRows = [headers.join(',')];

        services.forEach(service => {
            const row = [
                service.id,
                `"${service.name}"`,
                service.email,
                service.active ? 'Yes' : 'No',
                service.canViewAllAnalyses ? 'Yes' : 'No',
                service.userCount || 0,
                service.roomCount || 0,
                new Date(service.created_at).toLocaleDateString()
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Convert rooms to CSV
     */
    _convertRoomsToCSV(rooms) {
        if (!rooms || rooms.length === 0) return 'No data available';

        const headers = ['ID', 'Room Number', 'Service', 'Service Email', 'Created By', 'Created At'];
        const csvRows = [headers.join(',')];

        rooms.forEach(room => {
            const row = [
                room.id,
                room.room_number,
                `"${room.service ? room.service.name : ''}"`,
                `"${room.service ? room.service.email : ''}"`,
                `"${room.creator ? room.creator.username : ''}"`,
                new Date(room.created_at).toLocaleDateString()
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Convert patients to CSV
     */
    _convertPatientsToCSV(patients) {
        if (!patients || patients.length === 0) return 'No data available';

        const headers = ['ID', 'Matricule', 'First Name', 'Last Name', 'Date of Birth', 'Gender', 'Phone', 'Address', 'Room', 'Doctor', 'Active', 'Created At'];
        const csvRows = [headers.join(',')];

        patients.forEach(patient => {
            const row = [
                patient.id,
                patient.matricule_national,
                `"${patient.first_name}"`,
                `"${patient.last_name}"`,
                patient.date_of_birth,
                patient.gender,
                patient.phone || '',
                `"${patient.address || ''}"`,
                patient.room_number || '',
                `"${patient.doctor_name || ''}"`,
                patient.is_active ? 'Yes' : 'No',
                new Date(patient.created_at).toLocaleDateString()
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Helper method to log export failures
     * @private
     * @param {string} format - Export format
     * @param {number} adminId - Admin user ID
     * @param {Object} context - Request context
     * @param {string} [exportType] - Type of data being exported
     */
    async _logExportFailure(format, adminId, context, exportType = 'users') {
        const logService = require('../../services/logService');
        await logService.securityLog({
            eventType: 'export.password_failed',
            severity: 'medium',
            userId: adminId,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType: exportType,
                format,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Helper method to log successful exports
     * @private
     * @param {string} format - Export format
     * @param {number} adminId - Admin user ID
     * @param {number} dataCount - Number of records exported
     * @param {Object} filters - Applied filters
     * @param {Object} context - Request context
     * @param {string} [exportType] - Type of data being exported
     */
    async _logExportSuccess(format, adminId, dataCount, filters, context, exportType = 'users') {
        const logService = require('../../services/logService');
        await logService.auditLog({
            eventType: `${exportType}.exported`,
            userId: adminId,
            targetType: exportType,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                exportType,
                format,
                dataCount,
                filters,
                userAgent: context.userAgent
            }
        });
    }



    /**
     * Create new room
     */
    async createRoom(req, res) {
        const roomController = require('./roomController');
        return roomController.createRoom(req, res);
    }

    /**
     * Update room
     */
    async updateRoom(req, res) {
        try {
            const { roomId } = req.params;
            const { roomNumber, serviceId } = req.body;
            const { userId } = req.auth;

            const roomService = require('../../services/roomService');
            const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

            const updateData = {
                roomNumber,
                serviceId: serviceId !== undefined ? (serviceId ? parseInt(serviceId) : null) : undefined,
            };

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await roomService.updateRoom(
                parseInt(roomId),
                updateData,
                userId,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update room error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update room'
            });
        }
    }



    /**
     * Get audit logs for a specific user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getUserAuditLogs(req, res) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20, eventFilter = '' } = req.query;

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            // Check if user is system admin
            const { permissions } = req.auth;
            const isSystemAdmin = permissions.includes('system.view_all_sessions') || 
                                 permissions.includes('system.access_env');

            // Build filters for audit logs
            const filters = {
                userId: parseInt(userId)
            };

            // Add event type filter if specified
            if (eventFilter) {
                filters.eventType = eventFilter;
            }

            // For non-system admins, filter to only meaningful actions
            if (!isSystemAdmin) {
                const meaningfulEvents = [
                    // Analysis events (check actual event names in your system)
                    'analysis_created',
                    'analysis_updated', 
                    'analysis_completed',
                    'analysis_postponed',
                    'analysis_cancelled',
                    'analysis_resumed',
                    'analysis.created',
                    'analysis.updated',
                    'analysis.completed',
                    'analysis.postponed',
                    'analysis.cancelled',
                    'analysis.resumed',
                    'analysis.status_changed',
                    'analysis_status_changed',
                    // Patient events
                    'patient_created',
                    'patient_updated',
                    'patient_deleted',
                    'patient.created',
                    'patient.updated',
                    'patient.deleted',
                    // Doctor events
                    'doctor_created',
                    'doctor_updated', 
                    'doctor_deleted',
                    'doctor.created',
                    'doctor.updated',
                    'doctor.deleted',
                    // Room events
                    'room_created',
                    'room_updated',
                    'room_deleted',
                    'room.created',
                    'room.updated',
                    'room.deleted',
                    // User events
                    'user_created',
                    'user_updated',
                    'user_role_changed',
                    'user_locked',
                    'user_unlocked',
                    'user.created',
                    'user.updated',
                    'user.role_changed',
                    'user.locked',
                    'user.unlocked',
                    // System events
                    'system_update_published',
                    'system.update_published'
                ];
                
                filters.meaningfulEventsOnly = meaningfulEvents;
            }

            // Get audit logs using logService
            const logService = require('../../services/logService');
            const result = await logService.getAuditLogs(filters, parseInt(page), parseInt(limit));

            // Enrich metadata with patient names for analysis-related logs
            const db = require('../../db');
            const enrichedLogs = await Promise.all(result.logs.map(async (log) => {
                let enrichedMetadata = { ...log.metadata };
                
                // For analysis-related events that have a patientId, fetch patient name
                if (log.event_type.includes('analysis') && log.metadata && log.metadata.patientId) {
                    try {
                        const patient = await db.Patient.findByPk(log.metadata.patientId, {
                            attributes: ['name']
                        });
                        
                        if (patient) {
                            enrichedMetadata.patient_name = patient.name;
                        }
                    } catch (error) {
                        console.error('Error fetching patient for audit log:', error);
                        // Continue without patient name if lookup fails
                    }
                }
                
                return {
                    ...log,
                    metadata: enrichedMetadata
                };
            }));

            // Format logs for display
            const formattedLogs = enrichedLogs.map(log => ({
                ...log,
                friendly_event_type: formatEventTypeForDisplay(log.event_type),
                friendly_details: isSystemAdmin ? null : formatDetailsForDisplay(log.event_type, log.metadata, log.target_type, log.target_id)
            }));

            return res.json({
                success: true,
                data: {
                    logs: formattedLogs,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: result.totalPages || 1,
                        totalItems: result.total || 0,
                        itemsPerPage: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get user audit logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user audit logs'
            });
        }
    }


    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }
}

module.exports = new AdminController();