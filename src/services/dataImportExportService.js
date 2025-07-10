// services/dataImportExportService.js
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const db = require('../db');
const { Op } = require('sequelize');
const cryptoService = require('./cryptoService');
const logService = require('./logService');

/**
 * Service for handling data import and export operations
 */
class DataImportExportService {
    constructor() {
        this.supportedFormats = ['csv', 'excel', 'json'];
        this.importBatchSize = 100; // Process imports in batches
    }

    /**
     * Import data from a file
     * @param {Object} params - Import parameters
     * @returns {Object} Import results
     */
    async importData(params) {
        const {
            entityType,
            filePath,
            format,
            userId,
            options = {}
        } = params;

        try {
            // Validate parameters
            if (!this.supportedFormats.includes(format)) {
                throw new Error(`Unsupported format: ${format}`);
            }

            // Read and parse file based on format
            let data;
            switch (format) {
                case 'csv':
                    data = await this._parseCSV(filePath);
                    break;
                case 'excel':
                    data = await this._parseExcel(filePath);
                    break;
                case 'json':
                    data = await this._parseJSON(filePath);
                    break;
            }

            // Validate data structure
            const validationResult = await this._validateImportData(entityType, data);
            if (!validationResult.valid) {
                return {
                    success: false,
                    errors: validationResult.errors,
                    message: 'Validation failed'
                };
            }

            // Process import based on entity type
            let importResult;
            switch (entityType) {
                case 'patients':
                    importResult = await this._importPatients(data, userId, options);
                    break;
                case 'doctors':
                    importResult = await this._importDoctors(data, userId, options);
                    break;
                case 'analyses':
                    importResult = await this._importAnalyses(data, userId, options);
                    break;
                default:
                    throw new Error(`Unsupported entity type: ${entityType}`);
            }

            // Log import activity
            await logService.auditLog({
                eventType: 'data.import',
                userId,
                metadata: {
                    entityType,
                    format,
                    totalRecords: data.length,
                    imported: importResult.imported,
                    failed: importResult.failed,
                    skipped: importResult.skipped
                }
            });

            return {
                success: true,
                ...importResult
            };

        } catch (error) {
            console.error('Data import error:', error);
            await logService.auditLog({
                eventType: 'data.import_failed',
                userId,
                metadata: {
                    entityType,
                    format,
                    error: error.message
                }
            });

            return {
                success: false,
                message: 'Import failed',
                error: error.message
            };
        }
    }

    /**
     * Export data to a file
     * @param {Object} params - Export parameters
     * @returns {Object} Export results with file path
     */
    async exportData(params) {
        const {
            entityType,
            format,
            filters = {},
            userId,
            options = {}
        } = params;

        try {
            // Validate parameters
            if (!this.supportedFormats.includes(format)) {
                throw new Error(`Unsupported format: ${format}`);
            }

            // Fetch data based on entity type
            let data;
            switch (entityType) {
                case 'patients':
                    data = await this._fetchPatients(filters, options);
                    break;
                case 'doctors':
                    data = await this._fetchDoctors(filters, options);
                    break;
                case 'analyses':
                    data = await this._fetchAnalyses(filters, options);
                    break;
                case 'template':
                    data = options.data || [];
                    break;
                default:
                    throw new Error(`Unsupported entity type: ${entityType}`);
            }

            // Generate export file
            const fileExtension = format === 'excel' ? 'xlsx' : format;
            const fileName = `${entityType}_export_${Date.now()}.${fileExtension}`;
            const exportPath = path.join(process.cwd(), 'exports', fileName);
            
            // Ensure exports directory exists
            await fs.mkdir(path.dirname(exportPath), { recursive: true });

            // Export based on format
            switch (format) {
                case 'csv':
                    await this._exportToCSV(data, exportPath, options);
                    break;
                case 'excel':
                    await this._exportToExcel(data, exportPath, entityType, options);
                    break;
                case 'json':
                    await this._exportToJSON(data, exportPath, options);
                    break;
            }

            // Log export activity
            await logService.auditLog({
                eventType: 'data.export',
                userId,
                metadata: {
                    entityType,
                    format,
                    recordCount: data.length,
                    filters
                }
            });

            return {
                success: true,
                filePath: exportPath,
                fileName,
                recordCount: data.length
            };

        } catch (error) {
            console.error('Data export error:', error);
            await logService.auditLog({
                eventType: 'data.export_failed',
                userId,
                metadata: {
                    entityType,
                    format,
                    error: error.message
                }
            });

            return {
                success: false,
                message: 'Export failed',
                error: error.message
            };
        }
    }

