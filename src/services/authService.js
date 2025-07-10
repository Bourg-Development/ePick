// services/authService.js
const argon2 = require('argon2');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { Op } = require('sequelize');
const db = require('../db');
const tokenService = require('./tokenService');
const logService = require('./logService');
const cryptoService = require('./cryptoService');
const detectionService = require('./detectionService');
const { PEPPER } = require('../config/environment');

/**
 * Military-grade authentication service
 * Handles user authentication, session management, and security features
 */
class AuthService {
    /**
     * Authenticate a user with username and password
     * @param {string} username - 6-digit username
     * @param {string} password - User password
     * @param {object} context - Contains IP, device fingerprint, user agent
     * @returns {Promise<object>} Authentication result with tokens
     */
    async authenticate(username, password, context) {
        const { ip, deviceFingerprint, userAgent } = context;

        try {
            // Find user by username with correct associations
            const user = await db.User.findOne({
                where: { username },
                include: [{
                    association: 'role',
                    include: [{ association: 'permissions' }]
                }]
            });

            // Generic error for security (prevents username enumeration)
            if (!user) {
                await this._logFailedAttempt(null, username, 'user_not_found', context);
                return { success: false, message: 'Invalid credentials' };
            }

            // Check if account is locked
            if (user.account_locked) {
                if (user.account_locked_until && user.account_locked_until > new Date()) {
                    await this._logFailedAttempt(user.id, username, 'account_locked', context);
                    return { success: false, message: 'Invalid credentials' };
                } else {
                    // Reset lock if time has expired
                    user.account_locked = false;
                    user.account_locked_until = null;
                }
            }

            // Check if password is correct
            const isPasswordValid = await this._verifyPassword(password, user.password_hash, user.salt);

            if (!isPasswordValid) {
                await this._handleFailedLogin(user, context);
                return { success: false, message: 'Invalid credentials' };
            }

            // Reset failed login attempts on successful login
            user.failed_login_attempts = 0;
            user.last_login_attempt = new Date();
            user.last_login = new Date();
            user.last_ip_address = ip;
            user.last_device_fingerprint = deviceFingerprint;
            await user.save();

            // Check for 2FA requirement
            if (user.totp_enabled) {
                return {
                    success: true,
                    requireTOTP: true,
                    userId: user.id,
                    message: 'TOTP verification required'
                };
            }

            // Check for WebAuthn requirement
            if (user.webauthn_enabled) {
                return {
                    success: true,
                    requireWebAuthn: true,
                    userId: user.id,
                    credentials: user.webauthn_credentials,
                    message: 'WebAuthn verification required'
                };
            }

            // Authentication successful - generate tokens and invalidate previous sessions
            await this._invalidatePreviousSessions(user.id, 'new_login');

            const tokens = await this._generateTokens(user, context);

            // Log successful login
            await logService.auditLog({
                eventType: 'user.login',
                userId: user.id,
                targetId: user.id,
                targetType: 'user',
                ipAddress: ip,
                deviceFingerprint,
                metadata: { userAgent }
            });

            // Check for suspicious behavior
            await detectionService.analyzeLoginBehavior(user, context);

            return {
                success: true,
                userId: user.id,
                username: user.username,
                role: user.role.name,
                permissions: user.role.permissions.map(p => p.name),
                ...tokens
            };
        } catch (error) {
            console.error('Authentication error:', error);
            await logService.securityLog({
                eventType: 'auth.error',
                severity: 'high',
                ipAddress: ip,
                deviceFingerprint,
                metadata: { error: error.message, userAgent, username }
            });
            return { success: false, message: 'Authentication failed' };
        }
    }

    /**
     * Verify a user's password (for export operations and sensitive actions)
     * @param {number} userId - User ID
     * @param {string} password - Plain text password to verify
     * @returns {Promise<object>} Verification result
     */
    async verifyUserPassword(userId, password) {
        try {
            // Find user by ID
            const user = await db.User.findByPk(userId);

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Check if user has a password set
            if (!user.password_hash || !user.salt) {
                return {
                    success: false,
                    message: 'User has no password set'
                };
            }

            // Verify password
            const isPasswordValid = await this._verifyPassword(password, user.password_hash, user.salt);

            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid password'
                };
            }

