document.addEventListener('DOMContentLoaded', function() {
    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Check if profile is editable from server
    const editableProfile = document.getElementById('editProfileBtn') !== null;

    // State variables
    let currentProfile = null;
    let currentSession = null;
    let currentActivity = null;
    let currentPreferences = null;
    let activeTab = 'logins';
    let showingMore = false;

    // DOM Elements
    const editProfileBtn = document.getElementById('editProfileBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshSessionBtn = document.getElementById('refreshSessionBtn');
    const refreshActivityBtn = document.getElementById('refreshActivityBtn');
    const showMoreBtn = document.getElementById('showMoreBtn');

    // Modal elements (only if editable)
    const editProfileModal = editableProfile ? document.getElementById('editProfileModal') : null;
    const closeEditModalBtn = editableProfile ? document.getElementById('closeEditModalBtn') : null;
    const cancelEditBtn = editableProfile ? document.getElementById('cancelEditBtn') : null;
    const editProfileForm = editableProfile ? document.getElementById('editProfileForm') : null;
    const saveProfileBtn = editableProfile ? document.getElementById('saveProfileBtn') : null;

    // Toast
    const toast = document.getElementById('toast');

    // Activity tabs
    const activityTabs = document.querySelectorAll('.activity-tab');

    // Keyboard shortcuts
    const keybinds = {
        'Escape': () => {
            if (editProfileModal) {
                editProfileModal.classList.remove('show');
            }
        },
        'Control+r': (e) => {
            e.preventDefault();
            loadAllData();
        }
    };

    // Add edit shortcut only if editable
    if (editableProfile) {
        keybinds['Control+e'] = (e) => {
            e.preventDefault();
            showEditProfileModal();
        };
    }

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        setupIcsFeedListeners();
        await loadAllData();
    }

    function setupEventListeners() {
        // Button listeners
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', showEditProfileModal);
        }
        refreshBtn.addEventListener('click', loadAllData);
        refreshSessionBtn.addEventListener('click', loadSessionInfo);
        refreshActivityBtn.addEventListener('click', loadAuthActivity);

        // Modal listeners (only if editable)
        if (editableProfile) {
            closeEditModalBtn.addEventListener('click', () => {
                editProfileModal.classList.remove('show');
            });
            cancelEditBtn.addEventListener('click', () => {
                editProfileModal.classList.remove('show');
            });
            editProfileForm.addEventListener('submit', handleProfileUpdate);

            // Modal backdrop clicks
            editProfileModal.addEventListener('click', (e) => {
                if (e.target === editProfileModal) {
                    editProfileModal.classList.remove('show');
                }
            });
        }

        // Activity tab listeners
        activityTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchActivityTab(tabName);
            });
        });

        // Show more button listener
        showMoreBtn.addEventListener('click', () => {
            showingMore = !showingMore;
            renderCurrentActivity();
            updateShowMoreButton();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const key = [
                e.ctrlKey ? 'Control' : '',
                e.shiftKey ? 'Shift' : '',
                e.altKey ? 'Alt' : '',
                e.metaKey ? 'Meta' : '',
                e.key,
            ]
                .filter(Boolean)
                .join('+');

            const action = keybinds[key];
            if (action) {
                action(e);
            }
        });
    }

    // Data Loading Functions
    async function loadAllData() {
        showToast('Refreshing profile data...', 'info');

        await Promise.all([
            loadProfile(),
            loadSessionInfo(),
            loadAuthActivity(),
            loadIcsFeedStatus()
        ]);

        showToast('Profile data refreshed successfully', 'success');
    }

    async function loadProfile() {
        try {
            showProfileLoading();
            const data = await api.get('/user/profile');

            if (data.success && data.profile) {
                currentProfile = data.profile;
                renderProfile(data.profile);
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
                renderSession(data.session);
            } else {
                showSessionError('Failed to load session data');
            }
        } catch (error) {
            console.error('Load session error:', error);
            if (handleAuthError(error)) return;
            showSessionError('Failed to load session: ' + getErrorMessage(error));
        }
    }

    async function loadAuthActivity() {
        try {
            showActivityLoading();
            const data = await api.get('/user/auth-activity');

            if (data.success && data.activity) {
                currentActivity = data.activity;
                renderActivity(data.activity);
            } else {
                showActivityError('Failed to load activity data');
            }
        } catch (error) {
            console.error('Load activity error:', error);
            if (handleAuthError(error)) return;
            showActivityError('Failed to load activity: ' + getErrorMessage(error));
        }
    }

    // Rendering Functions
    function renderProfile(profile) {
        // Header information
        const displayName = profile.full_name || profile.username || 'User';
        document.getElementById('profileDisplayName').textContent = displayName;
        document.getElementById('profileUsername').textContent = `@${profile.username || 'unknown'}`;
        document.getElementById('profileRoleBadge').textContent = profile.role || 'No Role';
        document.getElementById('profileHeaderCreated').textContent =
            profile.createdAt ? (window.formatDate ? window.formatDate(profile.createdAt) : new Date(profile.createdAt).toLocaleDateString()) : 'Unknown';

        // Basic profile information
        document.getElementById('profileUsername2').textContent = profile.username || 'Not set';
        document.getElementById('profileFullName').textContent = profile.full_name || 'Not set';
        document.getElementById('profileEmail').textContent = profile.email || 'Not set';
        document.getElementById('profileRole').textContent = profile.role || 'Not assigned';
        document.getElementById('profileService').textContent = profile.service || 'Not assigned';

        // Two-factor authentication status
        renderTwoFactorStatus(profile);
    }

    function renderTwoFactorStatus(profile) {
        const twofaHeaderStatus = document.getElementById('twofaHeaderStatus');
        const totpStatus = document.getElementById('totpStatus');
        const webauthnStatus = document.getElementById('webauthnStatus');

        // TOTP status
        totpStatus.className = `status-badge ${profile.totpEnabled ? 'enabled' : 'disabled'}`;
        totpStatus.textContent = profile.totpEnabled ? 'Enabled' : 'Disabled';

        // WebAuthn status
        webauthnStatus.className = `status-badge ${profile.webauthnEnabled ? 'enabled' : 'disabled'}`;
        webauthnStatus.textContent = profile.webauthnEnabled ? 'Enabled' : 'Disabled';

        // Header status indicators
        const indicators = [];
        if (profile.totpEnabled) {
            indicators.push('<span class="twofa-badge enabled">TOTP</span>');
        }
        if (profile.webauthnEnabled) {
            indicators.push('<span class="twofa-badge enabled">WebAuthn</span>');
        }
        if (indicators.length === 0) {
            indicators.push('<span class="twofa-badge disabled">None</span>');
        }

        twofaHeaderStatus.innerHTML = indicators.join(' ');
    }


    function renderSession(session) {
        document.getElementById('sessionCreated').textContent =
            session.created ? (window.formatDateTime ? window.formatDateTime(session.created) : new Date(session.created).toLocaleString()) : 'Unknown';
        document.getElementById('sessionLastActivity').textContent =
            session.lastActivity ? (window.formatDateTime ? window.formatDateTime(session.lastActivity) : new Date(session.lastActivity).toLocaleString()) : 'Unknown';
        document.getElementById('sessionExpires').textContent =
            session.expires ? (window.formatDateTime ? window.formatDateTime(session.expires) : new Date(session.expires).toLocaleString()) : 'Unknown';
        document.getElementById('sessionIpAddress').textContent = session.ipAddress || 'Unknown';
        document.getElementById('sessionUserAgent').textContent = session.userAgent || 'Unknown';
    }

    function renderActivity(activity) {
        currentActivity = activity;
        showingMore = false; // Reset show more state
        renderCurrentActivity();

        // Show/hide tabs based on available data
        const failedTab = document.getElementById('failedTab');
        const passwordTab = document.getElementById('passwordTab');

        if (activity.failedLogins && activity.failedLogins.length > 0) {
            failedTab.style.display = 'block';
        } else {
            failedTab.style.display = 'none';
        }

        if (activity.passwordChanges && activity.passwordChanges.length > 0) {
            passwordTab.style.display = 'block';
        } else {
            passwordTab.style.display = 'none';
        }

        updateShowMoreButton();
    }

    function renderCurrentActivity() {
        if (!currentActivity) return;

        switch (activeTab) {
            case 'logins':
                renderLogins(currentActivity.logins || []);
                break;
            case 'failed':
                renderFailedLogins(currentActivity.failedLogins || []);
                break;
            case 'password':
                renderPasswordChanges(currentActivity.passwordChanges || []);
                break;
        }
    }

    function renderLogins(logins) {
        const container = document.getElementById('recentLogins');

        if (logins.length === 0) {
            container.innerHTML = '<div class="activity-empty">No recent login activity</div>';
            return;
        }

        const itemsToShow = showingMore ? logins.length : Math.min(3, logins.length);
        const html = logins.slice(0, itemsToShow).map(login => `
            <div class="activity-item login">
                <div class="activity-info">
                    <div class="activity-type">Successful Login</div>
                    <div class="activity-details">${login.ipAddress || 'Unknown IP'}</div>
                </div>
                <div class="activity-time">${window.formatDateTime ? window.formatDateTime(login.timestamp) : new Date(login.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    function renderFailedLogins(failedLogins) {
        const container = document.getElementById('failedLogins');

        if (failedLogins.length === 0) {
            container.innerHTML = '<div class="activity-empty">No failed login attempts</div>';
            return;
        }

        const itemsToShow = showingMore ? failedLogins.length : Math.min(3, failedLogins.length);
        const html = failedLogins.slice(0, itemsToShow).map(attempt => `
            <div class="activity-item failed">
                <div class="activity-info">
                    <div class="activity-type">Failed Login Attempt</div>
                    <div class="activity-details">${attempt.ipAddress || 'Unknown IP'} - ${attempt.reason || 'Unknown reason'}</div>
                </div>
                <div class="activity-time">${window.formatDateTime ? window.formatDateTime(attempt.timestamp) : new Date(attempt.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    function renderPasswordChanges(passwordChanges) {
        const container = document.getElementById('passwordChanges');

        if (passwordChanges.length === 0) {
            container.innerHTML = '<div class="activity-empty">No password changes</div>';
            return;
        }

        const itemsToShow = showingMore ? passwordChanges.length : Math.min(3, passwordChanges.length);
        const html = passwordChanges.slice(0, itemsToShow).map(change => `
            <div class="activity-item password-change">
                <div class="activity-info">
                    <div class="activity-type">Password Changed</div>
                    <div class="activity-details">${change.ipAddress || 'Unknown IP'}</div>
                </div>
                <div class="activity-time">${window.formatDateTime ? window.formatDateTime(change.timestamp) : new Date(change.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    function updateShowMoreButton() {
        if (!currentActivity) {
            showMoreBtn.style.display = 'none';
            return;
        }

        let currentData = [];
        switch (activeTab) {
            case 'logins':
                currentData = currentActivity.logins || [];
                break;
            case 'failed':
                currentData = currentActivity.failedLogins || [];
                break;
            case 'password':
                currentData = currentActivity.passwordChanges || [];
                break;
        }

        if (currentData.length > 3) {
            showMoreBtn.style.display = 'block';
            if (showingMore) {
                showMoreBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">expand_less</span>
                    Show Less
                `;
            } else {
                showMoreBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">expand_more</span>
                    Show More (${currentData.length - 3} more)
                `;
            }
        } else {
            showMoreBtn.style.display = 'none';
        }
    }

    // Activity Tab Functions
    function switchActivityTab(tabName) {
        // Update active tab
        activityTabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show/hide content
        const activityLists = document.querySelectorAll('.activity-list');
        activityLists.forEach(list => {
            list.classList.remove('active');
            list.style.display = 'none';
        });

        const activeList = document.getElementById(getActivityListId(tabName));
        if (activeList) {
            activeList.classList.add('active');
            activeList.style.display = 'flex';
        }

        activeTab = tabName;
        showingMore = false; // Reset show more state when switching tabs
        renderCurrentActivity();
        updateShowMoreButton();
    }

    function getActivityListId(tabName) {
        switch (tabName) {
            case 'logins': return 'recentLogins';
            case 'failed': return 'failedLogins';
            case 'password': return 'passwordChanges';
            default: return 'recentLogins';
        }
    }

    // Modal Functions (only if editable)
    function showEditProfileModal() {
        if (!editableProfile || !currentProfile) {
            showToast('Profile editing not available', 'error');
            return;
        }

        // Populate form with current values (excluding username)
        document.getElementById('editFullName').value = currentProfile.full_name || '';
        document.getElementById('editEmail').value = currentProfile.email || '';
        document.getElementById('editTotpEnabled').checked = currentProfile.totpEnabled || false;
        document.getElementById('editWebauthnEnabled').checked = currentProfile.webauthnEnabled || false;


        editProfileModal.classList.add('show');
        document.getElementById('editFullName').focus();
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();

        if (!editableProfile) {
            showToast('Profile editing not available', 'error');
            return;
        }

        if (!currentProfile) {
            showToast('Profile data not loaded', 'error');
            return;
        }

        // Get form values
        const formData = {
            fullName: document.getElementById('editFullName').value.trim() || null,
            email: document.getElementById('editEmail').value.trim() || null,
            totpEnabled: document.getElementById('editTotpEnabled').checked,
            webauthnEnabled: document.getElementById('editWebauthnEnabled').checked
        };

        // Only include changed fields
        const updateData = {};
        
        if (formData.fullName !== (currentProfile.fullName || null)) {
            updateData.fullName = formData.fullName;
        }
        
        if (formData.email !== (currentProfile.email || null)) {
            updateData.email = formData.email;
        }
        
        if (formData.totpEnabled !== (currentProfile.totpEnabled || false)) {
            updateData.totpEnabled = formData.totpEnabled;
        }
        
        if (formData.webauthnEnabled !== (currentProfile.webauthnEnabled || false)) {
            updateData.webauthnEnabled = formData.webauthnEnabled;
        }

        // Check if there are any changes
        if (Object.keys(updateData).length === 0) {
            showToast('No changes detected', 'info');
            editProfileModal.classList.remove('show');
            return;
        }

        // Validation for changed fields only
        if (updateData.fullName && updateData.fullName.length > 255) {
            showToast('Full name cannot exceed 255 characters', 'error');
            return;
        }

        if (updateData.email && !isValidEmail(updateData.email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        try {
            showUpdateProgress(true);

            const response = await api.put('/user/profile', updateData);

            if (response.success) {

                editProfileModal.classList.remove('show');
                showToast('Profile updated successfully', 'success');

                // Reload profile data to show changes
                await loadProfile();

                // Handle partial updates
                if (response.updateResults) {
                    const failedUpdates = response.updateResults.filter(result => !result.success);
                    if (failedUpdates.length > 0) {
                        const failedFields = failedUpdates.map(result => result.field).join(', ');
                        showToast(`Some updates failed: ${failedFields}`, 'warning');
                    }
                }
            } else {
                showToast('Failed to update profile: ' + (response.message || 'Unknown error'), 'error');
            }

        } catch (error) {
            console.error('Profile update error:', error);
            if (handleAuthError(error)) return;
            showToast('Failed to update profile: ' + getErrorMessage(error), 'error');
        } finally {
            showUpdateProgress(false);
        }
    }

    // Loading States
    function showProfileLoading() {
        const elements = [
            'profileDisplayName', 'profileUsername', 'profileUsername2',
            'profileFullName', 'profileEmail', 'profileRole', 'profileService',
            'profileRoleBadge', 'profileHeaderCreated'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Loading...';
            }
        });

        // Clear 2FA status
        document.getElementById('totpStatus').textContent = 'Loading...';
        document.getElementById('totpStatus').className = 'status-badge';
        document.getElementById('webauthnStatus').textContent = 'Loading...';
        document.getElementById('webauthnStatus').className = 'status-badge';
        document.getElementById('twofaHeaderStatus').innerHTML = '';
    }

    function showSessionLoading() {
        const elements = [
            'sessionCreated', 'sessionLastActivity', 'sessionExpires',
            'sessionIpAddress', 'sessionUserAgent'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Loading...';
            }
        });
    }

    function showActivityLoading() {
        document.getElementById('recentLogins').innerHTML =
            '<div class="loading">Loading recent logins...</div>';
        document.getElementById('failedLogins').innerHTML = '';
        document.getElementById('passwordChanges').innerHTML = '';

        // Hide optional tabs and show more button
        document.getElementById('failedTab').style.display = 'none';
        document.getElementById('passwordTab').style.display = 'none';
        showMoreBtn.style.display = 'none';
        showingMore = false;
    }


    function showUpdateProgress(show) {
        if (!editableProfile || !saveProfileBtn) return;

        saveProfileBtn.disabled = show;

        if (show) {
            saveProfileBtn.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 16px;">hourglass_empty</span>
                Saving...
            `;
        } else {
            saveProfileBtn.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 16px;">save</span>
                Save Changes
            `;
        }
    }

    // Error Handling
    function showError(message) {
        showToast(message, 'error');
    }

    function showSessionError(message) {
        const elements = [
            'sessionCreated', 'sessionLastActivity', 'sessionExpires',
            'sessionIpAddress', 'sessionUserAgent'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Error loading';
            }
        });

        showToast(message, 'error');
    }

    function showActivityError(message) {
        document.getElementById('recentLogins').innerHTML =
            '<div class="activity-empty">Error loading activity data</div>';
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

        if (error.message.includes('Network error')) {
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

    // Utility Functions
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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

    // Auto-refresh session info every 5 minutes
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadSessionInfo();
        }
    }, 5 * 60 * 1000);

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Refresh data when user returns to the page
            loadSessionInfo();
        }
    });

    // ICS Feed Functions
    let icsFeedEnabled = false;
    let icsFeedUrl = null;

    async function loadIcsFeedStatus() {
        try {
            console.log('Loading ICS feed status...');
            const response = await api.get('/ics/url');
            console.log('ICS feed response:', response);
            
            if (response.success && response.data) {
                icsFeedEnabled = response.data.enabled;
                icsFeedUrl = response.data.feedUrl;
                
                console.log('ICS feed loaded:', { enabled: icsFeedEnabled, url: icsFeedUrl });
                updateIcsFeedUI();
            } else {
                console.log('ICS feed response not successful or no data');
                updateIcsFeedStatus('error', 'Failed to load status');
            }
        } catch (error) {
            console.error('Error loading ICS feed status:', error);
            updateIcsFeedStatus('error', 'Failed to load status');
        }
    }

    function updateIcsFeedUI() {
        console.log('Updating ICS feed UI...');
        const toggle = document.getElementById('icsFeedToggle');
        const urlContainer = document.getElementById('icsFeedUrlContainer');
        const urlInput = document.getElementById('icsFeedUrl');
        const statusElement = document.getElementById('icsFeedStatus');
        
        console.log('Elements found:', { 
            toggle: !!toggle, 
            urlContainer: !!urlContainer, 
            urlInput: !!urlInput, 
            statusElement: !!statusElement 
        });
        
        // Enable toggle
        if (toggle) {
            toggle.disabled = false;
            toggle.checked = icsFeedEnabled;
            console.log('Toggle updated:', { disabled: toggle.disabled, checked: toggle.checked });
        }
        
        // Update status
        updateIcsFeedStatus(icsFeedEnabled ? 'enabled' : 'disabled', 
                           icsFeedEnabled ? 'Feed enabled' : 'Feed disabled');
        
        // Show/hide URL
        if (urlContainer) {
            urlContainer.style.display = icsFeedEnabled ? 'block' : 'none';
        }
        
        // Set URL value
        if (urlInput && icsFeedUrl) {
            urlInput.value = icsFeedUrl;
        }
    }

    function updateIcsFeedStatus(status, text) {
        const statusElement = document.getElementById('icsFeedStatus');
        if (statusElement) {
            statusElement.className = `ics-feed-status ${status}`;
            const statusText = statusElement.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = text;
            }
        }
    }

    function setupIcsFeedListeners() {
        console.log('Setting up ICS feed listeners...');
        const toggle = document.getElementById('icsFeedToggle');
        const copyBtn = document.getElementById('copyIcsFeedBtn');
        const subscribeBtn = document.getElementById('subscribeIcsFeedBtn');
        
        console.log('ICS elements for listeners:', { toggle: !!toggle, copyBtn: !!copyBtn, subscribeBtn: !!subscribeBtn });
        
        if (toggle) {
            console.log('Adding event listener to ICS toggle');
            toggle.addEventListener('change', handleIcsFeedToggle);
            
            // Test if listener is working
            toggle.addEventListener('click', function() {
                console.log('ICS toggle clicked (click event)');
            });
        } else {
            console.error('ICS feed toggle element not found');
        }
        
        if (copyBtn) {
            copyBtn.addEventListener('click', handleCopyIcsFeedUrl);
        }

        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', handleSubscribeIcsFeed);
        }
    }

    async function handleIcsFeedToggle(e) {
        const enabled = e.target.checked;
        const toggle = e.target;
        
        console.log('ICS feed toggle clicked:', { enabled, toggleElement: toggle });
        
        // Disable toggle during operation
        toggle.disabled = true;
        updateIcsFeedStatus('loading', enabled ? 'Enabling feed...' : 'Disabling feed...');
        
        try {
            const endpoint = enabled ? '/ics/enable' : '/ics/disable';
            console.log('Making request to:', endpoint);
            const response = await api.post(endpoint);
            console.log('Toggle response:', response);
            
            if (response.success) {
                icsFeedEnabled = response.data.enabled;
                icsFeedUrl = response.data.feedUrl;
                
                console.log('Feed updated successfully:', { enabled: icsFeedEnabled, url: icsFeedUrl });
                updateIcsFeedUI();
                showToast(`ICS feed ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
            } else {
                console.log('Toggle failed:', response.message);
                // Revert toggle on error
                toggle.checked = !enabled;
                showToast(response.message || 'Failed to update ICS feed', 'error');
            }
        } catch (error) {
            console.error('Error toggling ICS feed:', error);
            // Revert toggle on error
            toggle.checked = !enabled;
            showToast('Failed to update ICS feed', 'error');
        } finally {
            toggle.disabled = false;
        }
    }

    function handleCopyIcsFeedUrl() {
        const urlInput = document.getElementById('icsFeedUrl');
        if (!urlInput || !urlInput.value) return;
        
        // Copy to clipboard
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            showToast('Feed URL copied to clipboard', 'success');
            
            // Change button text temporarily
            const copyBtn = document.getElementById('copyIcsFeedBtn');
            if (copyBtn) {
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            showToast('Failed to copy URL', 'error');
        }
        
        // Clear selection
        window.getSelection().removeAllRanges();
    }

    function handleSubscribeIcsFeed() {
        const urlInput = document.getElementById('icsFeedUrl');
        if (!urlInput || !urlInput.value) {
            showToast('No feed URL available', 'error');
            return;
        }

        // Convert http/https URL to webcal for calendar subscription
        const httpUrl = urlInput.value;
        const webcalUrl = httpUrl.replace(/^https?:/, 'webcal:');
        
        console.log('Subscribing to webcal URL:', webcalUrl);
        
        try {
            // Open webcal URL - this will prompt the user's default calendar app
            window.location.href = webcalUrl;
            
            showToast('Opening calendar application...', 'success');
            
            // Change button text temporarily
            const subscribeBtn = document.getElementById('subscribeIcsFeedBtn');
            if (subscribeBtn) {
                const originalHtml = subscribeBtn.innerHTML;
                subscribeBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Opening...';
                setTimeout(() => {
                    subscribeBtn.innerHTML = originalHtml;
                }, 3000);
            }
        } catch (error) {
            console.error('Error opening webcal URL:', error);
            showToast('Failed to open calendar application', 'error');
        }
    }

    // ICS feed listeners are now called directly in init()

    // Export functions for potential external use
    window.profileManager = {
        loadProfile,
        loadSessionInfo,
        loadAuthActivity,
        showEditProfileModal: editableProfile ? showEditProfileModal : null
    };
});