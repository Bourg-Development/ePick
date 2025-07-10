document.addEventListener('DOMContentLoaded', function() {
    // Load current user preferences
    loadDisplayPreferences();
    loadNotificationPreferences();

    // Language change handler
    const languageSelect = document.getElementById('languageSelect');
    const saveLanguageBtn = document.getElementById('saveLanguageBtn');
    
    if (languageSelect && saveLanguageBtn) {
        saveLanguageBtn.addEventListener('click', async function() {
            const selectedLanguage = languageSelect.value;
            const currentLanguage = languageSelect.dataset.currentLang || 'en';
            
            if (selectedLanguage === currentLanguage) {
                showToast('No changes to save', 'info');
                return;
            }
            
            // Add loading state
            saveLanguageBtn.disabled = true;
            saveLanguageBtn.classList.add('loading');
            updateStatus('status-language', 'Saving...', 'info');
            
            try {
                // Saving language preference
                
                // Save language preference to database
                const response = await fetch('/api/user/language', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ language: selectedLanguage })
                });
                
                // Response received
                
                const result = await response.json();
                // Processing response
                
                if (response.ok && result.success) {
                    // Show success status
                    updateStatus('status-language', 'Language saved successfully!', 'success');
                    showToast('Language preference saved successfully', 'success');
                    
                    // Redirect with new language parameter after a short delay
                    setTimeout(() => {
                        const url = new URL(window.location);
                        url.searchParams.set('lang', selectedLanguage);
                        // Redirecting to updated page
                        window.location.href = url.toString();
                    }, 1500);
                } else {
                    console.error('API Error:', result);
                    throw new Error(result.message || 'Failed to save language preference');
                }
            } catch (error) {
                console.error('Error saving language preference:', error);
                updateStatus('status-language', 'Failed to save language', 'error');
                showToast('Error saving language preference: ' + error.message, 'error');
            } finally {
                saveLanguageBtn.disabled = false;
                saveLanguageBtn.classList.remove('loading');
            }
        });
    }
    
    // Date format handler
    const saveDateFormatBtn = document.getElementById('saveDateFormatBtn');
    if (saveDateFormatBtn) {
        saveDateFormatBtn.addEventListener('click', async function() {
            const selectedFormat = document.querySelector('input[name="dateFormat"]:checked')?.value;
            
            if (!selectedFormat) {
                showToast('Please select a date format', 'error');
                return;
            }

            saveDateFormatBtn.disabled = true;
            saveDateFormatBtn.classList.add('loading');
            updateStatus('status-date-format', 'Saving...', 'info');

            try {
                const response = await fetch('/api/user/display-preferences', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ dateFormat: selectedFormat })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    updateStatus('status-date-format', 'Date format saved!', 'success');
                    showToast('Date format preferences saved', 'success');
                } else {
                    throw new Error(result.message || 'Failed to save date format');
                }
            } catch (error) {
                console.error('Error saving date format:', error);
                updateStatus('status-date-format', 'Failed to save date format', 'error');
                showToast('Error saving date format: ' + error.message, 'error');
            } finally {
                saveDateFormatBtn.disabled = false;
                saveDateFormatBtn.classList.remove('loading');
            }
        });
    }
    
    
    
    function updateStatus(elementId, message, type) {
        const statusElement = document.getElementById(elementId);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `setting-status ${type}`;
            
            // Clear status after 3 seconds
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'setting-status';
            }, 3000);
        }
    }
    
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastIcon = toast.querySelector('.toast-icon');
        const toastMessage = toast.querySelector('.toast-message');
        
        if (toast && toastIcon && toastMessage) {
            // Set content
            toastMessage.textContent = message;
            
            // Set icon and style based on type
            if (type === 'success') {
                toastIcon.textContent = 'check_circle';
                toastIcon.className = 'toast-icon material-symbols-outlined success';
            } else if (type === 'error') {
                toastIcon.textContent = 'error';
                toastIcon.className = 'toast-icon material-symbols-outlined error';
            } else {
                toastIcon.textContent = 'info';
                toastIcon.className = 'toast-icon material-symbols-outlined';
            }
            
            // Show toast
            toast.classList.add('show');
            
            // Hide after 4 seconds
            setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }
    }

    // Load user display preferences and set form values
    async function loadDisplayPreferences() {
        try {
            const response = await fetch('/api/user/display-preferences');
            const result = await response.json();

            if (response.ok && result.success) {
                const { dateFormat } = result.preferences;

                // Clear all existing selections first
                document.querySelectorAll('input[name="dateFormat"]').forEach(radio => radio.checked = false);

                // Set date format radio buttons
                const dateFormatRadio = document.querySelector(`input[name="dateFormat"][value="${dateFormat}"]`);
                if (dateFormatRadio) {
                    dateFormatRadio.checked = true;
                }
            }
        } catch (error) {
            console.error('Error loading display preferences:', error);
        }
    }

    // Load notification preferences and render UI
    async function loadNotificationPreferences() {
        try {
            // Get user profile to check for email availability
            const profileResponse = await fetch('/api/user/profile');
            const userProfile = await profileResponse.json();

            // Get notification preferences
            const prefsResponse = await fetch('/api/user/preferences');
            const prefsResult = await prefsResponse.json();

            let emailNotifications = false;
            if (prefsResponse.ok && prefsResult.success && prefsResult.preferences && prefsResult.preferences.notifications) {
                emailNotifications = prefsResult.preferences.notifications.email || false;
            }

            // Check if user has email (personal or service email)
            const hasEmail = userProfile.success && userProfile.profile && userProfile.profile.email;

            renderNotificationUI(hasEmail, emailNotifications);

        } catch (error) {
            console.error('Error loading notification preferences:', error);
            renderNotificationUI(false, false);
        }
    }

    function renderNotificationUI(hasEmail, emailEnabled) {
        const container = document.getElementById('emailNotificationContainer');
        if (!container) return;

        if (hasEmail) {
            container.innerHTML = `
                <div class="setting-group">
                    <label class="setting-label" for="emailNotifications">
                        Email Notifications
                    </label>
                    <div class="setting-input-group">
                        <div class="toggle-switch">
                            <input type="checkbox" id="emailNotifications" class="toggle-input" ${emailEnabled ? 'checked' : ''}>
                            <label for="emailNotifications" class="toggle-label">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="input-actions">
                            <button class="btn btn-sm btn-primary save-btn" id="saveEmailNotificationBtn">
                                <span class="material-symbols-outlined">save</span>
                            </button>
                        </div>
                    </div>
                    <small class="setting-help">Receive important system notifications via email</small>
                    <div class="setting-status" id="status-email-notifications"></div>
                </div>
            `;

            // Add event listener for the save button
            const saveBtn = document.getElementById('saveEmailNotificationBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', saveEmailNotificationPreference);
            }
        } else {
            container.innerHTML = `
                <div class="setting-group">
                    <label class="setting-label">
                        Email Notifications
                    </label>
                    <div class="setting-disabled">
                        <span class="material-symbols-outlined">email_off</span>
                        <span>Email notifications are unavailable - no email address on file</span>
                    </div>
                    <small class="setting-help">Add an email address to your profile to enable email notifications</small>
                </div>
            `;
        }
    }

    async function saveEmailNotificationPreference() {
        const checkbox = document.getElementById('emailNotifications');
        const saveBtn = document.getElementById('saveEmailNotificationBtn');
        
        if (!checkbox || !saveBtn) return;

        const isEnabled = checkbox.checked;
        
        saveBtn.disabled = true;
        saveBtn.classList.add('loading');
        updateStatus('status-email-notifications', 'Saving...', 'info');

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    preferences: {
                        notifications: {
                            email: isEnabled
                        }
                    }
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                updateStatus('status-email-notifications', 'Email notification preference saved!', 'success');
                showToast('Email notification preferences saved', 'success');
            } else {
                throw new Error(result.message || 'Failed to save notification preference');
            }
        } catch (error) {
            console.error('Error saving notification preference:', error);
            updateStatus('status-email-notifications', 'Failed to save preference', 'error');
            showToast('Error saving notification preference: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
        }
    }
});