// services/docService.js - Enhanced with export functionality
const { join } = require("node:path");
const { readFileSync, existsSync } = require("node:fs");
const handlebars = require("handlebars");
const puppeteer = require('puppeteer');
const { randomUUID } = require("crypto");
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const logService = require('./logService');

class DocService {
    constructor() {
        this.templatesPath = join(__dirname, '../templates/docs');
        this.supportedFormats = ['pdf', 'html'];
        this.supportedTemplates = ['ref-code', 'user-report', 'service-summary'];

        // Register handlebars helpers
        this._registerHelpers();
    }

    /**
     * Generate a document from template
     * @param {string} templateName - Name of PDF template
     * @param {Object} data - Data to be filled into template
     * @param {string} format - Output format (pdf, html)
     * @param {Object} context - Request context for logging
     * @returns {Promise<{success: boolean, document_id?: string, buffer?: Buffer, html?: string, message?: string}>}
     */
    async getDocument(templateName, data = {}, format = 'pdf', context = {}) {
        try {
            // Validate template name
            if (!this.supportedTemplates.includes(templateName)) {
                return {
                    success: false,
                    message: `Unsupported template: ${templateName}`
                };
            }

            // Validate format
            if (!this.supportedFormats.includes(format)) {
                return {
                    success: false,
                    message: `Unsupported format: ${format}`
                };
            }

            // Check if template exists
            const templatePath = join(this.templatesPath, `${templateName}.html`);
            if (!existsSync(templatePath)) {
                return {
                    success: false,
                    message: `Template file not found: ${templateName}`
                };
            }

            // Render template with data
            const { document_id, html } = await this._renderDocTemplate(templateName, data);

            // Log document generation attempt
            await this._logDocumentGeneration({
                eventType: 'document.generation_started',
                documentId: document_id,
                templateName,
                format,
                userId: data.user_id,
                context
            });

            let result = {
                success: true,
                document_id,
                html
            };

            // Generate PDF if requested
            if (format === 'pdf') {
                const pdfBuffer = await this._generatePDFFromHTML(html);
                result.buffer = pdfBuffer;
                delete result.html; // Don't return HTML when PDF is requested
            }

            // Log successful generation
            await this._logDocumentGeneration({
                eventType: 'document.generation_completed',
                documentId: document_id,
                templateName,
                format,
                userId: data.user_id,
                context
            });

            return result;

        } catch (error) {
            console.error('Document generation error:', error);

            // Log error
            await this._logDocumentGeneration({
                eventType: 'document.generation_failed',
                templateName,
                format,
                userId: data.user_id,
                error: error.message,
                context
            });

            return {
                success: false,
                message: 'Failed to generate document'
            };
        }
    }

    // ===== NEW EXPORT FUNCTIONALITY =====

    /**
     * Export data to different formats (JSON, CSV, Excel)
     * @param {Array} data - Array of data objects to export
     * @param {string} format - Export format ('json', 'csv', 'excel')
     * @param {Object} options - Export options
     * @param {Array} [options.includeColumns] - Columns to include
     * @param {Array} [options.excludeColumns] - Columns to exclude
     * @param {Array} [options.defaultExcludedFields] - Fields excluded by default for security
     * @param {Object} [options.columnHeaders] - Custom column header mappings
     * @param {Object} [options.metadata] - Additional metadata for the export
     * @param {string} [options.sheetName] - Excel sheet name (default: 'Data')
     * @param {string} [options.exportTitle] - Title for the export document
     * @returns {Promise<Object>} Export result
     */
    async exportData(data, format = 'json', options = {}) {
        try {
            if (!Array.isArray(data)) {
                return {
                    success: false,
                    message: 'Data must be an array'
                };
            }

            // Apply column selection to data
            const formattedData = data.map(item =>
                this._applyColumnSelection(item, options)
            );

            // Generate export metadata
            const exportMetadata = {
                appliedFilters: options.appliedFilters || {},
                columnSelection: {}
            };

            if (options.includeColumns) {
                exportMetadata.columnSelection.included = options.includeColumns;
            }

            if (options.excludeColumns) {
                exportMetadata.columnSelection.excluded = options.excludeColumns;
            }

            switch (format.toLowerCase()) {
                case 'csv':
                    const csvData = this._convertDataToCSV(formattedData, options);
                    return {
                        success: true,
                        dataCount: formattedData.length,
                        ...exportMetadata,
                        csvData
                    };

                case 'excel':
                    const excelBuffer = await this._convertDataToExcel(formattedData, options);
                    return {
                        success: true,
                        dataCount: formattedData.length,
                        ...exportMetadata,
                        excelBuffer
                    };

                case 'json':
                default:
                    return {
                        success: true,
                        dataCount: formattedData.length,
                        ...exportMetadata,
                        data: formattedData
                    };
            }
        } catch (error) {
            console.error('Export data error:', error);
            return {
                success: false,
                message: 'Failed to export data'
            };
        }
    }

