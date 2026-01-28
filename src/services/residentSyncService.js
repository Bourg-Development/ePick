// services/residentSyncService.js
const axios = require('axios');
const https = require('https');
const db = require('../db');
const logService = require('./logService');
const encryptedSearchService = require('./encryptedSearchService');

/**
 * Service for syncing residents from external API
 */
class ResidentSyncService {
    constructor() {
        this.apiUrl = process.env.RESIDENT_API_URL;
        this.apiKey = process.env.RESIDENT_API_KEY;
        // Allow skipping SSL verification for internal APIs with self-signed/mismatched certs
        this.skipSslVerification = process.env.RESIDENT_API_SKIP_SSL === 'true';
    }

    /**
     * Fetch residents from external API
     * @returns {Promise<Array>} Array of resident data
     */
    async fetchResidentsFromApi() {
        if (!this.apiUrl || !this.apiKey) {
            throw new Error('Resident API configuration missing. Check RESIDENT_API_URL and RESIDENT_API_KEY in .env');
        }

        const axiosConfig = {
            headers: {
                'X-Api-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };

        // Skip SSL verification if configured (for internal APIs with cert issues)
        if (this.skipSslVerification) {
            axiosConfig.httpsAgent = new https.Agent({
                rejectUnauthorized: false
            });
        }

        const response = await axios.get(this.apiUrl, axiosConfig);

        if (!Array.isArray(response.data)) {
            throw new Error('Invalid API response: expected array of residents');
        }

        return response.data;
    }

    /**
     * Map external resident data to patient model format
     * @param {Object} resident - External resident data
     * @returns {Object} Mapped patient data
     */
    mapResidentToPatient(resident) {
        // External format: { Id, Name, SocialSecurityNumber, Sex, RoomNumber }
        // Name format: "LASTNAME FIRSTNAME" (e.g., "MEIER MAX")
        const nameParts = (resident.Name || '').trim().split(/\s+/);
        const lastName = nameParts[0] || '';
        const firstName = nameParts.slice(1).join(' ') || lastName; // If only one name part, use as first name

        // Map gender: external uses M/F, internal uses Male/Female
        let gender = null;
        if (resident.Sex === 'M') {
            gender = 'Male';
        } else if (resident.Sex === 'F') {
            gender = 'Female';
        }

        return {
            externalId: resident.Id,
            firstName: firstName,
            lastName: lastName !== firstName ? lastName : null,
            fullName: firstName && lastName && lastName !== firstName
                ? `${firstName} ${lastName}`
                : firstName || lastName,
            matriculeNational: resident.SocialSecurityNumber,
            gender: gender,
            roomNumber: resident.RoomNumber
        };
    }

    /**
     * Find or create a room by room number
     * @param {string} roomNumber - 4-digit room number
     * @param {number} systemUserId - System user ID for created_by field
     * @returns {Promise<number|null>} Room ID or null if invalid room number
     */
    async findOrCreateRoom(roomNumber, systemUserId = null) {
        if (!roomNumber || !roomNumber.match(/^\d{4}$/)) {
            return null;
        }

        // Try to find existing room
        let room = await db.Room.findOne({
            where: { room_number: roomNumber }
        });

        if (!room) {
            // Create new room
            room = await db.Room.create({
                room_number: roomNumber,
                service_id: null,
                created_by: systemUserId
            });
        }

        return room.id;
    }

    /**
     * Ensure all rooms from residents exist in the database
     * @param {Array} residents - Array of resident data from API
     * @param {number} systemUserId - System user ID for created_by field
     * @returns {Promise<Map>} Map of room_number -> room_id
     */
    async ensureRoomsExist(residents, systemUserId = null) {
        const roomMap = new Map();

        // Collect unique valid room numbers
        const uniqueRoomNumbers = new Set();
        for (const resident of residents) {
            const roomNumber = resident.RoomNumber;
            if (roomNumber && /^\d{4}$/.test(roomNumber)) {
                uniqueRoomNumbers.add(roomNumber);
            }
        }

        // Find existing rooms
        const existingRooms = await db.Room.findAll({
            where: {
                room_number: Array.from(uniqueRoomNumbers)
            }
        });

        // Add existing rooms to map
        for (const room of existingRooms) {
            roomMap.set(room.room_number, room.id);
        }

        // Create missing rooms
        const existingRoomNumbers = new Set(existingRooms.map(r => r.room_number));
        for (const roomNumber of uniqueRoomNumbers) {
            if (!existingRoomNumbers.has(roomNumber)) {
                const newRoom = await db.Room.create({
                    room_number: roomNumber,
                    service_id: null,
                    created_by: systemUserId
                });
                roomMap.set(roomNumber, newRoom.id);
            }
        }

        console.log(`Room sync: ${existingRooms.length} existing, ${uniqueRoomNumbers.size - existingRooms.length} created`);
        return roomMap;
    }

    /**
     * Sync a single resident to the database with pre-resolved room ID
     * @param {Object} mappedResident - Mapped resident data
     * @param {number|null} roomId - Pre-resolved room ID
     * @param {number} systemUserId - System user ID for audit trail
     * @returns {Promise<Object>} Sync result for this resident
     */
    async syncResidentWithRoom(mappedResident, roomId, systemUserId = null) {
        try {
            // Check if patient already exists by matricule national
            const existingPatient = await db.Patient.findOne({
                where: { matricule_national: mappedResident.matriculeNational }
            });

            // Create search hashes
            const searchHashes = encryptedSearchService.createPatientSearchHashes({
                name: mappedResident.fullName,
                matricule_national: mappedResident.matriculeNational
            });

            if (existingPatient) {
                // Update existing patient
                await existingPatient.update({
                    name: mappedResident.fullName,
                    first_name: mappedResident.firstName,
                    last_name: mappedResident.lastName,
                    gender: mappedResident.gender,
                    room_id: roomId,
                    active: true,
                    ...searchHashes
                });

                return {
                    action: 'updated',
                    patientId: existingPatient.id,
                    externalId: mappedResident.externalId,
                    name: mappedResident.fullName,
                    roomId: roomId
                };
            } else {
                // Create new patient
                const newPatient = await db.Patient.create({
                    name: mappedResident.fullName,
                    first_name: mappedResident.firstName,
                    last_name: mappedResident.lastName,
                    matricule_national: mappedResident.matriculeNational,
                    gender: mappedResident.gender,
                    room_id: roomId,
                    active: true,
                    created_by: systemUserId,
                    ...searchHashes
                });

                return {
                    action: 'created',
                    patientId: newPatient.id,
                    externalId: mappedResident.externalId,
                    name: mappedResident.fullName,
                    roomId: roomId
                };
            }
        } catch (error) {
            return {
                action: 'error',
                externalId: mappedResident.externalId,
                name: mappedResident.fullName,
                error: error.message
            };
        }
    }

    /**
     * Sync a single resident to the database (legacy method, kept for manual triggers)
     * @param {Object} mappedResident - Mapped resident data
     * @param {number} systemUserId - System user ID for audit trail
     * @returns {Promise<Object>} Sync result for this resident
     */
    async syncResident(mappedResident, systemUserId = null) {
        // Find or create room first
        const roomId = await this.findOrCreateRoom(mappedResident.roomNumber, systemUserId);
        return this.syncResidentWithRoom(mappedResident, roomId, systemUserId);
    }

    /**
     * Sync all residents from external API
     * @param {number} userId - User ID triggering the sync
     * @param {Object} context - Request context for audit logging
     * @returns {Promise<Object>} Sync results summary
     */
    async syncAllResidents(userId, context = {}) {
        const startTime = Date.now();
        const results = {
            success: true,
            created: 0,
            updated: 0,
            errors: 0,
            details: [],
            duration: 0
        };

        try {
            // Fetch residents from external API
            const residents = await this.fetchResidentsFromApi();
            results.totalFromApi = residents.length;

            // Pre-create all rooms first and build a map of room_number -> room_id
            const roomMap = await this.ensureRoomsExist(residents, userId);

            // Process each resident
            for (const resident of residents) {
                const mappedResident = this.mapResidentToPatient(resident);

                // Skip if no matricule national (required field)
                if (!mappedResident.matriculeNational) {
                    results.errors++;
                    results.details.push({
                        action: 'skipped',
                        externalId: resident.Id,
                        reason: 'Missing SocialSecurityNumber'
                    });
                    continue;
                }

                // Get room ID from pre-built map
                const roomId = roomMap.get(mappedResident.roomNumber) || null;

                const syncResult = await this.syncResidentWithRoom(mappedResident, roomId, userId);
                results.details.push(syncResult);

                if (syncResult.action === 'created') {
                    results.created++;
                } else if (syncResult.action === 'updated') {
                    results.updated++;
                } else if (syncResult.action === 'error') {
                    results.errors++;
                }
            }

            results.duration = Date.now() - startTime;

            // Log the sync operation
            await logService.auditLog({
                eventType: 'residents.synced',
                userId,
                targetType: 'patient',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    totalFromApi: results.totalFromApi,
                    created: results.created,
                    updated: results.updated,
                    errors: results.errors,
                    duration: results.duration,
                    userAgent: context.userAgent
                }
            });

            return results;
        } catch (error) {
            console.error('Resident sync error:', error);

            results.success = false;
            results.error = error.message;
            results.duration = Date.now() - startTime;

            // Log the failed sync
            await logService.auditLog({
                eventType: 'residents.sync_failed',
                userId,
                targetType: 'patient',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    duration: results.duration,
                    userAgent: context.userAgent
                }
            });

            return results;
        }
    }

    /**
     * Check if the API is configured and reachable
     * @returns {Promise<Object>} Health check result
     */
    async checkApiHealth() {
        if (!this.apiUrl || !this.apiKey) {
            return {
                configured: false,
                reachable: false,
                message: 'API not configured'
            };
        }

        try {
            const axiosConfig = {
                headers: {
                    'X-Api-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            };

            // Skip SSL verification if configured
            if (this.skipSslVerification) {
                axiosConfig.httpsAgent = new https.Agent({
                    rejectUnauthorized: false
                });
            }

            const response = await axios.get(this.apiUrl, axiosConfig);

            return {
                configured: true,
                reachable: true,
                status: response.status,
                residentCount: Array.isArray(response.data) ? response.data.length : null
            };
        } catch (error) {
            return {
                configured: true,
                reachable: false,
                error: error.message
            };
        }
    }
}

module.exports = new ResidentSyncService();
