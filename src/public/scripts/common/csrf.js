// public/scripts/common/csrf.js

/**
 * CSRF Protection Utility for Frontend
 * Handles CSRF token management and automatic inclusion in requests
 */
class CSRFProtection {
    constructor() {
        this.token = null;
        this.tokenKey = '_csrf';
        this.headerName = 'X-CSRF-Token';
        
        // Initialize CSRF token
        this.initializeToken();
        
        // Auto-refresh token periodically (every 45 minutes)
        setInterval(() => {
            this.refreshToken();
        }, 45 * 60 * 1000);
    }

    /**
     * Initialize CSRF token from cookie or fetch new one
     */
    async initializeToken() {
        try {
            // Try to get token from cookie first
            this.token = this.getTokenFromCookie();
            
            // If no token in cookie, fetch a new one
            if (!this.token) {
                await this.fetchToken();
            }
            
            // Set up automatic form injection
            this.setupFormInjection();
            
            // Set up fetch/XMLHttpRequest interception
            this.setupRequestInterception();
            
        } catch (error) {
            console.error('CSRF token initialization failed:', error);
        }
    }

    /**
     * Get CSRF token from cookie
     * @returns {string|null} CSRF token or null if not found
     */
    getTokenFromCookie() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === this.tokenKey) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    /**
     * Fetch new CSRF token from server
     * @returns {Promise<string>} CSRF token
     */
    async fetchToken() {
        try {
            const response = await fetch('/api/csrf/token', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch CSRF token: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.csrfToken) {
                this.token = data.csrfToken;
                return this.token;
            } else {
                throw new Error('Invalid CSRF token response');
            }
        } catch (error) {
            console.error('CSRF token fetch failed:', error);
            throw error;
        }
    }

    /**
     * Refresh CSRF token
     */
    async refreshToken() {
        try {
            await this.fetchToken();
            console.log('CSRF token refreshed');
        } catch (error) {
            console.error('CSRF token refresh failed:', error);
        }
    }

    /**
     * Get current CSRF token
     * @returns {string|null} Current CSRF token
     */
    getToken() {
        return this.token || this.getTokenFromCookie();
    }

    /**
     * Setup automatic CSRF token injection into forms
     */
    setupFormInjection() {
        // Add token to existing forms
        this.injectTokenIntoForms();
        
        // Watch for dynamically added forms
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'FORM') {
                                this.injectTokenIntoForm(node);
                            } else if (node.querySelectorAll) {
                                const forms = node.querySelectorAll('form');
                                forms.forEach(form => this.injectTokenIntoForm(form));
                            }
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Inject CSRF token into all forms on the page
     */
    injectTokenIntoForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => this.injectTokenIntoForm(form));
    }

    /**
     * Inject CSRF token into a specific form
     * @param {HTMLFormElement} form - Form element
     */
    injectTokenIntoForm(form) {
        // Skip if form already has CSRF token or is a GET form
        if (form.method?.toLowerCase() === 'get' || 
            form.querySelector(`input[name="${this.tokenKey}"]`)) {
            return;
        }

        const token = this.getToken();
        if (!token) return;

        // Create hidden input for CSRF token
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = this.tokenKey;
        csrfInput.value = token;
        
        form.appendChild(csrfInput);
    }

    /**
     * Setup automatic CSRF token inclusion in fetch requests
     */
    setupRequestInterception() {
        // Store original fetch function
        const originalFetch = window.fetch;
        
        // Override fetch function
        window.fetch = async (url, options = {}) => {
            // Only add CSRF token for non-GET requests to same origin
            if (this.shouldAddCSRFToken(url, options.method)) {
                options.headers = options.headers || {};
                
                // Add CSRF token header
                const token = this.getToken();
                if (token) {
                    options.headers[this.headerName] = token;
                }
                
                // Ensure credentials are included
                options.credentials = options.credentials || 'include';
            }
            
            return originalFetch(url, options);
        };

        // Override XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._method = method;
            this._url = url;
            return originalOpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            if (this.shouldAddCSRFToken && this.shouldAddCSRFToken(this._url, this._method)) {
                const token = csrfProtection.getToken();
                if (token) {
                    this.setRequestHeader(csrfProtection.headerName, token);
                }
            }
            return originalSend.call(this, ...args);
        };
    }

    /**
     * Check if CSRF token should be added to request
     * @param {string} url - Request URL
     * @param {string} method - HTTP method
     * @returns {boolean} Whether to add CSRF token
     */
    shouldAddCSRFToken(url, method = 'GET') {
        // Only add CSRF token for non-safe methods
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (safeMethods.includes(method?.toUpperCase())) {
            return false;
        }
        
        // Only add for same-origin requests
        try {
            const requestUrl = new URL(url, window.location.origin);
            return requestUrl.origin === window.location.origin;
        } catch (error) {
            // If URL parsing fails, assume it's relative (same origin)
            return !url.startsWith('http');
        }
    }

    /**
     * Manually add CSRF token to request headers
     * @param {Object} headers - Headers object
     * @returns {Object} Headers with CSRF token added
     */
    addTokenToHeaders(headers = {}) {
        const token = this.getToken();
        if (token) {
            headers[this.headerName] = token;
        }
        return headers;
    }

    /**
     * Get CSRF token for manual inclusion in requests
     * @returns {Object} Object with token name and value
     */
    getTokenForRequest() {
        return {
            name: this.tokenKey,
            value: this.getToken()
        };
    }

    /**
     * Check if CSRF protection is working
     * @returns {boolean} Whether CSRF protection is active
     */
    isProtected() {
        return !!this.getToken();
    }
}

// Create global instance
const csrfProtection = new CSRFProtection();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = csrfProtection;
}

// Add to window for global access
if (typeof window !== 'undefined') {
    window.csrfProtection = csrfProtection;
}

// jQuery integration (if jQuery is available)
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        // Setup CSRF token for jQuery AJAX requests
        $.ajaxSetup({
            beforeSend: function(xhr, settings) {
                // Only add CSRF token for non-safe methods to same origin
                if (csrfProtection.shouldAddCSRFToken(settings.url, settings.type)) {
                    const token = csrfProtection.getToken();
                    if (token) {
                        xhr.setRequestHeader(csrfProtection.headerName, token);
                    }
                }
            }
        });
    });
}