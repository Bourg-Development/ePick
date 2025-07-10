// controllers/docController.js
const docService = require('../../services/docService');
const userService = require('../../services/userService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Controller for document generation operations
 */
class DocController {
    constructor() {
        // Bind methods to maintain context
        this.generateDocument = this.generateDocument.bind(this);
        this.getTemplates = this.getTemplates.bind(this);
        this.previewDocument = this.previewDocument.bind(this);
        this.validateTemplate = this.validateTemplate.bind(this);
        this._getRequestContext = this._getRequestContext.bind(this);
        this._formatRole = this._formatRole.bind(this);
    }

    /**
     * Generate a document from template
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async generateDocument(req, res) {
        try {
            const { userId } = req.auth;
            const { data: userData } = await userService.getUserById(userId);
            const { templateName, data, format = 'pdf' } = req.body;
            // Validate required fields
            if (!templateName) {
                console.log(1)
                return res.status(400).json({
                    success: false,
                    message: 'Template name is required'
                });
            }

            if (!data || typeof data !== 'object') {
                console.log(2)
                return res.status(400).json({
                    success: false,
                    message: 'Template data is required and must be an object'
                });
            }

            // Add user ID to template data
            const templateData = {
                ...data,
                user_name: userData.full_name,
                user_role: this._formatRole(userData.role?.name),
                user_id: userId
            };

            // Validate template data
            const validation = docService.validateTemplateData(templateName, {
                ...data,
                ...templateData
            });

            if (!validation.valid) {
                console.log(templateData)
                console.log(data)
                console.log(3)
                return res.status(400).json({
                    success: false,
                    message: 'Missing required template fields',
                    missing: validation.missing
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);




            // Generate document
            const result = await docService.getDocument(templateName, templateData, format, context);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Return appropriate response based on format
            if (format === 'pdf') {
                res.set({
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${templateName}-${result.document_id}.pdf"`,
                    'Content-Length': result.buffer.length
                });
                return res.send(result.buffer);
            } else if (format === 'html') {
                return res.status(200).json({
                    success: true,
                    document_id: result.document_id,
                    html: result.html
                });
            }

        } catch (error) {
            console.error('Generate document error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate document'
            });
        }
    }

    /**
     * Get available templates
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getTemplates(req, res) {
        try {
            const templates = docService.getAvailableTemplates();

            return res.status(200).json({
                success: true,
                templates
            });

        } catch (error) {
            console.error('Get templates error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve templates'
            });
        }
    }

    /**
     * Preview document template (returns HTML only)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async previewDocument(req, res) {
        try {
            const { userId } = req.auth;
            const { templateName, data } = req.body;

            // Validate required fields
            if (!templateName) {
                return res.status(400).json({
                    success: false,
                    message: 'Template name is required'
                });
            }

            if (!data || typeof data !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Template data is required and must be an object'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Add user ID to template data
            const templateData = {
                ...data,
                user_id: userId
            };

            // Generate HTML preview
            const result = await docService.getDocument(templateName, templateData, 'html', context);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                document_id: result.document_id,
                html: result.html
            });

        } catch (error) {
            console.error('Preview document error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to preview document'
            });
        }
    }



    /**
     * Validate template data without generating document
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async validateTemplate(req, res) {
        try {
            const { templateName, data } = req.body;

            // Validate required fields
            if (!templateName) {
                return res.status(400).json({
                    success: false,
                    message: 'Template name is required'
                });
            }

            if (!data || typeof data !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Template data is required and must be an object'
                });
            }

            // Validate template data
            const validation = docService.validateTemplateData(templateName, data);

            return res.status(200).json({
                success: true,
                valid: validation.valid,
                missing: validation.missing || []
            });

        } catch (error) {
            console.error('Validate template error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to validate template'
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
    /**
     * Format role name for display in signature
     * @private
     * @param {string} roleName - Raw role name
     * @returns {string} Formatted role name
     */
    _formatRole(roleName) {
        if (!roleName) return 'Team Member';

        // Replace underscores with spaces and capitalize first letter of each word
        return roleName
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}

module.exports = new DocController();