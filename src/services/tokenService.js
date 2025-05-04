// services/tokenService.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const {
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY
} = require('../config/environment');

/**
 * Service for token generation, verification and management
 */
class TokenService {
    /**
     * Generate a JWT token
     * @param {Object} payload - Token payload
     * @param {string} type - Token type ('access' or 'refresh')
     * @returns {Promise<Object>} Generated token info
     */
    async generateToken(payload, type = 'access') {
        try {
            // Set token configuration based on type
            const config = {
                secret: type === 'access' ? ACCESS_TOKEN_SECRET : REFRESH_TOKEN_SECRET,
                expiresIn: type === 'access' ?
                    (ACCESS_TOKEN_EXPIRY || '15m') :
                    (REFRESH_TOKEN_EXPIRY || '7d')
            };

            // Generate unique token ID if not provided
            const tokenId = payload.id || crypto.randomUUID();

            // Create JWT payload with token ID and issued time
            const tokenPayload = {
                ...payload,
                id: tokenId,
                iat: Math.floor(Date.now() / 1000),
                type
            };

            // Sign the token
            const token = jwt.sign(tokenPayload, config.secret, {
                expiresIn: config.expiresIn
            });

            // Calculate expiration time in seconds
            const expiresIn = this._getExpirySeconds(config.expiresIn);

            return {
                token,
                id: tokenId,
                expiresIn
            };
        } catch (error) {
            console.error(`Error generating ${type} token:`, error);
            throw new Error(`Failed to generate ${type} token`);
        }
    }

    /**
     * Verify and decode a JWT token
     * @param {string} token - JWT token to verify
     * @param {string} type - Token type ('access' or 'refresh')
     * @returns {Promise<Object|null>} Decoded token payload or null if invalid
     */
    async verifyToken(token, type = 'access') {
        try {
            // Select secret based on token type
            const secret = type === 'access' ? ACCESS_TOKEN_SECRET : REFRESH_TOKEN_SECRET;

            // Verify the token
            const decoded = jwt.verify(token, secret);

            // Ensure token type matches
            if (decoded.type !== type) {
                throw new Error('Token type mismatch');
            }

            // Check if token is blacklisted
            const isBlacklisted = await this.isTokenBlacklisted(decoded.id);
            if (isBlacklisted) {
                throw new Error('Token has been revoked');
            }



            return decoded;
        } catch (error) {
            console.error(`Token verification error (${type}):`, error.message);

            if(error.name === 'TokenExpireError'){
                throw { code: 'TOKEN_EXPIRED', message: 'Token has expired', originalError: error };
            }

            throw { code: 'TOKEN_INVALID', message: 'Invalid token', originalError: error };
        }
    }

    /**
     * Check if a token is blacklisted
     * @param {string} tokenId - Token ID to check
     * @returns {Promise<boolean>} Whether token is blacklisted
     */
    async isTokenBlacklisted(tokenId) {
        try {
            const blacklistedToken = await db.BlacklistedToken.findOne({
                where: { token_id: tokenId }
            });

            return !!blacklistedToken;
        } catch (error) {
            console.error('Error checking blacklisted token:', error);
            // Default to true (blacklisted) on error for security
            return true;
        }
    }

    /**
     * Blacklist a token
     * @param {string} tokenId - Token ID to blacklist
     * @param {number} userId - User ID associated with token
     * @param {string} reason - Reason for blacklisting
     * @returns {Promise<boolean>} Blacklisting result
     */
    async blacklistToken(tokenId, userId, reason) {
        try {
            await db.BlacklistedToken.create({
                token_id: tokenId,
                user_id: userId,
                reason: reason || 'unspecified'
            });

            return true;
        } catch (error) {
            console.error('Error blacklisting token:', error);
            return false;
        }
    }

    /**
     * Extract token from Authorization header
     * @param {Object} req - Express request object
     * @returns {string|null} Extracted token or null
     */
    extractTokenFromHeader(req) {
        if (!req.headers || !req.headers.authorization) {
            return null;
        }

        const authHeader = req.headers.authorization;
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }

        return parts[1];
    }

    /**
     * Rotate an access token
     * @param {string} currentToken - Current access token
     * @param {Object} context - Request context
     * @returns {Promise<Object>} New token info
     */
    async rotateAccessToken(currentToken, context) {
        try {
            // Verify current token
            const decoded = await this.verifyToken(currentToken, 'access');
            if (!decoded) {
                throw new Error('Invalid token');
            }

            // Blacklist current token
            await this.blacklistToken(decoded.id, decoded.userId, 'rotation');

            // Generate new token with same permissions but new ID
            const { userId, username, role, permissions } = decoded;
            const newToken = await this.generateToken({
                userId,
                username,
                role,
                permissions
            }, 'access');

            // Update session with new token ID
            const session = await db.Session.findOne({
                where: { token_id: decoded.id, user_id: decoded.userId }
            });

            if (session) {
                session.token_id = newToken.id;
                session.last_activity = new Date();
                session.expires_at = new Date(Date.now() + (newToken.expiresIn * 1000));
                await session.save();
            }

            return newToken;
        } catch (error) {
            console.error('Token rotation error:', error);
            throw new Error('Failed to rotate token');
        }
    }

    /**
     * Convert expiry string to seconds
     * @private
     * @param {string|number} expiry - Expiry time string (e.g., '1h', '7d') or seconds
     * @returns {number} Expiry time in seconds
     */
    _getExpirySeconds(expiry) {
        if (typeof expiry === 'number') {
            return expiry;
        }

        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) {
            return 3600; // Default to 1 hour
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return 3600;
        }
    }
}

module.exports = new TokenService();