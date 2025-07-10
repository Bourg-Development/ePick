document.addEventListener('DOMContentLoaded', function() {
    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Check if account is editable from server
    const editableAccount = document.getElementById('fullNameInput') && !document.getElementById('fullNameInput').disabled;

    // State variables
    let currentProfile = null;
    let passwordStrength = 0;

    // DOM Elements
    const fullNameInput = document.getElementById('fullNameInput');
    const emailInput = document.getElementById('emailInput');
    const saveFullNameBtn = document.getElementById('saveFullNameBtn');
    const saveEmailBtn = document.getElementById('saveEmailBtn');
    
    // Password elements
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    // Display elements
    const usernameDisplay = document.getElementById('usernameDisplay');
    const roleDisplay = document.getElementById('roleDisplay');
    const serviceDisplay = document.getElementById('serviceDisplay');
    const memberSinceDisplay = document.getElementById('memberSinceDisplay');
    const lastLoginDisplay = document.getElementById('lastLoginDisplay');
    const totpMethodStatus = document.getElementById('totpMethodStatus');
    const webauthnMethodStatus = document.getElementById('webauthnMethodStatus');

    // Toast
    const toast = document.getElementById('toast');

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadAccountData();
    }

    function setupEventListeners() {
        // Profile update listeners (only if editable)
        if (editableAccount) {
            if (saveFullNameBtn) {
                saveFullNameBtn.addEventListener('click', () => updateProfile('fullName'));
            }
            if (saveEmailBtn) {
                saveEmailBtn.addEventListener('click', () => updateProfile('email'));
            }

            // Enable save buttons when inputs change
            if (fullNameInput) {
                fullNameInput.addEventListener('input', () => {
                    const hasChanges = fullNameInput.value.trim() !== (currentProfile?.full_name || '');
                    saveFullNameBtn.disabled = !hasChanges;
                });
            }

            if (emailInput) {
                emailInput.addEventListener('input', () => {
                    const hasChanges = emailInput.value.trim() !== (currentProfile?.email || '');
                    saveEmailBtn.disabled = !hasChanges;
                });
            }
        }

        // Password change listeners
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', handlePasswordChange);
        }

        // Password strength checking
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', checkPasswordStrength);
        }

        // Password confirmation validation
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', validatePasswordConfirmation);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                loadAccountData();
            }
        });
    }

    // Data Loading Functions
    async function loadAccountData() {
        showToast('Loading account data...', 'info');

        try {
            await Promise.all([
                loadProfile(),
                loadSecurityStatus()
            ]);
            showToast('Account data loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading account data:', error);
            showToast('Failed to load account data', 'error');
        }
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

    async function loadSecurityStatus() {
        try {
            // This data is included in the profile response
            if (currentProfile) {
                renderSecurityStatus(currentProfile);
            }
        } catch (error) {
            console.error('Load security status error:', error);
        }
    }

    // Rendering Functions
    function renderProfile(profile) {
        // Populate editable fields
        if (fullNameInput) {
            fullNameInput.value = profile.full_name || '';
        }
        if (emailInput) {
            emailInput.value = profile.email || '';
        }

        // Populate readonly displays
        usernameDisplay.textContent = profile.username || 'Not set';
        roleDisplay.textContent = profile.role || 'Not assigned';
        serviceDisplay.textContent = profile.service || 'Not assigned';
        
        // Format dates
        memberSinceDisplay.textContent = profile.createdAt ? 
            (window.formatDate ? window.formatDate(profile.createdAt) : new Date(profile.createdAt).toLocaleDateString()) : 
            'Unknown';
            
        lastLoginDisplay.textContent = profile.lastLogin ? 
            (window.formatDateTime ? window.formatDateTime(profile.lastLogin) : new Date(profile.lastLogin).toLocaleString()) : 
            'Never';

        // Reset save button states
        if (saveFullNameBtn) saveFullNameBtn.disabled = true;
        if (saveEmailBtn) saveEmailBtn.disabled = true;
    }

    function renderSecurityStatus(profile) {
        // TOTP status
        if (totpMethodStatus) {
            if (profile.totpEnabled) {
                totpMethodStatus.textContent = 'Enabled';
                totpMethodStatus.className = 'method-status enabled';
            } else {
                totpMethodStatus.textContent = 'Disabled';
                totpMethodStatus.className = 'method-status disabled';
            }
        }

        // WebAuthn status
        if (webauthnMethodStatus) {
            if (profile.webauthnEnabled) {
                webauthnMethodStatus.textContent = 'Enabled';
                webauthnMethodStatus.className = 'method-status enabled';
            } else {
                webauthnMethodStatus.textContent = 'Disabled';
                webauthnMethodStatus.className = 'method-status disabled';
            }
        }
    }

    // Profile Update Functions
    async function updateProfile(field) {
        if (!editableAccount) {
            showToast('Profile editing is disabled', 'error');
            return;
        }

        let updateData = {};
        let button, statusElement;

        switch (field) {
            case 'fullName':
                updateData.fullName = fullNameInput.value.trim() || null;
                button = saveFullNameBtn;
                statusElement = document.getElementById('status-fullname');
                break;
            case 'email':
                updateData.email = emailInput.value.trim() || null;
                button = saveEmailBtn;
                statusElement = document.getElementById('status-email');
                
                // Validate email format
                if (updateData.email && !isValidEmail(updateData.email)) {
                    showToast('Please enter a valid email address', 'error');
                    return;
                }
                break;
            default:
                return;
        }

        try {
            showUpdateProgress(button, true);
            clearStatus(statusElement);

            const response = await api.put('/user/profile', updateData);

            if (response.success) {
                showToast(`${field === 'fullName' ? 'Full name' : 'Email'} updated successfully`, 'success');
                showStatus(statusElement, 'Updated successfully', 'success');
                
                // Reload profile to show changes
                await loadProfile();
            } else {
                showToast(`Failed to update ${field}: ` + (response.message || 'Unknown error'), 'error');
                showStatus(statusElement, 'Update failed', 'error');
            }
        } catch (error) {
            console.error(`Update ${field} error:`, error);
            if (handleAuthError(error)) return;
            showToast(`Failed to update ${field}: ` + getErrorMessage(error), 'error');
            showStatus(statusElement, 'Update failed', 'error');
        } finally {
            showUpdateProgress(button, false);
        }
    }

    // Password Change Functions
    async function handlePasswordChange() {
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showToast('Password must be at least 8 characters long', 'error');
            return;
        }

        if (passwordStrength < 2) {
            showToast('Password is too weak. Please use a stronger password.', 'error');
            return;
        }

        try {
            showUpdateProgress(changePasswordBtn, true);

            const response = await api.post('/auth/change-password', {
                currentPassword,
                newPassword,
                confirmPassword
            });

            if (response.success) {
                showToast('Password changed successfully', 'success');
                
                // Clear password fields
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                
                // Clear password strength indicator
                passwordStrength = 0;
                updatePasswordStrength();
                
                showStatus(document.getElementById('status-password'), 'Password updated successfully', 'success');
            } else {
                showToast('Failed to change password: ' + (response.message || 'Unknown error'), 'error');
                showStatus(document.getElementById('status-password'), 'Password change failed', 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            if (handleAuthError(error)) return;
            showToast('Failed to change password: ' + getErrorMessage(error), 'error');
            showStatus(document.getElementById('status-password'), 'Password change failed', 'error');
        } finally {
            showUpdateProgress(changePasswordBtn, false);
        }
    }

    function checkPasswordStrength() {
        const password = newPasswordInput.value;
        let strength = 0;

        // Check various criteria
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/)) strength++;
        if (password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;

        passwordStrength = strength;
        updatePasswordStrength();
    }

    function updatePasswordStrength() {
        // This could be enhanced with a visual password strength indicator
        // For now, we just store the strength value for validation
    }

    function validatePasswordConfirmation() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword && newPassword !== confirmPassword) {
            confirmPasswordInput.setCustomValidity('Passwords do not match');
        } else {
            confirmPasswordInput.setCustomValidity('');
        }
    }

    // Loading States
    function showProfileLoading() {
        const elements = [
            usernameDisplay, roleDisplay, serviceDisplay, 
            memberSinceDisplay, lastLoginDisplay
        ];

        elements.forEach(element => {
            if (element) {
                element.textContent = 'Loading...';
            }
        });

        if (totpMethodStatus) totpMethodStatus.textContent = 'Loading...';
        if (webauthnMethodStatus) webauthnMethodStatus.textContent = 'Loading...';
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
                } else if (button.id.includes('password')) {
                    icon.textContent = 'key';
                }
            }
        }
    }

    function showStatus(element, message, type) {
        if (!element) return;
        
        element.textContent = message;
        element.className = `setting-status ${type}`;
        
        // Clear status after 5 seconds
        setTimeout(() => {
            clearStatus(element);
        }, 5000);
    }

    function clearStatus(element) {
        if (!element) return;
        element.textContent = '';
        element.className = 'setting-status';
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

    // Export functions for potential external use
    window.accountManager = {
        loadAccountData,
        updateProfile,
        handlePasswordChange
    };
});