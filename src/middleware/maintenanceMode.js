// middleware/maintenanceMode.js
const fs = require('fs');
const path = require('path');
const tokenService = require('../services/tokenService');

/**
 * Middleware to check for maintenance mode
 * Blocks all non-system-admin users when maintenance mode is active
 */
const checkMaintenanceMode = async (req, res, next) => {
    try {
        const maintenanceFile = path.join(process.cwd(), '.maintenance');
        
        // Check if maintenance file exists
        if (fs.existsSync(maintenanceFile)) {
            // Try to extract user role from token
            let userRole = null;
            try {
                const token = req.cookies.accessToken;
                if (token) {
                    const decoded = await tokenService.verifyToken(token, 'access');
                    userRole = decoded.role;
                }
            } catch (error) {
                // Token invalid or missing, user is not authenticated
                userRole = null;
            }
            
            // Allow system admins to bypass maintenance mode
            if (userRole === 'system_admin') {
                return next();
            }
            
            // Allow token refresh for all users (needed for system admin auth)
            if (req.path.includes('/api/auth/refresh-token')) {
                return next();
            }
            
            // Block all other users - show maintenance page
            try {
                const maintenanceData = JSON.parse(fs.readFileSync(maintenanceFile, 'utf8'));
                const message = maintenanceData.message || 'System is currently under maintenance. Please try again later.';
                const enabledBy = maintenanceData.enabledBy || 'System Administrator';
                const enabledAt = maintenanceData.enabledAt || new Date().toISOString();
                
                // If it's an API request, return JSON
                if (req.path.startsWith('/api/')) {
                    return res.status(503).json({
                        success: false,
                        error: 'Service Unavailable',
                        message: message,
                        maintenanceMode: true
                    });
                }
                
                // For web requests, render maintenance page
                return res.status(503).render('errors/maintenance', {
                    title: 'Under Maintenance',
                    message: message,
                    enabledBy: enabledBy,
                    enabledAt: new Date(enabledAt).toLocaleString(),
                    layout: false // Don't use any layout
                });
            } catch (error) {
                // If maintenance file is corrupted, show default message
                if (req.path.startsWith('/api/')) {
                    return res.status(503).json({
                        success: false,
                        error: 'Service Unavailable',
                        message: 'System is currently under maintenance.',
                        maintenanceMode: true
                    });
                }
                
                return res.status(503).render('errors/maintenance', {
                    title: 'Under Maintenance',
                    message: 'System is currently under maintenance. Please try again later.',
                    enabledBy: 'System Administrator',
                    enabledAt: new Date().toLocaleString(),
                    layout: false // Don't use any layout
                });
            }
        }
        
        // No maintenance mode, continue normally
        next();
    } catch (error) {
        console.error('Maintenance mode check error:', error);
        // If there's an error checking maintenance mode, allow request to continue
        next();
    }
};

module.exports = {
    checkMaintenanceMode
};