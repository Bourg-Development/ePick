// controllers/authController.js
const authService = require('../services/authService');
const userService = require('../services/userService');
const referenceCodeService = require('../services/referenceCodeService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');
const validator = require('../utils/validator');
const envConfig = require('../config/environment');
const tokenService = require('../services/tokenService');
const logService = require('../services/logService');

/**
 * Authentication controller for handling user auth operations
 */
class AuthController {

    /**
     * Handle user login
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async login(req, res) {
        try {
            // Validate request
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Attempt authentication
            const result = await authService.authenticate(username, password, context);

            // Return appropriate response based on authentication result
            if (!result.success) {
                return res.status(401).json(result);
            }

            // If 2FA is required, send special response
            if (result.requireTOTP) {
                return res.status(200).json({
                    success: true,
                    requireTOTP: true,
                    userId: result.userId,
                    message: result.message
                });
            }

            // If WebAuthn is required, send challenge
            if (result.requireWebAuthn) {
                return res.status(200).json({
                    success: true,
                    requireWebAuthn: true,
                    userId: result.userId,
                    credentials: result.credentials,
                    message: result.message
                });
            }

            res.cookie('accessToken', result.accessToken, {
                httpOnly: true,
                secure: envConfig.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: envConfig.ACCESS_TOKEN_COOKIE_EXPIRY * 1000,
            });

            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: envConfig.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/api/auth/refresh-token',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            // Success - send tokens
            return res.status(200).json({
                success: true,
                userId: result.userId,
                username: result.username,
                role: result.role,
                permissions: result.permissions,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authentication failed'
            });
        }
    }

    /**
     * Handle TOTP verification
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyTOTP(req, res) {
        try {
            const { userId, totpCode } = req.body;

            if (!userId || !totpCode) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and TOTP code are required'
                });
            }

            // Validate TOTP format (6 digits)
            if (!totpCode.match(/^\d{6}$/)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid verification code format'
                });
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Verify TOTP
            const result = await authService.verifyTOTP(userId, totpCode, context);

            if (!result.success) {
                return res.status(401).json(result);
            }

            // Success - send tokens
            return res.status(200).json({
                success: true,
                userId: result.userId,
                username: result.username,
                role: result.role,
                permissions: result.permissions,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            });
        } catch (error) {
            console.error('TOTP verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Verification failed'
            });
        }
    }

    /**
     * Handle WebAuthn verification
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyWebAuthn(req, res) {
        try {
            const { userId, credential } = req.body;

            if (!userId || !credential) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and WebAuthn credential are required'
                });
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Verify WebAuthn
            const result = await authService.verifyWebAuthn(userId, credential, context);

            if (!result.success) {
                return res.status(401).json(result);
            }

            // Success - send tokens
            return res.status(200).json({
                success: true,
                userId: result.userId,
                username: result.username,
                role: result.role,
                permissions: result.permissions,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            });
        } catch (error) {
            console.error('WebAuthn verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Verification failed'
            });
        }
    }

    /**
     * Handle user logout
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async logout(req, res) {
        try {
            const { userId, tokenId } = req.auth;

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Process logout
            const result = await authService.logout(tokenId, userId, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Logout error:', error);
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }

    /**
     * Handle token refresh
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async refreshToken(req, res) {
        try {
            const  refreshToken  = req.cookies.refreshToken;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Process token refresh
            const result = await authService.refreshToken(refreshToken, context);

            if (!result.success) {
                return res.status(401).json(result);
            }

            res.cookie('accessToken', result.accessToken, {
                httpOnly: true,
                secure: envConfig.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: envConfig.ACCESS_TOKEN_COOKIE_EXPIRY * 1000,
            });

            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: envConfig.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/api/auth/refresh-token',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            const redirectUrl = req.query.redirect;
            if(redirectUrl){
                return res.status(200).redirect(redirectUrl);
            }else{
                // Success - send tokens
                return res.status(200).json({
                    success: true,
                    userId: result.userId,
                    username: result.username,
                    role: result.role,
                    permissions: result.permissions,
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    expiresIn: result.expiresIn
                });
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return res.status(500).json({
                success: false,
                message: 'Token refresh failed'
            });
        }
    }

    /**
     * Handle user registration with reference code
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async register(req, res) {
        try {
            const { referenceCode, password, confirmPassword } = req.body;

            // Validate request
            if (!referenceCode || !password || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Reference code and password are required'
                });
            }

            // Validate reference code format
            if (!referenceCode.match(/^\d{3}-\d{3}-\d{3}$/)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reference code format'
                });
            }

            // Validate passwords match
            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Passwords do not match'
                });
            }

            // Validate password strength
            const passwordValidation = validator.validatePassword(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: passwordValidation.message
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Process registration
            const result = await authService.registerWithReferenceCode(
                referenceCode,
                password,
                context
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            // If 2FA setup is required
            if (result.requireSetup2FA) {
                return res.status(200).json({
                    success: true,
                    requireSetup2FA: true,
                    userId: result.userId,
                    username: result.username,
                    message: result.message
                });
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({
                success: false,
                message: 'Registration failed'
            });
        }
    }

    /**
     * Handle TOTP setup request
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async setupTOTP(req, res) {
        try {
            // User must be authenticated
            const { userId } = req.auth;

            // Generate TOTP setup
            const result = await authService.setupTOTP(userId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                totpUri: result.totpUri,
                totpSecret: result.totpSecret,
                message: result.message
            });
        } catch (error) {
            console.error('TOTP setup error:', error);
            return res.status(500).json({
                success: false,
                message: 'TOTP setup failed'
            });
        }
    }

    /**
     * Enable TOTP for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async enableTOTP(req, res) {
        try {
            const { userId } = req.auth;
            const { totpCode } = req.body;

            if (!totpCode) {
                return res.status(400).json({
                    success: false,
                    message: 'TOTP code is required'
                });
            }

            // Validate TOTP format (6 digits)
            if (!totpCode.match(/^\d{6}$/)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid verification code format'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Enable TOTP
            const result = await authService.enableTOTP(userId, totpCode, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('TOTP enable error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to enable TOTP'
            });
        }
    }

    /**
     * Change user password
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async changePassword(req, res) {
        try {
            const { userId } = req.auth;
            const { currentPassword, newPassword, confirmPassword } = req.body;

            // Validate request
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password and new password are required'
                });
            }

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'New passwords do not match'
                });
            }

            // Validate password strength
            const passwordValidation = validator.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: passwordValidation.message
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Process password change
            const result = await authService.changePassword(
                userId,
                currentPassword,
                newPassword,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Password change error:', error);
            return res.status(500).json({
                success: false,
                message: 'Password change failed'
            });
        }
    }

    /**
     * Validate a reference code
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async validateReferenceCode(req, res) {
        try {
            const { code } = req.params;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: 'Reference code is required'
                });
            }

            // Validate reference code
            const result = await referenceCodeService.validateReferenceCode(code);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Reference code validation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Validation failed'
            });
        }
    }

    /**
     * Request WebAuthn registration
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async requestWebAuthnRegistration(req, res) {
        try {
            // User must be authenticated
            const { userId } = req.auth;

            // Generate WebAuthn registration options
            const result = await authService.generateWebAuthnRegistrationOptions(userId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(200).json({
                success: true,
                options: result.options,
                message: result.message
            });
        } catch (error) {
            console.error('WebAuthn registration options error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate WebAuthn registration options'
            });
        }
    }

    /**
     * Complete WebAuthn registration
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async completeWebAuthnRegistration(req, res) {
        try {
            const { userId } = req.auth;
            const { credential } = req.body;

            if (!credential) {
                return res.status(400).json({
                    success: false,
                    message: 'WebAuthn credential is required'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Complete WebAuthn registration
            const result = await authService.completeWebAuthnRegistration(
                userId,
                credential,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('WebAuthn registration error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to register WebAuthn credential'
            });
        }
    }

    /**
     * Check authentication status
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async checkAuthStatus(req, res) {
        try {
            const { userId, username, role, permissions } = req.auth;

            // Get user info
            const user = await userService.getUserById(userId);

            if (!user.success) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            return res.status(200).json({
                success: true,
                user: {
                    id: userId,
                    username,
                    role,
                    permissions,
                    twoFactorEnabled: {
                        totp: user.data.totp_enabled,
                        webauthn: user.data.webauthn_enabled
                    },
                    lastLogin: user.data.last_login
                }
            });
        } catch (error) {
            console.error('Auth status check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to check authentication status'
            });
        }
    }

    /**
     * List authentication methods available for a user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async listAuthMethods(req, res) {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'Username is required'
                });
            }

            // Get available auth methods
            const result = await authService.getAvailableAuthMethods(username);

            // Always return 200 even if user doesn't exist (for security)
            if (!result.success) {
                return res.status(200).json({
                    success: true,
                    methods: ['password'] // Default fallback
                });
            }

            return res.status(200).json({
                success: true,
                methods: result.methods
            });
        } catch (error) {
            console.error('Auth methods error:', error);
            // Always return password as fallback for security
            return res.status(200).json({
                success: true,
                methods: ['password']
            });
        }
    }

    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    static _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }
}

module.exports = new AuthController();