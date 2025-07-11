/**
 * API Utility for making HTTP requests with automatic token refresh
 * Works with httpOnly cookies for secure token storage
 */

(function(global) {
    'use strict';

    // Default configuration
    const defaultConfig = {
        baseURL: '',
        timeout: 10000,
        credentials: 'include', // Include cookies in all requests
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        auth: {
            refreshEndpoint: '/api/auth/refresh-token',
            loginUrl: '/auth/login',
            onTokenRefresh: null, // Callback when token is refreshed
            onAuthFailure: null   // Callback when auth fails completely
        }
    };

    class ApiUtility {
        constructor(config = {}) {
            this.config = { ...defaultConfig, ...config };
            this.isRefreshing = false;
            this.failedQueue = [];
            this.requestQueue = [];
            this.isProcessingQueue = false;
        }

        /**
         * Set global configuration
         * @param {Object} config - Configuration object
         */
        setConfig(config) {
            this.config = { ...this.config, ...config };
        }

        /**
         * Build full URL
         * @param {string} endpoint - API endpoint
         * @returns {string} Full URL
         */
        buildUrl(endpoint) {
            const baseURL = this.config.baseURL.replace(/\/$/, '');
            const cleanEndpoint = endpoint.replace(/^\//, '');
            return baseURL ? `${baseURL}/${cleanEndpoint}` : cleanEndpoint;
        }

        /**
         * Process the request queue sequentially
         * @private
         */
        async processQueue() {
            if (this.isProcessingQueue || this.requestQueue.length === 0) {
                return;
            }

            this.isProcessingQueue = true;

            while (this.requestQueue.length > 0) {
                const { method, endpoint, options, resolve, reject } = this.requestQueue.shift();
                
                try {
                    const result = await this.executeRequest(method, endpoint, options);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }

            this.isProcessingQueue = false;
        }

        /**
         * Add request to queue
         * @private
         * @param {string} method - HTTP method
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        queueRequest(method, endpoint, options = {}) {
            return new Promise((resolve, reject) => {
                this.requestQueue.push({ method, endpoint, options, resolve, reject });
                this.processQueue();
            });
        }

        /**
         * Handle token refresh
         * @returns {Promise<boolean>} True if refresh successful
         */
        async handleTokenRefresh() {
            if (this.isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    this.failedQueue.push({ resolve, reject });
                });
            }

            this.isRefreshing = true;

            try {
                // Make refresh request - cookies will be sent automatically
                const refreshConfig = {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include' // Send existing cookies (refresh token)
                };

                const response = await fetch(this.config.auth.refreshEndpoint, refreshConfig);

                if (response.ok) {
                    const data = await response.json();

                    // New tokens are automatically set via Set-Cookie headers
                    // No need to manually handle token storage

                    // Call refresh callback if provided
                    if (this.config.auth.onTokenRefresh) {
                        this.config.auth.onTokenRefresh(data);
                    }

                    // Resolve all queued requests
                    this.failedQueue.forEach(({ resolve }) => resolve(true));
                    this.failedQueue = [];

                    // Token refreshed successfully
                    return true;
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Token refresh failed: ${response.status} - ${errorData.message || response.statusText}`);
                }
            } catch (error) {
                // Don't log token refresh errors to console for users
                
                // Reject all queued requests silently
                this.failedQueue.forEach(({ reject }) => reject(new Error('Authentication expired')));
                this.failedQueue = [];

                // Call auth failure callback if provided
                if (this.config.auth.onAuthFailure) {
                    this.config.auth.onAuthFailure(error);
                } else {
                    // Default behavior: clear cookies and redirect to login
                    if (!window.location.pathname.includes('/auth/login')) {
                        // Clear all authentication cookies
                        document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
                        document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
                        
                        // Redirect silently without showing error messages
                        window.location.href = this.config.auth.loginUrl;
                    }
                }

                return false;
            } finally {
                this.isRefreshing = false;
            }
        }

        /**
         * Make HTTP request with automatic token refresh (public interface)
         * @param {string} method - HTTP method
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        async request(method, endpoint, options = {}) {
            return this.queueRequest(method, endpoint, options);
        }

        /**
         * Execute HTTP request with automatic token refresh (internal implementation)
         * @private
         * @param {string} method - HTTP method
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        async executeRequest(method, endpoint, options = {}) {
            await new Promise(r => setTimeout(r, 400))
            let url = this.buildUrl(endpoint);
            const config = {
                method: method.toUpperCase(),
                headers: { ...this.config.headers, ...options.headers },
                credentials: this.config.credentials // Include cookies automatically
            };

            // Add body for methods that support it
            if (['POST', 'PUT', 'PATCH'].includes(config.method) && options.data) {
                if (options.data instanceof FormData) {
                    config.body = options.data;
                    // Remove Content-Type for FormData (browser sets it automatically)
                    delete config.headers['Content-Type'];
                } else {
                    config.body = JSON.stringify(options.data);
                }
            }

            // Add query parameters
            if (options.params) {
                const params = new URLSearchParams(options.params);
                const separator = url.includes('?') ? '&' : '?';
                url += separator + params.toString();
            }

            try {
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
                );

                // Make the request
                let response = await Promise.race([
                    fetch(url, config),
                    timeoutPromise
                ]);

                // Handle 401 - token expired (only if not already a retry and not the refresh endpoint)
                if (response.status === 401 && !options._isRetry && endpoint !== this.config.auth.refreshEndpoint) {
                    // Token expired, attempting refresh...

                    const refreshSuccess = await this.handleTokenRefresh();

                    if (refreshSuccess) {
                        // Retry the original request with refreshed cookies
                        response = await Promise.race([
                            fetch(url, { ...config, _isRetry: true }),
                            timeoutPromise
                        ]);
                    } else {
                        // Refresh failed, the handleTokenRefresh will handle redirect
                        throw new Error('Authentication failed');
                    }
                }

                // Handle HTTP errors
                if (!response.ok) {
                    const error = new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                    error.status = response.status;
                    error.statusText = response.statusText;

                    // Clone response to avoid "body stream already read" error
                    const responseClone = response.clone();

                    // Try to parse error response - first try JSON, then text on cloned response
                    try {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            error.data = await response.json();
                        } else {
                            error.data = await response.text();
                        }
                    } catch (e) {
                        // If first attempt fails, try the opposite on the cloned response
                        try {
                            const contentType = responseClone.headers.get('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                error.data = await responseClone.json();
                            } else {
                                error.data = await responseClone.text();
                            }
                        } catch (e2) {
                            error.data = null;
                        }
                    }

                    throw error;
                }

                // Parse successful response based on content type
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                } else {
                    return await response.text();
                }

            } catch (error) {
                // Add more context to network errors
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    error.message = 'Network error: Please check your internet connection';
                }
                throw error;
            }
        }

        /**
         * GET request
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        get(endpoint, options = {}) {
            return this.request('GET', endpoint, options);
        }

        /**
         * POST request
         * @param {string} endpoint - API endpoint
         * @param {Object} data - Request data
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        post(endpoint, data = null, options = {}) {
            return this.request('POST', endpoint, { ...options, data });
        }

        /**
         * PUT request
         * @param {string} endpoint - API endpoint
         * @param {Object} data - Request data
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        put(endpoint, data = null, options = {}) {
            return this.request('PUT', endpoint, { ...options, data });
        }

        /**
         * PATCH request
         * @param {string} endpoint - API endpoint
         * @param {Object} data - Request data
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        patch(endpoint, data = null, options = {}) {
            return this.request('PATCH', endpoint, { ...options, data });
        }

        /**
         * DELETE request
         * @param {string} endpoint - API endpoint
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        delete(endpoint, options = {}) {
            return this.request('DELETE', endpoint, options);
        }

        /**
         * Upload file
         * @param {string} endpoint - API endpoint
         * @param {File|FileList} files - File(s) to upload
         * @param {Object} options - Request options
         * @returns {Promise} Request promise
         */
        upload(endpoint, files, options = {}) {
            const formData = new FormData();

            if (files instanceof FileList) {
                for (let i = 0; i < files.length; i++) {
                    formData.append('files', files[i]);
                }
            } else if (files instanceof File) {
                formData.append('file', files);
            } else {
                throw new Error('Invalid file parameter');
            }

            // Add additional form data if provided
            if (options.formData) {
                Object.entries(options.formData).forEach(([key, value]) => {
                    formData.append(key, value);
                });
            }

            return this.post(endpoint, formData, options);
        }

        /**
         * Logout - call server logout and redirect
         * @param {string} logoutEndpoint - Logout API endpoint (default: '/api/auth/logout')
         * @returns {Promise} Logout promise
         */
        async logout(logoutEndpoint = '/api/auth/logout') {
            try {
                await this.post(logoutEndpoint);
            } catch (error) {
                console.error('Logout request failed:', error);
            } finally {
                // Redirect to login regardless of logout request success
                window.location.href = this.config.auth.loginUrl;
            }
        }
    }

    // Create default instance
    const api = new ApiUtility();

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = { ApiUtility, api };
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(function() {
            return { ApiUtility, api };
        });
    } else {
        // Browser global
        global.ApiUtility = ApiUtility;
        global.api = api;
    }

})(typeof window !== 'undefined' ? window : this);