document.addEventListener('DOMContentLoaded', function() {
    // Wait for date formatting functions to be available
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    function waitForDateFormatter() {
        attempts++;
        if (window.formatDate && window.formatDateTime && window.userDateFormat) {
            // Date formatters are now available
            initializePage();
        } else if (attempts < maxAttempts) {
            // Waiting for date formatters...
            setTimeout(waitForDateFormatter, 100);
        } else {
            // Date formatters not available after 5 seconds, proceeding with defaults
            // Set defaults if not available
            window.userDateFormat = window.userDateFormat || 'DD/MM/YYYY';
            window.userTimeFormat = window.userTimeFormat || '24h';
            if (!window.formatDate) {
                window.formatDate = function(date) {
                    return new Date(date).toLocaleDateString();
                };
            }
            if (!window.formatDateTime) {
                window.formatDateTime = function(date) {
                    return new Date(date).toLocaleString();
                };
            }
            initializePage();
        }
    }
    
    waitForDateFormatter();
});

function initializePage() {
    // Translation fallback function
    if (typeof __ === 'undefined') {
        window.__ = function(key) {
            // Temporary hardcoded translations for testing
            const hardcodedTranslations = {
                'editUser': 'Modifier l\'utilisateur',
                'generateRefCode': 'Générer le code de référence',
                'resetPassword': 'Réinitialiser le mot de passe',
                'viewServiceInfo': 'Voir les infos du service',
                'lockUser': 'Verrouiller l\'utilisateur',
                'unlockUser': 'Déverrouiller l\'utilisateur',
                'notifications.massPreferences.selectOneUser': 'Veuillez sélectionner au moins un utilisateur',
                'notifications.massPreferences.selectOnePreference': 'Veuillez sélectionner au moins une préférence à mettre à jour',
                'notifications.massPreferences.selectOnePreferenceReset': 'Veuillez sélectionner au moins une préférence à réinitialiser',
                'notifications.massPreferences.errorUpdating': 'Erreur lors de la mise à jour des préférences',
                'notifications.massPreferences.errorResetting': 'Erreur lors de la réinitialisation des préférences',
                'users.noUsersFound': 'Aucun utilisateur trouvé',
                'export.noFiltersAppliedUsers': 'Aucun filtre appliqué - export de tous les utilisateurs',
                'filter.allRoles': 'Tous les rôles',
                'filter.selectRole': 'Sélectionner un rôle',
                'filter.allServices': 'Tous les services'
            };
            
            if (hardcodedTranslations[key]) {
                return hardcodedTranslations[key];
            }
            
            if (window.translations) {
                const keys = key.split('.');
                let value = window.translations;
                for (const k of keys) {
                    value = value[k];
                    if (!value) break;
                }
                return value || key;
            }
            return key;
        };
    }

    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    })

    // State variables
    let users = [];
    let roles = [];
    let services = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalUsers = 0;
    let limit = 20;
    let activeDropdown = null;
    let currentEditUserId = null;
    let currentRefCodeUserId = null;
    let sortField = null;
    let sortDirection = 'asc';
    let hideActions;
    let activeServiceDropdown = null;
    let activeExportDropdown = null;

    // Password modal state
    let passwordModalResolve = null;
    let passwordModalReject = null;

    // Export column definitions
    const exportColumns = {
        id: { name: 'ID', description: 'User internal ID', sensitive: false },
        username: { name: 'Username', description: '6-digit user identifier', sensitive: false },
        fullName: { name: 'Full Name', description: 'User display name', sensitive: false },
        email: { name: 'Email', description: 'User email address', sensitive: false },
        isRegistered: { name: 'Registration Status', description: 'Whether user completed registration', sensitive: false },
        role: { name: 'Role', description: 'User role name', sensitive: false },
        roleId: { name: 'Role ID', description: 'Internal role identifier', sensitive: false },
        service: { name: 'Service', description: 'Assigned service name', sensitive: false },
        serviceId: { name: 'Service ID', description: 'Internal service identifier', sensitive: false },
        serviceEmail: { name: 'Service Email', description: 'Service contact email', sensitive: false },
        totpEnabled: { name: 'TOTP Enabled', description: 'Two-factor authentication status', sensitive: false },
        webauthnEnabled: { name: 'WebAuthn Enabled', description: 'WebAuthn authentication status', sensitive: false },
        accountLocked: { name: 'Account Locked', description: 'Account lock status', sensitive: false },
        accountLockedUntil: { name: 'Lock Expiry', description: 'Account lock expiration time', sensitive: true },
        failedLoginAttempts: { name: 'Failed Logins', description: 'Number of failed login attempts', sensitive: false },
        lastLogin: { name: 'Last Login', description: 'Last successful login time', sensitive: false },
        lastLoginAttempt: { name: 'Last Login Attempt', description: 'Last login attempt time', sensitive: false },
        lastIpAddress: { name: 'Last IP Address', description: 'Last known IP address', sensitive: true },
        createdAt: { name: 'Created Date', description: 'Account creation date', sensitive: false },
        updatedAt: { name: 'Updated Date', description: 'Last modification date', sensitive: false },
        createdBy: { name: 'Created By', description: 'Username who created this account', sensitive: false },
        createdById: { name: 'Created By ID', description: 'Internal ID of creator', sensitive: false }
    };

    // Safe columns (non-sensitive, commonly exported)
    const safeColumns = ['id', 'username', 'fullName', 'email', 'isRegistered', 'role', 'service', 'totpEnabled', 'webauthnEnabled', 'accountLocked', 'createdAt'];

    // DOM Elements
    const tableBody = document.querySelector('#userTable tbody');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const serviceFilter = document.getElementById('serviceFilter');
    const statusFilter = document.getElementById('statusFilter');
    const limitInput = document.getElementById('limitInput');
    const recordCount = document.getElementById('recordCount');
    const pagination = document.getElementById('pagination');
    const addNewBtn = document.getElementById('addNewBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    // Export elements
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportModal = document.getElementById('exportModal');

    // Modals
    const addUserModal = document.getElementById('addUserModal');
    const generateRefCodeModal = document.getElementById('generateRefCodeModal');
    const editUserModal = document.getElementById('editUserModal');
    const refCodeModal = document.getElementById('refCodeModal');
    const confirmModal = document.getElementById('confirmModal');
    const passwordModal = document.getElementById('passwordModal');
    const toast = document.getElementById('toast');

    const keybinds = {
        'Escape': () => {
            if(activeDropdown !== null) return closeDropdown();
            if(activeServiceDropdown !== null) return closeServiceDropdown();
            if(activeExportDropdown !== null) return closeExportDropdown();
            addUserModal.classList.remove('show');
            generateRefCodeModal.classList.remove('show');
            editUserModal.classList.remove('show');
            refCodeModal.classList.remove('show');
            confirmModal.classList.remove('show');
            exportModal.classList.remove('show');
            passwordModal.classList.remove('show');
        },
        'Control+r': () => {
            loadUsers();
        }
    };

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadRoles();
        await loadServices();
        await loadUsers();
    }

    function setupEventListeners() {
        // Search and filters
        searchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            loadUsers();
        }, 500));

        roleFilter.addEventListener('change', () => {
            currentPage = 1;
            loadUsers();
        });

        serviceFilter.addEventListener('change', () => {
            currentPage = 1;
            loadUsers();
        });

        statusFilter.addEventListener('change', () => {
            currentPage = 1;
            loadUsers();
        });

        limitInput.addEventListener('change', () => {
            limit = parseInt(limitInput.value) || 20;
            currentPage = 1;
            loadUsers();
        });

        // Buttons
        if(addNewBtn){
            addNewBtn.addEventListener('click', showAddUserModal);
        }
        refreshBtn.addEventListener('click', loadUsers);

        // Export functionality
        if (exportDropdownBtn) {
            setupExportEventListeners();
        }

        // Column sorting
        document.querySelectorAll('#userTable th[data-sort]').forEach(th => {
            th.addEventListener('click', function() {
                const field = this.getAttribute('data-sort');
                handleSort(field);
            });
        });

        // Modal event listeners
        setupModalEventListeners();

        // Global click for closing dropdowns
        document.addEventListener('click', function(e) {
            if (activeDropdown && !e.target.closest('.dropdown-container')) {
                closeDropdown();
            }
            if (activeServiceDropdown && !e.target.closest('.service-search-container')) {
                closeServiceDropdown();
            }
            if (activeExportDropdown && !e.target.closest('.export-dropdown-container')) {
                closeExportDropdown();
            }
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
                e.preventDefault();
                action();
            }
        });
    }

    function setupExportEventListeners() {
        // Export dropdown toggle
        exportDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExportDropdown();
        });

        // Export dropdown options
        exportDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.closest('.dropdown-item')?.dataset.action;
            if (action) {
                closeExportDropdown();
                handleExportAction(action);
            }
        });

        // Export modal event listeners
        document.getElementById('closeExportModalBtn').addEventListener('click', () => {
            exportModal.classList.remove('show');
        });
        document.getElementById('cancelExportBtn').addEventListener('click', () => {
            exportModal.classList.remove('show');
        });
        document.getElementById('exportForm').addEventListener('submit', handleExportSubmit);

        // Column selection buttons
        document.getElementById('selectAllColumnsBtn').addEventListener('click', () => {
            selectAllColumns(true);
        });
        document.getElementById('selectNoneColumnsBtn').addEventListener('click', () => {
            selectAllColumns(false);
        });
        document.getElementById('selectSafeColumnsBtn').addEventListener('click', () => {
            selectSafeColumns();
        });

        // Listen for column checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.column-checkbox')) {
                updateSensitiveWarning();
            }
        });
    }

    function setupModalEventListeners() {
        // Add User Modal
        document.getElementById('closeAddModalBtn').addEventListener('click', () => {
            addUserModal.classList.remove('show');
        });
        document.getElementById('cancelAddBtn').addEventListener('click', () => {
            addUserModal.classList.remove('show');
        });
        document.getElementById('addUserForm').addEventListener('submit', handleAddUser);

        // Generate Reference Code Modal
        document.getElementById('closeGenerateRefCodeModalBtn').addEventListener('click', () => {
            generateRefCodeModal.classList.remove('show');
        });
        document.getElementById('cancelGenerateRefCodeBtn').addEventListener('click', () => {
            generateRefCodeModal.classList.remove('show');
        });
        document.getElementById('generateRefCodeForm').addEventListener('submit', handleGenerateRefCode);

        // Edit User Modal
        document.getElementById('closeEditModalBtn').addEventListener('click', () => {
            editUserModal.classList.remove('show');
        });
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            editUserModal.classList.remove('show');
        });
        document.getElementById('editUserForm').addEventListener('submit', handleEditUser);

        // Reference Code Modal
        document.getElementById('closeRefCodeModalBtn').addEventListener('click', () => {
            refCodeModal.classList.remove('show');
        });
        document.getElementById('closeRefCodeBtn').addEventListener('click', () => {
            refCodeModal.classList.remove('show');
        });
        document.getElementById('copyRefCodeBtn').addEventListener('click', copyRefCode);
        document.getElementById('copyUrlBtn').addEventListener('click', copyRegistrationUrl);
        document.getElementById('printRefCodeBtn').addEventListener('click', printRefCode)

        // Confirm Modal
        document.getElementById('closeConfirmBtn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
        });
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
        });

        // Password Modal
        document.getElementById('closePasswordModalBtn').addEventListener('click', () => {
            closePasswordModal();
        });
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
            closePasswordModal();
        });
        document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);
    }

    // Password Modal Functions
    function showPasswordModal(title = 'Password Required', message = 'Please enter your password to continue with this action.') {
        return new Promise((resolve, reject) => {
            passwordModalResolve = resolve;
            passwordModalReject = reject;

            document.getElementById('passwordModalTitle').textContent = title;
            document.getElementById('passwordModalMessage').textContent = message;
            document.getElementById('passwordModalInput').value = '';

            passwordModal.classList.add('show');
            document.getElementById('passwordModalInput').focus();
        });
    }

    function closePasswordModal() {
        passwordModal.classList.remove('show');
        if (passwordModalReject) {
            passwordModalReject(new Error('Password modal cancelled'));
            passwordModalResolve = null;
            passwordModalReject = null;
        }
    }

    function handlePasswordSubmit(e) {
        e.preventDefault();
        const password = document.getElementById('passwordModalInput').value;

        if (!password) {
            showToast(__('messages.password.required'), 'error');
            return;
        }

        passwordModal.classList.remove('show');

        if (passwordModalResolve) {
            passwordModalResolve(password);
            passwordModalResolve = null;
            passwordModalReject = null;
        }
    }

    // Export Functions
    function toggleExportDropdown() {
        const container = exportDropdownBtn.closest('.export-dropdown-container');
        const isOpen = container.classList.contains('show');

        if (isOpen) {
            closeExportDropdown();
        } else {
            closeExportDropdown(); // Close any other open dropdown first
            container.classList.add('show');
            exportDropdown.classList.add('show');
            activeExportDropdown = exportDropdown;
        }
    }

    function closeExportDropdown() {
        const container = document.querySelector('.export-dropdown-container');
        if (container) {
            container.classList.remove('show');
        }
        if (exportDropdown) {
            exportDropdown.classList.remove('show');
        }
        activeExportDropdown = null;
    }

    function handleExportAction(action) {
        switch (action) {
            case 'export-advanced':
                showExportModal();
                break;
            case 'export-quick-csv':
                performQuickExport('csv');
                break;
            case 'export-quick-excel':
                performQuickExport('excel');
                break;
        }
    }

    function showExportModal() {
        // Populate column selection
        populateColumnGrid();

        // Update current filters display
        updateCurrentFiltersDisplay();

        // Reset form
        document.getElementById('exportForm').reset();
        document.querySelector('input[name="exportFormat"][value="csv"]').checked = true;

        // Select safe columns by default
        selectSafeColumns();

        exportModal.classList.add('show');
    }

    function populateColumnGrid() {
        const columnGrid = document.getElementById('columnGrid');
        columnGrid.innerHTML = '';

        Object.entries(exportColumns).forEach(([key, column]) => {
            const option = document.createElement('div');
            option.className = `column-option${column.sensitive ? ' sensitive' : ''}`;

            option.innerHTML = `
                <input type="checkbox" class="column-checkbox" value="${key}" id="col_${key}">
                <label class="column-label" for="col_${key}">
                    <div class="column-name">
                        ${column.name}
                        ${column.sensitive ? '<span class="column-sensitive-indicator">⚠️</span>' : ''}
                    </div>
                    <div class="column-description">${column.description}</div>
                </label>
            `;

            columnGrid.appendChild(option);
        });
    }

    function selectAllColumns(select) {
        const checkboxes = document.querySelectorAll('.column-checkbox');
        checkboxes.forEach(cb => cb.checked = select);
        updateSensitiveWarning();
    }

    function selectSafeColumns() {
        const checkboxes = document.querySelectorAll('.column-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = safeColumns.includes(cb.value);
        });
        updateSensitiveWarning();
    }

    function updateSensitiveWarning() {
        const sensitiveWarning = document.getElementById('sensitiveWarning');
        const selectedSensitive = [];

        document.querySelectorAll('.column-checkbox:checked').forEach(cb => {
            const column = exportColumns[cb.value];
            if (column && column.sensitive) {
                selectedSensitive.push(column.name);
            }
        });

        if (selectedSensitive.length > 0) {
            sensitiveWarning.style.display = 'flex';
        } else {
            sensitiveWarning.style.display = 'none';
        }
    }

    function updateCurrentFiltersDisplay() {
        const currentFilters = document.getElementById('currentFilters');
        const activeFilters = [];

        if (searchInput.value.trim()) {
            activeFilters.push(`Search: "${searchInput.value.trim()}"`);
        }

        if (roleFilter.value) {
            const roleName = roleFilter.options[roleFilter.selectedIndex].text;
            activeFilters.push(`Role: ${roleName}`);
        }

        if (serviceFilter.value) {
            const serviceName = serviceFilter.options[serviceFilter.selectedIndex].text;
            activeFilters.push(`Service: ${serviceName}`);
        }

        if (statusFilter.value) {
            const statusName = statusFilter.options[statusFilter.selectedIndex].text;
            activeFilters.push(`Status: ${statusName}`);
        }

        if (activeFilters.length > 0) {
            currentFilters.innerHTML = activeFilters.map(filter =>
                `<span class="filter-tag">${filter}</span>`
            ).join('');
        } else {
            currentFilters.innerHTML = `<span class="filter-info">${__('export.noFiltersAppliedUsers')}</span>`;
        }
    }

    async function handleExportSubmit(e) {
        e.preventDefault();

        const password = document.getElementById('exportPassword').value;
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value);

        if (!password) {
            showToast(__('messages.password.requiredForExport'), 'error');
            return;
        }

        if (selectedColumns.length === 0) {
            showToast(__('messages.export.selectColumns'), 'error');
            return;
        }

        try {
            showExportProgress(true);
            await performExport(format, password, selectedColumns);
            exportModal.classList.remove('show');
            showToast(`${__('messages.export.completed')} (${format.toUpperCase()})`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast(getErrorMessage(error), 'error');
        } finally {
            showExportProgress(false);
        }
    }

    async function performQuickExport(format) {
        try {
            const password = await showPasswordModal(
                'Password Required for Export',
                `Please enter your password to confirm the ${format.toUpperCase()} export.`
            );

            showToast(`${__('messages.export.starting')} ${format.toUpperCase()}...`, 'info');
            await performExport(format, password, safeColumns);
            showToast(`${__('messages.export.quickCompleted')} (${format.toUpperCase()})`, 'success');
        } catch (error) {
            if (error.message === 'Password modal cancelled') {
                return; // User cancelled, don't show error
            }
            console.error('Quick export error:', error);
            showToast(getErrorMessage(error), 'error');
        }
    }

    async function performExport(format, password, selectedColumns) {
        const exportData = {
            password: password,
            filters: getCurrentFilters(),
            includeColumns: selectedColumns
        };

        let endpoint;
        switch (format) {
            case 'csv':
                endpoint = '/admin/users/export/csv';
                break;
            case 'excel':
                endpoint = '/admin/users/export/excel';
                break;
            case 'json':
                endpoint = '/admin/users/export/json';
                break;
            default:
                throw new Error('Invalid export format');
        }

        try {
            if (format === 'json') {
                // JSON export returns JSON response - use API utility
                const data = await api.post(endpoint, exportData);
                downloadJsonFile(data, `users_export_${new Date().toISOString().split('T')[0]}.json`);
            } else {
                // CSV and Excel return file data - need to handle binary response
                await downloadFileExport(endpoint, exportData, format);
            }
        } catch (error) {
            console.error('Export request error:', error);
            throw error;
        }
    }

    async function downloadFileExport(endpoint, exportData, format) {
        // For file downloads, we need to use a custom approach with your API utility
        // since we need to handle the binary response differently

        const url = api.buildUrl(endpoint);

        try {
            // Use the API utility's request method with custom handling for binary data
            const config = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Use your API's cookie-based auth
                body: JSON.stringify(exportData)
            };

            // Create timeout promise matching your API utility
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), api.config.timeout || 15000)
            );

            // Make the request
            let response = await Promise.race([
                fetch(url, config),
                timeoutPromise
            ]);

            // Handle 401 - use your API utility's token refresh logic
            if (response.status === 401) {
                // Token expired, attempting refresh...
                const refreshSuccess = await api.handleTokenRefresh();

                if (refreshSuccess) {
                    // Retry the request with refreshed cookies
                    response = await Promise.race([
                        fetch(url, config),
                        timeoutPromise
                    ]);
                } else {
                    throw new Error('Authentication failed');
                }
            }

            if (!response.ok) {
                // Use similar error handling as your API utility
                const error = new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                error.status = response.status;
                error.statusText = response.statusText;

                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        error.data = await response.json();
                    } else {
                        error.data = await response.text();
                    }
                } catch (e) {
                    error.data = null;
                }

                throw error;
            }

            // Get the blob for file download
            const blob = await response.blob();
            const filename = getFilenameFromResponse(response) ||
                `users_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;

            downloadBlob(blob, filename);

        } catch (error) {
            // Add network error context like your API utility
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                error.message = 'Network error: Please check your internet connection';
            }
            throw error;
        }
    }

    function getCurrentFilters() {
        const filters = {};

        if (searchInput.value.trim()) {
            filters.search = searchInput.value.trim();
        }

        if (roleFilter.value) {
            filters.roleId = parseInt(roleFilter.value);
        }

        if (serviceFilter.value) {
            filters.serviceId = parseInt(serviceFilter.value);
        }

        return filters;
    }

    function getFilenameFromResponse(response) {
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.indexOf('filename=') !== -1) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches && matches[1]) {
                return matches[1].replace(/['"]/g, '');
            }
        }
        return null;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadJsonFile(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        downloadBlob(blob, filename);
    }

    function showExportProgress(show) {
        const progressElement = document.getElementById('exportProgress');
        if (progressElement) {
            progressElement.classList.toggle('show', show);
        }

        const exportBtn = document.getElementById('executeExportBtn');
        if (exportBtn) {
            exportBtn.disabled = show;
            if (show) {
                exportBtn.innerHTML = `
                    <div class="export-spinner"></div>
                    Exporting...
                `;
            } else {
                exportBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">download</span>
                    Export Data
                `;
            }
        }
    }

    // API Functions
    async function loadUsers() {
        try {
            showLoading();

            let endpoint = '/admin/users?';
            const params = new URLSearchParams({
                page: currentPage,
                limit: limit
            });

            if (searchInput.value.trim()) {
                params.append('search', searchInput.value.trim());
            }

            if (roleFilter.value) {
                params.append('roleId', roleFilter.value);
            }

            if (serviceFilter.value) {
                params.append('serviceId', serviceFilter.value);
            }

            endpoint += params.toString();

            const data = await api.get(endpoint);

            users = data.users || [];
            totalUsers = data.total || 0;
            totalPages = data.totalPages || 1;

            renderTable();
            renderPagination();
            updateRecordCount();

        } catch (error) {
            console.error('Load users error:', error);
            if (handleAuthError(error)) return;
            showError(getErrorMessage(error));
        }
    }

    async function loadRoles() {
        try {
            const data = await api.get('/admin/roles');
            roles = data.roles || [];
            populateRoleSelects();
        } catch (error) {
            console.error('Failed to load roles:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
        }
    }

    async function loadServices() {
        try {
            let allServicesLoaded = false;
            let page = 1;
            const limit = 100;
            services = [];

            while (!allServicesLoaded) {
                const data = await api.get(`/admin/services?active=true&page=${page}&limit=${limit}`);

                if (data.success && data.data) {
                    services.push(...data.data);

                    if (data.pagination && page < data.pagination.totalPages) {
                        page++;
                    } else {
                        allServicesLoaded = true;
                    }
                } else {
                    allServicesLoaded = true;
                }
            }

            populateServiceSelects();
            // Services loaded successfully

        } catch (error) {
            console.error('Failed to load services:', error);
            if (handleAuthError(error)) return;
            services = [];
            populateServiceSelects();
        }
    }

    async function createUser(userData) {
        try {
            const data = await api.post('/admin/user', userData);
            return data;
        } catch (error) {
            console.error('Create user error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateUserFullName(userId, fullName) {
        try {
            await api.put(`/admin/user/${userId}/full-name`, { fullName });
            showToast(__('messages.success.fullNameUpdated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Update user full name error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateUserEmail(userId, email) {
        try {
            await api.put(`/admin/user/${userId}/email`, { email });
            showToast(__('messages.success.emailUpdated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Update user email error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function generateReferenceCode(userId, require2FA = false, purpose = 'registration') {
        try {
            let data;
            if (purpose === 'password-reset') {
                data = await api.post('/admin/password-reset', {
                    targetUserId: userId,
                    require2FA: require2FA
                });
            } else {
                data = await api.post('/admin/reference-code', {
                    userId: userId,
                    require2FA: require2FA
                });
            }
            return data;
        } catch (error) {
            console.error('Generate reference code error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateUserRole(userId, roleId) {
        try {
            await api.put(`/admin/user/${userId}/role`, { roleId });
            showToast(__('messages.success.roleUpdated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Update user role error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateUserService(userId, serviceId) {
        try {
            await api.put(`/admin/user/${userId}/service`, { serviceId });
            showToast(__('messages.success.serviceUpdated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Update user service error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateUser2FA(userId, settings) {
        try {
            await api.put(`/admin/user/${userId}/two-factor`, settings);
            showToast(__('messages.success.twoFactorUpdated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Update 2FA error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function toggleUserLock(userId, locked, reason = '') {
        try {
            await api.put(`/admin/user/${userId}/lock-status`, { locked, reason });
            showToast(locked ? __('messages.success.userLocked') : __('messages.success.userUnlocked'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Toggle user lock error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function searchServices(term) {
        try {
            if (!term || term.length < 2) {
                return services.slice(0, 10);
            }

            const data = await api.get(`/admin/services/search/${encodeURIComponent(term)}?limit=10`);

            if (data.success && data.services) {
                return data.services;
            }

            return [];
        } catch (error) {
            console.error('Service search error:', error);
            return services.filter(service =>
                service.name.toLowerCase().includes(term.toLowerCase()) ||
                service.email.toLowerCase().includes(term.toLowerCase())
            ).slice(0, 10);
        }
    }

    // UI Functions
    function renderTable() {
        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--medium-gray);">${__('users.noUsersFound')}</td></tr>`;
            return;
        }

        tableBody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.id = user.id;

            const statusClass = user.account_locked ? 'status-locked' : 'status-active';
            const statusText = user.account_locked ? 'Locked' : 'Active';
            const registrationStatus = getRegistrationStatus(user);
            const twoFAStatus = get2FAStatus(user);
            const createdDate = window.formatDate ? window.formatDate(user.created_at) : new Date(user.created_at).toLocaleDateString();
            const serviceDisplay = getServiceDisplay(user.service);
            const fullNameDisplay = user.full_name ?
                `<span class="user-full-name">${user.full_name}</span>` :
                '<span class="user-full-name-empty">Not set</span>';

            row.innerHTML = `
                <td>${user.username}</td>
                <td>${fullNameDisplay}</td>
                <td title="${user.email || 'N/A'}">${user.email || 'N/A'}</td>
                <td>${user.role ? user.role.name : 'N/A'}</td>
                <td>${serviceDisplay}</td>
                <td>${createdDate}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>${registrationStatus}</td>
                <td>
                    <div class="twofa-indicator">${twoFAStatus}</div>
                </td>
                ${hideActions !== true ? `<td>
                    <div class="dropdown-container">
                        <button class="action-button" data-id="${user.id}">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                </td>` : ''}
            `;

            // Add click handler to make row clickable for user details popup
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                // Don't open popup if clicking on action button or dropdown
                if (!e.target.closest('.action-button') && !e.target.closest('.dropdown-container')) {
                    showUserDetailsPopup(user.id);
                }
            });

            tableBody.appendChild(row);
        });

        document.querySelectorAll('.action-button').forEach(btn => {
            btn.addEventListener('click', handleActionClick);
        });
    }

    function getServiceDisplay(service) {
        if (!service) {
            return '<span class="service-none">No Service</span>';
        }

        return `
            <div class="service-info" title="${service.description || service.name}">
                <span class="service-name">${service.name}</span>
                <span class="service-email">${service.email}</span>
            </div>
        `;
    }

    function getRegistrationStatus(user) {
        if (user.is_registered) {
            return '<span class="registration-badge registration-completed">Completed</span>';
        } else {
            return '<span class="registration-badge registration-pending">Pending</span>';
        }
    }

    function get2FAStatus(user) {
        const badges = [];

        if (user.totp_enabled) {
            badges.push('<span class="twofa-badge twofa-enabled">TOTP</span>');
        }

        if (user.webauthn_enabled) {
            badges.push('<span class="twofa-badge twofa-enabled">WebAuthn</span>');
        }

        if (badges.length === 0) {
            badges.push('<span class="twofa-badge twofa-disabled">None</span>');
        }

        return badges.join(' ');
    }

    function renderPagination() {
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        paginationHTML += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            <span class="material-symbols-outlined">chevron_left</span>
        </button>`;

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button onclick="changePage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="page-info">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="page-info">...</span>`;
            }
            paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
        }

        paginationHTML += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            <span class="material-symbols-outlined">chevron_right</span>
        </button>`;

        pagination.innerHTML = paginationHTML;
    }

    function updateRecordCount() {
        const start = (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalUsers);
        recordCount.textContent = `Showing ${start}-${end} of ${totalUsers} users`;
    }

    function populateRoleSelects() {
        const roleSelects = [roleFilter, document.getElementById('newUserRole'), document.getElementById('editUserRole')];

        roleSelects.forEach((select, index) => {
            if (index === 0) {
                select.innerHTML = `<option value="">${__('filter.allRoles')}</option>`;
            } else {
                select.innerHTML = index === 1 ? `<option value="">${__('filter.selectRole')}</option>` : '';
            }

            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.name;
                select.appendChild(option);
            });
        });
    }

    function populateServiceSelects() {
        if (serviceFilter) {
            serviceFilter.innerHTML = `<option value="">${__('filter.allServices')}</option>`;
            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                serviceFilter.appendChild(option);
            });
        }

        setupServiceSearchInputs();
    }

    function setupServiceSearchInputs() {
        const serviceInputs = [
            { id: 'newUserService', containerId: 'newUserServiceContainer' },
            { id: 'editUserService', containerId: 'editUserServiceContainer' }
        ];

        serviceInputs.forEach(({ id, containerId }) => {
            const originalSelect = document.getElementById(id);
            if (!originalSelect) return;

            const container = document.createElement('div');
            container.id = containerId;
            container.className = 'service-search-container';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'form-control service-search-input';
            searchInput.placeholder = 'Search services or select none...';
            searchInput.setAttribute('data-service-id', '');
            searchInput.id = id + 'Search';

            const dropdown = document.createElement('div');
            dropdown.className = 'service-dropdown';
            dropdown.style.display = 'none';

            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'service-clear-btn';
            clearBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">close</span>';
            clearBtn.title = 'Clear service selection';

            container.appendChild(searchInput);
            container.appendChild(clearBtn);
            container.appendChild(dropdown);

            originalSelect.parentNode.replaceChild(container, originalSelect);

            setupServiceSearchListeners(searchInput, dropdown, clearBtn);
        });
    }

    function setupServiceSearchListeners(searchInput, dropdown, clearBtn) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const term = e.target.value.trim();

            if (term.length === 0) {
                showServiceDropdown(searchInput, dropdown, services.slice(0, 5));
            } else if (term.length >= 2) {
                const results = await searchServices(term);
                showServiceDropdown(searchInput, dropdown, results);
            } else {
                hideServiceDropdown(dropdown);
            }
        }, 300));

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length === 0) {
                showServiceDropdown(searchInput, dropdown, services.slice(0, 5));
            }
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.setAttribute('data-service-id', '');
            hideServiceDropdown(dropdown);
            searchInput.focus();
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                hideServiceDropdown(dropdown);
            }
        });
    }

    function showServiceDropdown(searchInput, dropdown, services) {
        if (services.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        let html = `
            <div class="service-option" data-service-id="">
                <div class="service-option-content">
                    <span class="service-option-name">No Service</span>
                    <span class="service-option-description">User will not be assigned to any service</span>
                </div>
            </div>
        `;

        services.forEach(service => {
            html += `
                <div class="service-option" data-service-id="${service.id}">
                    <div class="service-option-content">
                        <span class="service-option-name">${service.name}</span>
                        <span class="service-option-email">${service.email}</span>
                        ${service.description ? `<span class="service-option-description">${service.description}</span>` : ''}
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;

        dropdown.querySelectorAll('.service-option').forEach(option => {
            option.addEventListener('click', () => {
                const serviceId = option.getAttribute('data-service-id');
                const serviceName = option.querySelector('.service-option-name').textContent;

                searchInput.value = serviceName;
                searchInput.setAttribute('data-service-id', serviceId);
                hideServiceDropdown(dropdown);
            });
        });

        dropdown.style.display = 'block';
        activeServiceDropdown = dropdown;
    }

    function hideServiceDropdown(dropdown) {
        dropdown.style.display = 'none';
        if (activeServiceDropdown === dropdown) {
            activeServiceDropdown = null;
        }
    }

    function closeServiceDropdown() {
        if (activeServiceDropdown) {
            hideServiceDropdown(activeServiceDropdown);
        }
    }

    function showAddUserModal() {
        document.getElementById('addUserForm').reset();

        const serviceSearchInput = document.getElementById('newUserServiceSearch');
        if (serviceSearchInput) {
            serviceSearchInput.value = '';
            serviceSearchInput.setAttribute('data-service-id', '');
        }

        addUserModal.classList.add('show');
    }

    function showGenerateRefCodeModal(userId, purpose = 'registration') {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        currentRefCodeUserId = userId;

        const modalTitle = document.querySelector('#generateRefCodeModal .modal-header h2');
        if (purpose === 'password-reset') {
            modalTitle.textContent = 'Generate Password Reset Code';
        } else {
            modalTitle.textContent = 'Generate Reference Code';
        }

        document.getElementById('refCodeUserId').value = userId;
        document.getElementById('refCodeUserName').textContent = user.username;
        document.getElementById('refCodeUserFullName').textContent = user.full_name || 'Not set';
        document.getElementById('refCodeUserRole').textContent = user.role ? user.role.name : 'N/A';
        document.getElementById('refCodeUserEmail').textContent = user.email || 'N/A';
        document.getElementById('refCodeRequire2FA').checked = false;

        document.getElementById('generateRefCodeForm').dataset.purpose = purpose;

        generateRefCodeModal.classList.add('show');
    }

    function showEditUserModal(userId) {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        currentEditUserId = userId;

        document.getElementById('editUserId').value = userId;
        document.getElementById('editUserFullName').value = user.full_name || '';
        document.getElementById('editUserEmail').value = user.email || '';
        document.getElementById('editUserRole').value = user.role ? user.role.id : '';

        const serviceSearchInput = document.getElementById('editUserServiceSearch');
        if (serviceSearchInput) {
            if (user.service) {
                serviceSearchInput.value = user.service.name;
                serviceSearchInput.setAttribute('data-service-id', user.service.id);
            } else {
                serviceSearchInput.value = '';
                serviceSearchInput.setAttribute('data-service-id', '');
            }
        }

        document.getElementById('editUserTotpEnabled').checked = user.totp_enabled;
        document.getElementById('editUserWebauthnEnabled').checked = user.webauthn_enabled;
        document.getElementById('editUserRequire2FA').checked = false;

        document.getElementById('editModalTitle').textContent = `Edit User: ${user.username}`;
        editUserModal.classList.add('show');
    }

    function showRefCodeModal(data) {
        const purpose = data.type || 'registration';

        const modalTitle = document.querySelector('#refCodeModal .modal-header h2');
        if (purpose === 'password-reset') {
            modalTitle.textContent = 'Password Reset Code Generated';
        } else {
            modalTitle.textContent = 'Reference Code Generated';
        }

        document.getElementById('refCodeUsername').textContent = data.username;
        document.getElementById('refCodeDisplay').textContent = data.code;
        const expiryDate = new Date(data.expiresAt);
        document.getElementById('refCodeExpires').textContent = window.formatDateTime ? window.formatDateTime(expiryDate) : expiryDate.toLocaleString();

        const baseUrl = window.location.origin;
        const registrationUrl = `${baseUrl}/auth/register?refCode=${data.code}`;
        document.getElementById('registrationUrl').textContent = registrationUrl;

        const refCodeInfo = document.querySelector('.ref-code-info');
        const firstParagraph = refCodeInfo.querySelector('p:first-child');
        const secondParagraph = refCodeInfo.querySelector('p:nth-child(2)');

        if (purpose === 'password-reset') {
            firstParagraph.innerHTML = `<strong>Password reset code for:</strong> <span id="refCodeUsername">${data.username}</span>`;
            secondParagraph.innerHTML = `<strong>User can reset password at:</strong>`;
        } else {
            firstParagraph.innerHTML = `<strong>Reference code for:</strong> <span id="refCodeUsername">${data.username}</span>`;
            secondParagraph.innerHTML = `<strong>Registration URL:</strong>`;
        }

        refCodeModal.classList.add('show');
    }

    function showConfirmModal(message, onConfirm) {
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmBtn').onclick = () => {
            confirmModal.classList.remove('show');
            onConfirm();
        };
        confirmModal.classList.add('show');
    }

    // Event Handlers
    async function handleAddUser(e) {
        e.preventDefault();

        const serviceSearchInput = document.getElementById('newUserServiceSearch');
        const serviceId = serviceSearchInput ? serviceSearchInput.getAttribute('data-service-id') : null;

        const userData = {
            username: document.getElementById('newUsername').value,
            fullName: document.getElementById('newUserFullName').value.trim() || null,
            roleId: parseInt(document.getElementById('newUserRole').value),
            serviceId: serviceId && serviceId !== '' ? parseInt(serviceId) : null,
            email: document.getElementById('newUserEmail').value || null
        };

        if (!/^\d{6}$/.test(userData.username)) {
            showToast(__('messages.validation.usernameDigits'), 'error');
            return;
        }

        if (!userData.roleId) {
            showToast(__('messages.validation.selectRole'), 'error');
            return;
        }

        if (userData.fullName && userData.fullName.length > 255) {
            showToast(__('messages.validation.fullNameLength'), 'error');
            return;
        }

        try {
            const result = await createUser(userData);
            addUserModal.classList.remove('show');
            showToast(__('messages.success.userCreated'), 'success');
            loadUsers();
        } catch (error) {
            console.error('Failed to create user:', error);
        }
    }

    async function handleGenerateRefCode(e) {
        e.preventDefault();

        const userId = currentRefCodeUserId;
        const require2FA = document.getElementById('refCodeRequire2FA').checked;
        const purpose = e.target.dataset.purpose || 'registration';

        try {
            const result = await generateReferenceCode(userId, require2FA, purpose);
            result.type = purpose;

            generateRefCodeModal.classList.remove('show');
            showRefCodeModal(result);

            const successMessage = purpose === 'password-reset'
                ? 'Password reset code generated successfully'
                : 'Reference code generated successfully';
            showToast(successMessage, 'success');
        } catch (error) {
            console.error('Failed to generate reference code:', error);
        }
    }

    async function handleEditUser(e) {
        e.preventDefault();

        const userId = currentEditUserId;
        const user = users.find(u => u.id === userId);
        if (!user) return;

        // Get current form values
        const fullName = document.getElementById('editUserFullName').value.trim() || null;
        const email = document.getElementById('editUserEmail').value.trim() || null;
        const roleId = parseInt(document.getElementById('editUserRole').value);

        const serviceSearchInput = document.getElementById('editUserServiceSearch');
        const serviceId = serviceSearchInput ? serviceSearchInput.getAttribute('data-service-id') : null;
        const finalServiceId = serviceId && serviceId !== '' ? parseInt(serviceId) : null;

        const twoFASettings = {
            totpEnabled: document.getElementById('editUserTotpEnabled').checked,
            webauthnEnabled: document.getElementById('editUserWebauthnEnabled').checked,
            require2FA: document.getElementById('editUserRequire2FA').checked
        };

        try {
            const updates = [];

            // Only update full name if changed
            const originalFullName = user.full_name || null;
            if (fullName !== originalFullName) {
                updates.push(updateUserFullName(userId, fullName));
            }

            // Only update email if changed
            const originalEmail = user.email || null;
            if (email !== originalEmail) {
                updates.push(updateUserEmail(userId, email));
            }

            // Only update role if changed
            const originalRoleId = user.role ? user.role.id : null;
            if (roleId !== originalRoleId) {
                updates.push(updateUserRole(userId, roleId));
            }

            // Only update service if changed
            const originalServiceId = user.service ? user.service.id : null;
            if (finalServiceId !== originalServiceId) {
                updates.push(updateUserService(userId, finalServiceId));
            }

            // Only update 2FA if any setting changed
            const original2FA = {
                totpEnabled: user.totp_enabled || false,
                webauthnEnabled: user.webauthn_enabled || false,
                require2FA: false // This is always false in the modal initialization
            };
            
            if (twoFASettings.totpEnabled !== original2FA.totpEnabled || 
                twoFASettings.webauthnEnabled !== original2FA.webauthnEnabled || 
                twoFASettings.require2FA !== original2FA.require2FA) {
                updates.push(updateUser2FA(userId, twoFASettings));
            }

            // Execute only the necessary updates
            if (updates.length > 0) {
                await Promise.all(updates);
                showToast(__('messages.success.userUpdated'), 'success');
            } else {
                showToast(__('messages.info.noChanges'), 'info');
            }

            editUserModal.classList.remove('show');
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    }

    function handleActionClick(e) {
        e.stopPropagation();

        if (activeDropdown) {
            closeDropdown();
        }

        const button = e.currentTarget;
        const userId = parseInt(button.dataset.id);
        const user = users.find(u => u.id === userId);
        const container = button.closest('.dropdown-container');

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu action-dropdown show';

        const hasRegistered = user.is_registered;

        let dropdownHTML = `
            <div class="dropdown-item" data-action="edit">
                <span class="material-symbols-outlined">edit</span>
                ${__('editUser')}
            </div>
        `;

        if (!hasRegistered) {
            dropdownHTML += `
                <div class="dropdown-item" data-action="generate-ref-code">
                    <span class="material-symbols-outlined">qr_code</span>
                    ${__('generateRefCode')}
                </div>
            `;
        } else {
            dropdownHTML += `
                <div class="dropdown-item" data-action="reset-password">
                    <span class="material-symbols-outlined">lock_reset</span>
                    ${__('resetPassword')}
                </div>
            `;
        }

        if (user.service) {
            dropdownHTML += `
                <div class="dropdown-item" data-action="view-service">
                    <span class="material-symbols-outlined">business</span>
                    ${__('viewServiceInfo')}
                </div>
            `;
        }

        dropdownHTML += `
            <div class="dropdown-item" data-action="toggle-lock">
                <span class="material-symbols-outlined">${user.account_locked ? 'lock_open' : 'lock'}</span>
                ${user.account_locked ? __('unlockUser') : __('lockUser')}
            </div>
        `;

        dropdown.innerHTML = dropdownHTML;

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();

                const action = this.dataset.action;

                switch (action) {
                    case 'edit':
                        showEditUserModal(userId);
                        break;
                    case 'generate-ref-code':
                        showGenerateRefCodeModal(userId, 'registration');
                        break;
                    case 'reset-password':
                        showGenerateRefCodeModal(userId, 'password-reset');
                        break;
                    case 'view-service':
                        showToast(`Service: ${user.service.name} - ${__('messages.info.serviceUsers')}`, 'info');
                        break;
                    case 'toggle-lock':
                        const lockAction = user.account_locked ? 'unlock' : 'lock';
                        showConfirmModal(
                            `Are you sure you want to ${lockAction} ${user.username}?`,
                            () => toggleUserLock(userId, !user.account_locked, `Manual ${lockAction} by admin`)
                        );
                        break;
                }

                closeDropdown();
            });
        });

        container.appendChild(dropdown);
        activeDropdown = dropdown;
    }

    function handleSort(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }

        resetSortIcons();
        const th = document.querySelector(`th[data-sort="${field}"]`);
        th.querySelector('.material-symbols-outlined').textContent =
            sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';

        users.sort((a, b) => {
            let aVal, bVal;

            switch (field) {
                case 'username':
                    aVal = a.username;
                    bVal = b.username;
                    break;
                case 'full_name':
                    aVal = a.full_name || '';
                    bVal = b.full_name || '';
                    break;
                case 'email':
                    aVal = a.email || '';
                    bVal = b.email || '';
                    break;
                case 'role':
                    aVal = a.role ? a.role.name : '';
                    bVal = b.role ? b.role.name : '';
                    break;
                case 'service':
                    aVal = a.service ? a.service.name : '';
                    bVal = b.service ? b.service.name : '';
                    break;
                case 'created_at':
                    aVal = new Date(a.created_at);
                    bVal = new Date(b.created_at);
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable();
    }

    function resetSortIcons() {
        document.querySelectorAll('th[data-sort] .material-symbols-outlined').forEach(icon => {
            icon.textContent = 'swap_vert';
        });
    }

    function closeDropdown() {
        if (activeDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
        }
    }

    function copyRefCode() {
        const code = document.getElementById('refCodeDisplay').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast(__('messages.success.refCodeCopied'), 'success');
        }).catch(() => {
            showToast(__('messages.error.copyFailed'), 'error');
        });
    }

    function copyRegistrationUrl() {
        const url = document.getElementById('registrationUrl').textContent;
        navigator.clipboard.writeText(url).then(() => {
            showToast(__('messages.success.urlCopied'), 'success');
        }).catch(() => {
            showToast(__('messages.error.copyFailed'), 'error');
        });
    }

    // Frontend code for generating and printing documents

    /**
     * Generate HTML and open print dialog (recommended for printing)
     */
    async function printDocument(templateName, data) {
        try {
            // Show loading (optional)
            // Generating document for print...

            // Generate HTML version
            const response = await api.post('/documents/generate', {
                templateName,
                format: 'html',
                data
            });

            if (!response.success) {
                throw new Error(response.message || 'Failed to generate document');
            }

            // Create new window for printing
            const printWindow = window.open('', '_blank', 'width=800,height=600');

            // Write HTML content to new window
            printWindow.document.write(response.html);
            printWindow.document.close();

            // Wait for content to load, then print
            printWindow.onload = function() {
                setTimeout(() => {
                    printWindow.print();
                    // Close window after print dialog
                    setTimeout(() => {
                        if (!printWindow.closed) {
                            printWindow.close();
                        }
                    }, 1000);
                }, 500);
            };

        } catch (error) {
            console.error('Print failed:', error);
            alert('Failed to generate document for printing: ' + error.message);
        }
    }

    /**
     * Generate and download PDF
     */
    async function downloadPDF(templateName, data, filename = null) {
        try {
            // Generating PDF...

            // Use fetch directly for binary PDF data
            const response = await fetch(api.buildUrl('/api/documents/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Important for authentication
                body: JSON.stringify({
                    templateName,
                    format: 'pdf',
                    data
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error: ${response.status}`);
            }

            // Get the PDF blob
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `${templateName}-${Date.now()}.pdf`;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            window.URL.revokeObjectURL(url);

            // PDF downloaded successfully

        } catch (error) {
            console.error('PDF download failed:', error);
            alert('Failed to download PDF: ' + error.message);
        }
    }

    /**
     * Preview document in new tab (useful for review before printing)
     */
    async function previewDocument(templateName, data) {
        try {
            // Generating preview...

            const response = await api.post('/api/documents/preview', {
                templateName,
                data
            });

            if (!response.success) {
                throw new Error(response.message || 'Failed to generate preview');
            }

            // Open in new tab
            const previewWindow = window.open('', '_blank');
            previewWindow.document.write(response.html);
            previewWindow.document.close();

        } catch (error) {
            console.error('Preview failed:', error);
            alert('Failed to generate preview: ' + error.message);
        }
    }

// Example usage functions for specific templates:

    /**
     * Print a reference code document
     */
    async function printRefCode() {
        const referenceCode = document.getElementById('refCodeDisplay').textContent;

        await printDocument('ref-code', {referenceCode});
    }

    /**
     * Download reference code as PDF
     */
    async function downloadRefCodePDF(referenceCode, userName = 'ePick Administration', userRole = 'System Administrator') {
        const templateData = {
            referenceCode,
        };

        await downloadPDF('ref-code', templateData, `ref-code-${referenceCode}.pdf`);
    }

    /**
     * Print user report
     */
    async function printUserReport(userData) {
        await printDocument('user-report', userData);
    }

    /**
     * Download user report as PDF
     */
    async function downloadUserReportPDF(userData) {
        await downloadPDF('user-report', userData, `user-report-${userData.username || 'user'}.pdf`);
    }

// Example event handlers for buttons:

// HTML: <button onclick="handlePrintRefCode()">Print Ref Code</button>
    function handlePrintRefCode() {
        const refCode = document.getElementById('refCodeInput').value;
        if (!refCode) {
            alert('Please enter a reference code');
            return;
        }
        printRefCode(refCode);
    }

// HTML: <button onclick="handleDownloadRefCode()">Download PDF</button>
    function handleDownloadRefCode() {
        const refCode = document.getElementById('refCodeInput').value;
        if (!refCode) {
            alert('Please enter a reference code');
            return;
        }
        downloadRefCodePDF(refCode);
    }


    // Utility Functions
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

        if (error.message.includes('body stream already read')) {
            return 'Server error occurred. Please try again.';
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

    function handleAuthError(error) {
        if (error.status === 401) {
            showToast(__('messages.error.sessionExpired'), 'error');
            setTimeout(() => {
                // window.location.href = '/login';
            }, 2000);
            return true;
        }
        return false;
    }

    function showLoading() {
        tableBody.innerHTML = '<tr><td colspan="10" class="loading"><span class="material-symbols-outlined">hourglass_empty</span><br>Loading users...</td></tr>';
        recordCount.textContent = 'Loading...';
    }

    function showError(message) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--dark-red);">${message}</td></tr>`;
        recordCount.textContent = 'Error loading users';
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

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Global functions for pagination
    window.changePage = function(page) {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            currentPage = page;
            loadUsers();
        }
    };

    // User Details Popup functionality
    let currentUserAuditPage = 1;
    let currentUserAuditTotal = 0;
    let currentUserId = null;

    function initializeUserDetailsPopup() {
        const popup = document.getElementById('userDetailsPopup');
        const closeBtn = document.getElementById('closeUserDetailsBtn');
        const auditEventFilter = document.getElementById('auditEventFilter');
        const refreshAuditBtn = document.getElementById('refreshAuditBtn');
        const auditPrevBtn = document.getElementById('auditPrevBtn');
        const auditNextBtn = document.getElementById('auditNextBtn');

        // Close popup handlers
        closeBtn.addEventListener('click', closeUserDetailsPopup);
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                closeUserDetailsPopup();
            }
        });

        // Audit log controls
        auditEventFilter.addEventListener('change', () => {
            currentUserAuditPage = 1;
            loadUserAuditLogs();
        });

        refreshAuditBtn.addEventListener('click', () => {
            currentUserAuditPage = 1;
            loadUserAuditLogs();
        });

        auditPrevBtn.addEventListener('click', () => {
            if (currentUserAuditPage > 1) {
                currentUserAuditPage--;
                loadUserAuditLogs();
            }
        });

        auditNextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(currentUserAuditTotal / 20);
            if (currentUserAuditPage < totalPages) {
                currentUserAuditPage++;
                loadUserAuditLogs();
            }
        });

        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popup.style.display !== 'none') {
                closeUserDetailsPopup();
            }
        });
    }

    async function showUserDetailsPopup(userId) {
        currentUserId = userId;
        currentUserAuditPage = 1;
        currentUserAuditTotal = 0;

        const popup = document.getElementById('userDetailsPopup');
        popup.style.display = 'flex';

        // Load user details and audit logs
        await Promise.all([
            loadUserDetails(userId),
            loadUserAuditLogs()
        ]);
    }

    function closeUserDetailsPopup() {
        const popup = document.getElementById('userDetailsPopup');
        popup.style.display = 'none';
        currentUserId = null;
    }

    async function loadUserDetails(userId) {
        try {
            const response = await api.get(`/admin/user/${userId}`);
            
            if (response.success) {
                const user = response.data;
                populateUserDetails(user);
            } else {
                showToast(__('messages.error.loadingUserDetails'), 'error');
            }
        } catch (error) {
            console.error('Error loading user details:', error);
            showToast(__('messages.error.errorLoadingUserDetails'), 'error');
        }
    }

    function populateUserDetails(user) {
        // Debug: log the user object to see the actual structure
        console.log('User object:', user);
        
        document.getElementById('userDetailUsername').textContent = user.username || 'N/A';
        document.getElementById('userDetailFullName').textContent = user.full_name || 'N/A';
        document.getElementById('userDetailEmail').textContent = user.email || 'N/A';
        
        // Check different possible role field names
        let roleName = 'N/A';
        if (user.Role?.name) {
            roleName = user.Role.name;
        } else if (user.role?.name) {
            roleName = user.role.name;
        } else if (user.role_name) {
            roleName = user.role_name;
        }
        document.getElementById('userDetailRole').textContent = roleName;
        
        // Check different possible service field names
        let serviceName = 'N/A';
        if (user.Service?.name) {
            serviceName = user.Service.name;
        } else if (user.service?.name) {
            serviceName = user.service.name;
        } else if (user.service_name) {
            serviceName = user.service_name;
        } else if (!user.Service && !user.service && !user.service_name) {
            serviceName = 'No Service Assigned';
        }
        document.getElementById('userDetailService').textContent = serviceName;
        
        // Format status - check different possible field names
        let statusText = 'Active';
        if (user.account_locked === true || user.locked === true) {
            statusText = 'Locked';
        } else if (user.account_active === false || user.active === false) {
            statusText = 'Inactive';
        } else if (user.account_active === true || user.active === true || user.account_active === undefined) {
            statusText = 'Active';
        }
        document.getElementById('userDetailStatus').textContent = statusText;
        
        document.getElementById('userDetailLastLogin').textContent = 
            user.last_login ? formatDateTime(user.last_login) : 'Never';
        document.getElementById('userDetailCreatedAt').textContent = 
            formatDateTime(user.created_at);
    }

    async function loadUserAuditLogs() {
        if (!currentUserId) return;

        const auditLogLoading = document.getElementById('auditLogLoading');
        const auditLogEmpty = document.getElementById('auditLogEmpty');
        const auditLogTable = document.getElementById('auditLogTable');
        const auditPagination = document.getElementById('auditPagination');

        // Show loading state
        auditLogLoading.style.display = 'block';
        auditLogEmpty.style.display = 'none';
        auditLogTable.style.display = 'none';
        auditPagination.style.display = 'none';

        try {
            const eventFilter = document.getElementById('auditEventFilter').value;
            const params = new URLSearchParams({
                page: currentUserAuditPage,
                limit: 20
            });

            if (eventFilter) {
                params.append('eventFilter', eventFilter);
            }

            const response = await api.get(`/admin/user/${currentUserId}/audit-logs?${params}`);
            
            auditLogLoading.style.display = 'none';

            if (response.success && response.data.logs.length > 0) {
                populateAuditLogs(response.data.logs);
                updateAuditPagination(response.data.pagination);
                auditLogTable.style.display = 'block';
                auditPagination.style.display = 'flex';
            } else {
                auditLogEmpty.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
            auditLogLoading.style.display = 'none';
            auditLogEmpty.style.display = 'block';
        }
    }

    function populateAuditLogs(logs) {
        const auditLogBody = document.getElementById('auditLogBody');
        auditLogBody.innerHTML = '';

        logs.forEach(log => {
            const row = document.createElement('tr');
            
            // Use friendly event type if available, otherwise format the raw event type
            const eventType = log.friendly_event_type || formatEventType(log.event_type);
            const target = formatAuditTarget(log.target_type, log.target_id);
            
            // Use friendly details for regular admins, technical details for system admins
            const details = log.friendly_details || formatAuditDetails(log.metadata);

            row.innerHTML = `
                <td class="audit-timestamp">${formatDateTime(log.created_at)}</td>
                <td class="audit-event">${eventType}</td>
                <td class="audit-target">${target}</td>
                <td class="audit-details">${details}</td>
            `;

            auditLogBody.appendChild(row);
        });
    }

    function updateAuditPagination(pagination) {
        const auditPageInfo = document.getElementById('auditPageInfo');
        const auditPrevBtn = document.getElementById('auditPrevBtn');
        const auditNextBtn = document.getElementById('auditNextBtn');

        auditPageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
        auditPrevBtn.disabled = pagination.currentPage <= 1;
        auditNextBtn.disabled = pagination.currentPage >= pagination.totalPages;

        currentUserAuditTotal = pagination.totalItems;
    }

    function formatEventType(eventType) {
        return eventType
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function formatAuditTarget(targetType, targetId) {
        if (!targetType) return 'N/A';
        
        // Make target names more user-friendly
        const targetTypeMap = {
            'Analysis': 'Analysis',
            'Patient': 'Patient',
            'Doctor': 'Doctor', 
            'Room': 'Room',
            'User': 'User Account',
            'SystemUpdate': 'System Update'
        };
        
        const friendlyType = targetTypeMap[targetType] || targetType;
        return `${friendlyType} #${targetId}`;
    }

    function formatAuditDetails(metadata) {
        if (!metadata || typeof metadata !== 'object') return 'N/A';
        
        const details = [];
        Object.entries(metadata).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                details.push(`${key}: ${value}`);
            }
        });
        
        return details.length > 0 ? details.join(', ') : 'N/A';
    }

    // Mass Preferences Management (System Admin Only)
    const massPreferencesBtn = document.getElementById('massPreferencesBtn');
    const massPreferencesModal = document.getElementById('massPreferencesModal');
    
    if (massPreferencesBtn && massPreferencesModal) {
        massPreferencesBtn.addEventListener('click', openMassPreferencesModal);
        initializeMassPreferencesModal();
    }

    async function openMassPreferencesModal() {
        massPreferencesModal.classList.add('show');
        await loadPreferencesSummary();
    }

    function closeMassPreferencesModal() {
        massPreferencesModal.classList.remove('show');
    }

    function initializeMassPreferencesModal() {
        // Tab switching
        const tabButtons = massPreferencesModal.querySelectorAll('.tab-button');
        const tabContents = massPreferencesModal.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });

        // Target user selection handlers
        const updateTargetRadios = document.querySelectorAll('input[name="updateTarget"]');
        const resetTargetRadios = document.querySelectorAll('input[name="resetTarget"]');
        const resetModeRadios = document.querySelectorAll('input[name="resetMode"]');

        updateTargetRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const selectedUsersGroup = document.getElementById('selectedUsersGroup');
                selectedUsersGroup.style.display = radio.value === 'selected' ? 'block' : 'none';
                if (radio.value === 'selected') {
                    loadUserSelection('userSelection');
                }
            });
        });

        resetTargetRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const resetSelectedUsersGroup = document.getElementById('resetSelectedUsersGroup');
                resetSelectedUsersGroup.style.display = radio.value === 'selected' ? 'block' : 'none';
                if (radio.value === 'selected') {
                    loadUserSelection('resetUserSelection');
                }
            });
        });

        resetModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const specificPreferencesGroup = document.getElementById('specificPreferencesGroup');
                specificPreferencesGroup.style.display = radio.value === 'specific' ? 'block' : 'none';
            });
        });

        // Action button handlers
        document.getElementById('applyMassUpdateBtn').addEventListener('click', applyMassUpdate);
        document.getElementById('applyResetBtn').addEventListener('click', applyPreferencesReset);
    }

    async function loadPreferencesSummary() {
        const summaryContainer = document.getElementById('preferencesSummary');
        
        try {
            summaryContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>Loading preferences summary...</span>
                </div>
            `;

            const response = await api.get('/admin/user-preferences/summary');
            
            if (response.success) {
                renderPreferencesSummary(response.data);
            } else {
                throw new Error(response.message || 'Failed to load preferences summary');
            }
        } catch (error) {
            console.error('Error loading preferences summary:', error);
            summaryContainer.innerHTML = `
                <div class="error-state">
                    <span class="material-symbols-outlined">error</span>
                    <span>Error loading preferences summary: ${error.message}</span>
                </div>
            `;
        }
    }

    function renderPreferencesSummary(data) {
        const summaryContainer = document.getElementById('preferencesSummary');
        const { summary, users } = data;

        let html = `
            <div class="summary-stats">
                <div class="stat-card">
                    <h4>Total Users</h4>
                    <span class="stat-value">${summary.totalUsers}</span>
                </div>
                <div class="stat-card">
                    <h4>Active Users</h4>
                    <span class="stat-value">${summary.activeUsers}</span>
                </div>
                <div class="stat-card">
                    <h4>Users with Preferences</h4>
                    <span class="stat-value">${summary.usersWithPreferences}</span>
                </div>
            </div>
        `;

        if (Object.keys(summary.commonPreferences).length > 0) {
            html += '<div class="preferences-breakdown">';
            html += '<h4>Preference Usage</h4>';
            
            Object.entries(summary.commonPreferences).forEach(([key, data]) => {
                html += `
                    <div class="preference-breakdown">
                        <h5>${formatPreferenceName(key)}</h5>
                        <div class="preference-values">
                `;
                
                data.values.forEach(({ value, count, percentage }) => {
                    html += `
                        <div class="preference-value">
                            <span class="value">${formatPreferenceValue(value)}</span>
                            <span class="count">${count} users (${percentage}%)</span>
                        </div>
                    `;
                });
                
                html += '</div></div>';
            });
            
            html += '</div>';
        }

        summaryContainer.innerHTML = html;
    }

    async function loadUserSelection(containerId) {
        const container = document.getElementById(containerId);
        
        try {
            const response = await api.get('/admin/user-preferences/summary');
            
            if (response.success) {
                const users = response.data.users.filter(u => u.active);
                
                let html = '<div class="user-checkboxes">';
                users.forEach(user => {
                    html += `
                        <label class="user-checkbox">
                            <input type="checkbox" name="selectedUsers" value="${user.id}">
                            <span>${user.username} (${user.email})</span>
                        </label>
                    `;
                });
                html += '</div>';
                
                container.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading users:', error);
            container.innerHTML = '<div class="error-state">Error loading users</div>';
        }
    }

    async function applyMassUpdate() {
        const btn = document.getElementById('applyMassUpdateBtn');
        const originalText = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined loading">hourglass_empty</span> Updating...';

            const updateTarget = document.querySelector('input[name="updateTarget"]:checked').value;
            const updateMode = document.getElementById('updateMode').value;
            
            let userIds = [];
            if (updateTarget === 'all') {
                userIds = ['all'];
            } else {
                const selectedCheckboxes = document.querySelectorAll('input[name="selectedUsers"]:checked');
                userIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
                
                if (userIds.length === 0) {
                    showToast(__('notifications.massPreferences.selectOneUser'), 'error');
                    return;
                }
            }

            // Collect preferences to update
            const preferences = {};
            const prefElements = ['language', 'dateFormat', 'timeFormat', 'emailNotifications', 'timezone'];
            
            prefElements.forEach(pref => {
                const element = document.getElementById(`pref-${pref}`);
                if (element && element.value) {
                    let value = element.value;
                    // Convert string booleans to actual booleans
                    if (value === 'true') value = true;
                    if (value === 'false') value = false;
                    preferences[pref] = value;
                }
            });

            if (Object.keys(preferences).length === 0) {
                showToast(__('notifications.massPreferences.selectOnePreference'), 'error');
                return;
            }

            const response = await api.post('/admin/user-preferences/mass-update', {
                userIds,
                preferences,
                overwriteMode: updateMode
            });

            if (response.success) {
                showToast(response.message, 'success');
                await loadPreferencesSummary(); // Refresh the summary
            } else {
                throw new Error(response.message || 'Failed to update preferences');
            }

        } catch (error) {
            console.error('Error applying mass update:', error);
            showToast(__('notifications.massPreferences.errorUpdating') + ': ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async function applyPreferencesReset() {
        const btn = document.getElementById('applyResetBtn');
        const originalText = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined loading">hourglass_empty</span> Resetting...';

            const resetTarget = document.querySelector('input[name="resetTarget"]:checked').value;
            const resetMode = document.querySelector('input[name="resetMode"]:checked').value;
            
            let userIds = [];
            if (resetTarget === 'all') {
                userIds = ['all'];
            } else {
                const selectedCheckboxes = document.querySelectorAll('#resetUserSelection input[name="selectedUsers"]:checked');
                userIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
                
                if (userIds.length === 0) {
                    showToast(__('notifications.massPreferences.selectOneUser'), 'error');
                    return;
                }
            }

            let preferenceKeys = [];
            if (resetMode === 'specific') {
                const selectedPrefs = document.querySelectorAll('input[name="resetPrefs"]:checked');
                preferenceKeys = Array.from(selectedPrefs).map(cb => cb.value);
                
                if (preferenceKeys.length === 0) {
                    showToast(__('notifications.massPreferences.selectOnePreferenceReset'), 'error');
                    return;
                }
            }

            const confirmMessage = resetMode === 'all' 
                ? 'Are you sure you want to reset ALL preferences for the selected users? This cannot be undone.'
                : `Are you sure you want to reset the selected preferences (${preferenceKeys.join(', ')}) for the selected users? This cannot be undone.`;
                
            if (!confirm(confirmMessage)) {
                return;
            }

            const response = await api.post('/admin/user-preferences/reset', {
                userIds,
                preferenceKeys: resetMode === 'all' ? [] : preferenceKeys
            });

            if (response.success) {
                showToast(response.message, 'success');
                await loadPreferencesSummary(); // Refresh the summary
            } else {
                throw new Error(response.message || 'Failed to reset preferences');
            }

        } catch (error) {
            console.error('Error resetting preferences:', error);
            showToast(__('notifications.massPreferences.errorResetting') + ': ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    function formatPreferenceName(key) {
        const nameMap = {
            'language': 'Language',
            'dateFormat': 'Date Format',
            'timeFormat': 'Time Format',
            'timezone': 'Timezone',
            'emailNotifications': 'Email Notifications'
        };
        return nameMap[key] || key;
    }

    function formatPreferenceValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'Enabled' : 'Disabled';
        }
        return value || 'Not set';
    }

    // Make functions available globally
    window.showUserDetailsPopup = showUserDetailsPopup;
    window.closeMassPreferencesModal = closeMassPreferencesModal;
    
    // Initialize popup when page loads
    initializeUserDetailsPopup();
}