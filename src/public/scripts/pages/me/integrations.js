document.addEventListener('DOMContentLoaded', function() {
    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // State variables
    let icsFeedEnabled = false;
    let icsFeedUrl = '';
    let emailNotificationsAvailable = false;
    let currentPreferences = null;

    // DOM Elements
    const icsFeedToggle = document.getElementById('icsFeedToggle');
    const icsFeedStatus = document.getElementById('icsFeedStatus');
    const icsFeedUrlContainer = document.getElementById('icsFeedUrlContainer');
    const icsFeedUrlInput = document.getElementById('icsFeedUrl');
    const copyIcsFeedBtn = document.getElementById('copyIcsFeedBtn');
    const subscribeIcsFeedBtn = document.getElementById('subscribeIcsFeedBtn');
    
    // Email notifications
    const emailAvailabilityStatus = document.getElementById('emailAvailabilityStatus');
    const emailNotificationCategories = document.getElementById('emailNotificationCategories');
    const emailLoginAlerts = document.getElementById('emailLoginAlerts');
    const emailPasswordChanges = document.getElementById('emailPasswordChanges');
    const emailSecurityChanges = document.getElementById('emailSecurityChanges');
    const emailSystemMaintenance = document.getElementById('emailSystemMaintenance');
    const emailAccountUpdates = document.getElementById('emailAccountUpdates');
    
    // Display preferences
    const languageSelect = document.getElementById('languageSelect');
    const saveLanguageBtn = document.getElementById('saveLanguageBtn');
    const languageStatus = document.getElementById('status-language');
    
    const dateFormatSelect = document.getElementById('dateFormatSelect');
    const saveDateFormatBtn = document.getElementById('saveDateFormatBtn');
    const dateFormatStatus = document.getElementById('status-dateformat');
    
    const timeFormatSelect = document.getElementById('timeFormatSelect');
    const saveTimeFormatBtn = document.getElementById('saveTimeFormatBtn');
    const timeFormatStatus = document.getElementById('status-timeformat');
    
    const timezoneSelect = document.getElementById('timezoneSelect');
    const saveTimezoneBtn = document.getElementById('saveTimezoneBtn');
    const timezoneStatus = document.getElementById('status-timezone');

    // Toast
    const toast = document.getElementById('toast');

    // Initialize page
    init();

    async function init() {
        try {
            await Promise.all([
                loadIcsFeedStatus(),
                loadEmailNotificationStatus(),
                loadUserPreferences()
            ]);
        } catch (error) {
            console.error('Error initializing integrations page:', error);
            showToast(__('profile.integrations.failedToLoadSettings'), 'error');
        }
    }

    // ICS Feed Functions
    async function loadIcsFeedStatus() {
        try {
            const response = await api.get('/ics/url');
            
            if (response.success && response.data) {
                const isEnabled = response.data.enabled;
                const feedUrl = response.data.feedUrl;
                
                icsFeedEnabled = isEnabled;
                icsFeedUrl = feedUrl || '';
                updateIcsFeedUI(isEnabled, feedUrl);
            } else {
                icsFeedEnabled = false;
                updateIcsFeedUI(false);
            }
        } catch (error) {
            console.error('Error loading ICS feed status:', error);
            updateIcsFeedUI(false);
        }
    }

    function updateIcsFeedUI(enabled, url = null) {
        icsFeedToggle.disabled = false;
        icsFeedToggle.checked = enabled;
        
        const statusIcon = icsFeedStatus.querySelector('.material-symbols-outlined');
        const statusText = icsFeedStatus.querySelector('.status-text');
        
        if (enabled && url) {
            statusIcon.textContent = 'check_circle';
            statusText.textContent = __('profile.integrations.calendarFeedActive');
            icsFeedStatus.style.color = '#27ae60';
            
            icsFeedUrlInput.value = url;
            icsFeedUrlContainer.style.display = 'block';
        } else {
            statusIcon.textContent = 'cancel';
            statusText.textContent = __('profile.integrations.calendarFeedDisabled');
            icsFeedStatus.style.color = '#e74c3c';
            
            icsFeedUrlContainer.style.display = 'none';
        }
    }

    async function toggleIcsFeed() {
        if (icsFeedToggle.disabled) return;
        
        icsFeedToggle.disabled = true;
        const newState = icsFeedToggle.checked;
        
        try {
            if (newState) {
                // Enable ICS feed
                const response = await api.post('/ics/enable');
                if (response.success) {
                    // Check for feedUrl in response.data
                    const feedUrl = response.data?.feedUrl;
                    if (feedUrl) {
                        icsFeedEnabled = true;
                        icsFeedUrl = feedUrl;
                        updateIcsFeedUI(true, feedUrl);
                        showToast(__('profile.integrations.calendarFeedEnabledSuccess'), 'success');
                    } else {
                        throw new Error(__('profile.integrations.feedUrlNotFound'));
                    }
                } else {
                    throw new Error(response.message || __('profile.integrations.failedToEnableIcs'));
                }
            } else {
                // Disable ICS feed
                const response = await api.post('/ics/disable');
                if (response.success) {
                    icsFeedEnabled = false;
                    icsFeedUrl = '';
                    updateIcsFeedUI(false);
                    showToast(__('profile.integrations.calendarFeedDisabledSuccess'), 'success');
                } else {
                    throw new Error(response.message || __('profile.integrations.failedToDisableIcs'));
                }
            }
        } catch (error) {
            console.error('Error toggling ICS feed:', error);
            // Revert toggle state
            icsFeedToggle.checked = !newState;
            showToast(getErrorMessage(error), 'error');
        } finally {
            icsFeedToggle.disabled = false;
        }
    }

    function copyIcsFeedUrl() {
        if (!icsFeedUrl) return;
        
        navigator.clipboard.writeText(icsFeedUrl).then(() => {
            showToast(__('profile.integrations.feedUrlCopied'), 'success');
        }).catch(error => {
            console.error('Error copying to clipboard:', error);
            // Fallback selection method
            icsFeedUrlInput.select();
            document.execCommand('copy');
            showToast(__('profile.integrations.feedUrlCopied'), 'success');
        });
    }

    function subscribeToIcsFeed() {
        if (!icsFeedUrl) return;
        
        // Convert HTTP/HTTPS URL to webcal for calendar subscription
        const webcalUrl = icsFeedUrl.replace(/^https?:/, 'webcal:');
        console.log('Original URL:', icsFeedUrl);
        console.log('Webcal URL:', webcalUrl);
        
        window.open(webcalUrl, '_blank');
    }

    // Email Notification Functions
    async function loadEmailNotificationStatus() {
        try {
            // For now, assume email notifications are available
            // TODO: Implement proper email status check endpoint
            emailNotificationsAvailable = true;
            emailAvailabilityStatus.innerHTML = `
                <div class="notification-available">
                    <span class="material-symbols-outlined" style="color: #27ae60;">check_circle</span>
                    <span>Email notifications are available and configured</span>
                </div>
            `;
            emailNotificationCategories.style.display = 'block';
            
            // Load current notification preferences
            await loadEmailPreferences();
        } catch (error) {
            console.error('Error checking email status:', error);
            emailAvailabilityStatus.innerHTML = `
                <div class="notification-error">
                    <span class="material-symbols-outlined" style="color: #f39c12;">warning</span>
                    <span>Unable to check email notification status</span>
                </div>
            `;
        }
    }

    async function loadEmailPreferences() {
        if (!emailNotificationsAvailable) return;
        
        try {
            const response = await api.get('/user/preferences');
            if (response.success && response.preferences) {
                const prefs = response.preferences;
                
                emailLoginAlerts.checked = prefs.emailLoginAlerts !== false;
                emailPasswordChanges.checked = prefs.emailPasswordChanges !== false;
                emailSecurityChanges.checked = prefs.emailSecurityChanges !== false;
                emailSystemMaintenance.checked = prefs.emailSystemMaintenance !== false;
                emailAccountUpdates.checked = prefs.emailAccountUpdates !== false;
            }
        } catch (error) {
            console.error('Error loading email preferences:', error);
        }
    }

    async function saveEmailPreferences() {
        if (!emailNotificationsAvailable) return;
        
        try {
            const preferences = {
                emailLoginAlerts: emailLoginAlerts.checked,
                emailPasswordChanges: emailPasswordChanges.checked,
                emailSecurityChanges: emailSecurityChanges.checked,
                emailSystemMaintenance: emailSystemMaintenance.checked,
                emailAccountUpdates: emailAccountUpdates.checked
            };
            
            const response = await api.put('/user/preferences', { preferences });
            if (response.success) {
                showToast(__('profile.integrations.emailPreferencesSaved'), 'success');
            } else {
                throw new Error(response.message || __('profile.integrations.failedToSavePreferences'));
            }
        } catch (error) {
            console.error('Error saving email preferences:', error);
            showToast(getErrorMessage(error), 'error');
        }
    }

    // Language Functions
    async function loadUserPreferences() {
        try {
            const response = await api.get('/user/preferences');
            if (response.success && response.preferences) {
                currentPreferences = response.preferences;
                
                // Update language select if preference exists
                if (response.preferences.language) {
                    languageSelect.value = response.preferences.language;
                    languageSelect.dataset.currentLang = response.preferences.language;
                } else {
                    // Set default to 'en' if no language preference exists
                    languageSelect.dataset.currentLang = 'en';
                }
                
                // Update date format
                if (response.preferences.dateFormat) {
                    dateFormatSelect.value = response.preferences.dateFormat;
                }
                
                // Update time format
                if (response.preferences.timeFormat) {
                    timeFormatSelect.value = response.preferences.timeFormat;
                }
                
                // Update timezone
                if (response.preferences.timezone) {
                    timezoneSelect.value = response.preferences.timezone;
                }
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    async function saveLanguagePreference() {
        const selectedLanguage = languageSelect.value;
        const currentLanguage = languageSelect.dataset.currentLang || 'en';
        
        if (selectedLanguage === currentLanguage) {
            showToast(__('profile.integrations.languageAlreadySet'), 'success');
            return;
        }
        
        saveLanguageBtn.disabled = true;
        saveLanguageBtn.classList.add('loading');
        
        try {
            const preferences = {
                ...currentPreferences,
                language: selectedLanguage
            };
            
            const response = await api.put('/user/preferences', { preferences });
            
            console.log('Language API response received:', response);
            console.log('DEBUG - User ID:', response.debug?.userId);
            console.log('DEBUG - Language sent:', response.debug?.languageInPreferences);
            console.log('DEBUG - Language in DB after save:', response.debug?.actualUserLanguageInDB);
            
            if (response.success) {
                languageStatus.textContent = 'Language preference saved. Applying changes...';
                languageStatus.className = 'setting-status success';
                showToast(__('profile.integrations.languagePreferenceSaved'), 'success');
                
                // Update current preferences
                currentPreferences = preferences;
                
                // Update dataset for future comparisons
                languageSelect.dataset.currentLang = selectedLanguage;
                
                // Hide save button since preference is now saved
                saveLanguageBtn.style.display = 'none';
                
                // Automatically reload the page to apply the new language
                console.log('Language preference saved, reloading page in 500ms');
                setTimeout(() => {
                    console.log(__('profile.integrations.reloadingPage'));
                    window.location.reload();
                }, 500); // Give user time to see the success message
            } else {
                throw new Error(response.message || __('profile.integrations.failedToSaveLanguage'));
            }
        } catch (error) {
            console.error('Error saving language preference:', error);
            languageStatus.textContent = getErrorMessage(error);
            languageStatus.className = 'setting-status error';
            showToast(getErrorMessage(error), 'error');
            
            // Reset select to previous value
            languageSelect.value = currentLanguage;
        } finally {
            saveLanguageBtn.disabled = false;
            saveLanguageBtn.classList.remove('loading');
        }
    }

    async function saveDateFormatPreference() {
        const selectedFormat = dateFormatSelect.value;
        
        saveDateFormatBtn.disabled = true;
        saveDateFormatBtn.classList.add('loading');
        
        try {
            const preferences = {
                ...currentPreferences,
                dateFormat: selectedFormat
            };
            
            const response = await api.put('/user/preferences', { preferences });
            
            if (response.success) {
                dateFormatStatus.textContent = __('profile.integrations.dateFormatSavedSuccess');
                dateFormatStatus.className = 'setting-status success';
                showToast(__('profile.integrations.datePreferenceSaved'), 'success');
                
                // Update current preferences
                currentPreferences = preferences;
                
                // Hide save button
                saveDateFormatBtn.style.display = 'none';
            } else {
                throw new Error(response.message || __('profile.integrations.failedToSaveDateFormat'));
            }
        } catch (error) {
            console.error('Error saving date format:', error);
            dateFormatStatus.textContent = getErrorMessage(error);
            dateFormatStatus.className = 'setting-status error';
            showToast(getErrorMessage(error), 'error');
        } finally {
            saveDateFormatBtn.disabled = false;
            saveDateFormatBtn.classList.remove('loading');
        }
    }

    async function saveTimeFormatPreference() {
        const selectedFormat = timeFormatSelect.value;
        
        saveTimeFormatBtn.disabled = true;
        saveTimeFormatBtn.classList.add('loading');
        
        try {
            const preferences = {
                ...currentPreferences,
                timeFormat: selectedFormat
            };
            
            const response = await api.put('/user/preferences', { preferences });
            
            if (response.success) {
                timeFormatStatus.textContent = __('profile.integrations.timeFormatSavedSuccess');
                timeFormatStatus.className = 'setting-status success';
                showToast(__('profile.integrations.timePreferenceSaved'), 'success');
                
                // Update current preferences
                currentPreferences = preferences;
                
                // Hide save button
                saveTimeFormatBtn.style.display = 'none';
            } else {
                throw new Error(response.message || __('profile.integrations.failedToSaveTimeFormat'));
            }
        } catch (error) {
            console.error('Error saving time format:', error);
            timeFormatStatus.textContent = getErrorMessage(error);
            timeFormatStatus.className = 'setting-status error';
            showToast(getErrorMessage(error), 'error');
        } finally {
            saveTimeFormatBtn.disabled = false;
            saveTimeFormatBtn.classList.remove('loading');
        }
    }

    async function saveTimezonePreference() {
        const selectedTimezone = timezoneSelect.value;
        
        saveTimezoneBtn.disabled = true;
        saveTimezoneBtn.classList.add('loading');
        
        try {
            const preferences = {
                ...currentPreferences,
                timezone: selectedTimezone
            };
            
            const response = await api.put('/user/preferences', { preferences });
            
            if (response.success) {
                timezoneStatus.textContent = __('profile.integrations.timeZoneSavedSuccess');
                timezoneStatus.className = 'setting-status success';
                showToast(__('profile.integrations.timezonePreferenceSaved'), 'success');
                
                // Update current preferences
                currentPreferences = preferences;
                
                // Hide save button
                saveTimezoneBtn.style.display = 'none';
            } else {
                throw new Error(response.message || __('profile.integrations.failedToSaveTimezone'));
            }
        } catch (error) {
            console.error('Error saving time zone:', error);
            timezoneStatus.textContent = getErrorMessage(error);
            timezoneStatus.className = 'setting-status error';
            showToast(getErrorMessage(error), 'error');
        } finally {
            saveTimezoneBtn.disabled = false;
            saveTimezoneBtn.classList.remove('loading');
        }
    }

    // Utility Functions
    function showToast(message, type = 'success') {
        const toastIcon = toast.querySelector('.toast-icon');
        const toastMessage = toast.querySelector('.toast-message');
        
        toastIcon.textContent = type === 'success' ? 'check_circle' : 'error';
        toastIcon.className = `toast-icon material-symbols-outlined ${type}`;
        toastMessage.textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    function getErrorMessage(error) {
        if (error.response && error.response.data && error.response.data.message) {
            return error.response.data.message;
        }
        if (error.message) {
            return error.message;
        }
        return __('profile.integrations.unexpectedError');
    }

    // Event Listeners
    if (icsFeedToggle) {
        icsFeedToggle.addEventListener('change', toggleIcsFeed);
    }

    if (copyIcsFeedBtn) {
        copyIcsFeedBtn.addEventListener('click', copyIcsFeedUrl);
    }

    if (subscribeIcsFeedBtn) {
        subscribeIcsFeedBtn.addEventListener('click', subscribeToIcsFeed);
    }

    if (saveLanguageBtn) {
        saveLanguageBtn.addEventListener('click', saveLanguagePreference);
    }
    
    if (saveDateFormatBtn) {
        saveDateFormatBtn.addEventListener('click', saveDateFormatPreference);
    }
    
    if (saveTimeFormatBtn) {
        saveTimeFormatBtn.addEventListener('click', saveTimeFormatPreference);
    }
    
    if (saveTimezoneBtn) {
        saveTimezoneBtn.addEventListener('click', saveTimezonePreference);
    }

    // Email notification toggles
    const emailToggles = [
        emailLoginAlerts,
        emailPasswordChanges,
        emailSecurityChanges,
        emailSystemMaintenance,
        emailAccountUpdates
    ].filter(Boolean);

    emailToggles.forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', saveEmailPreferences);
        }
    });

    // Language select change detection
    if (languageSelect) {
        languageSelect.addEventListener('change', () => {
            const selectedLanguage = languageSelect.value;
            const currentLanguage = languageSelect.dataset.currentLang || 'en';
            
            if (selectedLanguage !== currentLanguage) {
                saveLanguageBtn.style.display = 'inline-flex';
                languageStatus.textContent = '';
                languageStatus.className = 'setting-status';
            } else {
                saveLanguageBtn.style.display = 'none';
            }
        });
    }
    
    // Date format change detection
    if (dateFormatSelect) {
        dateFormatSelect.addEventListener('change', () => {
            const selectedFormat = dateFormatSelect.value;
            const currentFormat = currentPreferences?.dateFormat || 'DD/MM/YYYY';
            
            if (selectedFormat !== currentFormat) {
                saveDateFormatBtn.style.display = 'inline-flex';
                dateFormatStatus.textContent = '';
                dateFormatStatus.className = 'setting-status';
            } else {
                saveDateFormatBtn.style.display = 'none';
            }
        });
    }
    
    // Time format change detection
    if (timeFormatSelect) {
        timeFormatSelect.addEventListener('change', () => {
            const selectedFormat = timeFormatSelect.value;
            const currentFormat = currentPreferences?.timeFormat || '24h';
            
            if (selectedFormat !== currentFormat) {
                saveTimeFormatBtn.style.display = 'inline-flex';
                timeFormatStatus.textContent = '';
                timeFormatStatus.className = 'setting-status';
            } else {
                saveTimeFormatBtn.style.display = 'none';
            }
        });
    }
    
    // Timezone change detection
    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', () => {
            const selectedTimezone = timezoneSelect.value;
            const currentTimezone = currentPreferences?.timezone || 'Europe/Luxembourg';
            
            if (selectedTimezone !== currentTimezone) {
                saveTimezoneBtn.style.display = 'inline-flex';
                timezoneStatus.textContent = '';
                timezoneStatus.className = 'setting-status';
            } else {
                saveTimezoneBtn.style.display = 'none';
            }
        });
    }

    // Utility functions
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(dateString) {
        if (!dateString) return __('profile.integrations.unknown');
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            return __('profile.integrations.invalidDate');
        }
    }

    // Mailing Lists Functions
    const mailingListsContainer = document.getElementById('mailingListsContainer');
    const mailingListsLoading = document.getElementById('mailingListsLoading');
    const mailingListsContent = document.getElementById('mailingListsContent');
    const mailingListsList = document.getElementById('mailingListsList');
    const mailingListsError = document.getElementById('mailingListsError');
    const noSubscriptions = document.getElementById('noSubscriptions');
    const retryLoadLists = document.getElementById('retryLoadLists');

    async function loadMailingLists() {
        try {
            // Show loading state
            if (mailingListsLoading) mailingListsLoading.style.display = 'flex';
            if (mailingListsContent) mailingListsContent.style.display = 'none';
            if (mailingListsError) mailingListsError.style.display = 'none';

            const data = await api.get('/user/mailing-lists');

            if (data.success) {
                renderMailingLists(data.data?.subscriptions || []);
            } else {
                showMailingListsError(__('profile.integrations.failedToLoadMailingSubscriptions'));
            }
        } catch (error) {
            console.error('Load mailing lists error:', error);
            showMailingListsError('Failed to load mailing list subscriptions: ' + getErrorMessage(error));
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
                        <p class="mailing-list-description">${escapeHtml(subscription.description || __('profile.integrations.noDescriptionAvailable'))}</p>
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
            mailingListsError.querySelector('span:last-of-type').textContent = message;
        }
    }

    async function unsubscribeFromList(listId, listName) {
        if (!confirm(`Are you sure you want to unsubscribe from "${listName}"? You will no longer receive emails from this mailing list.`)) {
            return;
        }
        
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
                showToast(__('profile.integrations.failedToUnsubscribe') + ': ' + (response.message || __('profile.integrations.unknownError')), 'error');
                
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
            console.error('Error unsubscribing from list:', error);
            showToast(getErrorMessage(error), 'error');
            
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

    // Event listeners for mailing lists
    if (retryLoadLists) {
        retryLoadLists.addEventListener('click', loadMailingLists);
    }

    // Make unsubscribe function globally available
    window.unsubscribeFromList = unsubscribeFromList;

    // Load mailing lists on page load
    loadMailingLists();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close any open modals or reset states if needed
        }
        
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            init();
        }
    });
});