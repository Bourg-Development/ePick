module.exports = {
    analyses: (req, res) => {
        res.render('dashboard/analyses', {title: 'Analyses - ePick', styles: [ '/pages/restricted/dashboard/analyses.css' ], scripts: [ '/pages/restricted/dashboard/analyses.js' ] });
    },
    users: (req, res) => {
        res.render('dashboard/users', {title: 'User Management - ePick', styles: [ '/pages/restricted/dashboard/users.css' ], scripts: [ '/pages/restricted/dashboard/users.js' ] });
    },
    org_settings: (req, res) => {
        res.render('dashboard/org-settings', {title: 'Organization Settings - ePick', styles: [ '/pages/restricted/dashboard/org-settings.css' ], scripts: [ '/pages/restricted/dashboard/org-settings.js' ] });
    },
    archive: (req, res) => {
        res.render('dashboard/archive', {title: 'Analysis Archive - ePick', styles: [ '/pages/restricted/dashboard/archive.css' ], scripts: [ '/pages/restricted/dashboard/archive.js' ] });
    },
    rooms: (req, res) => {
        res.render('dashboard/rooms', {title: 'Room Management - ePick', styles: [ '/pages/restricted/dashboard/rooms.css' ], scripts: [ '/pages/restricted/dashboard/rooms.js' ] });
    },
    services: (req, res) => {
        res.render('dashboard/services', {title: 'Service Management - ePick', styles: [ '/pages/restricted/dashboard/services.css' ], scripts: [ '/pages/restricted/dashboard/services.js' ] });
    },
    patients: (req, res) => {
        res.render('dashboard/patients', {title: 'Patient Management - ePick', styles: [ '/pages/restricted/dashboard/patients.css' ], scripts: [ '/pages/restricted/dashboard/patients.js' ] });
    },
    security: (req, res) => {
        // Check if user has forensics permissions
        if (req.auth.role !== 'system_admin' && !req.auth.permissions.includes('forensics.dashboard')) {
            return res.status(403).render('errors/unauthorized', {
                title: 'Access Denied',
                message: 'You do not have permission to access the security dashboard.'
            });
        }
        
        res.render('dashboard/security', {
            title: 'Security & Forensics Dashboard', 
            styles: [ '/pages/restricted/dashboard/security.css' ], 
            scripts: [ '/pages/restricted/dashboard/security.js' ]
        });
    }
}