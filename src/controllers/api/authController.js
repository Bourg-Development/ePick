// controllers/authController.js
const authService = require('../../services/authService');
const userService = require('../../services/userService');
const referenceCodeService = require('../../services/referenceCodeService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
const validator = require('../../utils/validator');
const envConfig = require('../../config/environment');
const tokenService = require('../../services/tokenService');
const logService = require('../../services/logService');
const { safeRedirectUrl } = require('../../utils/urlValidator');
const secureErrorHandler = require('../../utils/secureErrorHandler');

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
            const isHtmlRequest = req.headers.accept?.includes('text/html') && !req.headers.accept?.includes('application/json');

            if (!username || !password) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/login', {
                        title: 'Login - ePick',
                        error: 'Username and password are required',
                        username: username || ''
                    });
                }
                const errorResponse = secureErrorHandler.handleError(
                    { code: 'validation.missing_field', name: 'ValidationError' },
                    req,
                    { missingFields: ['username', 'password'] }
                );
                return res.status(400).json(errorResponse);
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Attempt authentication
            const result = await authService.authenticate(username, password, context);

            // Return appropriate response based on authentication result
            if (!result.success) {
                if (isHtmlRequest) {
                    return res.status(401).render('auth/login', {
                        title: 'Login',
                        error: result.message || 'Invalid credentials',
                        username: username || ''
                    });
                }
                const errorResponse = secureErrorHandler.handleAuthError('invalid_credentials', req, {
                    username: username,
                    loginAttempt: true
                });
                return res.status(401).json(errorResponse);
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

            // Success - redirect to dashboard with login parameter
            return res.status(200).redirect('/restricted/dashboard?login=true');
        } catch (error) {
            console.error('Login error:', error);
            const isHtmlRequest = req.headers.accept?.includes('text/html') && !req.headers.accept?.includes('application/json');
            
            if (isHtmlRequest) {
                return res.status(500).render('auth/login', {
                    title: 'Login - ePick',
                    error: 'Authentication failed. Please try again.',
                    username: req.body.username || ''
                });
            }
            
            const errorResponse = secureErrorHandler.handleError(error, req, {
                controllerMethod: 'login',
                username: req.body.username
            });
            return res.status(500).json(errorResponse);
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
                const errorResponse = secureErrorHandler.handleError(
                    { code: 'validation.missing_field', name: 'ValidationError' },
                    req,
                    { missingFields: ['userId', 'totpCode'] }
                );
                return res.status(400).json(errorResponse);
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

            // Clear auth Cookies
            res.clearCookie('refreshToken');
            res.clearCookie('accessToken');

            if(result.success){
                return res.status(200).redirect('/');
            }
            return res.status(400).json(result);

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
            const refreshToken  = req.cookies.refreshToken;

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
                // Clear authentication cookies
                res.clearCookie('accessToken');
                res.clearCookie('refreshToken');
                
                // Check if this is an API request or browser request
                const isApiRequest = req.headers.accept?.includes('application/json') && 
                                   !req.headers.accept?.includes('text/html');
                
                if (isApiRequest) {
                    // For API requests, return a generic error without details
                    return res.status(401).json({
                        success: false,
                        message: 'Authentication expired'
                    });
                } else {
                    // For browser requests, redirect to login
                    return res.status(401).redirect('/auth/login');
                }
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

            const requestedRedirectUrl = req.query.redirect;
            if (requestedRedirectUrl) {
                // Validate and sanitize the redirect URL to prevent open redirect attacks
                const redirectResult = safeRedirectUrl(requestedRedirectUrl, { 
                    userId: result.userId, 
                    role: result.role 
                });
                
                // Log security attempt if fallback was used
                if (redirectResult.isFallback) {
                    await logService.securityLog({
                        eventType: 'auth.redirect_blocked',
                        severity: 'medium',
                        userId: result.userId,
                        ipAddress: req.ip,
                        deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                        metadata: {
                            requestedUrl: requestedRedirectUrl,
                            reason: redirectResult.reason,
                            safeUrl: redirectResult.url,
                            userAgent: req.get('User-Agent')
                        }
                    });
                }
                
                return res.status(200).redirect(redirectResult.url);
            } else {
                // Check if this is an API request or browser request
                const isApiRequest = req.headers.accept?.includes('application/json') && 
                                   !req.headers.accept?.includes('text/html');
                
                if (isApiRequest) {
                    // For API requests, send tokens as JSON
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
                } else {
                    // For browser requests, redirect to dashboard
                    return res.status(200).redirect('/restricted/dashboard');
                }
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            
            // Clear authentication cookies
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            
            // Check if this is an API request or browser request
            const isApiRequest = req.headers.accept?.includes('application/json') && 
                               !req.headers.accept?.includes('text/html');
            
            if (isApiRequest) {
                // For API requests, return error
                return res.status(500).json({
                    success: false,
                    message: 'Token refresh failed'
                });
            } else {
                // For browser requests, redirect to login
                return res.redirect('/auth/login');
            }
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
            const isHtmlRequest = req.headers.accept?.includes('text/html') && !req.headers.accept?.includes('application/json');

            // Validate request
            if (!referenceCode || !password || !confirmPassword) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/register', {
                        title: 'Register - ePick',
                        error: 'Reference code and password are required',
                        referenceCode: referenceCode || ''
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'Reference code and password are required'
                });
            }

            // Validate reference code format
            if (!referenceCode.match(/^\d{3}-\d{3}-\d{3}$/)) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/register', {
                        title: 'Register - ePick',
                        error: 'Invalid reference code format',
                        referenceCode: referenceCode || ''
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reference code format'
                });
            }

            // Validate passwords match
            if (password !== confirmPassword) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/register', {
                        title: 'Register - ePick',
                        error: 'Passwords do not match',
                        referenceCode: referenceCode || ''
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'Passwords do not match'
                });
            }

            // Validate password strength
            const passwordValidation = validator.validatePassword(password);
            if (!passwordValidation.valid) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/register', {
                        title: 'Register - ePick',
                        error: passwordValidation.message,
                        referenceCode: referenceCode || ''
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: passwordValidation.message
                });
            }

            // Extract request context
            const context = AuthController._getRequestContext(req);

            // Process registration
            const result = await authService.registerWithReferenceCode(
                referenceCode,
                password,
                context
            );

            if (!result.success) {
                if (isHtmlRequest) {
                    return res.status(400).render('auth/register', {
                        title: 'Register - ePick',
                        error: result.message || 'Registration failed',
                        referenceCode: referenceCode || ''
                    });
                }
                return res.status(400).json(result);
            }

            // If 2FA setup is required
            if (result.requireSetup2FA) {
                if (isHtmlRequest) {
                    // For HTML requests, redirect to 2FA setup page
                    return res.redirect(`/auth/setup-2fa?userId=${result.userId}&username=${result.username}`);
                }
                return res.status(200).json({
                    success: true,
                    requireSetup2FA: true,
                    userId: result.userId,
                    username: result.username,
                    message: result.message
                });
            }

            if (isHtmlRequest) {
                // For HTML requests, redirect to login with success message
                return res.redirect('/auth/login?registered=true');
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error('Registration error:', error);
            if (isHtmlRequest) {
                return res.status(500).render('auth/register', {
                    title: 'Register - ePick',
                    error: 'Registration failed. Please try again.',
                    referenceCode: req.body.referenceCode || ''
                });
            }
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
            const context = AuthController._getRequestContext(req);

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
            const context = AuthController._getRequestContext(req);

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
            const context = AuthController._getRequestContext(req);

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