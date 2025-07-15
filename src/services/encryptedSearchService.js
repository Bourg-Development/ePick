// services/encryptedSearchService.js
const db = require('../db');
const cryptoService = require('./cryptoService');
const { Op } = require('sequelize');

/**
 * Service for searching encrypted data using search hashes
 * Provides secure search capabilities for encrypted patient data
 */
class EncryptedSearchService {
    
    /**
     * Search patients by name or national ID
     * @param {string} searchTerm - Search term (will be hashed for comparison)
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Object with patients array and metadata
     */
    async searchPatients(searchTerm, options = {}) {
        if (!searchTerm || typeof searchTerm !== 'string') {
            console.log('EncryptedSearchService: Invalid search term provided');
            return { patients: [] };
        }
        
        const { 
            limit = 50, 
            offset = 0, 
            includeInactive = false,
            activeOnly = true,
            includeAssociations = false,
            doctorId = null,
            roomId = null
        } = options;
        
        const trimmedTerm = searchTerm.toLowerCase().trim();
        
        // Generate all possible hashes for the search term
        const searchHashes = this._generateSearchHashes(trimmedTerm);
        
        const baseWhere = {};
        if (activeOnly || !includeInactive) {
            baseWhere.active = true;
        }
        if (doctorId) {
            baseWhere.doctor_id = doctorId;
        }
        if (roomId) {
            baseWhere.room_id = roomId;
        }

        const include = [];
        if (includeAssociations) {
            include.push(
                {
                    model: db.Doctor,
                    as: 'doctor',
                    attributes: ['id', 'name', 'specialization']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'room_number']
                }
            );
        }
        
