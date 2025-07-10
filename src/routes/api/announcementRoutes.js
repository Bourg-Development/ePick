// routes/api/announcementRoutes.js
const express = require('express');
const router = express.Router();
const announcementController = require('../../controllers/api/announcementController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit, settingsRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All announcement routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get announcements for current user
router.get('/user',
    generalRateLimit,
    announcementController.getUserAnnouncements
);

// Mark announcement as viewed
router.post('/:id/view',
    generalRateLimit,
    validation.validateId,
    announcementController.markAsViewed
);

// Acknowledge an announcement
router.post('/:id/acknowledge',
    generalRateLimit,
    validation.validateId,
    announcementController.acknowledgeAnnouncement
);

// ===== ADMIN ROUTES =====

// Get all announcements (admin only)
router.get('/admin/all',
    generalRateLimit,
    requirePermission(['system.manage_announcements', 'write.all']),
    announcementController.getAllAnnouncements
);

// Create new announcement (admin only)
router.post('/admin',
    settingsRateLimit,
    requirePermission(['system.manage_announcements', 'write.all']),
    validation.validateAnnouncementCreate,
    announcementController.createAnnouncement
);

// Update announcement (admin only)
router.put('/admin/:id',
    settingsRateLimit,
    validation.validateId,
    requirePermission(['system.manage_announcements', 'write.all']),
    validation.validateAnnouncementUpdate,
    announcementController.updateAnnouncement
);

// Delete announcement (admin only)
router.delete('/admin/:id',
    settingsRateLimit,
    validation.validateId,
    requirePermission(['system.manage_announcements', 'write.all']),
    announcementController.deleteAnnouncement
);

// Get announcement statistics (admin only)
router.get('/admin/stats',
    generalRateLimit,
    requirePermission(['system.manage_announcements', 'read.all']),
    announcementController.getAnnouncementStats
);

module.exports = router;