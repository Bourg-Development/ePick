document.addEventListener('DOMContentLoaded', function() {
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // State variables
    let settings = {};
    let originalValues = {};
    let pendingChanges = {};
    let readOnlyMode = false;
    let activeExportDropdown = null;
    let analysisTypes = [];
    let analysisTypesModified = false;

    // Export column definitions for organization settings
    const exportColumns = {
        key: { name: 'Setting Key', description: 'Internal setting identifier', sensitive: false },
        value: { name: 'Setting Value', description: 'Current setting value', sensitive: true },
        dataType: { name: 'Data Type', description: 'Type of setting (string, integer, boolean, etc.)', sensitive: false },
        description: { name: 'Description', description: 'Human-readable description of the setting', sensitive: false },
        category: { name: 'Category', description: 'Setting category or group', sensitive: false },
        isCritical: { name: 'Critical Setting', description: 'Whether this is a critical system setting', sensitive: false },
        isSystem: { name: 'System Setting', description: 'Whether this is a system-level setting', sensitive: false },
        createdAt: { name: 'Created Date', description: 'When the setting was first created', sensitive: false },
        updatedAt: { name: 'Last Modified', description: 'When the setting was last updated', sensitive: false },
        createdBy: { name: 'Created By', description: 'Username who created this setting', sensitive: false },
        modifiedBy: { name: 'Modified By', description: 'Username who last modified this setting', sensitive: false }
    };

    // Safe columns (non-sensitive, commonly exported)
    const safeColumns = ['key', 'dataType', 'description', 'category', 'isCritical', 'isSystem', 'createdAt', 'updatedAt'];

    // Data type validation
    const dataTypeValidators = {
        string: (value) => typeof value === 'string' && value.length > 0,
        integer: (value) => Number.isInteger(Number(value)) && !isNaN(Number(value)),
        decimal: (value) => !isNaN(parseFloat(value)) && isFinite(value),
        boolean: (value) => value === true || value === false || value === 'true' || value === 'false',
        json: (value) => {
            try {
                JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // DOM Elements
    const refreshBtn = document.getElementById('refreshBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportModal = document.getElementById('exportModal');
    const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
    const advancedContent = document.getElementById('advancedContent');
    const changesSummary = document.getElementById('changesSummary');
    const changesCount = document.getElementById('changesCount');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const discardChangesBtn = document.getElementById('discardChangesBtn');
    const confirmModal = document.getElementById('confirmModal');
    const toast = document.getElementById('toast');

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadSettings();
        await loadAnalysisTypes();
    }

    function setupEventListeners() {
        // Main action buttons
        refreshBtn.addEventListener('click', loadSettings);
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', showSaveConfirmation);
        }

        // Export functionality
        if (exportDropdownBtn) {
            setupExportEventListeners();
        }

        // Advanced settings toggle
        if (toggleAdvancedBtn) {
            toggleAdvancedBtn.addEventListener('click', toggleAdvancedSettings);
        }

        // Changes summary actions
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', showSaveConfirmation);
        }
        if (discardChangesBtn) {
            discardChangesBtn.addEventListener('click', discardAllChanges);
        }

        // Modal handlers
        document.getElementById('closeConfirmBtn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
        });
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
        });
        document.getElementById('confirmSaveBtn').addEventListener('click', saveAllChanges);

        // Setting input change handlers
        setupSettingInputHandlers();

        // Global click for closing dropdowns
        document.addEventListener('click', function(e) {
            if (activeExportDropdown && !e.target.closest('.export-dropdown-container')) {
                closeExportDropdown();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                confirmModal.classList.remove('show');
                exportModal.classList.remove('show');
                if (activeExportDropdown) closeExportDropdown();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (Object.keys(pendingChanges).length > 0) {
                    showSaveConfirmation();
                }
            }
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                loadSettings();
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

    function setupSettingInputHandlers() {
        // Regular input fields
        document.querySelectorAll('.setting-input').forEach(input => {
            const key = input.dataset.key;
            const type = input.dataset.type;

            input.addEventListener('input', () => trackChange(key, input, type));
            input.addEventListener('change', () => trackChange(key, input, type));
        });

        // Select dropdowns
        document.querySelectorAll('.setting-select').forEach(select => {
            const key = select.dataset.key;
            const type = select.dataset.type;

            select.addEventListener('change', () => trackChange(key, select, type));
        });

        // Toggle switches
        document.querySelectorAll('.toggle-switch').forEach(toggleContainer => {
            const key = toggleContainer.dataset.key;
            const type = toggleContainer.dataset.type;
            const input = toggleContainer.querySelector('.toggle-input');

            input.addEventListener('change', () => trackChange(key, toggleContainer, type));
        });

        // Checkbox groups (for working days)
        document.querySelectorAll('.checkbox-group-horizontal').forEach(group => {
            const key = group.dataset.key;
            const type = group.dataset.type;
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');

            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => trackChange(key, group, type));
            });
        });

        // Save buttons
        document.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                const keys = this.dataset.keys;
                
                if (keys) {
                    // Handle multiple keys (like interval value + unit)
                    const keyArray = keys.split(',');
                    saveMultipleSettings(keyArray, this);
                } else if (key) {
                    // Handle single key
                    saveSingleSetting(key);
                }
            });
        });

        // Reset buttons
        document.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                const keys = this.dataset.keys;
                
                if (keys) {
                    // Handle multiple keys (like interval value + unit)
                    const keyArray = keys.split(',');
                    keyArray.forEach(k => resetSingleSetting(k));
                } else if (key) {
                    // Handle single key
                    resetSingleSetting(key);
                }
            });
        });

        // Special handling for prescription check interval unit change
        const intervalUnitSelect = document.getElementById('prescriptionCheckIntervalUnit');
        const intervalValueInput = document.getElementById('prescriptionCheckIntervalValue');
        
        if (intervalUnitSelect && intervalValueInput) {
            intervalUnitSelect.addEventListener('change', function() {
                // First track the unit change
                trackChange('prescription_check_interval_unit', this, 'string');
                
                const unit = this.value;
                const currentValue = parseInt(intervalValueInput.value) || 1;
                
                if (unit === 'minutes') {
                    intervalValueInput.max = '1440';
                    intervalValueInput.placeholder = 'Enter minutes (1-1440)';
                    // Convert hours to minutes if current value is reasonable
                    if (currentValue <= 24) {
                        intervalValueInput.value = currentValue * 60;
                        trackChange('prescription_check_interval_value', intervalValueInput, 'integer');
                    }
                } else if (unit === 'hours') {
                    intervalValueInput.max = '24';
                    intervalValueInput.placeholder = 'Enter hours (1-24)';
                    // Convert minutes to hours if it's a clean conversion
                    if (currentValue % 60 === 0 && currentValue <= 1440) {
                        intervalValueInput.value = currentValue / 60;
                        trackChange('prescription_check_interval_value', intervalValueInput, 'integer');
                    } else if (currentValue > 24) {
                        intervalValueInput.value = 4; // Reset to default
                        trackChange('prescription_check_interval_value', intervalValueInput, 'integer');
                    }
                }
            });
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
            case 'export-config':
                exportConfiguration();
                break;
        }
    }

    function showExportModal() {
        // Populate column selection
        populateColumnGrid();

        // Update current settings display
        updateCurrentSettingsDisplay();

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

    function updateCurrentSettingsDisplay() {
        const currentSettings = document.getElementById('currentSettings');
        const settingsCount = Object.keys(settings).length;
        const pendingCount = Object.keys(pendingChanges).length;

        let displayText = `All ${settingsCount} organization settings`;
        if (pendingCount > 0) {
            displayText += ` (${pendingCount} with unsaved changes)`;
        }

        currentSettings.innerHTML = `<span class="settings-info">${displayText}</span>`;
    }

    async function handleExportSubmit(e) {
        e.preventDefault();

        const password = document.getElementById('exportPassword').value;
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value);

        if (!password) {
            showToast(__('messages.validation.passwordRequired'), 'error');
            return;
        }

        if (selectedColumns.length === 0) {
            showToast(__('messages.validation.selectAtLeastOneColumn'), 'error');
            return;
        }

        try {
            showExportProgress(true);
            await performExport(format, password, selectedColumns);
            exportModal.classList.remove('show');
            showToast(`Export completed successfully (${format.toUpperCase()})`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast(getErrorMessage(error), 'error');
        } finally {
            showExportProgress(false);
        }
    }

    async function performQuickExport(format) {
        // Use safe columns for quick export
        const password = prompt('Enter your password to confirm export:');
        if (!password) return;

        try {
            showToast(`Starting ${format.toUpperCase()} export...`, 'info');
            await performExport(format, password, safeColumns);
            showToast(`Quick export completed (${format.toUpperCase()})`, 'success');
        } catch (error) {
            console.error('Quick export error:', error);
            showToast(getErrorMessage(error), 'error');
        }
    }

    async function performExport(format, password, selectedColumns) {
        const exportData = {
            password: password,
            includeColumns: selectedColumns,
            includePendingChanges: Object.keys(pendingChanges).length > 0
        };

        let endpoint;
        switch (format) {
            case 'csv':
                endpoint = '/org-settings/export/csv';
                break;
            case 'excel':
                endpoint = '/org-settings/export/excel';
                break;
            case 'json':
                endpoint = '/org-settings/export/json';
                break;
            default:
                throw new Error('Invalid export format');
        }

        try {
            if (format === 'json') {
                // JSON export returns JSON response - use API utility
                const data = await api.post(endpoint, exportData);
                downloadJsonFile(data, `org_settings_export_${new Date().toISOString().split('T')[0]}.json`);
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
        const url = api.buildUrl(endpoint);

        try {
            const config = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(exportData)
            };

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), api.config.timeout || 15000)
            );

            let response = await Promise.race([
                fetch(url, config),
                timeoutPromise
            ]);

            if (response.status === 401) {
                console.log('Token expired, attempting refresh...');
                const refreshSuccess = await api.handleTokenRefresh();

                if (refreshSuccess) {
                    response = await Promise.race([
                        fetch(url, config),
                        timeoutPromise
                    ]);
                } else {
                    throw new Error('Authentication failed');
                }
            }

            if (!response.ok) {
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

            const blob = await response.blob();
            const filename = getFilenameFromResponse(response) ||
                `org_settings_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;

            downloadBlob(blob, filename);

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                error.message = 'Network error: Please check your internet connection';
            }
            throw error;
        }
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

    function trackChange(key, inputElement, type) {
        if (readOnlyMode) return;

        let currentValue = getCurrentValue(inputElement, type);
        let originalValue = originalValues[key];

        // Convert for comparison
        if (type === 'boolean') {
            currentValue = currentValue === true || currentValue === 'true';
            originalValue = originalValue === true || originalValue === 'true';
        }

        // Check if value has changed
        const hasChanged = !isEqual(currentValue, originalValue);

        if (hasChanged) {
            pendingChanges[key] = {
                newValue: currentValue,
                oldValue: originalValue,
                type: type,
                element: inputElement
            };
        } else {
            delete pendingChanges[key];
        }

        updateSettingVisualState(key, inputElement, hasChanged);
        updateSaveButtonState(key, hasChanged);
        updateChangesSummary();
    }

    function getCurrentValue(element, type) {
        if (element.classList.contains('toggle-switch')) {
            const input = element.querySelector('.toggle-input');
            return input.checked;
        } else if (element.classList.contains('checkbox-group-horizontal')) {
            const checkboxes = element.querySelectorAll('input[type="checkbox"]:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        } else {
            let value = element.value;

            // Type conversion
            switch (type) {
                case 'integer':
                    return parseInt(value) || 0;
                case 'decimal':
                    return parseFloat(value) || 0;
                case 'boolean':
                    return value === 'true' || value === true;
                default:
                    return value;
            }
        }
    }

    function isEqual(a, b) {
        if (Array.isArray(a) && Array.isArray(b)) {
            return a.length === b.length && a.every((val, i) => val === b[i]);
        }
        return a === b;
    }

    function updateSettingVisualState(key, element, hasChanged) {
        const mainInput = element.classList.contains('setting-input') ? element :
            element.querySelector('.setting-input, .toggle-input, input[type="checkbox"]');

        if (mainInput) {
            mainInput.classList.toggle('changed', hasChanged);
        }

        // Update status
        const statusElement = document.getElementById(`status-${key}`);
        if (statusElement) {
            if (hasChanged) {
                statusElement.innerHTML = '<span class="material-symbols-outlined">edit</span>Modified';
                statusElement.className = 'setting-status';
            } else {
                statusElement.innerHTML = '';
                statusElement.className = 'setting-status';
            }
        }
    }

    function updateSaveButtonState(key, hasChanged) {
        const saveBtn = document.querySelector(`.save-btn[data-key="${key}"]`);
        if (saveBtn) {
            saveBtn.classList.toggle('enabled', hasChanged);
            saveBtn.disabled = !hasChanged;
        }
    }

    function updateChangesSummary() {
        const changeCount = Object.keys(pendingChanges).length;

        if (changeCount > 0) {
            changesSummary.classList.add('show');
            changesCount.textContent = changeCount;
        } else {
            changesSummary.classList.remove('show');
        }
    }

    // API Functions
    async function loadSettings() {
        try {
            showToast(__('messages.info.loadingSettings'), 'info');

            const data = await api.get('/org-settings/');
            settings = {};
            originalValues = {};

            // Convert array to object for easier access
            if (data.settings) {
                data.settings.forEach(setting => {
                    settings[setting.key] = setting;
                    originalValues[setting.key] = setting.value;
                });
            }

            populateSettingsForm();
            await loadAdvancedSettings();

            // Clear any pending changes
            pendingChanges = {};
            updateChangesSummary();

            showToast(__('messages.success.settingsLoaded'), 'success');
        } catch (error) {
            console.error('Load settings error:', error);
            showToast(__('messages.error.failedLoadSettings') + ': ' + getErrorMessage(error), 'error');
        }
    }

    async function loadAdvancedSettings() {
        try {
            // Load additional settings that aren't in the main UI
            const allSettings = Object.keys(settings);
            const mainSettingKeys = [
                'max_analyses_per_day',
                'working_days',
                'notification_enabled',
                'auto_archive_enabled',
                'self_service',
                'prescription_notification_enabled',
                'prescription_validation_notification_hours'
            ];

            const advancedSettingKeys = allSettings.filter(key => !mainSettingKeys.includes(key));

            if (advancedSettingKeys.length > 0) {
                populateAdvancedSettings(advancedSettingKeys);
            } else {
                advancedContent.innerHTML = '<p style="color: var(--medium-gray); text-align: center; padding: 20px;">No additional settings available</p>';
            }
        } catch (error) {
            console.error('Load advanced settings error:', error);
        }
    }

    function populateAdvancedSettings(keys) {
        let html = '';

        keys.forEach(key => {
            const setting = settings[key];
            const inputType = getInputType(setting.dataType);
            const value = setting.value;

            html += `
                <div class="setting-group">
                    <label class="setting-label" for="advanced-${key}">
                        ${formatLabel(key)}
                        <span class="setting-type type-${setting.dataType}">${setting.dataType}</span>
                    </label>
                    <div class="setting-input-group">
                        ${createInputElement(key, setting.dataType, value, `advanced-${key}`)}
                        <div class="input-actions">
                            <button class="btn btn-sm btn-primary save-btn" data-key="${key}">
                                <span class="material-symbols-outlined">save</span>
                            </button>
                            <button class="btn btn-sm btn-secondary reset-btn" data-key="${key}">
                                <span class="material-symbols-outlined">undo</span>
                            </button>
                        </div>
                    </div>
                    <small class="setting-help">${setting.description || 'No description available'}</small>
                    <div class="setting-status" id="status-${key}"></div>
                </div>
            `;
        });

        advancedContent.innerHTML = html;

        // Re-setup event listeners for advanced settings
        setupAdvancedEventListeners();
    }

    function createInputElement(key, type, value, elementId) {
        switch (type) {
            case 'boolean':
                return `
                    <div class="toggle-switch" data-key="${key}" data-type="${type}">
                        <input type="checkbox" id="${elementId}" class="toggle-input" ${value ? 'checked' : ''}>
                        <label for="${elementId}" class="toggle-label">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            case 'integer':
                return `<input type="number" class="setting-input" id="${elementId}" value="${value}" data-key="${key}" data-type="${type}">`;
            case 'decimal':
                return `<input type="number" step="any" class="setting-input" id="${elementId}" value="${value}" data-key="${key}" data-type="${type}">`;
            case 'json':
                return `<textarea class="setting-input" id="${elementId}" rows="3" data-key="${key}" data-type="${type}">${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</textarea>`;
            default:
                return `<input type="text" class="setting-input" id="${elementId}" value="${value}" data-key="${key}" data-type="${type}">`;
        }
    }

    function setupAdvancedEventListeners() {
        // Advanced setting inputs
        advancedContent.querySelectorAll('.setting-input').forEach(input => {
            const key = input.dataset.key;
            const type = input.dataset.type;

            input.addEventListener('input', () => trackChange(key, input, type));
            input.addEventListener('change', () => trackChange(key, input, type));
        });

        // Advanced toggle switches
        advancedContent.querySelectorAll('.toggle-switch').forEach(toggleContainer => {
            const key = toggleContainer.dataset.key;
            const type = toggleContainer.dataset.type;
            const input = toggleContainer.querySelector('.toggle-input');

            input.addEventListener('change', () => trackChange(key, toggleContainer, type));
        });

        // Advanced save buttons
        advancedContent.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                saveSingleSetting(key);
            });
        });

        // Advanced reset buttons
        advancedContent.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                resetSingleSetting(key);
            });
        });
    }

    function getInputType(dataType) {
        switch (dataType) {
            case 'integer': return 'number';
            case 'decimal': return 'number';
            case 'boolean': return 'checkbox';
            default: return 'text';
        }
    }

    function formatLabel(key) {
        return key.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    function populateSettingsForm() {
        // Populate main settings
        populateInput('max_analyses_per_day', 'maxAnalysesPerDay');
        populateToggle('notification_enabled', 'notificationEnabled');
        populateToggle('auto_archive_enabled', 'autoArchiveEnabled');
        populateToggle('self_service', 'selfServiceEnabled');
        populateToggle('prescription_notification_enabled', 'prescriptionNotificationEnabled');
        populateInput('prescription_validation_notification_hours', 'prescriptionValidationHours');
        populateInput('prescription_check_interval_value', 'prescriptionCheckIntervalValue');
        populateInput('prescription_check_interval_unit', 'prescriptionCheckIntervalUnit');
        populateWorkingDays('working_days');
    }

    function populateInput(settingKey, elementId) {
        const element = document.getElementById(elementId);
        const setting = settings[settingKey];

        if (element && setting) {
            element.value = setting.value;
            element.dataset.key = settingKey;
            element.dataset.type = setting.dataType;
        }
    }

    function populateToggle(settingKey, elementId) {
        const element = document.getElementById(elementId);
        const setting = settings[settingKey];

        if (element && setting) {
            element.checked = setting.value === true || setting.value === 'true';
            const container = element.closest('.toggle-switch');
            if (container) {
                container.dataset.key = settingKey;
                container.dataset.type = setting.dataType;
            }
        }
    }

    function populateWorkingDays(settingKey) {
        const container = document.getElementById('workingDaysGroup');
        const setting = settings[settingKey];

        if (container && setting) {
            const workingDays = Array.isArray(setting.value) ? setting.value : [];
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');

            checkboxes.forEach(checkbox => {
                checkbox.checked = workingDays.includes(checkbox.value);
            });
        }
    }

    async function saveMultipleSettings(keys, buttonElement) {
        // Check if any of the keys have pending changes
        const hasChanges = keys.some(key => pendingChanges[key]);
        if (!hasChanges) return;

        const statusElement = document.getElementById('status-prescription_check_interval');

        try {
            // Show saving state
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
            if (statusElement) {
                statusElement.innerHTML = '<div class="loading-spinner"></div>Saving...';
                statusElement.className = 'setting-status saving';
            }

            // Save each setting sequentially
            for (const key of keys) {
                if (pendingChanges[key]) {
                    const change = pendingChanges[key];
                    
                    // Prepare value for API
                    let apiValue = change.newValue;
                    if (change.type === 'json' && typeof apiValue !== 'string') {
                        apiValue = JSON.stringify(apiValue);
                    }

                    await api.put(`/org-settings/${key}`, { value: apiValue });

                    // Update original value and clear pending change
                    originalValues[key] = change.newValue;
                    delete pendingChanges[key];

                    // Update UI for this setting
                    updateSettingVisualState(key, change.element, false);
                }
            }

            // Update global UI state
            updateChangesSummary();

            if (statusElement) {
                statusElement.innerHTML = '<span class="material-symbols-outlined">check_circle</span>Saved';
                statusElement.className = 'setting-status success';
                setTimeout(() => {
                    statusElement.innerHTML = '';
                    statusElement.className = 'setting-status';
                }, 3000);
            }

            showToast(__('messages.success.prescriptionIntervalSaved'), 'success');

        } catch (error) {
            console.error('Save multiple settings error:', error);

            if (statusElement) {
                statusElement.innerHTML = '<span class="material-symbols-outlined">error</span>Error saving';
                statusElement.className = 'setting-status error';
            }

            const errorMessage = error.data?.message || error.message || 'Failed to save settings';
            showToast(errorMessage, 'error');

        } finally {
            // Reset button state
            buttonElement.classList.remove('loading');
            buttonElement.disabled = false;
        }
    }

    async function saveSingleSetting(key) {
        if (!pendingChanges[key]) return;

        const change = pendingChanges[key];
        const saveBtn = document.querySelector(`.save-btn[data-key="${key}"]`);
        const statusElement = document.getElementById(`status-${key}`);

        try {
            // Show saving state
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;
            if (statusElement) {
                statusElement.innerHTML = '<div class="loading-spinner"></div>Saving...';
                statusElement.className = 'setting-status saving';
            }

            // Prepare value for API
            let apiValue = change.newValue;
            if (change.type === 'json' && typeof apiValue !== 'string') {
                apiValue = JSON.stringify(apiValue);
            }

            await api.put(`/org-settings/${key}`, { value: apiValue });

            // Update original value and clear pending change
            originalValues[key] = change.newValue;
            delete pendingChanges[key];

            // Update UI
            updateSettingVisualState(key, change.element, false);
            updateSaveButtonState(key, false);
            updateChangesSummary();

            if (statusElement) {
                statusElement.innerHTML = '<span class="material-symbols-outlined">check_circle</span>Saved';
                statusElement.className = 'setting-status success';
                setTimeout(() => {
                    statusElement.innerHTML = '';
                    statusElement.className = 'setting-status';
                }, 3000);
            }

            showToast(`${formatLabel(key)} saved successfully`, 'success');

        } catch (error) {
            console.error('Save setting error:', error);

            if (statusElement) {
                statusElement.innerHTML = '<span class="material-symbols-outlined">error</span>Error saving';
                statusElement.className = 'setting-status error';
            }

            showToast(`Failed to save ${formatLabel(key)}: ${getErrorMessage(error)}`, 'error');
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    function resetSingleSetting(key) {
        const originalValue = originalValues[key];
        const setting = settings[key];

        if (!setting) return;

        // Find and reset the input element
        let element = document.querySelector(`[data-key="${key}"]`);

        if (element) {
            if (element.classList.contains('toggle-switch')) {
                const input = element.querySelector('.toggle-input');
                input.checked = originalValue === true || originalValue === 'true';
            } else if (element.classList.contains('checkbox-group-horizontal')) {
                const checkboxes = element.querySelectorAll('input[type="checkbox"]');
                const workingDays = Array.isArray(originalValue) ? originalValue : [];
                checkboxes.forEach(checkbox => {
                    checkbox.checked = workingDays.includes(checkbox.value);
                });
            } else {
                element.value = originalValue;
            }

            // Clear pending change
            delete pendingChanges[key];

            // Update UI
            updateSettingVisualState(key, element, false);
            updateSaveButtonState(key, false);
            updateChangesSummary();
        }
    }

    function showSaveConfirmation() {
        if (Object.keys(pendingChanges).length === 0) {
            showToast(__('messages.info.noChangesToSave'), 'info');
            return;
        }

        const changesPreview = document.getElementById('changesPreview');
        let html = '';

        Object.entries(pendingChanges).forEach(([key, change]) => {
            const oldValue = typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : String(change.oldValue);
            const newValue = typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : String(change.newValue);

            html += `
                <div class="change-item">
                    <span class="change-key">${formatLabel(key)}</span>
                    <div class="change-values">
                        <span class="old-value">${oldValue}</span>
                        <span class="material-symbols-outlined">arrow_forward</span>
                        <span class="new-value">${newValue}</span>
                    </div>
                </div>
            `;
        });

        changesPreview.innerHTML = html;
        document.getElementById('confirmMessage').textContent =
            `You are about to save ${Object.keys(pendingChanges).length} setting(s). This action cannot be undone.`;

        confirmModal.classList.add('show');
    }

    async function saveAllChanges() {
        confirmModal.classList.remove('show');

        if (Object.keys(pendingChanges).length === 0) return;

        const settingsToUpdate = {};
        Object.entries(pendingChanges).forEach(([key, change]) => {
            let value = change.newValue;
            if (change.type === 'json' && typeof value !== 'string') {
                value = JSON.stringify(value);
            }
            settingsToUpdate[key] = value;
        });

        try {
            showToast(__('messages.info.savingChanges'), 'info');

            if (saveAllBtn) {
                saveAllBtn.classList.add('loading');
                saveAllBtn.disabled = true;
            }

            await api.put('/org-settings/bulk/update', { settings: settingsToUpdate });

            // Update original values and clear pending changes
            Object.keys(pendingChanges).forEach(key => {
                originalValues[key] = pendingChanges[key].newValue;
                updateSettingVisualState(key, pendingChanges[key].element, false);
                updateSaveButtonState(key, false);
            });

            pendingChanges = {};
            updateChangesSummary();

            showToast(__('messages.success.settingsSaved', Object.keys(settingsToUpdate).length), 'success');

        } catch (error) {
            console.error('Bulk save error:', error);
            showToast(__('messages.error.failedSaveChanges') + ': ' + getErrorMessage(error), 'error');
        } finally {
            if (saveAllBtn) {
                saveAllBtn.classList.remove('loading');
                saveAllBtn.disabled = false;
            }
        }
    }

    function discardAllChanges() {
        Object.keys(pendingChanges).forEach(key => {
            resetSingleSetting(key);
        });

        showToast(__('messages.info.changesDiscarded'), 'info');
    }

    function toggleAdvancedSettings() {
        const isExpanded = advancedContent.classList.contains('show');

        if (isExpanded) {
            advancedContent.classList.remove('show');
            toggleAdvancedBtn.classList.remove('expanded');
            toggleAdvancedBtn.innerHTML = '<span class="material-symbols-outlined">expand_more</span>Show Advanced';
        } else {
            advancedContent.classList.add('show');
            toggleAdvancedBtn.classList.add('expanded');
            toggleAdvancedBtn.innerHTML = '<span class="material-symbols-outlined">expand_less</span>Hide Advanced';
        }
    }

    async function exportConfiguration() {
        try {
            const data = await api.get('/org-settings/system/configuration');
            const exportData = {
                exportDate: new Date().toISOString(),
                exportType: 'system_configuration',
                configuration: data.configuration
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `system_configuration_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast(__('messages.success.configExported'), 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast(__('messages.error.failedExportConfig') + ': ' + getErrorMessage(error), 'error');
        }
    }

    // Utility Functions
    function getErrorMessage(error) {
        if (error.status === 401) {
            return __('messages.error.authenticationRequired');
        }
        if (error.status === 403) {
            return __('messages.error.permissionDenied');
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
        return error.message || __('messages.error.unexpected');
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

    // Auto-save feature (optional)
    let autoSaveTimeout;
    function scheduleAutoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            if (Object.keys(pendingChanges).length > 0) {
                showToast(__('messages.info.autoSaving'), 'info');
                saveAllChanges();
            }
        }, 30000); // Auto-save after 30 seconds of inactivity
    }

    // Enable auto-save when there are changes
    const originalTrackChange = trackChange;
    trackChange = function(key, inputElement, type) {
        originalTrackChange(key, inputElement, type);
        scheduleAutoSave();
    };

    // ===== ANALYSIS TYPES MANAGEMENT =====
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async function loadAnalysisTypes() {
        try {
            const response = await api.get('/org-settings/analysis-types');
            if (response.success) {
                analysisTypes = response.analysisTypes || [];
                renderAnalysisTypes();
            } else {
                console.error('Failed to load analysis types:', response.message);
                showToast(__('messages.error.failedLoadAnalysisTypes'), 'error');
            }
        } catch (error) {
            console.error('Error loading analysis types:', error);
            showToast(__('messages.error.failedLoadAnalysisTypes'), 'error');
        }
    }
    
    function renderAnalysisTypes() {
        const container = document.getElementById('analysisTypesList');
        if (!container) return;
        
        if (analysisTypes.length === 0) {
            container.innerHTML = '<div class="analysis-types-empty">No analysis types configured</div>';
            return;
        }
        
        container.innerHTML = analysisTypes.map(type => `
            <div class="analysis-type-item">
                <div class="analysis-type-info">
                    <div>
                        <span class="analysis-type-code">${escapeHtml(type.code)}</span>
                        <span class="analysis-type-name">${escapeHtml(type.name)}</span>
                    </div>
                    ${type.description ? `<div class="analysis-type-description">${escapeHtml(type.description)}</div>` : ''}
                </div>
                <div class="analysis-type-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editAnalysisType('${type.code}')">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAnalysisType('${type.code}')">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    function setupAnalysisTypesEventListeners() {
        const addBtn = document.getElementById('addAnalysisTypeBtn');
        const modal = document.getElementById('analysisTypeModal');
        const form = document.getElementById('analysisTypeForm');
        const closeBtn = document.getElementById('closeAnalysisTypeModalBtn');
        const cancelBtn = document.getElementById('cancelAnalysisTypeBtn');
        
        if (addBtn) {
            addBtn.addEventListener('click', () => openAnalysisTypeModal());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeAnalysisTypeModal());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => closeAnalysisTypeModal());
        }
        
        if (form) {
            form.addEventListener('submit', handleAnalysisTypeSubmit);
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAnalysisTypeModal();
                }
            });
        }
    }
    
    function openAnalysisTypeModal(editCode = null) {
        const modal = document.getElementById('analysisTypeModal');
        const form = document.getElementById('analysisTypeForm');
        const title = document.getElementById('analysisTypeModalTitle');
        const codeInput = document.getElementById('analysisTypeCode');
        const nameInput = document.getElementById('analysisTypeName');
        const descriptionInput = document.getElementById('analysisTypeDescription');
        const idInput = document.getElementById('analysisTypeId');
        
        if (editCode) {
            const type = analysisTypes.find(t => t.code === editCode);
            if (type) {
                title.textContent = 'Edit Analysis Type';
                codeInput.value = type.code;
                nameInput.value = type.name;
                descriptionInput.value = type.description || '';
                idInput.value = type.code;
                codeInput.readOnly = true;
            }
        } else {
            title.textContent = 'Add Analysis Type';
            form.reset();
            idInput.value = '';
            codeInput.readOnly = false;
        }
        
        modal.classList.add('show');
        codeInput.focus();
    }
    
    function closeAnalysisTypeModal() {
        const modal = document.getElementById('analysisTypeModal');
        modal.classList.remove('show');
    }
    
    async function handleAnalysisTypeSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const isEdit = document.getElementById('analysisTypeId').value !== '';
        
        const analysisType = {
            code: document.getElementById('analysisTypeCode').value.trim().toUpperCase(),
            name: document.getElementById('analysisTypeName').value.trim(),
            description: document.getElementById('analysisTypeDescription').value.trim()
        };
        
        // Validate
        if (!analysisType.code || !analysisType.name) {
            showToast(__('messages.validation.codeNameRequired'), 'error');
            return;
        }

        // Check for duplicate codes (only when adding or changing code)
        if (!isEdit || analysisType.code !== document.getElementById('analysisTypeId').value) {
            if (analysisTypes.some(t => t.code === analysisType.code)) {
                showToast(__('messages.validation.analysisTypeCodeExists'), 'error');
                return;
            }
        }

        try {
            let newAnalysisTypes;
            if (isEdit) {
                newAnalysisTypes = analysisTypes.map(t =>
                    t.code === document.getElementById('analysisTypeId').value ? analysisType : t
                );
            } else {
                newAnalysisTypes = [...analysisTypes, analysisType];
            }

            const response = await api.put('/org-settings/analysis-types', { analysisTypes: newAnalysisTypes });

            if (response.success) {
                analysisTypes = newAnalysisTypes;
                renderAnalysisTypes();
                closeAnalysisTypeModal();
                showToast(isEdit ? __('messages.success.analysisTypeUpdated') : __('messages.success.analysisTypeAdded'), 'success');
                analysisTypesModified = true;
            } else {
                showToast(response.message || __('messages.error.failedSaveAnalysisType'), 'error');
            }
        } catch (error) {
            console.error('Error saving analysis type:', error);
            showToast(getErrorMessage(error), 'error');
        }
    }

    window.editAnalysisType = function(code) {
        openAnalysisTypeModal(code);
    };

    window.deleteAnalysisType = async function(code) {
        if (!confirm(__('messages.confirm.deleteAnalysisType', code))) {
            return;
        }

        try {
            const newAnalysisTypes = analysisTypes.filter(t => t.code !== code);
            const response = await api.put('/org-settings/analysis-types', { analysisTypes: newAnalysisTypes });

            if (response.success) {
                analysisTypes = newAnalysisTypes;
                renderAnalysisTypes();
                showToast(__('messages.success.analysisTypeDeleted'), 'success');
                analysisTypesModified = true;
            } else {
                showToast(response.message || __('messages.error.failedDeleteAnalysisType'), 'error');
            }
        } catch (error) {
            console.error('Error deleting analysis type:', error);
            showToast(getErrorMessage(error), 'error');
        }
    };
    
    // Set up analysis types event listeners
    setupAnalysisTypesEventListeners();

});