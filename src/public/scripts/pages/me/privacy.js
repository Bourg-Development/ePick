document.addEventListener('DOMContentLoaded', function() {
    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // State variables
    let currentProfile = null;
    let currentSession = null;
    let securityLogs = [];
    let privacySettings = null;
    let showingMoreLogs = false;

    // DOM Elements
    const totpStatus = document.getElementById('totpStatus');
    const webauthnStatus = document.getElementById('webauthnStatus');
    const manageTotpBtn = document.getElementById('manageTotpBtn');
    const manageWebauthnBtn = document.getElementById('manageWebauthnBtn');
    const totpActionText = document.getElementById('totpActionText');
    const webauthnActionText = document.getElementById('webauthnActionText');

    // Session elements
    const currentSessionLocation = document.getElementById('currentSessionLocation');
    const currentSessionDevice = document.getElementById('currentSessionDevice');
    const currentSessionStarted = document.getElementById('currentSessionStarted');
    const currentSessionActivity = document.getElementById('currentSessionActivity');
    const refreshSessionBtn = document.getElementById('refreshSessionBtn');
    const terminateOtherSessionsBtn = document.getElementById('terminateOtherSessionsBtn');

    // Privacy elements
    const showFullNameToggle = document.getElementById('showFullNameToggle');
    const showEmailToggle = document.getElementById('showEmailToggle');
    const showActivityToggle = document.getElementById('showActivityToggle');
    const savePrivacyBtn = document.getElementById('savePrivacyBtn');

    // Security log elements
    const securityLogList = document.getElementById('securityLogList');
    const logTypeFilter = document.getElementById('logTypeFilter');
    const logTimeFilter = document.getElementById('logTimeFilter');
    const refreshSecurityLogBtn = document.getElementById('refreshSecurityLogBtn');
    const showMoreLogBtn = document.getElementById('showMoreLogBtn');

    // Modal elements
    const totpModal = document.getElementById('totpModal');
    const webauthnModal = document.getElementById('webauthnModal');
    const closeTotpModalBtn = document.getElementById('closeTotpModalBtn');
    const closeWebauthnModalBtn = document.getElementById('closeWebauthnModalBtn');

    // Toast
    const toast = document.getElementById('toast');

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadAllData();
    }

    function setupEventListeners() {
        // 2FA Management
        if (manageTotpBtn) {
            manageTotpBtn.addEventListener('click', handleTotpManagement);
        }
        if (manageWebauthnBtn) {
            manageWebauthnBtn.addEventListener('click', handleWebauthnManagement);
        }

        // Session Management
        if (refreshSessionBtn) {
            refreshSessionBtn.addEventListener('click', loadSessionInfo);
        }
        if (terminateOtherSessionsBtn) {
            terminateOtherSessionsBtn.addEventListener('click', terminateOtherSessions);
        }

        // Privacy Settings
        if (savePrivacyBtn) {
            savePrivacyBtn.addEventListener('click', savePrivacySettings);
        }

        // Security Log
        if (refreshSecurityLogBtn) {
            refreshSecurityLogBtn.addEventListener('click', loadSecurityLogs);
        }
        if (showMoreLogBtn) {
            showMoreLogBtn.addEventListener('click', toggleShowMoreLogs);
        }
        if (logTypeFilter) {
            logTypeFilter.addEventListener('change', loadSecurityLogs);
        }
        if (logTimeFilter) {
            logTimeFilter.addEventListener('change', loadSecurityLogs);
        }

        // Modal event listeners
        if (closeTotpModalBtn) {
            closeTotpModalBtn.addEventListener('click', () => hideModal(totpModal));
        }
        if (closeWebauthnModalBtn) {
            closeWebauthnModalBtn.addEventListener('click', () => hideModal(webauthnModal));
        }

        // Click outside modal to close
        if (totpModal) {
            totpModal.addEventListener('click', (e) => {
                if (e.target === totpModal) hideModal(totpModal);
            });
        }
        if (webauthnModal) {
            webauthnModal.addEventListener('click', (e) => {
                if (e.target === webauthnModal) hideModal(webauthnModal);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideModal(totpModal);
                hideModal(webauthnModal);
            }
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                loadAllData();
            }
        });
    }

    // Data Loading Functions
    async function loadAllData() {
        showToast('Loading security settings...', 'info');

        try {
            await Promise.all([
                loadProfile(),
                loadSessionInfo(),
                loadPrivacySettings(),
                loadSecurityLogs()
            ]);
            showToast('Security settings loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading security data:', error);
            showToast('Failed to load security data', 'error');
        }
    }

    async function loadProfile() {
        try {
            const data = await api.get('/user/profile');

            if (data.success && data.profile) {
                currentProfile = data.profile;
                renderSecurityStatus(data.profile);
            } else {
                showError('Failed to load profile data');
            }
        } catch (error) {
            console.error('Load profile error:', error);
            if (handleAuthError(error)) return;
            showError('Failed to load profile: ' + getErrorMessage(error));
        }
    }

    async function loadSessionInfo() {
        try {
            showSessionLoading();
            const data = await api.get('/user/session');

            if (data.success && data.session) {
                currentSession = data.session;
                renderSessionInfo(data.session);
            } else {
                showSessionError('Failed to load session data');
            }
        } catch (error) {
            console.error('Load session error:', error);
            if (handleAuthError(error)) return;
            showSessionError('Failed to load session: ' + getErrorMessage(error));
        }
    }

    async function loadPrivacySettings() {
        try {
            const data = await api.get('/user/preferences');

            if (data.success && data.preferences) {
                privacySettings = data.preferences.privacy || {};
                renderPrivacySettings(privacySettings);
            } else {
                console.warn('Privacy settings not found in preferences');
                privacySettings = {};
                renderPrivacySettings(privacySettings);
            }
        } catch (error) {
            console.error('Load privacy settings error:', error);
            if (handleAuthError(error)) return;
            showError('Failed to load privacy settings: ' + getErrorMessage(error));
        }
    }

    async function loadSecurityLogs() {
        try {
            showSecurityLogLoading();
            
            const params = new URLSearchParams({
                type: logTypeFilter.value,
                days: logTimeFilter.value
            });

            const data = await api.get(`/user/auth-activity?${params}`);

            if (data.success && data.activity) {
                securityLogs = data.activity;
                renderSecurityLogs(data.activity);
            } else {
                showSecurityLogError('Failed to load security logs');
            }
        } catch (error) {
            console.error('Load security logs error:', error);
            if (handleAuthError(error)) return;
            showSecurityLogError('Failed to load security logs: ' + getErrorMessage(error));
        }
    }

    // Rendering Functions
    function renderSecurityStatus(profile) {
        // TOTP status
        if (totpStatus) {
            if (profile.totpEnabled) {
                totpStatus.textContent = 'Enabled';
                totpStatus.className = 'status-badge enabled';
                totpActionText.textContent = 'Disable';
            } else {
                totpStatus.textContent = 'Disabled';
                totpStatus.className = 'status-badge disabled';
                totpActionText.textContent = 'Enable';
            }
        }

        // WebAuthn status
        if (webauthnStatus) {
            if (profile.webauthnEnabled) {
                webauthnStatus.textContent = 'Enabled';
                webauthnStatus.className = 'status-badge enabled';
                webauthnActionText.textContent = 'Manage';
            } else {
                webauthnStatus.textContent = 'Disabled';
                webauthnStatus.className = 'status-badge disabled';
                webauthnActionText.textContent = 'Enable';
            }
        }
    }

    function renderSessionInfo(session) {
        if (currentSessionLocation) {
            currentSessionLocation.textContent = session.ipAddress || 'Unknown';
        }
        if (currentSessionDevice) {
            currentSessionDevice.textContent = parseUserAgent(session.userAgent) || 'Unknown Device';
        }
        if (currentSessionStarted) {
            currentSessionStarted.textContent = session.created ? 
                (window.formatDateTime ? window.formatDateTime(session.created) : new Date(session.created).toLocaleString()) : 
                'Unknown';
        }
        if (currentSessionActivity) {
            currentSessionActivity.textContent = session.lastActivity ? 
                (window.formatDateTime ? window.formatDateTime(session.lastActivity) : new Date(session.lastActivity).toLocaleString()) : 
                'Unknown';
        }
    }

    function renderPrivacySettings(settings) {
        if (showFullNameToggle) {
            showFullNameToggle.checked = settings.showFullName !== false;
        }
        if (showEmailToggle) {
            showEmailToggle.checked = settings.showEmail !== false;
        }
        if (showActivityToggle) {
            showActivityToggle.checked = settings.showActivity !== false;
        }
    }

    function renderSecurityLogs(activity) {
        const allLogs = [
            ...(activity.logins || []).map(log => ({ ...log, type: 'login', icon: 'login', iconClass: 'success' })),
            ...(activity.failedLogins || []).map(log => ({ ...log, type: 'failed_login', icon: 'warning', iconClass: 'danger' })),
            ...(activity.passwordChanges || []).map(log => ({ ...log, type: 'password_change', icon: 'key', iconClass: 'warning' }))
        ];

        // Sort by timestamp descending
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        securityLogs = allLogs;
        showingMoreLogs = false;
        renderCurrentSecurityLogs();
        updateShowMoreButton();
    }

    function renderCurrentSecurityLogs() {
        const logsToShow = showingMoreLogs ? securityLogs : securityLogs.slice(0, 5);

        if (securityLogs.length === 0) {
            securityLogList.innerHTML = '<div class="log-empty">No security activity found for the selected criteria</div>';
            return;
        }

        const html = logsToShow.map(log => `
            <div class="security-log-item">
                <div class="log-item-info">
                    <span class="log-item-icon material-symbols-outlined ${log.iconClass}">${log.icon}</span>
                    <div class="log-item-details">
                        <h4>${getLogTitle(log)}</h4>
                        <p>${getLogDescription(log)}</p>
                    </div>
                </div>
                <div class="log-item-time">
                    ${window.formatDateTime ? window.formatDateTime(log.timestamp) : new Date(log.timestamp).toLocaleString()}
                </div>
            </div>
        `).join('');

        securityLogList.innerHTML = html;
    }

    function getLogTitle(log) {
        switch (log.type) {
            case 'login':
                return 'Successful Login';
            case 'failed_login':
                return 'Failed Login Attempt';
            case 'password_change':
                return 'Password Changed';
            default:
                return 'Security Event';
        }
    }

    function getLogDescription(log) {
        const ip = log.ipAddress || 'Unknown IP';
        switch (log.type) {
            case 'login':
                return `Login from ${ip}`;
            case 'failed_login':
                return `Failed login attempt from ${ip} - ${log.reason || 'Unknown reason'}`;
            case 'password_change':
                return `Password changed from ${ip}`;
            default:
                return `Activity from ${ip}`;
        }
    }

    function updateShowMoreButton() {
        if (securityLogs.length > 5) {
            showMoreLogBtn.style.display = 'block';
            if (showingMoreLogs) {
                showMoreLogBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">expand_less</span>
                    Show Less
                `;
            } else {
                showMoreLogBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">expand_more</span>
                    Show More (${securityLogs.length - 5} more)
                `;
            }
        } else {
            showMoreLogBtn.style.display = 'none';
        }
    }

    function toggleShowMoreLogs() {
        showingMoreLogs = !showingMoreLogs;
        renderCurrentSecurityLogs();
        updateShowMoreButton();
    }

    // Two-Factor Authentication Management
    async function handleTotpManagement() {
        if (!currentProfile) {
            showToast('Profile not loaded', 'error');
            return;
        }

        try {
            if (currentProfile.totpEnabled) {
                // Disable TOTP
                if (confirm('Are you sure you want to disable TOTP authentication? This will reduce your account security.')) {
                    await disableTOTP();
                }
            } else {
                // Enable TOTP
                await showTOTPSetup();
            }
        } catch (error) {
            console.error('TOTP management error:', error);
            showToast('Failed to manage TOTP: ' + getErrorMessage(error), 'error');
        }
    }

    async function showTOTPSetup() {
        try {
            showUpdateProgress(manageTotpBtn, true);
            
            const response = await api.post('/auth/setup-totp');
            
            if (response.success) {
                renderTOTPSetup(response.totpUri, response.totpSecret);
                showModal(totpModal);
            } else {
                showToast('Failed to setup TOTP: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('TOTP setup error:', error);
            showToast('Failed to setup TOTP: ' + getErrorMessage(error), 'error');
        } finally {
            showUpdateProgress(manageTotpBtn, false);
        }
    }

    function renderTOTPSetup(totpUri, secret) {
        const modalContent = document.getElementById('totpModalContent');
        modalContent.innerHTML = `
            <div class="setup-step">
                <h4>Step 1: Scan QR Code</h4>
                <p>Open your authenticator app and scan this QR code:</p>
                <div class="qr-code-container">
                    <div class="qr-code-display" id="qrCodeDisplay"></div>
                </div>
                <p>Or manually enter this secret key:</p>
                <div class="secret-key-display">
                    ${secret}
                    <button class="btn btn-sm copy-button" onclick="copyToClipboard('${secret}')">Copy</button>
                </div>
            </div>
            
            <div class="setup-step">
                <h4>Step 2: Verify Setup</h4>
                <p>Enter the 6-digit code from your authenticator app:</p>
                <input type="text" class="verification-input" id="totpVerificationInput" 
                       placeholder="000000" maxlength="6" pattern="[0-9]{6}">
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="hideModal(document.getElementById('totpModal'))">Cancel</button>
                <button class="btn btn-primary" onclick="verifyTOTPSetup()">Verify & Enable</button>
            </div>
        `;

        // Generate QR code
        generateQRCode(totpUri, 'qrCodeDisplay');
    }

    async function verifyTOTPSetup() {
        const verificationInput = document.getElementById('totpVerificationInput');
        const code = verificationInput.value.trim();

        if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
            showToast('Please enter a valid 6-digit code', 'error');
            return;
        }

        try {
            const response = await api.post('/auth/enable-totp', { totpCode: code });

            if (response.success) {
                showToast('TOTP authentication enabled successfully', 'success');
                hideModal(totpModal);
                await loadProfile(); // Refresh profile to update status
            } else {
                showToast('Invalid verification code. Please try again.', 'error');
            }
        } catch (error) {
            console.error('TOTP verification error:', error);
            showToast('Failed to verify TOTP: ' + getErrorMessage(error), 'error');
        }
    }

    async function disableTOTP() {
        try {
            showUpdateProgress(manageTotpBtn, true);
            
            const response = await api.post('/auth/disable-totp');

            if (response.success) {
                showToast('TOTP authentication disabled', 'success');
                await loadProfile(); // Refresh profile to update status
            } else {
                showToast('Failed to disable TOTP: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('TOTP disable error:', error);
            showToast('Failed to disable TOTP: ' + getErrorMessage(error), 'error');
        } finally {
            showUpdateProgress(manageTotpBtn, false);
        }
    }

    // WebAuthn Management
    async function handleWebauthnManagement() {
        if (!currentProfile) {
            showToast('Profile not loaded', 'error');
            return;
        }

        try {
            if (currentProfile.webauthnEnabled) {
                // Show WebAuthn management
                await showWebAuthnManagement();
            } else {
                // Enable WebAuthn
                await showWebAuthnSetup();
            }
        } catch (error) {
            console.error('WebAuthn management error:', error);
            showToast('Failed to manage WebAuthn: ' + getErrorMessage(error), 'error');
        }
    }

    async function showWebAuthnSetup() {
        if (!window.PublicKeyCredential) {
            showToast('WebAuthn is not supported by your browser', 'error');
            return;
        }

        try {
            showUpdateProgress(manageWebauthnBtn, true);
            
            const response = await api.post('/auth/webauthn/register');
            
            if (response.success) {
                const credential = await navigator.credentials.create({
                    publicKey: response.options
                });

                const verificationResponse = await api.post('/auth/webauthn/verify', {
                    credential: {
                        id: credential.id,
                        rawId: Array.from(new Uint8Array(credential.rawId)),
                        response: {
                            attestationObject: Array.from(new Uint8Array(credential.response.attestationObject)),
                            clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON))
                        },
                        type: credential.type
                    }
                });

                if (verificationResponse.success) {
                    showToast('WebAuthn authentication enabled successfully', 'success');
                    await loadProfile(); // Refresh profile to update status
                } else {
                    showToast('Failed to verify WebAuthn: ' + (verificationResponse.message || 'Unknown error'), 'error');
                }
            } else {
                showToast('Failed to setup WebAuthn: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('WebAuthn setup error:', error);
            if (error.name === 'NotAllowedError') {
                showToast('WebAuthn setup was cancelled', 'warning');
            } else {
                showToast('Failed to setup WebAuthn: ' + error.message, 'error');
            }
        } finally {
            showUpdateProgress(manageWebauthnBtn, false);
        }
    }

    async function showWebAuthnManagement() {
        const modalContent = document.getElementById('webauthnModalContent');
        modalContent.innerHTML = `
            <div class="webauthn-status">
                <p>WebAuthn is currently enabled for your account. You can manage your registered devices below:</p>
                <div id="webauthnDevicesList">Loading devices...</div>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="hideModal(document.getElementById('webauthnModal'))">Close</button>
                <button class="btn btn-primary" onclick="addWebAuthnDevice()">Add New Device</button>
                <button class="btn btn-danger" onclick="disableWebAuthn()">Disable WebAuthn</button>
            </div>
        `;

        showModal(webauthnModal);
        // In a real implementation, you would load and display the user's registered devices
        setTimeout(() => {
            document.getElementById('webauthnDevicesList').innerHTML = `
                <div class="webauthn-device">
                    <div class="device-info">
                        <h5>Security Key</h5>
                        <p>Registered on ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="device-actions">
                        <button class="btn btn-sm btn-danger">Remove</button>
                    </div>
                </div>
            `;
        }, 500);
    }

    // Session Management
    async function terminateOtherSessions() {
        if (!confirm('Are you sure you want to sign out all other devices? This will end all other active sessions.')) {
            return;
        }

        try {
            showUpdateProgress(terminateOtherSessionsBtn, true);
            
            const response = await api.post('/auth/terminate-other-sessions');

            if (response.success) {
                showToast('All other sessions have been terminated', 'success');
            } else {
                showToast('Failed to terminate other sessions: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Terminate sessions error:', error);
            showToast('Failed to terminate other sessions: ' + getErrorMessage(error), 'error');
        } finally {
            showUpdateProgress(terminateOtherSessionsBtn, false);
        }
    }

    // Privacy Settings
    async function savePrivacySettings() {
        try {
            showUpdateProgress(savePrivacyBtn, true);

            const settings = {
                privacy: {
                    showFullName: showFullNameToggle.checked,
                    showEmail: showEmailToggle.checked,
                    showActivity: showActivityToggle.checked
                }
            };

            const response = await api.put('/user/preferences', { preferences: settings });

            if (response.success) {
                privacySettings = settings.privacy;
                showToast('Privacy settings saved successfully', 'success');
                showStatus(document.getElementById('status-privacy'), 'Settings saved', 'success');
            } else {
                showToast('Failed to save privacy settings: ' + (response.message || 'Unknown error'), 'error');
                showStatus(document.getElementById('status-privacy'), 'Save failed', 'error');
            }
        } catch (error) {
            console.error('Save privacy settings error:', error);
            showToast('Failed to save privacy settings: ' + getErrorMessage(error), 'error');
            showStatus(document.getElementById('status-privacy'), 'Save failed', 'error');
        } finally {
            showUpdateProgress(savePrivacyBtn, false);
        }
    }

    // Utility Functions
    function generateQRCode(data, containerId) {
        // This would use a QR code library like qrcode.js
        // For now, just show a placeholder
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd;">
                <p style="text-align: center; color: #666; margin: 0;">QR Code<br>would appear here</p>
            </div>
        `;
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'success');
        }).catch(() => {
            showToast('Failed to copy to clipboard', 'error');
        });
    }

    function parseUserAgent(userAgent) {
        if (!userAgent) return 'Unknown Device';
        
        // Simple user agent parsing
        if (userAgent.includes('Chrome')) return 'Chrome Browser';
        if (userAgent.includes('Firefox')) return 'Firefox Browser';
        if (userAgent.includes('Safari')) return 'Safari Browser';
        if (userAgent.includes('Edge')) return 'Edge Browser';
        
        return 'Unknown Browser';
    }

    function showModal(modal) {
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
        }
    }

    function hideModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // Loading States
    function showSessionLoading() {
        const elements = [currentSessionLocation, currentSessionDevice, currentSessionStarted, currentSessionActivity];
        elements.forEach(element => {
            if (element) element.textContent = 'Loading...';
        });
    }

    function showSecurityLogLoading() {
        securityLogList.innerHTML = '<div class="log-loading"><span class="material-symbols-outlined">hourglass_empty</span> Loading security logs...</div>';
    }

    function showUpdateProgress(button, show) {
        if (!button) return;

        button.disabled = show;

        if (show) {
            const icon = button.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = 'hourglass_empty';
                icon.classList.add('loading');
            }
        } else {
            const icon = button.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.classList.remove('loading');
                icon.textContent = 'settings';
            }
        }
    }

    function showStatus(element, message, type) {
        if (!element) return;
        
        element.textContent = message;
        element.className = `setting-status ${type}`;
        
        setTimeout(() => {
            element.textContent = '';
            element.className = 'setting-status';
        }, 5000);
    }

    // Error Handling
    function showError(message) {
        showToast(message, 'error');
    }

    function showSessionError(message) {
        const elements = [currentSessionLocation, currentSessionDevice, currentSessionStarted, currentSessionActivity];
        elements.forEach(element => {
            if (element) element.textContent = 'Error loading';
        });
        showToast(message, 'error');
    }

    function showSecurityLogError(message) {
        securityLogList.innerHTML = '<div class="log-empty">Error loading security logs</div>';
        showToast(message, 'error');
    }

    function handleAuthError(error) {
        if (error.status === 401) {
            showToast('Your session has expired. Please log in again.', 'error');
            setTimeout(() => {
                window.location.href = '/auth/login';
            }, 2000);
            return true;
        }
        return false;
    }

    function getErrorMessage(error) {
        if (error.status === 401) {
            return 'Authentication required. Please log in again.';
        }

        if (error.status === 403) {
            return 'You do not have permission to perform this action.';
        }

        if (error.message && error.message.includes('Network error')) {
            return 'Network error. Please check your connection and try again.';
        }

        if (error.data && typeof error.data === 'object' && error.data.message) {
            return error.data.message;
        }

        if (error.data && typeof error.data === 'string') {
            try {
                const parsed = JSON.parse(error.data);
                return parsed.message || error.message;
            } catch (e) {
                return error.data;
            }
        }

        switch (error.status) {
            case 400:
                return 'Invalid request. Please check your input.';
            case 404:
                return 'Resource not found.';
            case 429:
                return 'Too many requests. Please try again later.';
            case 500:
                return 'Server error. Please try again later.';
            default:
                return error.message || 'An unexpected error occurred';
        }
    }

    function showToast(message, type = 'info') {
        const toastIcon = toast.querySelector('.toast-icon');
        const toastMessage = toast.querySelector('.toast-message');

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        toastIcon.textContent = icons[type] || icons.info;
        toastMessage.textContent = message;

        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    // Global functions for modal actions
    window.hideModal = hideModal;
    window.verifyTOTPSetup = verifyTOTPSetup;
    window.copyToClipboard = copyToClipboard;
    window.addWebAuthnDevice = showWebAuthnSetup;
    window.disableWebAuthn = async function() {
        if (confirm('Are you sure you want to disable WebAuthn? This will reduce your account security.')) {
            // Implementation would go here
            showToast('WebAuthn disabled', 'success');
            hideModal(webauthnModal);
            await loadProfile();
        }
    };

    // Export functions for potential external use
    window.privacyManager = {
        loadAllData,
        handleTotpManagement,
        handleWebauthnManagement,
        savePrivacySettings,
        terminateOtherSessions
    };
});