    /**
     * Apply column selection (include/exclude) to data
     * @private
     * @param {Object} dataItem - Data object
     * @param {Object} options - Column selection options
     * @returns {Object} Filtered data
     */
    _applyColumnSelection(dataItem, options = {}) {
        const { includeColumns, excludeColumns, defaultExcludedFields = [] } = options;

        // If includeColumns is specified, only include those columns
        if (includeColumns && includeColumns.length > 0) {
            const filteredData = {};
            for (const column of includeColumns) {
                if (dataItem.hasOwnProperty(column)) {
                    filteredData[column] = dataItem[column];
                }
            }
            return filteredData;
        }

        // Start with all data
        const filteredData = { ...dataItem };

        // Always exclude default sensitive fields unless explicitly included
        for (const field of defaultExcludedFields) {
            delete filteredData[field];
        }

        // If excludeColumns is specified, exclude additional columns
        if (excludeColumns && excludeColumns.length > 0) {
            for (const column of excludeColumns) {
                delete filteredData[column];
            }
        }

        return filteredData;
    }

    /**
     * Convert data to CSV format
     * @private
     * @param {Array} data - Array of data objects
     * @param {Object} options - CSV options
     * @returns {string} CSV data
     */
    _convertDataToCSV(data, options = {}) {
        if (data.length === 0) {
            return 'No data found';
        }

        // Get columns from the first data item
        const availableColumns = Object.keys(data[0]);
        const { columnHeaders = {} } = options;

        // Create headers array
        const headers = availableColumns.map(col => columnHeaders[col] || col);

        // Convert data to CSV rows
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const item of data) {
            const row = availableColumns.map(column => {
                const value = item[column];

                // Handle different data types
                if (value === null || value === undefined) {
                    return '';
                } else if (typeof value === 'string') {
                    // Escape quotes and wrap in quotes for CSV
                    return `"${value.replace(/"/g, '""')}"`;
                } else if (typeof value === 'boolean') {
                    return value;
                } else if (value instanceof Date) {
                    return `"${value.toISOString()}"`;
                } else {
                    return value;
                }
            });
            csvRows.push(row.join(','));
        }