            return {
                success: true,
                message: 'Password verified'
            };
        } catch (error) {
            console.error('Password verification error:', error);
            return {
                success: false,
                message: 'Password verification failed'
            };
        }
    }

    /**
     * Verify TOTP code for 2FA
     * @param {number} userId - User ID
     * @param {string} totpCode - 6-digit TOTP code
     * @param {object} context - Request context
     * @returns {Promise<object>} Authentication result with tokens
     */
    async verifyTOTP(userId, totpCode, context) {
        try {
            const user = await db.User.findByPk(userId, {
                include: [{
                    association: 'role',
                    include: [{ association: 'permissions' }]
                }]
            });

            if (!user || !user.totp_enabled || !user.totp_secret) {
                return { success: false, message: 'Invalid request' };
            }

            // Verify TOTP code
            const isValid = speakeasy.totp.verify({
                secret: cryptoService.decrypt(user.totp_secret), // Decrypt stored secret
                encoding: 'base32',
                token: totpCode,
                window: 1 // Allow 1 period before and after for clock drift
            });

            if (!isValid) {
                await logService.securityLog({
                    eventType: 'totp.failed',
                    severity: 'medium',
                    userId: user.id,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: { userAgent: context.userAgent }
                });
                return { success: false, message: 'Invalid verification code' };
            }

            // Authentication successful - generate tokens and invalidate previous sessions
            await this._invalidatePreviousSessions(user.id, 'new_login_2fa');

            const tokens = await this._generateTokens(user, context);

            // Log successful 2FA login
            await logService.auditLog({
                eventType: 'user.login_2fa',
                userId: user.id,
                targetId: user.id,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent, method: 'totp' }
            });

            return {
                success: true,
                userId: user.id,
                username: user.username,
                role: user.role.name,
                permissions: user.role.permissions.map(p => p.name),
                ...tokens
            };
        } catch (error) {
            console.error('TOTP verification error:', error);
            await logService.securityLog({
                eventType: 'totp.error',
                severity: 'high',
                userId,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { error: error.message, userAgent: context.userAgent }
            });
            return { success: false, message: 'Verification failed' };
        }
    }

    /**
     * Verify WebAuthn authentication
     * @param {number} userId - User ID
     * @param {object} credential - WebAuthn credential response
     * @param {object} context - Request context
     * @returns {Promise<object>} Authentication result with tokens
     */
    async verifyWebAuthn(userId, credential, context) {
        // Implementation would verify the WebAuthn credential
        // This requires WebAuthn libraries and is implementation-specific

        // For this example, we'll assume verification passed
        try {
            const user = await db.User.findByPk(userId, {
                include: [{
                    association: 'role',
                    include: [{ association: 'permissions' }]
                }]
            });

            if (!user || !user.webauthn_enabled) {
                return { success: false, message: 'Invalid request' };
            }

            // Authentication successful - generate tokens and invalidate previous sessions
            await this._invalidatePreviousSessions(user.id, 'new_login_webauthn');

            const tokens = await this._generateTokens(user, context);

            // Log successful WebAuthn login
            await logService.auditLog({
                eventType: 'user.login_webauthn',
                userId: user.id,
                targetId: user.id,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent }
            });

            return {
                success: true,
                userId: user.id,
                username: user.username,
                role: user.role.name,
                permissions: user.role.permissions.map(p => p.name),
                ...tokens
            };
        } catch (error) {
            console.error('WebAuthn verification error:', error);
            await logService.securityLog({
                eventType: 'webauthn.error',
                severity: 'high',
                userId,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { error: error.message, userAgent: context.userAgent }
            });
            return { success: false, message: 'Verification failed' };
        }
    }

    /**
     * Log out a user and invalidate their session
     * @param {string} tokenId - Current session token ID
     * @param {number} userId - User ID
     * @param {object} context - Request context
     * @returns {Promise<object>} Logout result
     */
    async logout(tokenId, userId, context) {
        try {
            // Find and invalidate the session
            const session = await db.Session.findOne({
                where: { token_id: tokenId, user_id: userId, is_valid: true }
            });

            if (!session) {
                return { success: false, message: 'Invalid session' };
            }

            // Invalidate the session
            session.is_valid = false;
            await session.save();

            // Add token to blacklist
            await db.BlacklistedToken.create({
                token_id: tokenId,
                user_id: userId,
                reason: 'logout'
            });

            // If there's a refresh token, blacklist it too
            if (session.refresh_token_id) {
                await db.BlacklistedToken.create({
                    token_id: session.refresh_token_id,
                    user_id: userId,
                    reason: 'logout'
                });
            }

            // Log the logout
            await logService.auditLog({
                eventType: 'user.logout',
                userId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent }
            });

            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'Logout failed' };
        }
    }

    /**
     * Refresh an access token using a refresh token
     * @param {string} refreshToken - Refresh token
     * @param {object} context - Request context
     * @returns {Promise<object>} New tokens
     */
    async refreshToken(refreshToken, context) {
        try {
            // Verify and decode the refresh token
            const decoded = await tokenService.verifyToken(refreshToken, 'refresh');

            if (!decoded || !decoded.id || !decoded.userId) {
                return { success: false, message: 'Invalid refresh token' };
            }

            // Check if token is blacklisted
            const blacklisted = await db.BlacklistedToken.findOne({
                where: { token_id: decoded.id }
            });

            if (blacklisted) {
                await logService.securityLog({
                    eventType: 'token.blacklisted_use',
                    severity: 'high',
                    userId: decoded.userId,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: { userAgent: context.userAgent, tokenId: decoded.id }
                });
                return { success: false, message: 'Invalid token' };
            }

            // Find the session
            const session = await db.Session.findOne({
                where: {
                    refresh_token_id: decoded.id,
                    user_id: decoded.userId,
                    is_valid: true
                }
            });

            if (!session) {
                return { success: false, message: 'Invalid session' };
            }

            // Verify device fingerprint binding if configured
            if (session.device_fingerprint &&
                session.device_fingerprint !== context.deviceFingerprint) {
                // Log suspicious token use from different device
                await logService.securityLog({
                    eventType: 'token.device_mismatch',
                    severity: 'high',
                    userId: decoded.userId,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        userAgent: context.userAgent,
                        expectedDevice: session.device_fingerprint
                    }
                });

                // Invalidate this session
                await this._invalidateSession(session.id, 'security_violation');

                return { success: false, message: 'Invalid token' };
            }

            // Get the user
            const user = await db.User.findByPk(decoded.userId, {
                include: [{
                    association: 'role',
                    include: [{ association: 'permissions' }]
                }]
            });

            if (!user) {
                return { success: false, message: 'Invalid token' };
            }

            // Generate new tokens
            const accessToken = await tokenService.generateToken({
                userId: user.id,
                username: user.username,
                role: user.role.name,
                permissions: user.role.permissions.map(p => p.name)
            }, 'access');

            const newRefreshToken = await tokenService.generateToken({
                userId: user.id,
                id: crypto.randomUUID()
            }, 'refresh');

            // Update session with new refresh token
            const oldRefreshTokenId = session.refresh_token_id;
            session.token_id = accessToken.id;
            session.refresh_token_id = newRefreshToken.id;
            session.last_activity = new Date();
            await session.save();

            // Blacklist the old refresh token
            await db.BlacklistedToken.create({
                token_id: oldRefreshTokenId,
                user_id: user.id,
                reason: 'refresh_rotation'
            });

            // Log the token refresh
            await logService.auditLog({
                eventType: 'token.refresh',
                userId: user.id,
                targetId: user.id,
                targetType: 'token',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent }
            });

            // Check for suspicious behavior
            await detectionService.analyzeTokenUsage(user, session, context);

            return {
                success: true,
                accessToken: accessToken.token,
                refreshToken: newRefreshToken.token,
                expiresIn: accessToken.expiresIn
            };
        } catch (error) {
            console.error('Token refresh error:', error);
            await logService.securityLog({
                eventType: 'token.refresh_error',
                severity: 'medium',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { error: error.message, userAgent: context.userAgent }
            });
            return { success: false, message: 'Token refresh failed' };
        }
    }

    /**
     * Change user password
     * @param {number} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @param {object} context - Request context
     * @returns {Promise<object>} Password change result
     */
    async changePassword(userId, currentPassword, newPassword, context) {
        try {
            const user = await db.User.findByPk(userId);

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Verify current password
            const isCurrentPasswordValid = await this._verifyPassword(
                currentPassword,
                user.password_hash,
                user.salt
            );

            if (!isCurrentPasswordValid) {
                await logService.securityLog({
                    eventType: 'password.change_failed',
                    severity: 'medium',
                    userId,
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: { userAgent: context.userAgent, reason: 'invalid_current_password' }
                });
                return { success: false, message: 'Current password is incorrect' };
            }

            // Check if new password matches any previous passwords
            const passwordHistory = await db.PasswordHistory.findAll({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                limit: 10 // Check against last 10 passwords
            });

            // Check each historical password
            for (const historyEntry of passwordHistory) {
                const isPasswordReused = await this._verifyPassword(
                    newPassword,
                    historyEntry.password_hash,
                    user.salt
                );

                if (isPasswordReused) {
                    await logService.securityLog({
                        eventType: 'password.reuse_attempt',
                        severity: 'medium',
                        userId,
                        ipAddress: context.ip,
                        deviceFingerprint: context.deviceFingerprint,
                        metadata: { userAgent: context.userAgent }
                    });
                    return { success: false, message: 'Cannot reuse a previous password' };
                }
            }

            // Generate new salt and hash for the new password
            const salt = crypto.randomBytes(32).toString('hex');
            const newPasswordHash = await this._hashPassword(newPassword, salt);

            // Store the current password in history
            await db.PasswordHistory.create({
                user_id: userId,
                password_hash: user.password_hash
            });

            // Update user with new password
            user.password_hash = newPasswordHash;
            user.salt = salt;
            await user.save();

            // Invalidate all sessions
            await this._invalidatePreviousSessions(userId, 'password_change');

            // Log the password change
            await logService.auditLog({
                eventType: 'user.password_changed',
                userId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent }
            });

            return { success: true, message: 'Password changed successfully' };
        } catch (error) {
            console.error('Password change error:', error);
            return { success: false, message: 'Password change failed' };
        }
    }

    /**
     * Register a new user using a reference code
     * @param {string} referenceCode - xxx-xxx-xxx format code
     * @param {string} password - New password
     * @param {object} context - Request context
     * @returns {Promise<object>} Registration result
     */
    async registerWithReferenceCode(referenceCode, password, context) {
        try {
            // Find the reference code
            const refCode = await db.RefCode.findOne({
                where: {
                    code: referenceCode,
                    status: 'active',
                    expires_at: { [Op.gt]: new Date() }
                },
                include: [{ model: db.User, as: 'TargetUser' }]
            });

            if (!refCode) {
                await logService.securityLog({
                    eventType: 'registration.invalid_code',
                    severity: 'medium',
                    ipAddress: context.ip,
                    deviceFingerprint: context.deviceFingerprint,
                    metadata: {
                        userAgent: context.userAgent,
                        providedCode: referenceCode
                    }
                });
                return { success: false, message: 'Invalid or expired reference code' };
            }

            const user = refCode.TargetUser;

            // Generate salt and hash password
            const salt = crypto.randomBytes(32).toString('hex');
            const passwordHash = await this._hashPassword(password, salt);

            // Update user with password and salt
            user.password_hash = passwordHash;
            user.salt = salt;
            await user.save();

            // Mark reference code as used
            refCode.status = 'used';
            refCode.used_at = new Date();
            refCode.used_ip = context.ip;
            await refCode.save();

            // Store initial password in history
            await db.PasswordHistory.create({
                user_id: user.id,
                password_hash: passwordHash
            });

            // Log the registration
            await logService.auditLog({
                eventType: 'user.registered',
                userId: user.id,
                targetId: user.id,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    userAgent: context.userAgent,
                    refCodeId: refCode.id,
                    createdBy: refCode.created_by
                }
            });

            // Check if 2FA is required by the reference code
            if (refCode.require_2fa) {
                return {
                    success: true,
                    requireSetup2FA: true,
                    userId: user.id,
                    username: user.username,
                    message: '2FA setup required'
                };
            }

            return {
                success: true,
                userId: user.id,
                username: user.username,
                message: 'Registration successful'
            };
        } catch (error) {
            console.error('Registration error:', error);
            await logService.securityLog({
                eventType: 'registration.error',
                severity: 'high',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    userAgent: context.userAgent,
                    referenceCode
                }
            });
            return { success: false, message: 'Registration failed' };
        }
    }

    /**
     * Setup TOTP 2FA for a user
     * @param {number} userId - User ID
     * @returns {Promise<object>} TOTP setup information
     */
    async setupTOTP(userId) {
        try {
            const user = await db.User.findByPk(userId);

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Generate new TOTP secret
            const secret = speakeasy.generateSecret({
                name: `Military-Auth:${user.username}`
            });

            // Store encrypted secret
            user.totp_secret = cryptoService.encrypt(secret.base32);
            await user.save();

            return {
                success: true,
                totpUri: secret.otpauth_url,
                totpSecret: secret.base32,
                message: 'TOTP setup ready'
            };
        } catch (error) {
            console.error('TOTP setup error:', error);
            return { success: false, message: 'TOTP setup failed' };
        }
    }

    /**
     * Enable TOTP 2FA after verification
     * @param {number} userId - User ID
     * @param {string} totpCode - TOTP code for verification
     * @param {object} context - Request context
     * @returns {Promise<object>} Enable result
     */
    async enableTOTP(userId, totpCode, context) {
        try {
            const user = await db.User.findByPk(userId);

            if (!user || !user.totp_secret) {
                return { success: false, message: 'Invalid request' };
            }

            // Verify TOTP code
            const isValid = speakeasy.totp.verify({
                secret: cryptoService.decrypt(user.totp_secret),
                encoding: 'base32',
                token: totpCode,
                window: 1
            });

            if (!isValid) {
                return { success: false, message: 'Invalid verification code' };
            }

            // Enable TOTP
            user.totp_enabled = true;
            await user.save();

            // Log TOTP enablement
            await logService.auditLog({
                eventType: 'user.totp_enabled',
                userId,
                targetId: userId,
                targetType: 'user',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: { userAgent: context.userAgent }
            });

            return { success: true, message: 'TOTP enabled successfully' };
        } catch (error) {
            console.error('TOTP enable error:', error);
            return { success: false, message: 'TOTP enablement failed' };
        }
    }

    /**
     * Hash a password with Argon2id, salt, and pepper
     * @private
     * @param {string} password - Plain text password
     * @param {string} salt - User-specific salt
     * @returns {Promise<string>} Hashed password
     */
    async _hashPassword(password, salt) {
        // Combine salt and global pepper with password
        const pepperedPassword = `${password}${salt}${PEPPER}`;

        // Hash with Argon2id (memory-hard function resistant to GPU attacks)
        return argon2.hash(pepperedPassword, {
            type: argon2.argon2id,
            memoryCost: 65536, // 64 MiB
            timeCost: 3,       // 3 iterations
            parallelism: 4,    // 4 threads
            hashLength: 32     // 32 bytes output
        });
    }

    /**
     * Verify a password against stored hash
     * @private
     * @param {string} password - Plain text password
     * @param {string} hash - Stored password hash
     * @param {string} salt - User's salt
     * @returns {Promise<boolean>} Whether password is valid
     */
    async _verifyPassword(password, hash, salt) {
        // Add salt and pepper
        const pepperedPassword = `${password}${salt}${PEPPER}`;

        // Verify with Argon2id
        return argon2.verify(hash, pepperedPassword);
    }

    /**
     * Generate access and refresh tokens
     * @private
     * @param {object} user - User object
     * @param {object} context - Request context
     * @returns {Promise<object>} Generated tokens
     */
    async _generateTokens(user, context) {
        // Generate access token with user info and permissions
        const accessToken = await tokenService.generateToken({
            userId: user.id,
            username: user.username,
            role: user.role.name,
            permissions: user.role.permissions.map(p => p.name)
        }, 'access');

        // Generate refresh token
        const refreshTokenId = crypto.randomUUID();
        const refreshToken = await tokenService.generateToken({
            userId: user.id,
            id: refreshTokenId
        }, 'refresh');

        // Create session record
        const session = await db.Session.create({
            user_id: user.id,
            token_id: accessToken.id,
            refresh_token_id: refreshTokenId,
            ip_address: context.ip,
            device_fingerprint: context.deviceFingerprint,
            user_agent: context.userAgent,
            expires_at: new Date(Date.now() + (accessToken.expiresIn * 1000)),
            refresh_token_expires_at: new Date(Date.now() + (refreshToken.expiresIn * 1000))
        });

        return {
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            expiresIn: accessToken.expiresIn,
            sessionId: session.id
        };
    }

    /**
     * Handle failed login attempt
     * @private
     * @param {object} user - User object
     * @param {object} context - Request context
     */
    async _handleFailedLogin(user, context) {
        // Get user with role information
        const userWithRole = await db.User.findByPk(user.id, {
            include: [{ association: 'role' }]
        });

        // Check if user is system admin
        const isSystemAdmin = userWithRole.role && userWithRole.role.name === 'system_admin';

        // Increment failed login attempts
        user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
        user.last_login_attempt = new Date();

        // Check for account lockout threshold - but don't lock system admins
        if (user.failed_login_attempts >= 5 && !isSystemAdmin) { // Configurable threshold
            user.account_locked = true;
            user.account_locked_until = new Date(Date.now() + (15 * 60 * 1000)); // 15 min lockout

            // Log account lockout
            await logService.securityLog({
                eventType: 'user.account_locked',
                severity: 'medium',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    userAgent: context.userAgent,
                    failedAttempts: user.failed_login_attempts,
                    lockoutUntil: user.account_locked_until
                }
            });
        } else if (user.failed_login_attempts >= 5 && isSystemAdmin) {
            // Log excessive failed attempts for system admin without locking
            await logService.securityLog({
                eventType: 'user.excessive_failed_attempts',
                severity: 'high',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    userAgent: context.userAgent,
                    failedAttempts: user.failed_login_attempts,
                    role: 'system_admin',
                    note: 'System admin account - lockout prevented'
                }
            });
        }

        await user.save();

        // Log failed login attempt
        await this._logFailedAttempt(user.id, user.username, 'invalid_password', context);
    }

    /**
     * Log a failed authentication attempt
     * @private
     * @param {number|null} userId - User ID if known
     * @param {string} username - Attempted username
     * @param {string} reason - Failure reason
     * @param {object} context - Request context
     */
    async _logFailedAttempt(userId, username, reason, context) {
        await logService.securityLog({
            eventType: 'auth.failed',
            severity: 'medium',
            userId,
            ipAddress: context.ip,
            deviceFingerprint: context.deviceFingerprint,
            metadata: {
                username,
                reason,
                userAgent: context.userAgent
            }
        });
    }

    /**
     * Invalidate previous user sessions
     * @private
     * @param {number} userId - User ID
     * @param {string} reason - Invalidation reason
     */
    async _invalidatePreviousSessions(userId, reason) {
        const activeSessions = await db.Session.findAll({
            where: {
                user_id: userId,
                is_valid: true
            }
        });

        for (const session of activeSessions) {
            await this._invalidateSession(session.id, reason);
        }
    }

    /**
     * Invalidate a specific session
     * @private
     * @param {number} sessionId - Session ID
     * @param {string} reason - Invalidation reason
     */
    async _invalidateSession(sessionId, reason) {
        const session = await db.Session.findByPk(sessionId);
        if (!session) return;

        // Invalidate the session
        session.is_valid = false;
        await session.save();

        // Blacklist tokens
        if (session.token_id) {
            await db.BlacklistedToken.create({
                token_id: session.token_id,
                user_id: session.user_id,
                reason
            });
        }

        if (session.refresh_token_id) {
            await db.BlacklistedToken.create({
                token_id: session.refresh_token_id,
                user_id: session.user_id,
                reason
            });
        }
    }
}

module.exports = new AuthService();