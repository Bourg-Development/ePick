document.addEventListener('DOMContentLoaded', function() {
    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // State variables
    let currentProfile = null;
    let notificationSettings = null;

    // DOM Elements - Email notifications
    const emailAvailabilityStatus = document.getElementById('emailAvailabilityStatus');
    const emailNotificationCategories = document.getElementById('emailNotificationCategories');
    const saveNotificationBtn = document.getElementById('saveNotificationBtn');
    const resetNotificationBtn = document.getElementById('resetNotificationBtn');

    // Email notification toggles
    const loginAlertsToggle = document.getElementById('loginAlertsToggle');
    const passwordChangesToggle = document.getElementById('passwordChangesToggle');
    const twoFactorChangesToggle = document.getElementById('twoFactorChangesToggle');
    const suspiciousActivityToggle = document.getElementById('suspiciousActivityToggle');
    const maintenanceToggle = document.getElementById('maintenanceToggle');
    const featureUpdatesToggle = document.getElementById('featureUpdatesToggle');
    const systemAlertsToggle = document.getElementById('systemAlertsToggle');
    const analysisCompletionToggle = document.getElementById('analysisCompletionToggle');
    const dataExportToggle = document.getElementById('dataExportToggle');
    const reportGenerationToggle = document.getElementById('reportGenerationToggle');


    // Test elements
    const testEmailBtn = document.getElementById('testEmailBtn');
    const testToastBtn = document.getElementById('testToastBtn');
    const testSoundBtn = document.getElementById('testSoundBtn');

    // Toast
    const toast = document.getElementById('toast');
    
    // Mailing Lists elements
    const mailingListsContainer = document.getElementById('mailingListsContainer');
    const mailingListsLoading = document.getElementById('mailingListsLoading');
    const mailingListsContent = document.getElementById('mailingListsContent');
    const mailingListsList = document.getElementById('mailingListsList');
    const noSubscriptions = document.getElementById('noSubscriptions');
    const mailingListsError = document.getElementById('mailingListsError');
    const retryLoadLists = document.getElementById('retryLoadLists');

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadAllData();
        handleUrlParameters();
    }

    function setupEventListeners() {
        // Email notification settings
        if (saveNotificationBtn) {
            saveNotificationBtn.addEventListener('click', saveEmailNotificationSettings);
        }
        if (resetNotificationBtn) {
            resetNotificationBtn.addEventListener('click', resetNotificationSettings);
        }
        
        // Modal event listeners
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.addEventListener('click', function(e) {
                if (e.target === confirmModal) {
                    closeConfirmModal();
                }
            });
        }


        // Test notification buttons
        if (testEmailBtn) {
            testEmailBtn.addEventListener('click', sendTestEmail);
        }
        if (testToastBtn) {
            testToastBtn.addEventListener('click', showTestToast);
        }
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', playTestSound);
        }
        
        // Mailing lists
        if (retryLoadLists) {
            retryLoadLists.addEventListener('click', loadMailingLists);
        }

        // Enable/disable notification categories based on availability
        const emailToggles = [
            loginAlertsToggle, passwordChangesToggle, twoFactorChangesToggle,
            suspiciousActivityToggle, maintenanceToggle, featureUpdatesToggle,
            systemAlertsToggle, analysisCompletionToggle, dataExportToggle,
            reportGenerationToggle
        ];

        emailToggles.forEach(toggle => {
            if (toggle) {
                toggle.addEventListener('change', markSettingsChanged);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                loadAllData();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveEmailNotificationSettings();
            }
        });
    }

    // Data Loading Functions
    async function loadAllData() {
        showToast('Loading notification settings...', 'info');

        try {
            await Promise.all([
                loadProfile(),
                loadNotificationSettings(),
                loadMailingLists()
            ]);
            showToast('Notification settings loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading notification data:', error);
            showToast('Failed to load notification data', 'error');
        }
    }

    async function loadProfile() {
        try {
            const data = await api.get('/user/profile');

            if (data.success && data.profile) {
                currentProfile = data.profile;
                renderEmailAvailability(data.profile);
            } else {
                showError('Failed to load profile data');
            }
        } catch (error) {
            console.error('Load profile error:', error);
            if (handleAuthError(error)) return;
            showError('Failed to load profile: ' + getErrorMessage(error));
        }
    }

    async function loadNotificationSettings() {
        try {
            const data = await api.get('/user/preferences');

            if (data.success && data.preferences) {
                notificationSettings = data.preferences.notifications || {};
                renderNotificationSettings(notificationSettings);
            } else {
                console.warn('Notification settings not found in preferences');
                notificationSettings = {};
                renderNotificationSettings(notificationSettings);
            }
        } catch (error) {
            console.error('Load notification settings error:', error);
            if (handleAuthError(error)) return;
            showError('Failed to load notification settings: ' + getErrorMessage(error));
        }
    }

    
    async function loadMailingLists() {
        try {
            // Show loading state
            if (mailingListsLoading) mailingListsLoading.style.display = 'flex';
            if (mailingListsContent) mailingListsContent.style.display = 'none';
            if (mailingListsError) mailingListsError.style.display = 'none';

            const data = await api.get('/user/mailing-lists');

            if (data.success) {
                renderMailingLists(data.data.subscriptions || []);
            } else {
                showMailingListsError('Failed to load mailing list subscriptions');
            }
        } catch (error) {
            console.error('Load mailing lists error:', error);
            if (handleAuthError(error)) return;
            showMailingListsError('Failed to load mailing list subscriptions: ' + getErrorMessage(error));
        }
    }

    // Rendering Functions
    function renderEmailAvailability(profile) {
        const hasEmail = profile.email && profile.email.trim() !== '';
        
        if (hasEmail) {
            emailAvailabilityStatus.innerHTML = `
                <span class="material-symbols-outlined">check_circle</span>
                <div>
                    <strong>Email notifications available</strong><br>
                    Notifications will be sent to: ${profile.email}
                </div>
            `;
            emailAvailabilityStatus.className = 'notification-availability available';
            
            if (emailNotificationCategories) {
                emailNotificationCategories.style.display = 'block';
            }
        } else {
            emailAvailabilityStatus.innerHTML = `
                <span class="material-symbols-outlined">error</span>
                <div>
                    <strong>Email notifications unavailable</strong><br>
                    Please add an email address to your account to receive email notifications.
                </div>
            `;
            emailAvailabilityStatus.className = 'notification-availability unavailable';
            
            if (emailNotificationCategories) {
                emailNotificationCategories.style.display = 'none';
            }
        }
    }

    function renderNotificationSettings(settings) {
        // Security notifications
        if (loginAlertsToggle) {
            loginAlertsToggle.checked = settings.loginAlerts !== false;
        }
        if (passwordChangesToggle) {
            passwordChangesToggle.checked = settings.passwordChanges !== false;
        }
        if (twoFactorChangesToggle) {
            twoFactorChangesToggle.checked = settings.twoFactorChanges !== false;
        }
        if (suspiciousActivityToggle) {
            suspiciousActivityToggle.checked = settings.suspiciousActivity !== false;
        }

        // System notifications
        if (maintenanceToggle) {
            maintenanceToggle.checked = settings.maintenance !== false;
        }
        if (featureUpdatesToggle) {
            featureUpdatesToggle.checked = settings.featureUpdates === true;
        }
        if (systemAlertsToggle) {
            systemAlertsToggle.checked = settings.systemAlerts !== false;
        }

        // Activity notifications
        if (analysisCompletionToggle) {
            analysisCompletionToggle.checked = settings.analysisCompletion !== false;
        }
        if (dataExportToggle) {
            dataExportToggle.checked = settings.dataExport !== false;
        }
        if (reportGenerationToggle) {
            reportGenerationToggle.checked = settings.reportGeneration !== false;
        }
    }

    
    function renderMailingLists(subscriptions) {
        // Hide loading, show content
        if (mailingListsLoading) mailingListsLoading.style.display = 'none';
        if (mailingListsError) mailingListsError.style.display = 'none';
        if (mailingListsContent) mailingListsContent.style.display = 'block';

        if (!subscriptions || subscriptions.length === 0) {
            if (noSubscriptions) noSubscriptions.style.display = 'block';
            if (mailingListsList) mailingListsList.innerHTML = '';
            return;
        }

        if (noSubscriptions) noSubscriptions.style.display = 'none';
        
        if (mailingListsList) {
            mailingListsList.innerHTML = subscriptions.map(subscription => `
                <div class="mailing-list-item" data-list-id="${subscription.id}">
                    <div class="mailing-list-info">
                        <h4 class="mailing-list-name">${escapeHtml(subscription.name)}</h4>
                        <p class="mailing-list-description">${escapeHtml(subscription.description || 'No description available')}</p>
                        <div class="mailing-list-meta">
                            <span>Subscribed: ${formatDate(subscription.subscribed_at)}</span>
                        </div>
                    </div>
                    <div class="mailing-list-actions">
                        <button class="unsubscribe-btn" onclick="unsubscribeFromList(${subscription.id}, '${escapeHtml(subscription.name)}')" ${!subscription.can_unsubscribe ? 'disabled' : ''}>
                            <span class="material-symbols-outlined">unsubscribe</span>
                            Unsubscribe
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    function showMailingListsError(message) {
        if (mailingListsLoading) mailingListsLoading.style.display = 'none';
        if (mailingListsContent) mailingListsContent.style.display = 'none';
        if (mailingListsError) {
            mailingListsError.style.display = 'flex';
            const errorSpan = mailingListsError.querySelector('span:not(.material-symbols-outlined)');
            if (errorSpan) {
                errorSpan.textContent = message;
            }
        }
    }

    // Save Functions
    async function saveEmailNotificationSettings() {
        if (!currentProfile || !currentProfile.email) {
            showToast('Email address required for email notifications', 'error');
            return;
        }

        try {
            showUpdateProgress(saveNotificationBtn, true);

            const settings = {
                notifications: {
                    email: true, // Master email toggle
                    loginAlerts: loginAlertsToggle.checked,
                    passwordChanges: passwordChangesToggle.checked,
                    twoFactorChanges: twoFactorChangesToggle.checked,
                    suspiciousActivity: suspiciousActivityToggle.checked,
                    maintenance: maintenanceToggle.checked,
                    featureUpdates: featureUpdatesToggle.checked,
                    systemAlerts: systemAlertsToggle.checked,
                    analysisCompletion: analysisCompletionToggle.checked,
                    dataExport: dataExportToggle.checked,
                    reportGeneration: reportGenerationToggle.checked
                }
            };

            const response = await api.put('/user/preferences', { preferences: settings });

            if (response.success) {
                notificationSettings = settings.notifications;
                showToast('Email notification settings saved successfully', 'success');
                showStatus(document.getElementById('status-notifications'), 'Settings saved', 'success');
            } else {
                showToast('Failed to save notification settings: ' + (response.message || 'Unknown error'), 'error');
                showStatus(document.getElementById('status-notifications'), 'Save failed', 'error');
            }
        } catch (error) {
            console.error('Save notification settings error:', error);
            showToast('Failed to save notification settings: ' + getErrorMessage(error), 'error');
            showStatus(document.getElementById('status-notifications'), 'Save failed', 'error');
        } finally {
            showUpdateProgress(saveNotificationBtn, false);
        }
    }


    async function resetNotificationSettings() {
        showConfirmModal(
            'Reset Notification Settings',
            'Are you sure you want to reset all notification settings to their defaults? This cannot be undone.',
            async () => {
                await performResetNotificationSettings();
            }
        );
    }
    
    async function performResetNotificationSettings() {

        try {
            showUpdateProgress(resetNotificationBtn, true);

            const defaultSettings = {
                notifications: {
                    email: true,
                    loginAlerts: true,
                    passwordChanges: true,
                    twoFactorChanges: true,
                    suspiciousActivity: true,
                    maintenance: true,
                    featureUpdates: false,
                    systemAlerts: true,
                    analysisCompletion: true,
                    dataExport: true,
                    reportGeneration: true
                }
            };

            const response = await api.put('/user/preferences', { preferences: defaultSettings });

            if (response.success) {
                notificationSettings = defaultSettings.notifications;
                renderNotificationSettings(notificationSettings);
                showToast('Notification settings reset to defaults', 'success');
                showStatus(document.getElementById('status-notifications'), 'Settings reset', 'success');
            } else {
                showToast('Failed to reset notification settings: ' + (response.message || 'Unknown error'), 'error');
                showStatus(document.getElementById('status-notifications'), 'Reset failed', 'error');
            }
        } catch (error) {
            console.error('Reset notification settings error:', error);
            showToast('Failed to reset notification settings: ' + getErrorMessage(error), 'error');
            showStatus(document.getElementById('status-notifications'), 'Reset failed', 'error');
        } finally {
            showUpdateProgress(resetNotificationBtn, false);
        }
    }

    // Test Functions
    async function sendTestEmail() {
        if (!currentProfile || !currentProfile.email) {
            showToast('Email address required to send test email', 'error');
            return;
        }

        try {
            showUpdateProgress(testEmailBtn, true);
            showStatus(document.getElementById('status-test'), 'Sending test email...', 'pending');

            const response = await api.post('/user/test-notification', { 
                type: 'email',
                email: currentProfile.email
            });

            if (response.success) {
                showToast('Test email sent successfully', 'success');
                showStatus(document.getElementById('status-test'), 'Test email sent', 'success');
            } else {
                showToast('Failed to send test email: ' + (response.message || 'Unknown error'), 'error');
                showStatus(document.getElementById('status-test'), 'Test email failed', 'error');
            }
        } catch (error) {
            console.error('Send test email error:', error);
            showToast('Failed to send test email: ' + getErrorMessage(error), 'error');
            showStatus(document.getElementById('status-test'), 'Test email failed', 'error');
        } finally {
            showUpdateProgress(testEmailBtn, false);
        }
    }

    function showTestToast() {
        showToast('This is a test notification! Your toast notifications are working correctly.', 'success');
        showStatus(document.getElementById('status-test'), 'Test toast displayed', 'success');
    }

    function playTestSound() {
        try {
            // Create and play a simple notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            showToast('Test notification sound played', 'success');
            showStatus(document.getElementById('status-test'), 'Test sound played', 'success');
        } catch (error) {
            console.error('Play test sound error:', error);
            showToast('Failed to play test sound', 'error');
            showStatus(document.getElementById('status-test'), 'Test sound failed', 'error');
        }
    }

    // Utility Functions
    function markSettingsChanged() {
        // Visual indication that settings have changed
        if (saveNotificationBtn) {
            saveNotificationBtn.style.background = '#ffc107';
            saveNotificationBtn.querySelector('span').textContent = 'Unsaved changes';
            
            setTimeout(() => {
                saveNotificationBtn.style.background = '';
                saveNotificationBtn.querySelector('span').textContent = 'Save Notification Settings';
            }, 3000);
        }
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
                // Restore original icon based on button
                if (button.id.includes('save')) {
                    icon.textContent = 'save';
                } else if (button.id.includes('reset')) {
                    icon.textContent = 'refresh';
                } else if (button.id.includes('test')) {
                    if (button.id.includes('Email')) icon.textContent = 'email';
                    else if (button.id.includes('Toast')) icon.textContent = 'notifications';
                    else if (button.id.includes('Sound')) icon.textContent = 'volume_up';
                }
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
            info: 'info',
            pending: 'hourglass_empty'
        };

        toastIcon.textContent = icons[type] || icons.info;
        toastMessage.textContent = message;

        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    // Modal functions
    let confirmModalCallback = null;
    
    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('confirmModalTitle');
        const modalMessage = document.getElementById('confirmModalMessage');
        const confirmBtn = document.getElementById('confirmModalAction');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Remove any existing event listener
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Set the new callback
        confirmModalCallback = onConfirm;
        newConfirmBtn.addEventListener('click', handleConfirmAction);
        
        modal.classList.add('show');
    }
    
    function closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        modal.classList.remove('show');
        confirmModalCallback = null;
    }
    
    function handleConfirmAction() {
        if (confirmModalCallback) {
            confirmModalCallback();
        }
        closeConfirmModal();
    }
    
    // Make modal functions globally available
    window.closeConfirmModal = closeConfirmModal;

    // Mailing List Functions
    async function unsubscribeFromList(listId, listName) {
        showConfirmModal(
            'Unsubscribe from Mailing List',
            `Are you sure you want to unsubscribe from "${listName}"? You will no longer receive emails from this mailing list.`,
            async () => {
                await performUnsubscribe(listId, listName);
            }
        );
    }
    
    async function performUnsubscribe(listId, listName) {

        try {
            const button = document.querySelector(`[data-list-id="${listId}"] .unsubscribe-btn`);
            const icon = button?.querySelector('.material-symbols-outlined');
            
            // Show loading state
            if (button) {
                button.disabled = true;
                button.classList.add('loading');
            }
            if (icon) {
                icon.textContent = 'hourglass_empty';
            }

            const response = await api.delete(`/user/mailing-lists/${listId}`);

            if (response.success) {
                showToast(response.message || `Successfully unsubscribed from ${listName}`, 'success');
                
                // Remove the item from the UI
                const listItem = document.querySelector(`[data-list-id="${listId}"]`);
                if (listItem) {
                    listItem.style.opacity = '0.5';
                    listItem.style.pointerEvents = 'none';
                    
                    setTimeout(() => {
                        listItem.remove();
                        
                        // Check if no subscriptions remain
                        const remainingItems = mailingListsList?.children.length || 0;
                        if (remainingItems === 0) {
                            if (noSubscriptions) noSubscriptions.style.display = 'block';
                        }
                    }, 1000);
                }
            } else {
                showToast('Failed to unsubscribe: ' + (response.message || 'Unknown error'), 'error');
                
                // Reset button state
                if (button) {
                    button.disabled = false;
                    button.classList.remove('loading');
                }
                if (icon) {
                    icon.textContent = 'unsubscribe';
                }
            }
        } catch (error) {
            console.error('Unsubscribe error:', error);
            showToast('Failed to unsubscribe: ' + getErrorMessage(error), 'error');
            
            // Reset button state
            const button = document.querySelector(`[data-list-id="${listId}"] .unsubscribe-btn`);
            const icon = button?.querySelector('.material-symbols-outlined');
            if (button) {
                button.disabled = false;
                button.classList.remove('loading');
            }
            if (icon) {
                icon.textContent = 'unsubscribe';
            }
        }
    }
    
    // Utility Functions
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }

    // Handle URL parameters for highlighting and scrolling
    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const listId = urlParams.get('list');
        const shouldHighlight = urlParams.get('highlight') === 'true';
        const hash = window.location.hash;
        
        if (listId && shouldHighlight) {
            // Wait a bit for the page to fully load
            setTimeout(() => {
                highlightMailingList(listId);
                
                // If hash is #mailing-lists, scroll to that section
                if (hash === '#mailing-lists') {
                    scrollToMailingLists();
                }
            }, 500);
        } else if (hash === '#mailing-lists') {
            // Just scroll if we have the hash but no specific list
            setTimeout(() => {
                scrollToMailingLists();
            }, 500);
        }
    }
    
    function highlightMailingList(listId) {
        const listItem = document.querySelector(`[data-list-id="${listId}"]`);
        if (listItem) {
            // Add highlight class
            listItem.classList.add('highlighted');
            
            // Remove highlight after a few seconds
            setTimeout(() => {
                listItem.classList.remove('highlighted');
            }, 5000);
        }
    }
    
    function scrollToMailingLists() {
        const mailingListsSection = document.querySelector('#mailingListsContainer')?.closest('.settings-card');
        if (mailingListsSection) {
            // Scroll with offset for navbar
            const navbarHeight = 70; // Adjust based on your navbar height
            const elementPosition = mailingListsSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Also add a temporary highlight to the section
            mailingListsSection.classList.add('section-highlighted');
            setTimeout(() => {
                mailingListsSection.classList.remove('section-highlighted');
            }, 3000);
        }
    }

    // Make unsubscribe function globally available
    window.unsubscribeFromList = unsubscribeFromList;

    // Export functions for potential external use
    window.notificationManager = {
        loadAllData,
        saveEmailNotificationSettings,
        sendTestEmail,
        showTestToast,
        playTestSound,
        loadMailingLists,
        unsubscribeFromList
    };
});