// utils/webauthn.js
const { randomBytes } = require('crypto');
const base64url = require('base64url');
const { Fido2Lib } = require('fido2-lib');

/**
 * Utility for WebAuthn (FIDO2) operations
 */
class WebAuthnUtil {
    constructor() {
        // Initialize FIDO2 library with configuration
        this.fido2 = new Fido2Lib({
            timeout: 60000, // 1 minute
            rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
            rpName: process.env.WEBAUTHN_RP_NAME || 'Military-Grade Auth System',
            rpIcon: process.env.WEBAUTHN_RP_ICON || '',
            challengeSize: 32,
            attestation: 'none',
            cryptoParams: [-7, -257], // ES256 & RS256
            authenticatorAttachment: 'cross-platform', // Allow both platform and cross-platform authenticators
            authenticatorRequireResidentKey: false,
            authenticatorUserVerification: 'preferred'
        });

        // Cache for challenges (in-memory, should use Redis in production)
        this.challengeCache = new Map();
    }

    /**
     * Generate registration options for a new credential
     * @param {Object} user - User object
     * @param {string} user.id - User ID as string
     * @param {string} user.username - User's username
     * @param {string} [user.displayName] - User's display name
     * @returns {Promise<Object>} Registration options
     */
    async generateRegistrationOptions(user) {
        try {
            // Ensure we have valid user data
            if (!user || !user.id || !user.username) {
                throw new Error('Invalid user data for credential registration');
            }

            // Format user for WebAuthn
            const webAuthnUser = {
                id: base64url.encode(String(user.id)),
                name: user.username,
                displayName: user.displayName || user.username
            };

            // Generate registration options
            const registrationOptions = await this.fido2.attestationOptions();

            // Add user info to options
            registrationOptions.user = webAuthnUser;

            // Store challenge for validation
            const challenge = registrationOptions.challenge;
            this._storeChallenge(user.id, challenge);

            // Return registration options to client
            return {
                rp: {
                    id: registrationOptions.rp.id,
                    name: registrationOptions.rp.name
                },
                user: webAuthnUser,
                challenge: challenge,
                pubKeyCredParams: registrationOptions.pubKeyCredParams,
                timeout: registrationOptions.timeout,
                excludeCredentials: [],
                authenticatorSelection: registrationOptions.authenticatorSelection,
                attestation: registrationOptions.attestation
            };
        } catch (error) {
            console.error('WebAuthn registration options error:', error);
            throw new Error('Failed to generate WebAuthn registration options');
        }
    }

    /**
     * Verify and process registration response
     * @param {Object} credential - Credential response from client
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Verified credential for storage
     */
    async verifyRegistration(credential, userId) {
        try {
            // Get stored challenge
            const expectedChallenge = this._getChallenge(userId);

            if (!expectedChallenge) {
                throw new Error('Challenge not found or expired');
            }

            // Client data as JSON
            const clientDataJSON = base64url.decode(credential.response.clientDataJSON);

            // Parse client data
            const clientData = JSON.parse(clientDataJSON);

            // Verify the attestation
            const attestationExpectations = {
                challenge: expectedChallenge,
                origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
                factor: 'either'
            };

            // Format credential for verification
            const attestationResult = await this.fido2.attestationResult(credential, attestationExpectations);

            // Extract and format credential for storage
            const credentialId = base64url.encode(attestationResult.authnrData.get('credId'));
            const publicKey = attestationResult.authnrData.get('credentialPublicKeyPem');
            const counter = attestationResult.authnrData.get('counter');

            // Clear challenge from cache
            this._clearChallenge(userId);

            // Return the verified credential for storage
            return {
                id: credentialId,
                publicKey,
                counter,
                deviceType: credential.type || 'public-key',
                transports: credential.response.transports || [],
                createdAt: new Date()
            };
        } catch (error) {
            console.error('WebAuthn registration verification error:', error);
            throw new Error('Failed to verify WebAuthn registration');
        }
    }

    /**
     * Generate authentication options for an existing credential
     * @param {Array} credentials - User's registered credentials
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Authentication options
     */
    async generateAuthenticationOptions(credentials, userId) {
        try {
            // Generate authentication options
            const authOptions = await this.fido2.assertionOptions();

            // Convert stored credentials to allowCredentials format
            const allowCredentials = credentials.map(cred => ({
                id: cred.id,
                type: cred.deviceType || 'public-key',
                transports: cred.transports
            }));

            // Store challenge for validation
            const challenge = authOptions.challenge;
            this._storeChallenge(userId, challenge);

            // Return authentication options to client
            return {
                challenge,
                timeout: authOptions.timeout,
                rpId: authOptions.rpId,
                allowCredentials,
                userVerification: authOptions.userVerification
            };
        } catch (error) {
            console.error('WebAuthn authentication options error:', error);
            throw new Error('Failed to generate WebAuthn authentication options');
        }
    }

    /**
     * Verify authentication response
     * @param {Object} credential - Authentication credential from client
     * @param {Object} storedCredential - Stored credential from database
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Whether authentication is successful
     */
    async verifyAuthentication(credential, storedCredential, userId) {
        try {
            // Get stored challenge
            const expectedChallenge = this._getChallenge(userId);

            if (!expectedChallenge) {
                throw new Error('Challenge not found or expired');
            }

            // Prepare assertion expectations
            const assertionExpectations = {
                challenge: expectedChallenge,
                origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
                factor: 'either',
                publicKey: storedCredential.publicKey,
                prevCounter: storedCredential.counter,
                userHandle: base64url.encode(String(userId))
            };

            // Verify the assertion
            const assertionResult = await this.fido2.assertionResult(credential, assertionExpectations);

            // Update stored counter
            storedCredential.counter = assertionResult.authnrData.get('counter');

            // Clear challenge from cache
            this._clearChallenge(userId);

            return true;
        } catch (error) {
            console.error('WebAuthn authentication verification error:', error);
            return false;
        }
    }

    /**
     * Store challenge for later verification
     * @private
     * @param {string} userId - User ID
     * @param {string} challenge - Base64url encoded challenge
     */
    _storeChallenge(userId, challenge) {
        // Store with expiration (5 minutes)
        const expiry = Date.now() + (5 * 60 * 1000);
        this.challengeCache.set(userId, {
            challenge,
            expiry
        });

        // Schedule cleanup
        setTimeout(() => {
            this._clearChallenge(userId);
        }, 5 * 60 * 1000);
    }

    /**
     * Get stored challenge if not expired
     * @private
     * @param {string} userId - User ID
     * @returns {string|null} Stored challenge or null if expired
     */
    _getChallenge(userId) {
        const cached = this.challengeCache.get(userId);

        if (!cached) {
            return null;
        }

        // Check expiry
        if (cached.expiry < Date.now()) {
            this._clearChallenge(userId);
            return null;
        }

        return cached.challenge;
    }

    /**
     * Clear stored challenge
     * @private
     * @param {string} userId - User ID
     */
    _clearChallenge(userId) {
        this.challengeCache.delete(userId);
    }
}

module.exports = new WebAuthnUtil();