    /**
     * Parse CSV file
     * @private
     */
    async _parseCSV(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        return parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
    }

    /**
     * Parse Excel file
     * @private
     */
    async _parseExcel(filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const worksheet = workbook.worksheets[0];
        const data = [];
        
        let headers = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                headers = row.values.slice(1); // Excel rows are 1-indexed with empty first element
            } else {
                const rowData = {};
                row.values.slice(1).forEach((value, index) => {
                    rowData[headers[index]] = value;
                });
                data.push(rowData);
            }
        });
        
        return data;
    }

    /**
     * Parse JSON file
     * @private
     */
    async _parseJSON(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * Validate import data
     * @private
     */
    async _validateImportData(entityType, data) {
        const errors = [];
        const warnings = [];
        const requiredFields = this._getRequiredFields(entityType);
        const duplicates = new Set();

        // Check if data is array
        if (!Array.isArray(data)) {
            return {
                valid: false,
                errors: ['Data must be an array of records']
            };
        }

        // Check for empty data
        if (data.length === 0) {
            return {
                valid: false,
                errors: ['No data records found in file']
            };
        }

        // Check for maximum records limit
        if (data.length > 10000) {
            errors.push('File contains too many records. Maximum allowed is 10,000 per import.');
        }

        // Track unique identifiers for duplicate detection
        const uniqueIdentifiers = new Map();

        // Validate each record
        data.forEach((record, index) => {
            const rowNumber = index + 1;

            // Check for completely empty rows
            if (Object.values(record).every(value => !value || value.toString().trim() === '')) {
                warnings.push(`Row ${rowNumber}: Empty row will be skipped`);
                return;
            }

            // Validate required fields
            requiredFields.forEach(field => {
                if (!record[field] || record[field].toString().trim() === '') {
                    errors.push(`Row ${rowNumber}: Missing required field '${field}'`);
                }
            });

            // Entity-specific validation
            switch (entityType) {
                case 'patients':
                    this._validatePatientRecord(record, rowNumber, errors, warnings, uniqueIdentifiers);
                    break;
                case 'doctors':
                    this._validateDoctorRecord(record, rowNumber, errors, warnings, uniqueIdentifiers);
                    break;
                case 'analyses':
                    this._validateAnalysisRecord(record, rowNumber, errors, warnings);
                    break;
            }
        });

        // Report duplicate records
        duplicates.forEach(duplicate => {
            errors.push(`Duplicate record found: ${duplicate}`);
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate patient record
     * @private
     */
    _validatePatientRecord(record, rowNumber, errors, warnings, uniqueIdentifiers) {
        // Validate matricule national
        if (record.matricule_national) {
            if (!this._validateMatricule(record.matricule_national)) {
                errors.push(`Row ${rowNumber}: Invalid matricule format`);
            } else {
                // Check for duplicates
                if (uniqueIdentifiers.has(record.matricule_national)) {
                    errors.push(`Row ${rowNumber}: Duplicate matricule_national '${record.matricule_national}' found at row ${uniqueIdentifiers.get(record.matricule_national)}`);
                } else {
                    uniqueIdentifiers.set(record.matricule_national, rowNumber);
                }
            }
        }

        // Validate date of birth
        if (record.date_of_birth && !this._validateDate(record.date_of_birth)) {
            errors.push(`Row ${rowNumber}: Invalid date format for date_of_birth. Use YYYY-MM-DD format`);
        }

        // Validate gender
        if (record.gender && !['M', 'F', 'O'].includes(record.gender.toUpperCase())) {
            errors.push(`Row ${rowNumber}: Invalid gender. Use M, F, or O`);
        }

        // Validate email format
        if (record.email && !this._validateEmail(record.email)) {
            errors.push(`Row ${rowNumber}: Invalid email format`);
        }

        // Validate phone number format
        if (record.phone && !this._validatePhone(record.phone)) {
            warnings.push(`Row ${rowNumber}: Phone number format may be invalid`);
        }

        // Check name length
        if (record.name && record.name.length > 255) {
            errors.push(`Row ${rowNumber}: Name is too long (maximum 255 characters)`);
        }
    }

    /**
     * Validate doctor record
     * @private
     */
    _validateDoctorRecord(record, rowNumber, errors, warnings, uniqueIdentifiers) {
        // Validate email format and uniqueness
        if (record.email) {
            if (!this._validateEmail(record.email)) {
                errors.push(`Row ${rowNumber}: Invalid email format`);
            } else {
                // Check for duplicates
                if (uniqueIdentifiers.has(record.email)) {
                    errors.push(`Row ${rowNumber}: Duplicate email '${record.email}' found at row ${uniqueIdentifiers.get(record.email)}`);
                } else {
                    uniqueIdentifiers.set(record.email, rowNumber);
                }
            }
        }

        // Validate license number uniqueness
        if (record.license_number) {
            const licenseKey = `license_${record.license_number}`;
            if (uniqueIdentifiers.has(licenseKey)) {
                errors.push(`Row ${rowNumber}: Duplicate license_number '${record.license_number}' found at row ${uniqueIdentifiers.get(licenseKey)}`);
            } else {
                uniqueIdentifiers.set(licenseKey, rowNumber);
            }
        }

        // Validate phone number
        if (record.phone && !this._validatePhone(record.phone)) {
            warnings.push(`Row ${rowNumber}: Phone number format may be invalid`);
        }

        // Validate specialization length
        if (record.specialization && record.specialization.length > 100) {
            errors.push(`Row ${rowNumber}: Specialization is too long (maximum 100 characters)`);
        }

        // Validate full name length
        if (record.full_name && record.full_name.length > 255) {
            errors.push(`Row ${rowNumber}: Full name is too long (maximum 255 characters)`);
        }
    }

    /**
     * Validate analysis record
     * @private
     */
    _validateAnalysisRecord(record, rowNumber, errors, warnings) {
        // Validate IDs are numeric
        if (record.patient_id && (!Number.isInteger(Number(record.patient_id)) || Number(record.patient_id) <= 0)) {
            errors.push(`Row ${rowNumber}: Invalid patient_id. Must be a positive integer`);
        }

        if (record.doctor_id && (!Number.isInteger(Number(record.doctor_id)) || Number(record.doctor_id) <= 0)) {
            errors.push(`Row ${rowNumber}: Invalid doctor_id. Must be a positive integer`);
        }

        if (record.service_id && (!Number.isInteger(Number(record.service_id)) || Number(record.service_id) <= 0)) {
            errors.push(`Row ${rowNumber}: Invalid service_id. Must be a positive integer`);
        }

        // Validate analysis date
        if (record.analysis_date && !this._validateDate(record.analysis_date)) {
            errors.push(`Row ${rowNumber}: Invalid analysis_date format. Use YYYY-MM-DD format`);
        }

        // Validate status
        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        if (record.status && !validStatuses.includes(record.status.toLowerCase())) {
            errors.push(`Row ${rowNumber}: Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate priority
        const validPriorities = ['low', 'normal', 'high', 'urgent'];
        if (record.priority && !validPriorities.includes(record.priority.toLowerCase())) {
            errors.push(`Row ${rowNumber}: Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    /**
     * Get required fields for entity type
     * @private
     */
    _getRequiredFields(entityType) {
        const fields = {
            patients: ['name', 'matricule_national'],
            doctors: ['full_name', 'email', 'specialization'],
            analyses: ['patient_id', 'doctor_id', 'service_id', 'analysis_date']
        };
        return fields[entityType] || [];
    }

    /**
     * Import patients
     * @private
     */
    async _importPatients(data, userId, options) {
        const results = {
            imported: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        const transaction = await db.sequelize.transaction();

        try {
            for (const batch of this._batchArray(data, this.importBatchSize)) {
                for (const record of batch) {
                    try {
                        // Check if patient already exists
                        const matriculeHash = cryptoService.hash(record.matricule_national);
                        const existing = await db.Patient.findOne({
                            where: { matricule_hash: matriculeHash },
                            transaction
                        });

                        if (existing && !options.updateExisting) {
                            results.skipped++;
                            continue;
                        }

                        // Prepare patient data with encryption
                        const patientData = {
                            name: await cryptoService.encrypt(record.name),
                            name_hash: cryptoService.hash(record.name.toLowerCase()),
                            matricule_national: await cryptoService.encrypt(record.matricule_national),
                            matricule_hash: matriculeHash,
                            date_of_birth: record.date_of_birth,
                            gender: record.gender,
                            phone: record.phone ? await cryptoService.encrypt(record.phone) : null,
                            email: record.email,
                            address: record.address ? await cryptoService.encrypt(record.address) : null,
                            emergency_contact: record.emergency_contact,
                            medical_history: record.medical_history,
                            active: true,
                            created_by: userId
                        };

                        // Add name part hashes for search
                        const nameParts = record.name.toLowerCase().split(' ');
                        if (nameParts.length > 0) {
                            patientData.first_name_hash = cryptoService.hash(nameParts[0]);
                            if (nameParts.length > 1) {
                                patientData.last_name_hash = cryptoService.hash(nameParts[nameParts.length - 1]);
                            }
                            patientData.name_parts_json = JSON.stringify(
                                nameParts.map(part => cryptoService.hash(part))
                            );
                        }

                        if (existing) {
                            await existing.update(patientData, { transaction });
                        } else {
                            await db.Patient.create(patientData, { transaction });
                        }

                        results.imported++;

                    } catch (error) {
                        results.failed++;
                        results.errors.push({
                            row: record,
                            error: error.message
                        });
                    }
                }
            }

            await transaction.commit();

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return results;
    }

    /**
     * Import doctors
     * @private
     */
    async _importDoctors(data, userId, options) {
        const results = {
            imported: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        const transaction = await db.sequelize.transaction();

        try {
            for (const record of data) {
                try {
                    // Check if doctor already exists
                    const existing = await db.Doctor.findOne({
                        where: { email: record.email },
                        transaction
                    });

                    if (existing && !options.updateExisting) {
                        results.skipped++;
                        continue;
                    }

                    const doctorData = {
                        full_name: record.full_name,
                        email: record.email,
                        phone: record.phone,
                        specialization: record.specialization,
                        license_number: record.license_number,
                        department: record.department,
                        active: record.active !== false,
                        created_by: userId
                    };

                    if (existing) {
                        await existing.update(doctorData, { transaction });
                    } else {
                        await db.Doctor.create(doctorData, { transaction });
                    }

                    results.imported++;

                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        row: record,
                        error: error.message
                    });
                }
            }

            await transaction.commit();

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return results;
    }

    /**
     * Import analyses
     * @private
     */
    async _importAnalyses(data, userId, options) {
        // Implementation for importing analyses
        // Similar structure to patients and doctors
        return {
            imported: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
    }

    /**
     * Fetch patients for export
     * @private
     */
    async _fetchPatients(filters, options) {
        const where = { active: true };
        
        if (filters.createdAfter) {
            where.created_at = { [Op.gte]: new Date(filters.createdAfter) };
        }

        const patients = await db.Patient.findAll({
            where,
            attributes: { exclude: ['created_by', 'updated_by'] },
            raw: true
        });

        // Decrypt sensitive fields if requested
        if (options.includePersonalData) {
            for (const patient of patients) {
                patient.name = await cryptoService.decrypt(patient.name);
                patient.matricule_national = await cryptoService.decrypt(patient.matricule_national);
                if (patient.phone) patient.phone = await cryptoService.decrypt(patient.phone);
                if (patient.address) patient.address = await cryptoService.decrypt(patient.address);
                
                // Remove hash fields from export
                delete patient.name_hash;
                delete patient.matricule_hash;
                delete patient.first_name_hash;
                delete patient.last_name_hash;
                delete patient.name_parts_json;
            }
        } else {
            // Remove sensitive fields
            for (const patient of patients) {
                delete patient.name;
                delete patient.matricule_national;
                delete patient.phone;
                delete patient.address;
                delete patient.name_hash;
                delete patient.matricule_hash;
                delete patient.first_name_hash;
                delete patient.last_name_hash;
                delete patient.name_parts_json;
            }
        }

        return patients;
    }

    /**
     * Fetch doctors for export
     * @private
     */
    async _fetchDoctors(filters, options) {
        const where = { active: true };

        const doctors = await db.Doctor.findAll({
            where,
            attributes: { exclude: ['created_by', 'updated_by'] },
            raw: true
        });

        return doctors;
    }

    /**
     * Fetch analyses for export
     * @private
     */
    async _fetchAnalyses(filters, options) {
        const where = {};
        
        if (filters.dateFrom) {
            where.analysis_date = { [Op.gte]: new Date(filters.dateFrom) };
        }
        if (filters.dateTo) {
            where.analysis_date = { ...where.analysis_date, [Op.lte]: new Date(filters.dateTo) };
        }

        const analyses = await db.Analysis.findAll({
            where,
            include: [
                {
                    model: db.Patient,
                    as: 'patient',
                    attributes: ['id', 'email']
                },
                {
                    model: db.Doctor,
                    as: 'doctor',
                    attributes: ['id', 'full_name', 'email']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name']
                }
            ]
        });

        return analyses.map(analysis => {
            const data = analysis.toJSON();
            // Flatten nested associations
            data.patient_email = data.patient?.email;
            data.doctor_name = data.doctor?.full_name;
            data.service_name = data.service?.name;
            delete data.patient;
            delete data.doctor;
            delete data.service;
            return data;
        });
    }

    /**
     * Export to CSV
     * @private
     */
    async _exportToCSV(data, filePath, options) {
        const csv = stringify(data, {
            header: true,
            columns: options.columns
        });
        await fs.writeFile(filePath, csv);
    }

    /**
     * Export to Excel
     * @private
     */
    async _exportToExcel(data, filePath, sheetName, options) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        if (data.length > 0) {
            // Add headers
            worksheet.columns = Object.keys(data[0]).map(key => ({
                header: key.replace(/_/g, ' ').toUpperCase(),
                key: key,
                width: 15
            }));

            // Add data
            worksheet.addRows(data);

            // Style the header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        await workbook.xlsx.writeFile(filePath);
    }

    /**
     * Export to JSON
     * @private
     */
    async _exportToJSON(data, filePath, options) {
        const jsonContent = JSON.stringify(data, null, 2);
        await fs.writeFile(filePath, jsonContent);
    }

    /**
     * Utility to batch array
     * @private
     */
    *_batchArray(array, batchSize) {
        for (let i = 0; i < array.length; i += batchSize) {
            yield array.slice(i, i + batchSize);
        }
    }

    /**
     * Validate email format
     * @private
     */
    _validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate matricule format
     * @private
     */
    _validateMatricule(matricule) {
        // Luxembourg matricule format: 13 digits
        const matriculeRegex = /^\d{13}$/;
        return matriculeRegex.test(matricule);
    }

    /**
     * Validate date format
     * @private
     */
    _validateDate(dateString) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            return false;
        }
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
    }

    /**
     * Validate phone number format
     * @private
     */
    _validatePhone(phone) {
        // Luxembourg phone format: +352 followed by 6-9 digits
        const phoneRegex = /^(\+352\s?)?[2-9]\d{2}\s?\d{3}\s?\d{3}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }
}

module.exports = new DataImportExportService();