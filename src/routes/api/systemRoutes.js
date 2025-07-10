const express = require('express');
const router = express.Router();
const versionService = require('../../services/versionService');

/**
 * Get system version information
 */
router.get('/version', async (req, res) => {
    try {
        const versionInfo = await versionService.getVersionInfo();
        
        res.json({
            success: true,
            data: versionInfo
        });
    } catch (error) {
        console.error('Error getting version info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get version information',
            error: error.message
        });
    }
});

module.exports = router;