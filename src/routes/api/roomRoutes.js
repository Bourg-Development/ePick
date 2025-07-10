// routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomController = require('../../controllers/api/roomController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');
const { generalRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All room routes require authentication
 */
router.use(authMiddleware.authenticate);

// Get rooms with filtering and pagination
router.get('/',
    generalRateLimit,
    validation.validateRoomFilters,
    requirePermission('rooms.view'),
    roomController.getRooms
);

// Get specific room by ID
router.get('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('rooms.view'),
    roomController.getRoomById
);

// Create new room
router.post('/',
    generalRateLimit,
    validation.validateRoomCreate,
    requirePermission('rooms.create'),
    roomController.createRoom
);

// Update room
router.put('/:id',
    generalRateLimit,
    validation.validateId,
    validation.validateRoomUpdate,
    requirePermission('rooms.update'),
    roomController.updateRoom
);

// Deactivate room (soft delete)
router.delete('/:id',
    generalRateLimit,
    validation.validateId,
    requirePermission('rooms.delete'),
    roomController.deactivateRoom
);

// Reactivate room
router.post('/:id/reactivate',
    generalRateLimit,
    validation.validateId,
    requirePermission('rooms.update'),
    roomController.reactivateRoom
);

// Get room occupancy report
router.get('/reports/occupancy',
    generalRateLimit,
    validation.validateServiceFilter,
    requirePermission('rooms.view'),
    roomController.getRoomOccupancyReport
);

// Search rooms
router.get('/search/:term',
    generalRateLimit,
    validation.validateSearchTerm,
    requirePermission('rooms.view'),
    roomController.searchRooms
);

// Get available rooms
router.get('/filters/available',
    generalRateLimit,
    validation.validateServiceFilter,
    requirePermission('rooms.view'),
    roomController.getAvailableRooms
);

// Get services list (replaces departments)
router.get('/filters/services',
    generalRateLimit,
    requirePermission('rooms.view'),
    roomController.getServices
);

module.exports = router;