        try {
            // Build prioritized search queries
            const searches = [];
            
            // Priority 1: Exact first name + last name match
            if (searchHashes.firstName && searchHashes.lastName) {
                searches.push({
                    priority: 1,
                    where: {
                        ...baseWhere,
                        first_name_hash: searchHashes.firstName,
                        last_name_hash: searchHashes.lastName
                    }
                });
            }
            
            // Priority 2: Full name match or matricule match
            searches.push({
                priority: 2,
                where: {
                    ...baseWhere,
                    [Op.or]: [
                        { name_hash: searchHashes.fullName },
                        { matricule_hash: searchHashes.matricule }
                    ]
                }
            });
            
            // Priority 2.5: Names that contain all search words in sequence
            if (searchHashes.allWordCombinations.length > 0 && searchHashes.wordParts.length > 1) {
                const sequentialMatches = [];
                
                // Check if the full search term appears as a substring in name_parts_json
                // This catches cases like "Test Paul Mike" in "Kai Test Paul Mike"
                searchHashes.allWordCombinations.forEach(combinationHash => {
                    sequentialMatches.push({
                        name_parts_json: {
                            [Op.like]: `%"${combinationHash}"%`
                        }
                    });
                });
                
                searches.push({
                    priority: 2.5,
                    where: {
                        ...baseWhere,
                        [Op.or]: sequentialMatches
                    }
                });
            }
            
            // Priority 3: Exact word combinations in first or last name
            if (searchHashes.allWordCombinations.length > 0) {
                const exactCombinations = [];
                searchHashes.allWordCombinations.forEach(combinationHash => {
                    exactCombinations.push({ first_name_hash: combinationHash });
                    exactCombinations.push({ last_name_hash: combinationHash });
                });
                
                searches.push({
                    priority: 3,
                    where: {
                        ...baseWhere,
                        [Op.or]: exactCombinations
                    }
                });
            }
            
            // Priority 4: Individual word matches
            if (searchHashes.wordParts.length > 0) {
                const wordMatches = [];
                searchHashes.wordParts.forEach(wordHash => {
                    wordMatches.push({ first_name_hash: wordHash });
                    wordMatches.push({ last_name_hash: wordHash });
                    wordMatches.push({
                        name_parts_json: {
                            [Op.like]: `%"${wordHash}"%`
                        }
                    });
                });
                
                searches.push({
                    priority: 4,
                    where: {
                        ...baseWhere,
                        [Op.or]: wordMatches
                    }
                });
            }
            
            // Execute searches in priority order and combine results
            const allPatients = [];
            const seenIds = new Set();
            
            for (const search of searches) {
                const patients = await db.Patient.findAll({
                    where: search.where,
                    include,
                    limit: limit * 2, // Get more results to filter duplicates
                    order: [['created_at', 'DESC']]
                });
                
                // Add patients we haven't seen yet
                for (const patient of patients) {
                    if (!seenIds.has(patient.id)) {
                        seenIds.add(patient.id);
                        allPatients.push({
                            ...patient.toJSON(),
                            searchPriority: search.priority
                        });
                    }
                }
                
                // Stop if we have enough results
                if (allPatients.length >= limit) {
                    break;
                }
            }
            
            // Calculate match scores for better ranking
            const words = trimmedTerm.split(/\s+/).filter(word => word.length > 0);
            
            allPatients.forEach(patient => {
                let matchScore = 0;
                const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase();
                const combinedName = (patient.name || '').toLowerCase();
                
                // Score based on how many search words appear in the name
                const wordsInName = words.filter(word => 
                    fullName.includes(word.toLowerCase()) || combinedName.includes(word.toLowerCase())
                ).length;
                
                // Score based on word order preservation
                let orderScore = 0;
                if (words.length > 1) {
                    const searchPhrase = words.join(' ').toLowerCase();
                    if (fullName.includes(searchPhrase) || combinedName.includes(searchPhrase)) {
                        orderScore = 10; // High bonus for exact phrase match
                    }
                }
                
                // Score based on position (earlier in name = higher score)
                let positionScore = 0;
                if (fullName.startsWith(trimmedTerm) || combinedName.startsWith(trimmedTerm)) {
                    positionScore = 5;
                } else if (fullName.includes(trimmedTerm) || combinedName.includes(trimmedTerm)) {
                    positionScore = 2;
                }
                
                matchScore = (wordsInName * 2) + orderScore + positionScore;
                patient.matchScore = matchScore;
            });
            
            // Sort by priority first, then by match score, then by creation date
            allPatients.sort((a, b) => {
                if (a.searchPriority !== b.searchPriority) {
                    return a.searchPriority - b.searchPriority;
                }
                if (a.matchScore !== b.matchScore) {
                    return b.matchScore - a.matchScore; // Higher score first
                }
                return new Date(b.created_at) - new Date(a.created_at);
            });
            
            // Return limited results
            const limitedPatients = allPatients.slice(0, limit);
            
            return { patients: limitedPatients };
            
        } catch (error) {
            console.error('Error searching patients:', error);
            throw new Error('Failed to search patients');
        }
    }
    
    /**
     * Generate all possible search hashes for a search term
     * @param {string} searchTerm - The search term
     * @returns {Object} Object containing various hashes
     */
    _generateSearchHashes(searchTerm) {
        const hashes = {
            fullName: cryptoService.hash(searchTerm),
            matricule: cryptoService.hash(searchTerm),
            firstName: null,
            lastName: null,
            wordParts: [],
            allWordCombinations: []
        };
        
        // If search term contains spaces, treat as "first last" format
        const words = searchTerm.split(/\s+/).filter(word => word.length > 0);
        
        if (words.length >= 2) {
            // First word as first name, rest as last name
            hashes.firstName = cryptoService.hash(words[0]);
            hashes.lastName = cryptoService.hash(words.slice(1).join(' '));
            
            // Also add individual words to wordParts for searching against name_parts_json
            words.forEach(word => {
                hashes.wordParts.push(cryptoService.hash(word));
            });
            
            // Generate all possible combinations of consecutive words
            // This helps with searching for multiple last names
            for (let i = 0; i < words.length; i++) {
                for (let j = i + 1; j <= words.length; j++) {
                    const combination = words.slice(i, j).join(' ');
                    hashes.allWordCombinations.push(cryptoService.hash(combination));
                }
            }
        } else if (words.length === 1) {
            // Single word - could be first name, last name, or partial
            const word = words[0];
            hashes.firstName = cryptoService.hash(word);
            hashes.lastName = cryptoService.hash(word);
            
            // Add the full word to wordParts for searching against name_parts_json
            hashes.wordParts.push(cryptoService.hash(word));
            
            // Generate hashes for partial matches (2+ characters)
            if (word.length >= 2) {
                for (let i = 2; i <= word.length; i++) {
                    const partial = word.substring(0, i);
                    hashes.wordParts.push(cryptoService.hash(partial));
                }
            }
        }
        
        return hashes;
    }
    
    /**
     * Search for a specific patient by exact national ID
     * @param {string} matriculeNational - National ID to search for
     * @returns {Promise<Object|null>} Patient object or null if not found
     */
    async findPatientByMatricule(matriculeNational) {
        if (!matriculeNational) {
            return null;
        }
        
        const searchHash = cryptoService.hash(matriculeNational.toLowerCase().trim());
        
        try {
            const patient = await db.Patient.findOne({
                where: {
                    matricule_hash: searchHash,
                    active: true
                },
                include: [
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name', 'specialization']
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        attributes: ['id', 'number', 'capacity']
                    }
                ]
            });
            
            return patient;
        } catch (error) {
            console.error('Error finding patient by matricule:', error);
            throw new Error('Failed to find patient');
        }
    }
    
    /**
     * Search patients by name with fuzzy matching
     * @param {string} nameQuery - Name to search for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching patients
     */
    async searchPatientsByName(nameQuery, options = {}) {
        if (!nameQuery || typeof nameQuery !== 'string') {
            return [];
        }
        
        const { limit = 50, offset = 0, includeInactive = false } = options;
        
        // For encrypted data, we need to search by exact hash matches
        // For fuzzy search, we'd need to implement a different approach
        const searchHash = cryptoService.hash(nameQuery.toLowerCase().trim());
        
        const whereClause = {
            name_hash: searchHash
        };
        
        if (!includeInactive) {
            whereClause.active = true;
        }
        
        try {
            const patients = await db.Patient.findAll({
                where: whereClause,
                limit,
                offset,
                include: [
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name', 'specialization']
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        attributes: ['id', 'number', 'capacity']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
            
            return patients;
        } catch (error) {
            console.error('Error searching patients by name:', error);
            throw new Error('Failed to search patients by name');
        }
    }
    
    /**
     * Get all patients with pagination (for administrative views)
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Object with patients array and pagination info
     */
    async getAllPatients(options = {}) {
        const { 
            limit = 50, 
            offset = 0, 
            includeInactive = false,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;
        
        const whereClause = {};
        
        if (!includeInactive) {
            whereClause.active = true;
        }
        
        try {
            const { count, rows: patients } = await db.Patient.findAndCountAll({
                where: whereClause,
                limit,
                offset,
                include: [
                    {
                        model: db.Doctor,
                        as: 'doctor',
                        attributes: ['id', 'name', 'specialization']
                    },
                    {
                        model: db.Room,
                        as: 'room',
                        attributes: ['id', 'number', 'capacity']
                    }
                ],
                order: [[sortBy, sortOrder]]
            });
            
            return {
                patients,
                pagination: {
                    total: count,
                    limit,
                    offset,
                    pages: Math.ceil(count / limit),
                    currentPage: Math.floor(offset / limit) + 1
                }
            };
        } catch (error) {
            console.error('Error getting all patients:', error);
            throw new Error('Failed to get patients');
        }
    }
    
    /**
     * Update search hashes for a patient (called when patient data is updated)
     * @param {number} patientId - Patient ID
     * @param {Object} updatedData - Updated patient data
     * @returns {Promise<boolean>} Success status
     */
    async updatePatientSearchHashes(patientId, updatedData) {
        if (!patientId || !updatedData) {
            return false;
        }
        
        const hashes = {};
        
        // Update name hash if name was changed
        if (updatedData.name) {
            hashes.name_hash = cryptoService.hash(updatedData.name.toLowerCase().trim());
        }
        
        // Update matricule hash if national ID was changed
        if (updatedData.matricule_national) {
            hashes.matricule_hash = cryptoService.hash(updatedData.matricule_national.toLowerCase().trim());
        }
        
        if (Object.keys(hashes).length === 0) {
            return true; // No hashes to update
        }
        
        try {
            await db.Patient.update(hashes, {
                where: { id: patientId }
            });
            
            return true;
        } catch (error) {
            console.error('Error updating patient search hashes:', error);
            return false;
        }
    }
    
    /**
     * Create search hashes for a new patient
     * @param {Object} patientData - Patient data
     * @returns {Object} Object with search hashes
     */
    createPatientSearchHashes(patientData) {
        const hashes = {};
        
        if (patientData.name) {
            const fullName = patientData.name.toLowerCase().trim();
            hashes.name_hash = cryptoService.hash(fullName);
            
            // Split name into first and last parts
            const nameParts = fullName.split(/\s+/).filter(part => part.length > 0);
            
            if (nameParts.length >= 1) {
                hashes.first_name_hash = cryptoService.hash(nameParts[0]);
            }
            
            if (nameParts.length >= 2) {
                hashes.last_name_hash = cryptoService.hash(nameParts.slice(1).join(' '));
            }
            
            // Create searchable parts for partial matching
            const searchParts = [];
            nameParts.forEach(part => {
                // Add full word
                searchParts.push(cryptoService.hash(part));
                
                // Add partial matches (2+ characters)
                if (part.length >= 2) {
                    for (let i = 2; i <= part.length; i++) {
                        searchParts.push(cryptoService.hash(part.substring(0, i)));
                    }
                }
            });
            
            hashes.name_parts_json = JSON.stringify([...new Set(searchParts)]); // Remove duplicates
        }
        
        if (patientData.matricule_national) {
            hashes.matricule_hash = cryptoService.hash(patientData.matricule_national.toLowerCase().trim());
        }
        
        return hashes;
    }
    
    /**
     * Search archived analyses by patient name (limited due to encryption)
     * @param {string} patientName - Patient name to search for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching archived analyses
     */
    async searchArchivedAnalysesByPatient(patientName, options = {}) {
        if (!patientName) {
            return [];
        }
        
        const { limit = 50, offset = 0 } = options;
        
        // For encrypted archived data, we need to search by patient_id instead
        // First find the patient, then search archived analyses
        const patient = await this.searchPatientsByName(patientName);
        
        if (!patient || patient.length === 0) {
            return [];
        }
        
        const patientIds = patient.map(p => p.id);
        
        try {
            const archivedAnalyses = await db.ArchivedAnalysis.findAll({
                where: {
                    patient_id: {
                        [Op.in]: patientIds
                    }
                },
                limit,
                offset,
                order: [['archived_at', 'DESC']]
            });
            
            return archivedAnalyses;
        } catch (error) {
            console.error('Error searching archived analyses:', error);
            throw new Error('Failed to search archived analyses');
        }
    }
    

    /**
     * Get statistics about encrypted data
     * @returns {Promise<Object>} Statistics object
     */
    async getEncryptionStatistics() {
        try {
            const stats = {
                totalPatients: await db.Patient.count(),
                activePatients: await db.Patient.count({ where: { active: true } }),
                totalDoctors: await db.Doctor.count(),
                activeDoctors: await db.Doctor.count({ where: { active: true } }),
                totalAnalyses: await db.Analysis.count(),
                totalArchivedAnalyses: await db.ArchivedAnalysis.count(),
                totalPrescriptions: await db.Prescription.count()
            };
            
            return stats;
        } catch (error) {
            console.error('Error getting encryption statistics:', error);
            throw new Error('Failed to get encryption statistics');
        }
    }
}

module.exports = new EncryptedSearchService();