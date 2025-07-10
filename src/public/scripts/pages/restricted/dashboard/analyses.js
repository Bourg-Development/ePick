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
            window.userDateFormat = window.userDateFormat || 'MM/DD/YYYY';
            window.userTimeFormat = window.userTimeFormat || '12h';
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
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // State variables
    let analyses = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalAnalyses = 0;
    let limit = 20;
    let activeDropdown = null;
    let currentEditAnalysisId = null;
    let sortField = null;
    let sortDirection = 'asc';
    // Initialize hideActions - will be overridden by template if user lacks permission
    window.hideActions = false;
    let activeSearchDropdown = null;
    let activeExportDropdown = null;
    let analysisTypes = [];

    // Export column definitions
    const exportColumns = {
        id: { name: 'ID', description: 'Analysis internal ID', sensitive: false },
        analysisDate: { name: 'Analysis Date', description: 'Scheduled date for analysis', sensitive: false },
        status: { name: 'Status', description: 'Current analysis status', sensitive: false },
        analysisType: { name: 'Analysis Type', description: 'Type of blood analysis', sensitive: false },
        notes: { name: 'Notes', description: 'Analysis notes and comments', sensitive: true },
        patientId: { name: 'Patient Id', description: "Patient's internal ID ", sensitive: true },
        patientName: { name: 'Patient Name', description: 'Patient full name', sensitive: true },
        patientMatricule: { name: "Patient matricule", description: "Patient national registration number", sensitive: true },
        doctorId: { name: 'Doctor Id', description: 'Dcotor internal ID', sensitive: true },
        doctorName: { name: 'Doctor Name', description: 'Assigned doctor name', sensitive: false },
        doctorSpecialization: { name: 'Doctor Specialization', description: 'Doctor specialization', sensitive: false },
        roomId: { name: 'Room ID', description: 'Room internal ID', sensitive: true },
        roomNumber: { name: 'Room Number', description: 'Assigned room number', sensitive: false },
        roomService: { name: 'Room Service', description: 'Room service department', sensitive: false },
        serviceId: { name: 'Service ID', description: 'Service internal ID', sensitive: true },
        serviceName: { name: 'Service', description: 'Service responsinle', sensitive: false },
        createdAt: { name: 'Created Date', description: 'Analysis creation date', sensitive: false },
        createdById: { name: 'Created By', description: 'User who created the analysis', sensitive: false }
    };

    // Safe columns (non-sensitive, commonly exported)
    const safeColumns = ['id', 'analysisDate', 'status', 'analysisType', 'doctorName', 'doctorSpecialization', 'roomNumber', 'roomService', 'createdAt'];

    // DOM Elements
    const tableBody = document.querySelector('#analysisTable tbody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');
    const limitInput = document.getElementById('limitInput');
    const recordCount = document.getElementById('recordCount');
    const pagination = document.getElementById('pagination');
    const addNewBtn = document.getElementById('addNewBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');

    // Export elements
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportModal = document.getElementById('exportModal');

    // Modals
    const addAnalysisModal = document.getElementById('addAnalysisModal');
    const updateStatusModal = document.getElementById('updateStatusModal');
    const dashboardModal = document.getElementById('dashboardModal');
    const confirmModal = document.getElementById('confirmModal');
    const addDoctorModal = document.getElementById('addDoctorModal');
    const cancelAnalysisModal = document.getElementById('cancelAnalysisModal');
    const toast = document.getElementById('toast');

    const keybinds = {
        'Escape': () => {
            if(activeDropdown !== null) return closeDropdown();
            if(activeSearchDropdown !== null) return closeSearchDropdown();
            if(activeExportDropdown !== null) return closeExportDropdown();
            addAnalysisModal?.classList.remove('show');
            updateStatusModal?.classList.remove('show');
            dashboardModal?.classList.remove('show');
            confirmModal?.classList.remove('show');
            exportModal?.classList.remove('show');
            addDoctorModal?.classList.remove('show');
            cancelAnalysisModal?.classList.remove('show');
        },
        'Control+r': () => {
            loadAnalyses();
        }
    };

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadAnalysisTypes();
        await loadAnalyses();
    }

    function setupEventListeners() {
        // Search and filters
        if(searchInput){
            searchInput.addEventListener('input', debounce(() => {
                currentPage = 1;
                loadAnalyses();
            }, 500));
        }

        if(statusFilter){
            statusFilter.addEventListener('change', () => {
                currentPage = 1;
                loadAnalyses();
            });
        }

        if(typeFilter){
            typeFilter.addEventListener('change', () => {
                currentPage = 1;
                loadAnalyses();
            });
        }

        if(startDateFilter){
            startDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadAnalyses();
            });
        }

        if(endDateFilter){
            endDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadAnalyses();
            });
        }

        if(limitInput){
            limitInput.addEventListener('change', () => {
                limit = parseInt(limitInput.value) || 20;
                currentPage = 1;
                loadAnalyses();
            });
        }

        // Buttons
        if(addNewBtn){
            addNewBtn.addEventListener('click', showAddAnalysisModal);
        }
        if(refreshBtn){
            refreshBtn.addEventListener('click', loadAnalyses);
        }
        if(dashboardBtn){
            dashboardBtn.addEventListener('click', showDashboardModal);
        }

        // Export functionality
        if (exportDropdownBtn) {
            setupExportEventListeners();
        }

        // Column sorting
        const sortableHeaders = document.querySelectorAll('#analysisTable th[data-sort]');
        if(sortableHeaders.length > 0){
            sortableHeaders.forEach(th => {
                th.addEventListener('click', function() {
                    const field = this.getAttribute('data-sort');
                    handleSort(field);
                });
            });
        }

        // Modal event listeners
        setupModalEventListeners();

        // Global click for closing dropdowns
        document.addEventListener('click', function(e) {
            if (activeDropdown && !e.target.closest('.dropdown-container')) {
                closeDropdown();
            }
            if (activeSearchDropdown && !e.target.closest('.search-container')) {
                closeSearchDropdown();
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
        const closeExportModalBtn = document.getElementById('closeExportModalBtn');
        const cancelExportBtn = document.getElementById('cancelExportBtn');
        const exportForm = document.getElementById('exportForm');

        if(closeExportModalBtn) {
            closeExportModalBtn.addEventListener('click', () => {
                exportModal.classList.remove('show');
            });
        }
        if(cancelExportBtn) {
            cancelExportBtn.addEventListener('click', () => {
                exportModal.classList.remove('show');
            });
        }
        if(exportForm) {
            exportForm.addEventListener('submit', handleExportSubmit);
        }

        // Column selection buttons
        const selectAllColumnsBtn = document.getElementById('selectAllColumnsBtn');
        const selectNoneColumnsBtn = document.getElementById('selectNoneColumnsBtn');
        const selectSafeColumnsBtn = document.getElementById('selectSafeColumnsBtn');

        if(selectAllColumnsBtn) {
            selectAllColumnsBtn.addEventListener('click', () => {
                selectAllColumns(true);
            });
        }
        if(selectNoneColumnsBtn) {
            selectNoneColumnsBtn.addEventListener('click', () => {
                selectAllColumns(false);
            });
        }
        if(selectSafeColumnsBtn) {
            selectSafeColumnsBtn.addEventListener('click', () => {
                selectSafeColumns();
            });
        }

        // Listen for column checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.column-checkbox')) {
                updateSensitiveWarning();
            }
        });
    }

    function setupModalEventListeners() {
        // Add Analysis Modal
        const closeAddModalBtn = document.getElementById('closeAddModalBtn');
        const cancelAddBtn = document.getElementById('cancelAddBtn');
        const addAnalysisForm = document.getElementById('addAnalysisForm');

        if(closeAddModalBtn) {
            closeAddModalBtn.addEventListener('click', () => {
                addAnalysisModal.classList.remove('show');
            });
        }
        if(cancelAddBtn) {
            cancelAddBtn.addEventListener('click', () => {
                addAnalysisModal.classList.remove('show');
            });
        }
        if(addAnalysisForm) {
            addAnalysisForm.addEventListener('submit', handleAddAnalysis);
        }

        // Recurring Analysis functionality
        setupRecurringAnalysisEventListeners();

        // Update Status Modal
        const closeUpdateStatusModalBtn = document.getElementById('closeUpdateStatusModalBtn');
        const cancelUpdateStatusBtn = document.getElementById('cancelUpdateStatusBtn');
        const updateStatusForm = document.getElementById('updateStatusForm');

        if(closeUpdateStatusModalBtn) {
            closeUpdateStatusModalBtn.addEventListener('click', () => {
                updateStatusModal.classList.remove('show');
            });
        }
        if(cancelUpdateStatusBtn) {
            cancelUpdateStatusBtn.addEventListener('click', () => {
                updateStatusModal.classList.remove('show');
            });
        }
        if(updateStatusForm) {
            updateStatusForm.addEventListener('submit', handleUpdateStatus);
        }

        // Dashboard Modal
        const closeDashboardModalBtn = document.getElementById('closeDashboardModalBtn');
        const closeDashboardBtn = document.getElementById('closeDashboardBtn');

        if(closeDashboardModalBtn) {
            closeDashboardModalBtn.addEventListener('click', () => {
                dashboardModal.classList.remove('show');
            });
        }
        if(closeDashboardBtn) {
            closeDashboardBtn.addEventListener('click', () => {
                dashboardModal.classList.remove('show');
            });
        }

        // Confirm Modal
        const closeConfirmBtn = document.getElementById('closeConfirmBtn');
        const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

        if(closeConfirmBtn) {
            closeConfirmBtn.addEventListener('click', () => {
                confirmModal.classList.remove('show');
            });
        }
        if(cancelConfirmBtn) {
            cancelConfirmBtn.addEventListener('click', () => {
                confirmModal.classList.remove('show');
            });
        }

        // Add Doctor Modal
        const closeAddDoctorModalBtn = document.getElementById('closeAddDoctorModalBtn');
        const cancelAddDoctorBtn = document.getElementById('cancelAddDoctorBtn');
        const addDoctorForm = document.getElementById('addDoctorForm');

        if(closeAddDoctorModalBtn) {
            closeAddDoctorModalBtn.addEventListener('click', () => {
                addDoctorModal.classList.remove('show');
            });
        }
        if(cancelAddDoctorBtn) {
            cancelAddDoctorBtn.addEventListener('click', () => {
                addDoctorModal.classList.remove('show');
            });
        }
        if(addDoctorForm) {
            addDoctorForm.addEventListener('submit', handleAddDoctor);
        }

        // Cancel Analysis Modal
        const closeCancelAnalysisModalBtn = document.getElementById('closeCancelAnalysisModalBtn');
        const cancelCancelAnalysisBtn = document.getElementById('cancelCancelAnalysisBtn');
        const cancelAnalysisForm = document.getElementById('cancelAnalysisForm');

        if(closeCancelAnalysisModalBtn) {
            closeCancelAnalysisModalBtn.addEventListener('click', () => {
                cancelAnalysisModal.classList.remove('show');
            });
        }
        if(cancelCancelAnalysisBtn) {
            cancelCancelAnalysisBtn.addEventListener('click', () => {
                cancelAnalysisModal.classList.remove('show');
            });
        }
        if(cancelAnalysisForm) {
            cancelAnalysisForm.addEventListener('submit', handleCancelAnalysis);
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
        const exportForm = document.getElementById('exportForm');
        if(exportForm) {
            exportForm.reset();
        }
        const csvRadio = document.querySelector('input[name="exportFormat"][value="csv"]');
        if(csvRadio) {
            csvRadio.checked = true;
        }

        // Select safe columns by default
        selectSafeColumns();

        exportModal.classList.add('show');
    }

    function populateColumnGrid() {
        const columnGrid = document.getElementById('columnGrid');
        if(!columnGrid) return;

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
        if(!sensitiveWarning) return;

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
        if(!currentFilters) return;

        const activeFilters = [];

        if (searchInput && searchInput.value.trim()) {
            activeFilters.push(`Search: "${searchInput.value.trim()}"`);
        }

        if (statusFilter && statusFilter.value) {
            activeFilters.push(`Status: ${statusFilter.value}`);
        }

        if (typeFilter && typeFilter.value) {
            activeFilters.push(`Type: ${typeFilter.value}`);
        }

        if (startDateFilter && startDateFilter.value) {
            activeFilters.push(`From: ${startDateFilter.value}`);
        }

        if (endDateFilter && endDateFilter.value) {
            activeFilters.push(`To: ${endDateFilter.value}`);
        }

        if (activeFilters.length > 0) {
            currentFilters.innerHTML = activeFilters.map(filter =>
                `<span class="filter-tag">${filter}</span>`
            ).join('');
        } else {
            currentFilters.innerHTML = '<span class="filter-info">No filters applied - exporting all analyses</span>';
        }
    }

    async function handleExportSubmit(e) {
        e.preventDefault();

        const exportPassword = document.getElementById('exportPassword');
        const password = exportPassword ? exportPassword.value : '';
        const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatRadio ? formatRadio.value : 'csv';
        const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value);

        if (!password) {
            showToast('Password is required for export', 'error');
            return;
        }

        if (selectedColumns.length === 0) {
            showToast('Please select at least one column to export', 'error');
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
        // For quick export, just open the export modal with the format pre-selected
        showExportModal();

        // Pre-select the format
        const formatRadio = document.querySelector(`input[name="exportFormat"][value="${format}"]`);
        if(formatRadio) {
            formatRadio.checked = true;
        }

        // Select safe columns by default
        selectSafeColumns();

        showToast(`Quick ${format.toUpperCase()} export - please enter your password`, 'info');
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
                endpoint = '/analyses/export/csv';
                break;
            case 'excel':
                endpoint = '/analyses/export/excel';
                break;
            case 'json':
                endpoint = '/analyses/export/json';
                break;
            default:
                throw new Error('Invalid export format');
        }

        try {
            if (format === 'json') {
                const data = await api.post(endpoint, exportData);
                downloadJsonFile(data, `analyses_export_${new Date().toISOString().split('T')[0]}.json`);
            } else {
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
                // Token expired, attempting refresh...
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
                `analyses_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;

            downloadBlob(blob, filename);

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                error.message = 'Network error: Please check your internet connection';
            }
            throw error;
        }
    }

    function getCurrentFilters() {
        const filters = {};

        if (searchInput && searchInput.value.trim()) {
            filters.search = searchInput.value.trim();
        }

        if (statusFilter && statusFilter.value) {
            filters.status = statusFilter.value;
        }

        if (typeFilter && typeFilter.value) {
            filters.analysisType = typeFilter.value;
        }

        if (startDateFilter && startDateFilter.value) {
            filters.startDate = startDateFilter.value;
        }

        if (endDateFilter && endDateFilter.value) {
            filters.endDate = endDateFilter.value;
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
    async function loadAnalysisTypes() {
        try {
            const response = await api.get('/org-settings/analysis-types');
            if (response.success) {
                analysisTypes = response.analysisTypes || [];
                populateAnalysisTypeDropdowns();
            } else {
                console.error('Failed to load analysis types:', response.message);
                showToast('Failed to load analysis types', 'error');
            }
        } catch (error) {
            console.error('Error loading analysis types:', error);
            showToast('Error loading analysis types', 'error');
        }
    }
    
    function populateAnalysisTypeDropdowns() {
        // Populate type filter dropdown
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            // Keep the "All Types" option
            const allOption = typeFilter.querySelector('option[value=""]');
            typeFilter.innerHTML = '';
            if (allOption) {
                typeFilter.appendChild(allOption);
            }
            
            // Add analysis types
            analysisTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.code;
                option.textContent = `${type.code} - ${type.name}`;
                typeFilter.appendChild(option);
            });
        }
        
        // Populate analysis type dropdown in add modal
        const newAnalysisType = document.getElementById('newAnalysisType');
        if (newAnalysisType) {
            // Keep the "Select Type" option
            const selectOption = newAnalysisType.querySelector('option[value=""]');
            newAnalysisType.innerHTML = '';
            if (selectOption) {
                newAnalysisType.appendChild(selectOption);
            }
            
            // Add analysis types
            analysisTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.code;
                option.textContent = `${type.code} - ${type.name}`;
                option.title = type.description || '';
                newAnalysisType.appendChild(option);
            });
        }
    }
    
    function getAnalysisTypeName(code) {
        const type = analysisTypes.find(t => t.code === code);
        return type ? type.name : code;
    }

    async function loadAnalyses() {
        try {
            showLoading();

            let endpoint = '/analyses?';
            const params = new URLSearchParams({
                page: currentPage,
                limit: limit
            });

            // Add filters
            const filters = getCurrentFilters();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    params.append(key, value);
                }
            });

            endpoint += params.toString();

            await new Promise(r => setTimeout(r, 500))
            const data = await api.get(endpoint);
            

            analyses = data.data || [];
            totalAnalyses = data.pagination?.total || 0;
            totalPages = data.pagination?.totalPages || 1;

            renderTable();
            renderPagination();
            updateRecordCount();

        } catch (error) {
            console.error('Load analyses error:', error);
            if (handleAuthError(error)) return;
            showError(getErrorMessage(error));
        }
    }

    async function createAnalysis(analysisData) {
        try {
            const data = await api.post('/analyses', analysisData);
            return data;
        } catch (error) {
            console.error('Create analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function createRecurringAnalysis(analysisData) {
        try {
            const data = await api.post('/recurring-analyses', analysisData);
            return data;
        } catch (error) {
            console.error('Create recurring analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function updateAnalysisStatus(analysisId, statusData) {
        try {
            await api.put(`/analyses/${analysisId}/status`, statusData);
            showToast('Analysis status updated successfully', 'success');
            loadAnalyses();
        } catch (error) {
            console.error('Update analysis status error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function postponeAnalysis(analysisId) {
        try {
            const data = await api.post(`/analyses/${analysisId}/postpone`);
            showToast(`Analysis postponed to ${data.newDate}`, 'success');
            loadAnalyses();
        } catch (error) {
            console.error('Postpone analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function cancelAnalysis(analysisId, reason) {
        try {
            await api.post(`/analyses/${analysisId}/cancel`, { reason });
            showToast('Analysis cancelled successfully', 'success');
            loadAnalyses();
        } catch (error) {
            console.error('Cancel analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function loadDashboard() {
        try {
            const [statsData, dashboardData] = await Promise.all([
                api.get('/analyses/reports/statistics'),
                api.get('/analyses/reports/dashboard')
            ]);

            return {
                statistics: statsData.statistics,
                dashboard: dashboardData.dashboard
            };
        } catch (error) {
            console.error('Load dashboard error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function searchPatients(term) {
        try {
            if (!term || term.length < 2) {
                return [];
            }

            const data = await api.get(`/patients/search/${encodeURIComponent(term)}?limit=10`);
            return data.patients || [];
        } catch (error) {
            console.error('Patient search error:', error);
            return [];
        }
    }

    async function searchDoctors(term) {
        try {
            if (!term || term.length < 2) {
                return [];
            }

            const data = await api.get(`/doctors/search/${encodeURIComponent(term)}?limit=10`);
            return data.doctors || [];
        } catch (error) {
            console.error('Doctor search error:', error);
            return [];
        }
    }

    async function searchRooms(term) {
        try {
            if (!term || term.length < 2) {
                return [];
            }

            const data = await api.get(`/rooms/search/${encodeURIComponent(term)}?limit=10`);
            return data.rooms || [];
        } catch (error) {
            console.error('Room search error:', error);
            return [];
        }
    }

    async function createDoctor(doctorData) {
        try {
            const data = await api.post('/doctors', doctorData);
            return data;
        } catch (error) {
            console.error('Create doctor error:', error);
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    async function handleCreateNewDoctor(name, searchInput) {
        // Store the search input reference for later use
        const doctorSearchInputField = document.getElementById('doctorSearchInput');
        const newDoctorNameField = document.getElementById('newDoctorName');
        const newDoctorSpecializationField = document.getElementById('newDoctorSpecialization');
        const newDoctorPhoneField = document.getElementById('newDoctorPhone');
        const newDoctorEmailField = document.getElementById('newDoctorEmail');

        if(doctorSearchInputField) doctorSearchInputField.value = searchInput.id;
        if(newDoctorNameField) newDoctorNameField.value = name;
        if(newDoctorSpecializationField) newDoctorSpecializationField.value = '';
        if(newDoctorPhoneField) newDoctorPhoneField.value = '';
        if(newDoctorEmailField) newDoctorEmailField.value = '';

        addDoctorModal.classList.add('show');

        // Focus on specialization field
        setTimeout(() => {
            if(newDoctorSpecializationField) {
                newDoctorSpecializationField.focus();
            }
        }, 100);
    }

    async function handleAddDoctor(e) {
        e.preventDefault();

        const doctorSearchInputId = document.getElementById('doctorSearchInput').value;
        const name = document.getElementById('newDoctorName').value.trim();
        const specialization = document.getElementById('newDoctorSpecialization').value.trim();
        const phone = document.getElementById('newDoctorPhone').value.trim();
        const email = document.getElementById('newDoctorEmail').value.trim();

        // Validation
        if (!name) {
            showToast('Doctor name is required', 'error');
            return;
        }

        if (!specialization) {
            showToast('Specialization is required', 'error');
            return;
        }

        const doctorData = {
            name: name,
            specialization: specialization
        };

        if (phone) doctorData.phone = phone;
        if (email) doctorData.email = email;

        try {
            const result = await createDoctor(doctorData);

            if (result.success) {
                // Find the original search input and update it
                const originalSearchInput = document.getElementById(doctorSearchInputId);
                if (originalSearchInput) {
                    originalSearchInput.value = name;
                    originalSearchInput.setAttribute('data-selected-id', result.doctorId);
                }

                addDoctorModal.classList.remove('show');
                showToast(`Doctor "${name}" created successfully`, 'success');
            }
        } catch (error) {
            console.error('Create doctor error:', error);
            showToast(`Failed to create doctor: ${getErrorMessage(error)}`, 'error');
        }
    }

    // UI Functions
    function renderTable() {
        if(!tableBody) return;

        if (analyses.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--medium-gray);">No analyses found</td></tr>';
            return;
        }

        tableBody.innerHTML = '';

        analyses.forEach(analysis => {
            const row = document.createElement('tr');
            row.dataset.id = analysis.id;
            
            // Add recurring analysis tracking
            if (analysis.recurring_analysis_id) {
                row.dataset.recurringId = analysis.recurring_analysis_id;
            }

            const analysisDate = new Date(analysis.analysis_date);
            const today = new Date();
            const isToday = analysisDate.toDateString() === today.toDateString();
            const isOverdue = analysisDate < today && analysis.status === 'Pending';

            // Don't highlight cancelled analyses as "today"
            const dateClass = (isToday && analysis.status !== 'Cancelled') ? 'today' : (isOverdue ? 'overdue' : '');
            const statusClass = getStatusClass(analysis.status);
            const typeClass = getTypeClass(analysis.analysis_type);

            const patientDisplay = getPatientDisplay(analysis.patient);
            const doctorDisplay = getDoctorDisplay(analysis.doctor);
            const roomDisplay = getRoomDisplay(analysis.room);
            const notesDisplay = getNotesDisplay(analysis.notes);

            row.innerHTML = `
                <td>
                    <span class="analysis-date ${dateClass}">
                        ${window.formatDate ? window.formatDate(analysisDate) : analysisDate.toLocaleDateString()}
                    </span>
                    ${analysis.recurring_analysis_id ? `
                        <div class="recurring-indicator" title="Part of recurring series">
                            <span class="material-symbols-outlined">repeat</span>
                            <span class="occurrence-number">${analysis.occurrence_number || '?'}</span>
                            ${analysis.has_valid_prescription ? `
                                <span class="prescription-verified" title="Prescription verified">
                                    <span class="material-symbols-outlined">verified</span>
                                </span>
                            ` : `
                                <span class="prescription-missing" title="Prescription required">
                                    <span class="material-symbols-outlined">priority_high</span>
                                </span>
                            `}
                        </div>
                    ` : ''}
                </td>
                <td>${patientDisplay}</td>
                <td>${doctorDisplay}</td>
                <td>${roomDisplay}</td>
                <td>
                    <span class="type-badge ${typeClass}">${getAnalysisTypeName(analysis.analysis_type)}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${analysis.status}</span>
                </td>
                <td>${notesDisplay}</td>
                ${window.hideActions !== true ? `<td>
                    <div class="dropdown-container">
                        <button class="action-button" data-id="${analysis.id}">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                </td>` : ''}
            `;

            tableBody.appendChild(row);
        });

        document.querySelectorAll('.action-button').forEach(btn => {
            btn.addEventListener('click', handleActionClick);
        });
    }

    function getStatusClass(status) {
        const statusClasses = {
            'Pending': 'status-pending',
            'Delayed': 'status-delayed',
            'In Progress': 'status-in-progress',
            'Completed': 'status-completed',
            'Cancelled': 'status-cancelled'
        };
        return statusClasses[status] || '';
    }

    function getTypeClass(type) {
        const typeClasses = {
            'XY': 'type-xy',
            'YZ': 'type-yz',
            'ZG': 'type-zg',
            'HG': 'type-hg'
        };
        return typeClasses[type] || '';
    }

    function getPatientDisplay(patient) {
        if (!patient) {
            return '<span class="patient-none">No Patient</span>';
        }

        return `
            <div class="patient-info">
                <span class="patient-name">${patient.name}</span>
                <span class="patient-id">${patient.matricule_national}</span>
            </div>
        `;
    }

    function getDoctorDisplay(doctor) {
        if (!doctor) {
            return '<span class="doctor-none">No Doctor</span>';
        }

        return `
            <div class="doctor-info">
                <span class="doctor-name">${doctor.name}</span>
                ${doctor.specialization ? `<span class="doctor-specialization">${doctor.specialization}</span>` : ''}
            </div>
        `;
    }

    function getRoomDisplay(room) {
        if (!room) {
            return '<span class="room-none">No Room</span>';
        }

        return `
            <div class="room-info">
                <span class="room-number">${room.room_number}</span>
                ${room.service ? `<span class="room-service">${room.service.name}</span>` : ''}
            </div>
        `;
    }

    function getNotesDisplay(notes) {
        if (!notes || notes.trim() === '') {
            return '<span class="notes-empty">No notes</span>';
        }

        return `<span class="analysis-notes" title="${notes}">${notes}</span>`;
    }

    function renderPagination() {
        if(!pagination) return;

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
        if(!recordCount) return;

        const start = (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalAnalyses);
        recordCount.textContent = `Showing ${start}-${end} of ${totalAnalyses} analyses`;
    }

    function showAddAnalysisModal() {
        const addAnalysisForm = document.getElementById('addAnalysisForm');
        if(addAnalysisForm) {
            addAnalysisForm.reset();
        }

        // Set default date to today
        const newAnalysisDate = document.getElementById('newAnalysisDate');
        if(newAnalysisDate) {
            const today = new Date().toISOString().split('T')[0];
            newAnalysisDate.value = today;
        }

        // Setup search inputs
        setupSearchInputs();

        addAnalysisModal.classList.add('show');
    }

    function setupSearchInputs() {
        const searchInputs = [
            { id: 'newAnalysisPatient', containerId: 'newAnalysisPatientContainer', searchFn: searchPatients, displayKey: 'name', extraKey: 'matricule_national' },
            { id: 'newAnalysisDoctor', containerId: 'newAnalysisDoctorContainer', searchFn: searchDoctors, displayKey: 'name', extraKey: 'specialization' },
            { id: 'newAnalysisRoom', containerId: 'newAnalysisRoomContainer', searchFn: searchRooms, displayKey: 'roomNumber', extraKey: 'service.name' }
        ];

        searchInputs.forEach(({ id, containerId, searchFn, displayKey, extraKey }) => {
            const originalSelect = document.getElementById(id);
            if (!originalSelect || originalSelect.hasAttribute('data-enhanced')) return;

            const container = document.createElement('div');
            container.id = containerId;
            container.className = 'search-container';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'form-control search-input-enhanced';
            searchInput.placeholder = `Search ${id.includes('Patient') ? 'patients' : id.includes('Doctor') ? 'doctors' : 'rooms'}...`;
            searchInput.setAttribute('data-selected-id', '');
            searchInput.id = id + 'Search';

            const dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            dropdown.style.display = 'none';

            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'search-clear-btn';
            clearBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">close</span>';
            clearBtn.title = 'Clear selection';

            container.appendChild(searchInput);
            container.appendChild(clearBtn);
            container.appendChild(dropdown);

            originalSelect.parentNode.replaceChild(container, originalSelect);
            originalSelect.setAttribute('data-enhanced', 'true');

            setupSearchListeners(searchInput, dropdown, clearBtn, searchFn, displayKey, extraKey);
        });
    }

    function setupSearchListeners(searchInput, dropdown, clearBtn, searchFn, displayKey, extraKey) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const term = e.target.value.trim();

            if (term.length === 0) {
                hideSearchDropdown(dropdown);
            } else if (term.length >= 2) {
                const results = await searchFn(term);
                showSearchDropdown(searchInput, dropdown, results, displayKey, extraKey);
            } else {
                hideSearchDropdown(dropdown);
            }
        }, 300));

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.setAttribute('data-selected-id', '');
            hideSearchDropdown(dropdown);
            searchInput.focus();
        });
    }

    async function getPatientDetails(patientId) {
        try {
            const {data: patientData} = await api.get(`/patients/${patientId}`);
            return patientData || null;
        } catch (error) {
            console.error('Patient details error', error);
            return null
        }
    }


    async function getDoctorDetails(doctorId) {
        try {
            const {data: doctorData} = await api.get(`/doctors/${doctorId}`);
            return doctorData || null;
        } catch (error) {
            console.error('Doctor details error', error);
            return null
        }
    }


    async function getRoomDetails(roomId) {
        try {
            const {data: roomData} = await api.get(`/rooms/${roomId}`);
            return roomData || null;
        } catch (error) {
            console.error('Room details error', error);
            return null
        }
    }


    function showSearchDropdown(searchInput, dropdown, results, displayKey, extraKey) {
        const searchTerm = searchInput.value.trim();

        let html = '';

        // Add existing results
        results.forEach(item => {
            const name = getNestedValue(item, displayKey);
            const extra = getNestedValue(item, extraKey);

            html += `
                <div class="search-option" data-selected-id="${item.id}">
                    <div class="search-option-content">
                        <span class="search-option-name">${name}</span>
                        ${extra ? `<span class="search-option-detail">${extra}</span>` : ''}
                    </div>
                </div>
            `;
        });

        // Add "Create new..." option ONLY for doctors if no exact match found and search term is not empty
        if (searchTerm.length >= 2 && searchInput.id.includes('Doctor')) {
            const exactMatch = results.find(item =>
                getNestedValue(item, displayKey).toLowerCase() === searchTerm.toLowerCase()
            );

            if (!exactMatch) {
                html += `
                    <div class="search-option search-option-create" data-action="create" data-entity-type="doctor">
                        <div class="search-option-content">
                            <span class="search-option-name">
                                <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 8px;">add</span>
                                Add "${searchTerm}" as new Doctor
                            </span>
                            <span class="search-option-detail">Click to create new doctor</span>
                        </div>
                    </div>
                `;
            }
        }

        if (html === '') {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = html;

        dropdown.querySelectorAll('.search-option').forEach(option => {
            option.addEventListener('click', async () => {
                const action = option.getAttribute('data-action');

                if (action === 'create') {
                    await handleCreateNewDoctor(searchTerm, searchInput);
                } else {
                    const selectedId = option.getAttribute('data-selected-id');
                    const selectedName = option.querySelector('.search-option-name').textContent;

                    searchInput.value = selectedName;
                    searchInput.setAttribute('data-selected-id', selectedId);

                    if(searchInput.id.includes('Patient')){
                        await handlePatientSelection(selectedId);
                    }

                }

                hideSearchDropdown(dropdown);
            });
        });

        dropdown.style.display = 'block';
        activeSearchDropdown = dropdown;
    }

    async function handlePatientSelection(patientId){
        try{
            showToast('Loading patient details...', 'info');

            const patientDetails = await getPatientDetails(patientId);

            if(patientDetails){
                if(patientDetails.doctor_id){
                    const doctorSearchInput = document.getElementById('newAnalysisDoctorSearch');
                    const doctorDetails = await getDoctorDetails(patientDetails.doctor_id);
                    if (doctorDetails && doctorDetails.name) {
                        doctorSearchInput.setAttribute('data-selected-id', patientDetails.doctor_id);
                        doctorSearchInput.value = doctorDetails.name;

                        doctorSearchInput.style.backgroundColor = '#e8f5e8';
                        setTimeout(() => {
                            doctorSearchInput.style.backgroundColor = '';
                        }, 2000);
                    }
                }
            
                if(patientDetails.room_id) {
                    const roomSearchInput = document.getElementById('newAnalysisRoomSearch');
                    if (roomSearchInput) {
                        const roomDetails = await getRoomDetails(patientDetails.room_id);
                        if (roomDetails && roomDetails.room_number) {
                            roomSearchInput.setAttribute('data-selected-id', patientDetails.room_id);
                            roomSearchInput.value = roomDetails.room_number;

                            // Add visual indicator that field was auto-filled
                            roomSearchInput.style.backgroundColor = '#e8f5e8';
                            setTimeout(() => {
                                roomSearchInput.style.backgroundColor = '';
                            }, 2000);
                        }
                    }
                }
            
                const autoFilledItems = [];
                if (patientDetails.doctor_id) autoFilledItems.push('doctor');
                if (patientDetails.room_id) autoFilledItems.push('room');

                if (autoFilledItems.length > 0) {
                    showToast(`Auto-filled ${autoFilledItems.join(' and ')} from patient record`, 'success');
                } else {
                    showToast('Patient selected - no assigned doctor or room found', 'warning');
                }
            } else {
                showToast('Failed to load patient details', 'error');
            }
        } catch (error) {
            console.error('Error auto-filling patient details:', error);
            showToast('Failed to load patient details for auto-fill', 'error');
        }
    }

    function hideSearchDropdown(dropdown) {
        dropdown.style.display = 'none';
        if (activeSearchDropdown === dropdown) {
            activeSearchDropdown = null;
        }
    }

    function closeSearchDropdown() {
        if (activeSearchDropdown) {
            hideSearchDropdown(activeSearchDropdown);
        }
    }

    function getNestedValue(obj, path) {
        return path.split('.').reduce((o, p) => o && o[p], obj) || '';
    }

    function showUpdateStatusModal(analysisId) {
        const analysis = analyses.find(a => a.id === analysisId);
        if (!analysis) return;

        currentEditAnalysisId = analysisId;

        const updateStatusAnalysisId = document.getElementById('updateStatusAnalysisId');
        const updateStatusPatientName = document.getElementById('updateStatusPatientName');
        const updateStatusAnalysisType = document.getElementById('updateStatusAnalysisType');
        const updateStatusCurrentStatus = document.getElementById('updateStatusCurrentStatus');

        if(updateStatusAnalysisId) updateStatusAnalysisId.value = analysisId;
        if(updateStatusPatientName) updateStatusPatientName.textContent = analysis.patient ? analysis.patient.name : 'N/A';
        if(updateStatusAnalysisType) updateStatusAnalysisType.textContent = getAnalysisTypeName(analysis.analysis_type);
        if(updateStatusCurrentStatus) updateStatusCurrentStatus.textContent = analysis.status;

        // Reset form
        const updateStatusNewStatus = document.getElementById('updateStatusNewStatus');

        if(updateStatusNewStatus) updateStatusNewStatus.value = '';

        updateStatusModal.classList.add('show');
    }

    async function showDashboardModal() {
        try {
            dashboardModal.classList.add('show');

            // Show loading state
            const statsGrid = document.getElementById('statsGrid');
            const dashboardTableBody = document.querySelector('#dashboardTable tbody');

            if(statsGrid) {
                statsGrid.innerHTML = '<div class="loading">Loading statistics...</div>';
            }
            if(dashboardTableBody) {
                dashboardTableBody.innerHTML = '<tr><td colspan="5" class="loading">Loading dashboard...</td></tr>';
            }

            const data = await loadDashboard();

            // Render statistics
            renderStatistics(data.statistics);

            // Render dashboard table
            renderDashboardTable(data.dashboard);

        } catch (error) {
            console.error('Dashboard error:', error);
            showToast('Failed to load dashboard', 'error');
        }
    }

    function renderStatistics(stats) {
        const statsGrid = document.getElementById('statsGrid');
        if(!statsGrid) return;

        const statsCards = [
            { label: 'Total Analyses', value: stats.totalAnalyses, class: '' },
            { label: 'Completed', value: stats.completedAnalyses, class: 'completed' },
            { label: 'Pending', value: stats.pendingAnalyses, class: 'pending' },
            { label: 'Delayed', value: stats.delayedAnalyses, class: 'delayed' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, class: stats.completionRate >= 80 ? 'completed' : 'pending' }
        ];

        statsGrid.innerHTML = statsCards.map(stat => `
            <div class="stat-card ${stat.class}">
                <div class="stat-number">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');
    }

    function renderDashboardTable(dashboard) {
        const tbody = document.querySelector('#dashboardTable tbody');
        if(!tbody) return;

        if (dashboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--medium-gray);">No analyses scheduled for today</td></tr>';
            return;
        }

        tbody.innerHTML = dashboard.map(analysis => `
            <tr>
                <td>${analysis.patient_name}</td>
                <td>${analysis.doctor_name}</td>
                <td>${analysis.room_number}</td>
                <td><span class="type-badge ${getTypeClass(analysis.analysis_type)}">${getAnalysisTypeName(analysis.analysis_type)}</span></td>
                <td><span class="status-badge ${getStatusClass(analysis.status)}">${analysis.status}</span></td>
            </tr>
        `).join('');
    }

    function showCancelAnalysisModal(analysisId) {
        const analysis = analyses.find(a => a.id === analysisId);
        if (!analysis) return;

        const cancelAnalysisIdField = document.getElementById('cancelAnalysisId');
        const cancelAnalysisPatientName = document.getElementById('cancelAnalysisPatientName');
        const cancelAnalysisType = document.getElementById('cancelAnalysisType');
        const cancelAnalysisDate = document.getElementById('cancelAnalysisDate');
        const cancelAnalysisReason = document.getElementById('cancelAnalysisReason');

        if(cancelAnalysisIdField) cancelAnalysisIdField.value = analysisId;
        if(cancelAnalysisPatientName) cancelAnalysisPatientName.textContent = analysis.patient ? analysis.patient.name : 'N/A';
        if(cancelAnalysisType) cancelAnalysisType.textContent = getAnalysisTypeName(analysis.analysis_type);
        if(cancelAnalysisDate) {
            const date = new Date(analysis.analysis_date);
            cancelAnalysisDate.textContent = window.formatDate ? window.formatDate(date) : date.toLocaleDateString();
        }
        if(cancelAnalysisReason) cancelAnalysisReason.value = '';

        cancelAnalysisModal.classList.add('show');

        // Focus on reason field
        setTimeout(() => {
            if(cancelAnalysisReason) {
                cancelAnalysisReason.focus();
            }
        }, 100);
    }

    async function handleCancelAnalysis(e) {
        e.preventDefault();

        const analysisId = parseInt(document.getElementById('cancelAnalysisId').value);
        const reason = document.getElementById('cancelAnalysisReason').value.trim();

        // Validation
        if (!reason) {
            showToast('Cancellation reason is required', 'error');
            return;
        }

        if (reason.length < 10) {
            showToast('Please provide a more detailed reason (at least 10 characters)', 'error');
            return;
        }

        try {
            await cancelAnalysis(analysisId, reason);
            cancelAnalysisModal.classList.remove('show');
        } catch (error) {
            console.error('Cancel analysis error:', error);
        }
    }

    function showConfirmModal(message, onConfirm) {
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmBtn');

        if(confirmMessage) confirmMessage.textContent = message;
        if(confirmBtn) {
            confirmBtn.onclick = () => {
                confirmModal.classList.remove('show');
                onConfirm();
            };
        }
        confirmModal.classList.add('show');
    }

    // Recurring Analysis Functions
    function setupRecurringAnalysisEventListeners() {
        const enableRecurring = document.getElementById('enableRecurring');
        const recurringOptions = document.getElementById('recurringOptions');
        const recurrencePattern = document.getElementById('recurrencePattern');
        const customIntervalGroup = document.getElementById('customIntervalGroup');
        const intervalDays = document.getElementById('intervalDays');
        const totalOccurrences = document.getElementById('totalOccurrences');

        if (enableRecurring) {
            enableRecurring.addEventListener('change', function() {
                if (this.checked) {
                    recurringOptions.style.display = 'block';
                } else {
                    recurringOptions.style.display = 'none';
                    resetRecurringPreview();
                }
            });
        }

        if (recurrencePattern) {
            recurrencePattern.addEventListener('change', function() {
                const isCustom = this.value === 'custom';
                customIntervalGroup.style.display = isCustom ? 'block' : 'none';
                
                if (!isCustom) {
                    // Set default interval based on pattern
                    switch (this.value) {
                        case 'daily':
                            intervalDays.value = 1;
                            break;
                        case 'weekly':
                            intervalDays.value = 7;
                            break;
                        case 'monthly':
                            intervalDays.value = 30;
                            break;
                    }
                }
                
                updateRecurringPreview();
            });
        }

        if (intervalDays) {
            intervalDays.addEventListener('input', updateRecurringPreview);
        }

        if (totalOccurrences) {
            totalOccurrences.addEventListener('input', updateRecurringPreview);
        }
    }

    function updateRecurringPreview() {
        const newAnalysisDate = document.getElementById('newAnalysisDate');
        const recurrencePattern = document.getElementById('recurrencePattern');
        const intervalDays = document.getElementById('intervalDays');
        const totalOccurrences = document.getElementById('totalOccurrences');
        const recurringPreview = document.getElementById('recurringPreview');
        const previewContent = document.getElementById('previewContent');

        if (!newAnalysisDate?.value || !recurrencePattern?.value || !totalOccurrences?.value) {
            recurringPreview.style.display = 'none';
            return;
        }

        const startDate = new Date(newAnalysisDate.value);
        const pattern = recurrencePattern.value;
        const interval = parseInt(intervalDays?.value) || getDefaultInterval(pattern);
        const total = parseInt(totalOccurrences.value);

        if (total < 2 || total > 100) {
            recurringPreview.style.display = 'none';
            return;
        }

        const dates = generateRecurringDates(startDate, pattern, interval, total);
        
        let previewHTML = '<div class="preview-dates">';
        dates.forEach((date, index) => {
            const dateStr = formatDateForDisplay(date);
            previewHTML += `
                <div class="preview-date">
                    <span class="preview-date-number">${index + 1}.</span>
                    <span class="preview-date-value">${dateStr}</span>
                </div>
            `;
        });
        previewHTML += '</div>';

        previewContent.innerHTML = previewHTML;
        recurringPreview.style.display = 'block';
    }

    function resetRecurringPreview() {
        const recurringPreview = document.getElementById('recurringPreview');
        recurringPreview.style.display = 'none';
    }

    function generateRecurringDates(startDate, pattern, interval, total) {
        const dates = [new Date(startDate)];
        
        for (let i = 1; i < total; i++) {
            const nextDate = new Date(dates[i - 1]);
            
            switch (pattern) {
                case 'daily':
                    nextDate.setDate(nextDate.getDate() + 1);
                    break;
                case 'weekly':
                    nextDate.setDate(nextDate.getDate() + 7);
                    break;
                case 'monthly':
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    break;
                case 'custom':
                    nextDate.setDate(nextDate.getDate() + interval);
                    break;
                default:
                    nextDate.setDate(nextDate.getDate() + interval);
            }
            
            dates.push(nextDate);
        }
        
        return dates;
    }

    function getDefaultInterval(pattern) {
        switch (pattern) {
            case 'daily': return 1;
            case 'weekly': return 7;
            case 'monthly': return 30;
            default: return 1;
        }
    }

    function formatDateForDisplay(date) {
        return window.formatDate ? window.formatDate(date) : date.toLocaleDateString();
    }

    // Event Handlers
    async function handleAddAnalysis(e) {
        e.preventDefault();

        const patientSearchInput = document.getElementById('newAnalysisPatientSearch');
        const doctorSearchInput = document.getElementById('newAnalysisDoctorSearch');
        const roomSearchInput = document.getElementById('newAnalysisRoomSearch');

        const patientId = patientSearchInput ? patientSearchInput.getAttribute('data-selected-id') : null;
        const doctorId = doctorSearchInput ? doctorSearchInput.getAttribute('data-selected-id') : null;
        const roomId = roomSearchInput ? roomSearchInput.getAttribute('data-selected-id') : null;

        const newAnalysisDate = document.getElementById('newAnalysisDate');
        const newAnalysisType = document.getElementById('newAnalysisType');
        const newAnalysisNotes = document.getElementById('newAnalysisNotes');

        // Check if recurring analysis is enabled
        const enableRecurring = document.getElementById('enableRecurring');
        const isRecurring = enableRecurring && enableRecurring.checked;

        const analysisData = {
            analysisDate: newAnalysisDate ? newAnalysisDate.value : '',
            analysisType: newAnalysisType ? newAnalysisType.value : '',
            patientId: patientId ? parseInt(patientId) : null,
            doctorId: doctorId ? parseInt(doctorId) : null,
            roomId: roomId ? parseInt(roomId) : null,
            notes: newAnalysisNotes ? newAnalysisNotes.value.trim() || null : null
        };

        // Add recurring analysis data if enabled
        if (isRecurring) {
            const recurrencePattern = document.getElementById('recurrencePattern');
            const intervalDays = document.getElementById('intervalDays');
            const totalOccurrences = document.getElementById('totalOccurrences');

            analysisData.recurrencePattern = recurrencePattern ? recurrencePattern.value : '';
            analysisData.intervalDays = intervalDays ? parseInt(intervalDays.value) : null;
            analysisData.totalOccurrences = totalOccurrences ? parseInt(totalOccurrences.value) : null;
        }

        // Validation
        if (!analysisData.analysisDate) {
            showToast('Analysis date is required', 'error');
            return;
        }

        if (!analysisData.analysisType) {
            showToast('Analysis type is required', 'error');
            return;
        }

        if (!analysisData.patientId) {
            showToast('Please select a patient', 'error');
            return;
        }

        if (!analysisData.doctorId) {
            showToast('Please select a doctor', 'error');
            return;
        }

        if (!analysisData.roomId) {
            showToast('Please select a room', 'error');
            return;
        }

        // Recurring analysis validation
        if (isRecurring) {
            if (!analysisData.recurrencePattern) {
                showToast('Please select a recurrence frequency', 'error');
                return;
            }

            if (analysisData.recurrencePattern === 'custom' && (!analysisData.intervalDays || analysisData.intervalDays < 1)) {
                showToast('Please specify a valid interval for custom frequency', 'error');
                return;
            }

            if (!analysisData.totalOccurrences || analysisData.totalOccurrences < 2 || analysisData.totalOccurrences > 100) {
                showToast('Total occurrences must be between 2 and 100', 'error');
                return;
            }
        }

        try {
            if (isRecurring) {
                await createRecurringAnalysis(analysisData);
                addAnalysisModal.classList.remove('show');
                showToast(`Recurring analysis created successfully (${analysisData.totalOccurrences} analyses scheduled)`, 'success');
                loadAnalyses();
                // Reset form
                resetRecurringForm();
            } else {
                await createAnalysis(analysisData);
                addAnalysisModal.classList.remove('show');
                showToast('Analysis scheduled successfully', 'success');
                loadAnalyses();
            }
        } catch (error) {
            console.error('Failed to create analysis:', error);
        }
    }

    function resetRecurringForm() {
        const enableRecurring = document.getElementById('enableRecurring');
        const recurringOptions = document.getElementById('recurringOptions');
        const recurrencePattern = document.getElementById('recurrencePattern');
        const intervalDays = document.getElementById('intervalDays');
        const totalOccurrences = document.getElementById('totalOccurrences');
        const customIntervalGroup = document.getElementById('customIntervalGroup');

        if (enableRecurring) enableRecurring.checked = false;
        if (recurringOptions) recurringOptions.style.display = 'none';
        if (recurrencePattern) recurrencePattern.value = '';
        if (intervalDays) intervalDays.value = '';
        if (totalOccurrences) totalOccurrences.value = '';
        if (customIntervalGroup) customIntervalGroup.style.display = 'none';
        
        resetRecurringPreview();
    }

    async function handleUpdateStatus(e) {
        e.preventDefault();

        const analysisId = currentEditAnalysisId;
        const updateStatusNewStatus = document.getElementById('updateStatusNewStatus');
        const newStatus = updateStatusNewStatus ? updateStatusNewStatus.value : '';

        const statusData = {
            status: newStatus
        };

        try {
            await updateAnalysisStatus(analysisId, statusData);
            updateStatusModal.classList.remove('show');
        } catch (error) {
            console.error('Failed to update analysis status:', error);
        }
    }

    function handleActionClick(e) {
        e.stopPropagation();

        if (activeDropdown) {
            closeDropdown();
        }

        const button = e.currentTarget;
        const analysisId = parseInt(button.dataset.id);
        const analysis = analyses.find(a => a.id === analysisId);
        const container = button.closest('.dropdown-container');

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu action-dropdown show';

        let dropdownHTML = `
            <div class="dropdown-item" data-action="update-status">
                <span class="material-symbols-outlined">edit</span>
                Update Status
            </div>
        `;

        // Add prescription validation option for recurring analyses
        if (analysis.recurring_analysis_id) {
            dropdownHTML += `
                <div class="dropdown-item" data-action="validate-prescription">
                    <span class="material-symbols-outlined">medication</span>
                    Validate Prescription
                </div>
            `;
        }

        if (analysis.status === 'Pending' || analysis.status === 'Delayed') {
            dropdownHTML += `
                <div class="dropdown-item" data-action="postpone">
                    <span class="material-symbols-outlined">schedule</span>
                    Postpone
                </div>
            `;
        }

        if (analysis.status !== 'Completed' && analysis.status !== 'Cancelled') {
            dropdownHTML += `
                <div class="dropdown-item" data-action="cancel">
                    <span class="material-symbols-outlined">cancel</span>
                    Cancel Analysis
                </div>
            `;
        }

        dropdown.innerHTML = dropdownHTML;

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();

                const action = this.dataset.action;

                switch (action) {
                    case 'update-status':
                        showUpdateStatusModal(analysisId);
                        break;
                    case 'validate-prescription':
                        console.log('Validate prescription clicked for analysis:', analysisId);
                        openPrescriptionValidation(analysisId);
                        break;
                    case 'postpone':
                        showConfirmModal(
                            `Are you sure you want to postpone this analysis? It will be rescheduled to the next available date.`,
                            () => postponeAnalysis(analysisId)
                        );
                        break;
                    case 'cancel':
                        showCancelAnalysisModal(analysisId);
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
        if(th && th.querySelector('.material-symbols-outlined')){
            th.querySelector('.material-symbols-outlined').textContent =
                sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
        }

        analyses.sort((a, b) => {
            let aVal, bVal;

            switch (field) {
                case 'analysis_date':
                    aVal = new Date(a.analysis_date);
                    bVal = new Date(b.analysis_date);
                    break;
                case 'patient':
                    aVal = a.patient ? a.patient.name : '';
                    bVal = b.patient ? b.patient.name : '';
                    break;
                case 'doctor':
                    aVal = a.doctor ? a.doctor.name : '';
                    bVal = b.doctor ? b.doctor.name : '';
                    break;
                case 'room':
                    aVal = a.room ? a.room.room_number : '';
                    bVal = b.room ? b.room.room_number : '';
                    break;
                case 'analysis_type':
                    aVal = a.analysis_type;
                    bVal = b.analysis_type;
                    break;
                case 'status':
                    aVal = a.status;
                    bVal = b.status;
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
        const sortIcons = document.querySelectorAll('th[data-sort] .material-symbols-outlined');
        if(sortIcons.length > 0){
            sortIcons.forEach(icon => {
                icon.textContent = 'swap_vert';
            });
        }
    }

    function closeDropdown() {
        if (activeDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
        }
    }

    // Function to open prescription validation page
    function openPrescriptionValidation(analysisId) {
        console.log('openPrescriptionValidation called with analysisId:', analysisId);
        const analysis = analyses.find(a => a.id === analysisId);
        console.log('Found analysis:', analysis);
        
        if (!analysis || !analysis.recurring_analysis_id) {
            console.log('Analysis not found or not recurring');
            showToast('This analysis is not part of a recurring series', 'error');
            return;
        }
        
        console.log('Showing modal for recurring analysis:', analysis.recurring_analysis_id);
        showPrescriptionValidationModal(analysis.recurring_analysis_id, analysisId);
    }

    function showPrescriptionValidationModal(recurringAnalysisId, analysisId) {
        console.log('showPrescriptionValidationModal called with:', recurringAnalysisId, analysisId);
        const modalHTML = `
            <div class="modal-overlay" id="prescription-validation-modal">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Validate Prescription</h3>
                        <button type="button" class="modal-close" id="close-prescription-modal">×</button>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 20px; color: #333; font-size: 14px; line-height: 1.4;">Please confirm that you have received a valid prescription for this analysis.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancel-prescription-modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirm-prescription-btn" data-recurring-id="${recurringAnalysisId}" data-analysis-id="${analysisId}">Confirm Prescription</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show the modal by adding the 'show' class
        setTimeout(() => {
            const modal = document.getElementById('prescription-validation-modal');
            if (modal) {
                modal.classList.add('show');
                
                // Add event listeners
                document.getElementById('close-prescription-modal').addEventListener('click', closePrescriptionValidationModal);
                document.getElementById('cancel-prescription-modal').addEventListener('click', closePrescriptionValidationModal);
                document.getElementById('confirm-prescription-btn').addEventListener('click', function() {
                    confirmPrescriptionValidation(recurringAnalysisId, analysisId);
                });
            }
        }, 10);
    }

    function closePrescriptionValidationModal() {
        const modal = document.getElementById('prescription-validation-modal');
        if (modal) {
            modal.remove();
        }
    }

    function confirmPrescriptionValidation(recurringAnalysisId, analysisId) {
        const analysis = analyses.find(a => a.id === analysisId);
        if (!analysis) {
            showToast('Analysis not found', 'error');
            return;
        }
        
        const data = {
            recurringAnalysisId: recurringAnalysisId,
            analysisId: analysisId,
            analysisDate: analysis.analysis_date,
            totalAnalysesPrescribed: 1, // Always validate only this specific analysis
            prescriptionNumber: `VALIDATED-${Date.now()}`,
            validFrom: analysis.analysis_date,
            validUntil: analysis.analysis_date, // Valid only for this specific analysis date
            validationNotes: `Agent validation - single analysis validation`
        };

        fetch(`/api/prescriptions/validate/${recurringAnalysisId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showToast('Prescription validated successfully', 'success');
                closePrescriptionValidationModal();
                loadAnalyses(); // Refresh the analyses list
            } else {
                showToast(result.message || 'Failed to validate prescription', 'error');
            }
        })
        .catch(error => {
            console.error('Error validating prescription:', error);
            showToast('Error validating prescription', 'error');
        });
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
            showToast('Your session has expired. Please log in again.', 'error');
            setTimeout(() => {
                // window.location.href = '/login';
            }, 2000);
            return true;
        }
        return false;
    }

    function showLoading() {
        if(tableBody){
            tableBody.innerHTML = '<tr><td colspan="8" class="loading"><span class="material-symbols-outlined">hourglass_empty</span><br>Loading analyses...</td></tr>';
        }
        if(recordCount){
            recordCount.textContent = 'Loading...';
        }
    }

    function showError(message) {
        if(tableBody){
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--dark-red);">${message}</td></tr>`;
        }
        if(recordCount){
            recordCount.textContent = 'Error loading analyses';
        }
    }

    function showToast(message, type = 'info') {
        if(!toast) return;

        const toastIcon = toast.querySelector('.toast-icon');
        const toastMessage = toast.querySelector('.toast-message');

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        if(toastIcon) toastIcon.textContent = icons[type] || icons.info;
        if(toastMessage) toastMessage.textContent = message;

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
            loadAnalyses();
        }
    };

} // End of initializePage function