        return csvRows.join('\n');
    }

    /**
     * Convert data to Excel format with branding
     * @private
     * @param {Array} data - Array of data objects
     * @param {Object} options - Excel options
     * @returns {Promise<Buffer>} Excel file buffer
     */
    async _convertDataToExcel(data, options = {}) {
        const {
            columnHeaders = {},
            sheetName = 'Data',
            exportTitle = 'DATA EXPORT REPORT',
            metadata = {}
        } = options;

        // Brand colors (ARGB format for Excel)
        const brandColors = {
            bloodRed: 'FFE63946',
            darkRed: 'FFC1121F',
            textBlack: 'FF333333',
            offWhite: 'FFF9F9F9',
            lightGray: 'FFE6E6E6',
            mediumGray: 'FF666666',
            white: 'FFFFFFFF'
        };

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ePick Management System';
        workbook.lastModifiedBy = 'ePick Management System';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.company = 'Fondation Servior';

        if (data.length === 0) {
            const worksheet = workbook.addWorksheet(sheetName);
            worksheet.addRow(['No data found']);
            const messageCell = worksheet.getCell('A1');
            messageCell.font = { bold: true, color: { argb: brandColors.mediumGray } };
            messageCell.alignment = { horizontal: 'center' };
            return await workbook.xlsx.writeBuffer();
        }

        // Get columns from first data item
        const availableColumns = Object.keys(data[0]);

        // Create main worksheet
        const worksheet = workbook.addWorksheet(sheetName);

        // Add logo if available
        await this._addLogoToWorksheet(worksheet, 150, 75, 1, 0.1);

        // Add title section
        worksheet.mergeCells('B1:F3');
        const titleCell = worksheet.getCell('B1');
        titleCell.value = exportTitle;
        titleCell.font = {
            bold: true,
            size: 16,
            color: { argb: brandColors.darkRed }
        };
        titleCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true
        };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: brandColors.offWhite }
        };
        titleCell.border = {
            top: { style: 'thick', color: { argb: brandColors.bloodRed } },
            left: { style: 'thick', color: { argb: brandColors.bloodRed } },
            bottom: { style: 'thick', color: { argb: brandColors.bloodRed } },
            right: { style: 'thick', color: { argb: brandColors.bloodRed } }
        };

        // Add export metadata
        const exportDate = new Date().toLocaleString();
        const totalRecords = data.length;

        worksheet.getCell('G1').value = 'Export Date:';
        worksheet.getCell('H1').value = exportDate;
        worksheet.getCell('G2').value = 'Total Records:';
        worksheet.getCell('H2').value = totalRecords;
        worksheet.getCell('G3').value = 'Generated By:';
        worksheet.getCell('H3').value = 'ePick System';

        // Style metadata cells
        ['G1', 'G2', 'G3'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.font = { bold: true, color: { argb: brandColors.textBlack } };
        });
        ['H1', 'H2', 'H3'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.font = { color: { argb: brandColors.textBlack } };
        });

        // Set header row
        const headerRowIndex = 5;
        this._setExcelColumnWidths(worksheet, availableColumns);

        // Add headers
        const headerRow = worksheet.getRow(headerRowIndex);
        availableColumns.forEach((col, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = columnHeaders[col] || col;

            cell.font = {
                bold: true,
                color: { argb: brandColors.white },
                size: 11
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: brandColors.darkRed }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: brandColors.bloodRed } },
                left: { style: 'thin', color: { argb: brandColors.bloodRed } },
                bottom: { style: 'thin', color: { argb: brandColors.bloodRed } },
                right: { style: 'thin', color: { argb: brandColors.bloodRed } }
            };
            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle',
                wrapText: true
            };
        });

        headerRow.height = 25;

        // Add data rows
        data.forEach((item, rowIndex) => {
            const dataRowIndex = headerRowIndex + 1 + rowIndex;
            const row = worksheet.getRow(dataRowIndex);

            availableColumns.forEach((column, colIndex) => {
                const cell = row.getCell(colIndex + 1);
                const value = item[column];

                // Handle different data types
                if (value === null || value === undefined) {
                    cell.value = '';
                } else if (typeof value === 'string') {
                    cell.value = value;
                } else if (typeof value === 'boolean') {
                    cell.value = value ? 'Yes' : 'No';
                } else if (value instanceof Date) {
                    cell.value = value;
                } else if (typeof value === 'number') {
                    cell.value = value;
                } else {
                    cell.value = String(value);
                }

                // Style data cell
                cell.alignment = { vertical: 'middle' };

                // Alternate row colors
                if (rowIndex % 2 === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: brandColors.offWhite }
                    };
                }

                // Add borders
                cell.border = {
                    top: { style: 'thin', color: { argb: brandColors.lightGray } },
                    left: { style: 'thin', color: { argb: brandColors.lightGray } },
                    bottom: { style: 'thin', color: { argb: brandColors.lightGray } },
                    right: { style: 'thin', color: { argb: brandColors.lightGray } }
                };

                // Format dates
                if (value instanceof Date) {
                    cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
                }

                // Format boolean values
                if (cell.value === 'Yes') {
                    cell.font = { color: { argb: brandColors.darkRed }, bold: true };
                } else if (cell.value === 'No') {
                    cell.font = { color: { argb: brandColors.mediumGray } };
                }
            });

            row.height = 20;
        });

        // Add freeze panes
        worksheet.views = [
            { state: 'frozen', ySplit: headerRowIndex }
        ];

        // Create metadata worksheet
        const metadataWorksheet = workbook.addWorksheet('Export Info');
        await this._addLogoToWorksheet(metadataWorksheet, 100, 50, 0.1, 0.1);

        // Add metadata title
        metadataWorksheet.mergeCells('A1:C2');
        const metaTitleCell = metadataWorksheet.getCell('A1');
        metaTitleCell.value = 'EXPORT INFORMATION';
        metaTitleCell.font = {
            bold: true,
            size: 14,
            color: { argb: brandColors.darkRed }
        };
        metaTitleCell.alignment = {
            horizontal: 'center',
            vertical: 'middle'
        };
        metaTitleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: brandColors.offWhite }
        };

        // Add metadata information
        const metadataData = [
            ['Property', 'Value', 'Description'],
            ['Export Date', new Date().toISOString(), 'When this export was generated'],
            ['Total Records', data.length, 'Number of records exported'],
            ['Columns Exported', availableColumns.length, 'Number of data columns included'],
            ['Format Version', '2.0', 'Export format version'],
            ['Generated By', 'ePick Management System', 'System that generated this export'],
            ['', '', ''],
            ['Column Reference', '', ''],
            ...availableColumns.map(col => [col, columnHeaders[col] || col, 'Data field'])
        ];

        // Set column widths for metadata
        metadataWorksheet.getColumn(1).width = 25;
        metadataWorksheet.getColumn(2).width = 30;
        metadataWorksheet.getColumn(3).width = 40;

        // Add metadata rows
        metadataData.forEach((rowData, index) => {
            const actualRowIndex = 4 + index;
            const row = metadataWorksheet.getRow(actualRowIndex);

            row.getCell(1).value = rowData[0];
            row.getCell(2).value = rowData[1];
            row.getCell(3).value = rowData[2];

            if (index === 0) {
                // Header row
                row.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: brandColors.white } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: brandColors.darkRed }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: brandColors.bloodRed } },
                        left: { style: 'thin', color: { argb: brandColors.bloodRed } },
                        bottom: { style: 'thin', color: { argb: brandColors.bloodRed } },
                        right: { style: 'thin', color: { argb: brandColors.bloodRed } }
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                row.height = 25;
            } else if (index === 7) {
                // Section header
                row.getCell(1).font = { bold: true, color: { argb: brandColors.darkRed }, size: 12 };
            } else if (index > 0 && rowData[0] !== '') {
                // Data rows
                if ((index - 1) % 2 === 0) {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: brandColors.offWhite }
                        };
                    });
                }

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: brandColors.lightGray } },
                        left: { style: 'thin', color: { argb: brandColors.lightGray } },
                        bottom: { style: 'thin', color: { argb: brandColors.lightGray } },
                        right: { style: 'thin', color: { argb: brandColors.lightGray } }
                    };
                    cell.alignment = { vertical: 'middle' };
                });

                row.height = 20;
            }
        });

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Set column widths for Excel worksheet
     * @private
     * @param {Object} worksheet - ExcelJS worksheet
     * @param {Array} columns - Column keys
     */
    _setExcelColumnWidths(worksheet, columns) {
        columns.forEach((col, index) => {
            const columnIndex = index + 1;
            const column = worksheet.getColumn(columnIndex);

            // Default width based on column name/type
            let width = 15;

            // Customize based on your data types
            if (col.includes('id') || col.includes('Id')) {
                width = 10;
            } else if (col.includes('email') || col.includes('Email')) {
                width = 28;
            } else if (col.includes('name') || col.includes('Name')) {
                width = 20;
            } else if (col.includes('date') || col.includes('Date') || col.includes('At')) {
                width = 22;
            } else if (col.includes('ip') || col.includes('IP')) {
                width = 18;
            } else if (typeof col === 'string' && (col.includes('enabled') || col.includes('locked') || col.includes('active'))) {
                width = 14;
            }

            column.width = Math.min(width, 50); // Max 50 to prevent overly wide columns
        });
    }

    /**
     * Add logo to Excel worksheet
     * @private
     * @param {Object} worksheet - ExcelJS worksheet
     * @param {number} width - Logo width
     * @param {number} height - Logo height
     * @param {number} col - Column position
     * @param {number} row - Row position
     */
    async _addLogoToWorksheet(worksheet, width, height, col, row) {
        try {
            // Try different possible paths for the logo
            const possiblePaths = [
                path.join(__dirname, '..', 'public', 'media', 'logos', 'primary-logo.png'),
                path.join(__dirname, '..', 'assets', 'logo.png'),
                path.join(__dirname, '..', 'public', 'logo.png'),
                path.join(__dirname, '..', 'public', 'media', 'logo.png')
            ];

            let logoPath;
            for (const testPath of possiblePaths) {
                if (fs.existsSync(testPath)) {
                    logoPath = testPath;
                    break;
                }
            }

            if (!logoPath) {
                console.warn('Logo file not found at expected locations:', possiblePaths);
                return;
            }

            const logoBuffer = fs.readFileSync(logoPath);
            const imageId = worksheet.workbook.addImage({
                buffer: logoBuffer,
                extension: 'png'
            });

            worksheet.addImage(imageId, {
                tl: { col: col, row: row },
                ext: { width: width, height: height },
                editAs: 'oneCell'
            });

            console.log('Logo added successfully to Excel export from:', logoPath);

        } catch (error) {
            console.error('Error adding logo to Excel worksheet:', error);
            // Continue without logo if there's an issue
        }
    }

    // ===== END NEW EXPORT FUNCTIONALITY =====

    /**
     * Generate PDF Buffer from html code
     * @param {string} html - HTML code to be parsed to PDF
     * @returns {Promise<Buffer>} PDF Buffer generated from html
     * @private
     */
    async _generatePDFFromHTML(html) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Set content and wait for it to be fully loaded
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });

            // Generate PDF with proper settings
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm',
                },
                preferCSSPageSize: true
            });

            return pdfBuffer;

        } catch (error) {
            console.error('PDF generation error:', error);
            throw new Error('Failed to generate PDF');
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Get HTML template with data filled in
     * @param {string} templateName - Name of template
     * @param {Object} data - Data to be filled in
     * @returns {Promise<{document_id: string, html: string}>}
     * @private
     */
    async _renderDocTemplate(templateName, data = {}) {
        try {
            // Generate document metadata
            const currentDate = new Date().toLocaleDateString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const documentId = randomUUID();

            // Load and compile template
            const templateSource = this._loadDocTemplate(templateName);

            // Prepare template data
            const templateData = {
                ...data,
                currentDate,
                documentId,
                // Add some default values
                user_name: data.user_name || 'ePick Administration',
                user_role: data.user_role || 'System Administrator'
            };

            // Compile template with data
            let html = templateSource(templateData);

            // Handle special cases
            if (templateName === 'ref-code' && data.referenceCode) {
                html = await this._processRefCodeTemplate(html, data.referenceCode);
            }

            return {
                document_id: documentId,
                html
            };

        } catch (error) {
            console.error('Template rendering error:', error);
            throw new Error('Failed to render template');
        }
    }

    /**
     * Load and compile PDF template by name
     * @param {string} templateName - Name of template
     * @returns {HandlebarsTemplateDelegate} Compiled template
     * @private
     */
    _loadDocTemplate(templateName) {
        try {
            const templatePath = join(this.templatesPath, `${templateName}.html`);
            const templateSource = readFileSync(templatePath, 'utf-8');
            return handlebars.compile(templateSource);
        } catch (error) {
            console.error('Template loading error:', error);
            throw new Error(`Failed to load template: ${templateName}`);
        }
    }

    /**
     * Process ref-code template to inject QR code
     * @param {string} html - HTML content
     * @param {string} referenceCode - Reference code for QR generation
     * @returns {Promise<string>} Processed HTML
     * @private
     */
    async _processRefCodeTemplate(html, referenceCode) {
        try {
            // Generate QR code as data URL
            const qrCodeDataUrl = await QRCode.toDataURL(
                `https://epick.fondation.lu/auth/register?refCode=${referenceCode}`,
                {
                    width: 110,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    },
                    errorCorrectionLevel: 'H'
                }
            );

            // Replace QR code placeholder with actual QR code
            const qrCodeImg = `<img src="${qrCodeDataUrl}" width="110" height="110" alt="QR Code for ${referenceCode}" style="display: block; margin: 0 auto;">`;

            // Replace the QR code container content
            html = html.replace(
                /<div class="qr-code"[^>]*>.*?<\/div>/s,
                `<div class="qr-code">${qrCodeImg}</div>`
            );

            // Remove the JavaScript since we're embedding the QR code directly
            html = html.replace(/<script>[\s\S]*?<\/script>/g, '');

            return html;

        } catch (error) {
            console.error('QR code generation error:', error);
            // Return original HTML if QR code generation fails
            return html;
        }
    }

    /**
     * Register handlebars helpers
     * @private
     */
    _registerHelpers() {
        // Date formatting helper
        handlebars.registerHelper('formatDate', function(date, format) {
            if (!date) return '';

            const d = new Date(date);
            switch (format) {
                case 'short':
                    return d.toLocaleDateString('en-GB');
                case 'long':
                    return d.toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                case 'datetime':
                    return d.toLocaleString('en-GB');
                default:
                    return d.toLocaleDateString('en-GB');
            }
        });

        // Uppercase helper
        handlebars.registerHelper('uppercase', function(str) {
            return str ? str.toString().toUpperCase() : '';
        });

        // Conditional helper
        handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        });

        // Number formatting helper
        handlebars.registerHelper('formatNumber', function(num) {
            return num ? num.toLocaleString() : '0';
        });
    }

    /**
     * Get list of available templates
     * @returns {Array<{name: string, description: string}>}
     */
    getAvailableTemplates() {
        return [
            {
                name: 'ref-code',
                description: 'Reference code document for user registration',
                requiredFields: ['referenceCode', 'user_name', 'user_role']
            },
            {
                name: 'user-report',
                description: 'User activity and information report',
                requiredFields: ['username', 'fullName', 'role', 'service']
            },
            {
                name: 'service-summary',
                description: 'Service summary and statistics report',
                requiredFields: ['serviceName', 'statistics']
            }
        ];
    }

    /**
     * Validate template data
     * @param {string} templateName - Name of template
     * @param {Object} data - Data to validate
     * @returns {{valid: boolean, missing?: Array<string>}}
     */
    validateTemplateData(templateName, data) {
        const templates = this.getAvailableTemplates();
        const template = templates.find(t => t.name === templateName);

        if (!template) {
            return { valid: false, missing: [`Template '${templateName}' not found`] };
        }

        const missing = template.requiredFields.filter(field =>
            !data.hasOwnProperty(field) || data[field] === null || data[field] === undefined
        );

        return {
            valid: missing.length === 0,
            missing: missing.length > 0 ? missing : undefined
        };
    }

    /**
     * Log document generation events
     * @param {Object} logData - Log data
     * @private
     */
    async _logDocumentGeneration(logData) {
        try {
            const { eventType, documentId, templateName, format, userId, error, context } = logData;

            if (eventType.includes('failed')) {
                await logService.securityLog({
                    eventType,
                    severity: 'medium',
                    userId,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        documentId,
                        templateName,
                        format,
                        error,
                        userAgent: context.userAgent
                    }
                });
            } else {
                await logService.auditLog({
                    eventType,
                    userId,
                    targetType: 'document',
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        documentId,
                        templateName,
                        format,
                        userAgent: context.userAgent
                    }
                });
            }
        } catch (error) {
            console.error('Document logging error:', error);
            // Don't throw - logging should not break document generation
        }
    }
}

module.exports = new DocService();