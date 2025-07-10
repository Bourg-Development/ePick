// controllers/api/dataImportExportController.js
const dataImportExportService = require('../../services/dataImportExportService');
const logService = require('../../services/logService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
        }
    }
});

/**
 * Controller for data import/export operations
 */
class DataImportExportController {

    /**
     * Import data from uploaded file
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async importData(req, res) {
        try {
            const { userId, permissions, role } = req.auth;
            const { entityType } = req.params;
            const { updateExisting = false } = req.body;

            // Check permissions
            const requiredPermission = `${entityType}.import`;
            if (role !== 'system_admin' && !permissions.includes(requiredPermission) && !permissions.includes('import.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            // Determine format from file extension
            const format = this._getFormatFromFile(req.file);
            if (!format) {
                // Clean up uploaded file
                await fs.unlink(req.file.path);
                return res.status(400).json({
                    success: false,
                    message: 'Unable to determine file format'
                });
            }

            // Process import
            const result = await dataImportExportService.importData({
                entityType,
                filePath: req.file.path,
                format,
                userId,
                options: {
                    updateExisting: updateExisting === 'true' || updateExisting === true
                }
            });

            // Clean up uploaded file
            await fs.unlink(req.file.path);

            // Return appropriate response
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Import controller error:', error);
            
            // Clean up file if it exists
            if (req.file?.path) {
                try {
                    await fs.unlink(req.file.path);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }

            res.status(500).json({
                success: false,
                message: 'Import failed',
                error: error.message
            });
        }
    }

    /**
     * Export data to file
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async exportData(req, res) {
        try {
            const { userId, permissions, role } = req.auth;
            const { entityType } = req.params;
            const { format = 'csv', includePersonalData = false, ...filters } = req.query;

            // Check permissions
            const requiredPermission = `${entityType}.export`;
            if (role !== 'system_admin' && !permissions.includes(requiredPermission) && !permissions.includes('export.all')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied - insufficient permissions'
                });
            }

            // Additional check for personal data export
            if (includePersonalData === 'true' || includePersonalData === true) {
                if (role !== 'system_admin' && !permissions.includes('export.personal_data')) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied - cannot export personal data'
                    });
                }
            }

            // Process export
            const result = await dataImportExportService.exportData({
                entityType,
                format,
                filters,
                userId,
                options: {
                    includePersonalData: includePersonalData === 'true' || includePersonalData === true
                }
            });

            if (result.success) {
                // Set appropriate headers
                const contentType = this._getContentType(format);
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

                // Stream file to response
                const fileStream = require('fs').createReadStream(result.filePath);
                fileStream.pipe(res);

                // Clean up file after sending
                fileStream.on('end', async () => {
                    try {
                        await fs.unlink(result.filePath);
                    } catch (e) {
                        console.error('Error cleaning up export file:', e);
                    }
                });

            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Export controller error:', error);
            res.status(500).json({
                success: false,
                message: 'Export failed',
                error: error.message
            });
        }
    }

    /**
     * Get import template for entity type
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getImportTemplate(req, res) {
        try {
            const { entityType } = req.params;
            const { format = 'csv' } = req.query;

            // Define template structure for each entity
            const templates = {
                patients: [
                    {
                        name: 'John Doe',
                        matricule_national: '1234567890123',
                        date_of_birth: '1990-01-01',
                        gender: 'M',
                        phone: '+352 123 456 789',
                        email: 'john.doe@example.com',
                        address: '123 Main St, Luxembourg',
                        emergency_contact: 'Jane Doe: +352 987 654 321',
                        medical_history: 'No known allergies'
                    }
                ],
                doctors: [
                    {
                        full_name: 'Dr. Jane Smith',
                        email: 'jane.smith@hospital.com',
                        phone: '+352 123 456 789',
                        specialization: 'Hematology',
                        license_number: 'LU12345',
                        department: 'Laboratory Medicine'
                    }
                ],
                analyses: [
                    {
                        patient_id: '1',
                        doctor_id: '1',
                        service_id: '1',
                        analysis_date: '2024-01-01',
                        status: 'pending',
                        priority: 'normal',
                        notes: 'Routine blood work'
                    }
                ]
            };

            const template = templates[entityType];
            if (!template) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid entity type'
                });
            }

            // Generate template file
            const fileName = `${entityType}_import_template.${format}`;
            const result = await dataImportExportService.exportData({
                entityType: 'template',
                format,
                filters: {},
                userId: req.auth.userId,
                options: {
                    data: template
                }
            });

            if (result.success) {
                res.setHeader('Content-Type', this._getContentType(format));
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                
                const fileStream = require('fs').createReadStream(result.filePath);
                fileStream.pipe(res);
                
                fileStream.on('end', async () => {
                    try {
                        await fs.unlink(result.filePath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to generate template'
                });
            }

        } catch (error) {
            console.error('Template generation error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate template',
                error: error.message
            });
        }
    }

    /**
     * Get import/export history
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getHistory(req, res) {
        try {
            const { userId, permissions, role } = req.auth;
            const { type, limit = 50 } = req.query;

            // Build event type filter
            const eventTypes = [];
            if (!type || type === 'import') {
                eventTypes.push('data.import', 'data.import_failed');
            }
            if (!type || type === 'export') {
                eventTypes.push('data.export', 'data.export_failed');
            }

            // Get audit logs
            const logs = await logService.getAuditLogs({
                eventTypes,
                userId: role === 'system_admin' ? undefined : userId,
                limit: parseInt(limit)
            });

            // Transform logs for display
            const history = logs.map(log => ({
                id: log.id,
                type: log.event_type.includes('import') ? 'import' : 'export',
                status: log.event_type.includes('failed') ? 'failed' : 'success',
                entityType: log.metadata?.entityType,
                format: log.metadata?.format,
                recordCount: log.metadata?.totalRecords || log.metadata?.recordCount,
                imported: log.metadata?.imported,
                failed: log.metadata?.failed,
                skipped: log.metadata?.skipped,
                user: log.User?.username,
                timestamp: log.created_at,
                error: log.metadata?.error
            }));

            res.status(200).json({
                success: true,
                history
            });

        } catch (error) {
            console.error('History retrieval error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve history',
                error: error.message
            });
        }
    }

    /**
     * Determine format from file
     * @private
     */
    _getFormatFromFile(file) {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeTypeMap = {
            '.csv': 'csv',
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.json': 'json'
        };
        return mimeTypeMap[ext];
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
}

// Export both the controller instance and the upload middleware
const controller = new DataImportExportController();
module.exports = {
    importData: [upload.single('file'), controller.importData.bind(controller)],
    exportData: controller.exportData.bind(controller),
    getImportTemplate: controller.getImportTemplate.bind(controller),
    getHistory: controller.getHistory.bind(controller)
};