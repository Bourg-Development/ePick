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
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Translation function fallback
    if (typeof __ === 'undefined') {
        window.__ = function(key) {
            // Temporary hardcoded translations for testing
            const hardcodedTranslations = {
                'updateStatus': 'Mettre à jour le statut',
                'validatePrescription': 'Valider la prescription',
                'cancelAnalysis': 'Annuler l\'analyse',
                'viewAuditLogs': 'Voir les journaux d\'audit',
                'actions.postpone': 'Reporter',
                'analyses.noAnalysesFound': 'Aucune analyse trouvée',
                'export.noFiltersApplied': 'Aucun filtre appliqué - export de toutes les analyses'
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

    // State variables
    let analyses = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalAnalyses = 0;
    let limit = 20;
    let activeDropdown = null;
    let currentEditAnalysisId = null;
    let sortField = null;
    let organizationSettings = null;
    let sortDirection = 'asc';
    // Initialize hideActions - will be overridden by template if user lacks permission
    window.hideActions = false;
    let activeSearchDropdown = null;
    let activeExportDropdown = null;
    let analysisTypes = [];
    let manuallyAdjustedDates = {}; // Track manually adjusted dates by index

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
    // Dashboard functionality removed
    
    // Bulk Actions Elements
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const bulkActionsContainer = document.getElementById('bulkActionsContainer');
    const bulkSelectionInfo = document.getElementById('bulkSelectionInfo');
    const bulkActionsBtn = document.getElementById('bulkActionsBtn');
    const bulkActionsDropdown = document.getElementById('bulkActionsDropdown');
    const bulkCancelAnalysisModal = document.getElementById('bulkCancelAnalysisModal');

    // Export elements
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportModal = document.getElementById('exportModal');

    // Modals
    const addAnalysisModal = document.getElementById('addAnalysisModal');
    const updateStatusModal = document.getElementById('updateStatusModal');
    // Dashboard modal removed
    const confirmModal = document.getElementById('confirmModal');
    const addDoctorModal = document.getElementById('addDoctorModal');
    const cancelAnalysisModal = document.getElementById('cancelAnalysisModal');
    const auditLogsModal = document.getElementById('auditLogsModal');
    const toast = document.getElementById('toast');

    const keybinds = {
        'Escape': () => {
            if(activeDropdown !== null) return closeDropdown();
            if(activeSearchDropdown !== null) return closeSearchDropdown();
            if(activeExportDropdown !== null) return closeExportDropdown();
            addAnalysisModal?.classList.remove('show');
            updateStatusModal?.classList.remove('show');
            // Dashboard modal removed
            confirmModal?.classList.remove('show');
            exportModal?.classList.remove('show');
            addDoctorModal?.classList.remove('show');
            cancelAnalysisModal?.classList.remove('show');
        },
        'Control+r': () => {
            loadAnalyses();
        }
    };
    
    // Bulk Actions Functions
    function setupBulkActionsEventListeners() {
        // Select all checkbox
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.row-checkbox:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = this.checked);
            updateBulkSelectionInfo();
        });
        
        // Individual row checkboxes (delegated event)
        tableBody.addEventListener('change', function(e) {
            if (e.target.classList.contains('row-checkbox')) {
                updateBulkSelectionInfo();
                updateSelectAllCheckbox();
            }
        });
        
        // Bulk actions dropdown
        bulkActionsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            bulkActionsDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!bulkActionsBtn.contains(e.target) && !bulkActionsDropdown.contains(e.target)) {
                bulkActionsDropdown.classList.remove('show');
            }
        });
        
        // Bulk action items
        bulkActionsDropdown.addEventListener('click', async function(e) {
            e.preventDefault();
            const actionElement = e.target.closest('[data-action]');
            if (actionElement) {
                const action = actionElement.dataset.action;
                await handleBulkAction(action);
                bulkActionsDropdown.classList.remove('show');
            }
        });
    }
    
    function updateBulkSelectionInfo() {
        const selectedCount = document.querySelectorAll('.row-checkbox:checked').length;
        bulkSelectionInfo.textContent = `${selectedCount} selected`;
        
        // Show/hide bulk actions container
        if (selectedCount > 0) {
            bulkActionsContainer.style.display = 'flex';
        } else {
            bulkActionsContainer.style.display = 'none';
        }
    }
    
    function updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('.row-checkbox:not(:disabled)');
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    async function handleBulkAction(action) {
        const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked'))
            .map(cb => parseInt(cb.dataset.id));
        
        if (selectedIds.length === 0) {
            showToast(__('messages.success.bulkAction.noSelection'), 'warning');
            return;
        }
        
        switch (action) {
            case 'cancel-selected':
                await bulkCancelAnalyses(selectedIds);
                break;
            default:
                showToast(__('messages.success.bulkAction.unknownAction'), 'error');
        }
    }
    
    async function bulkCancelAnalyses(analysisIds) {
        // Store the analysis IDs for the modal
        window.bulkCancelAnalysisIds = analysisIds;
        
        // Update the modal with the count
        const bulkCancelAnalysisCount = document.getElementById('bulkCancelAnalysisCount');
        if (bulkCancelAnalysisCount) {
            bulkCancelAnalysisCount.textContent = analysisIds.length;
        }
        
        // Clear the reason field
        const bulkCancelReason = document.getElementById('bulkCancelReason');
        if (bulkCancelReason) {
            bulkCancelReason.value = '';
        }
        
        // Show the modal
        bulkCancelAnalysisModal.classList.add('show');
    }
    
    async function handleBulkCancelAnalysis(e) {
        e.preventDefault();
        
        const analysisIds = window.bulkCancelAnalysisIds;
        const bulkCancelReason = document.getElementById('bulkCancelReason');
        const reason = bulkCancelReason ? bulkCancelReason.value.trim() : '';
        
        if (!reason) {
            showToast(__('messages.success.bulkAction.provideCancellationReason'), 'error');
            return;
        }
        
        if (!analysisIds || analysisIds.length === 0) {
            showToast('No analyses selected', 'error');
            return;
        }
        
        // Client-side validation will be handled by the server
        // The server will return appropriate error messages with configurable limits
        
        try {
            // Hide the modal
            bulkCancelAnalysisModal.classList.remove('show');
            
            showToast(__('messages.success.bulkAction.cancellingAnalyses'), 'info');
            
            const result = await api.post('/analyses/bulk-cancel', {
                analysisIds: analysisIds,
                reason: reason
            });
            
            if (result.success) {
                showToast(`Successfully cancelled ${result.data.successCount} analyses`, 'success');
                
                // Clear selections
                document.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
                selectAllCheckbox.checked = false;
                updateBulkSelectionInfo();
                
                // Reload the table
                await loadAnalyses();
            } else {
                showToast(result.message || 'Failed to cancel analyses', 'error');
            }
        } catch (error) {
            console.error('Bulk cancel error:', error);
            showToast(getErrorMessage(error), 'error');
        }
    }

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadAnalysisTypes();
        await loadOrganizationSettings();
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
        // Dashboard button removed

        // Export functionality
        if (exportDropdownBtn) {
            setupExportEventListeners();
        }
        
        // Bulk Actions functionality
        if (selectAllCheckbox) {
            setupBulkActionsEventListeners();
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
                resetAddAnalysisForm();
            });
        }
        if(cancelAddBtn) {
            cancelAddBtn.addEventListener('click', () => {
                addAnalysisModal.classList.remove('show');
                resetAddAnalysisForm();
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

        // Dashboard Modal functionality removed

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

        // Bulk Cancel Analysis Modal
        const closeBulkCancelModalBtn = document.getElementById('closeBulkCancelModalBtn');
        const cancelBulkCancelBtn = document.getElementById('cancelBulkCancelBtn');
        const bulkCancelAnalysisForm = document.getElementById('bulkCancelAnalysisForm');

        if(closeBulkCancelModalBtn) {
            closeBulkCancelModalBtn.addEventListener('click', () => {
                bulkCancelAnalysisModal.classList.remove('show');
            });
        }
        if(cancelBulkCancelBtn) {
            cancelBulkCancelBtn.addEventListener('click', () => {
                bulkCancelAnalysisModal.classList.remove('show');
            });
        }
        if(bulkCancelAnalysisForm) {
            bulkCancelAnalysisForm.addEventListener('submit', handleBulkCancelAnalysis);
        }

        // Audit Logs Modal
        const closeAuditLogsModalBtn = document.getElementById('closeAuditLogsModalBtn');
        const closeAuditLogsBtn = document.getElementById('closeAuditLogsBtn');

        if(closeAuditLogsModalBtn) {
            closeAuditLogsModalBtn.addEventListener('click', () => {
                auditLogsModal.classList.remove('show');
            });
        }
        if(closeAuditLogsBtn) {
            closeAuditLogsBtn.addEventListener('click', () => {
                auditLogsModal.classList.remove('show');
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
            currentFilters.innerHTML = `<span class="filter-info">${__('export.noFiltersApplied')}</span>`;
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
        // For quick export, just open the export modal with the format pre-selected
        showExportModal();

        // Pre-select the format
        const formatRadio = document.querySelector(`input[name="exportFormat"][value="${format}"]`);
        if(formatRadio) {
            formatRadio.checked = true;
        }

        // Select safe columns by default
        selectSafeColumns();

        showToast(`Quick ${format.toUpperCase()} ${__('messages.export.enterPasswordInfo')}`, 'info');
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

            // Check for export warning headers
            const hasWarning = response.headers.get('X-Export-Warning') === 'true';
            if (hasWarning) {
                const warningMessage = response.headers.get('X-Export-Message');
                const exportLimits = response.headers.get('X-Export-Limits');
                
                if (warningMessage) {
                    // Show warning toast with longer duration
                    showToast(warningMessage, 'warning', 8000);
                }
                
                // Log limits for debugging
                if (exportLimits) {
                    console.log('Export limits:', JSON.parse(exportLimits));
                }
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
                showToast(__('messages.error.loadingAnalysisTypes'), 'error');
            }
        } catch (error) {
            console.error('Error loading analysis types:', error);
            showToast(__('messages.error.errorLoadingAnalysisTypes'), 'error');
        }
    }

    async function loadOrganizationSettings() {
        try {
            const response = await api.get('/org-settings');
            if (response.success) {
                organizationSettings = response.settings || {};
                console.log('Loaded organization settings:', organizationSettings);
            } else {
                console.error('Failed to load organization settings:', response.message);
                // Don't show error toast as this is optional for now
            }
        } catch (error) {
            console.error('Error loading organization settings:', error);
            // Don't show error toast as this is optional for now
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
            console.log('Attempting to create recurring analysis with data:', analysisData);
            const data = await api.post('/recurring-analyses', analysisData);
            return data;
        } catch (error) {
            console.error('Create recurring analysis error:', error);
            console.error('Error data from backend:', error.data);
            console.error('Error status:', error.status);
            console.error('Analysis data sent:', analysisData);
            
            // Try to get more specific error information
            if (error.data) {
                console.error('Backend error details:', error.data);
                let errorMessage = 'Backend validation error';
                
                if (typeof error.data === 'object' && error.data.message) {
                    errorMessage = error.data.message;
                    
                    // Handle recurring analysis validation issues
                    if (error.data.issues && Array.isArray(error.data.issues)) {
                        console.error('Validation issues:', error.data.issues);
                        const issues = error.data.issues.map((issue, index) => {
                            if (typeof issue === 'object') {
                                const date = issue.date ? new Date(issue.date).toLocaleDateString() : 'Unknown date';
                                const problem = issue.issue || issue.message || issue.reason || 'Unknown issue';
                                const suggestion = issue.suggestion || 'Please adjust your schedule';
                                return `• ${date}: ${problem}\n  Suggestion: ${suggestion}`;
                            }
                            return `• Issue ${index + 1}: ${issue}`;
                        }).join('\n');
                        
                        // Try to suggest a better start date
                        let suggestion = "Tip: Try starting on a different date or use a different recurrence pattern.";
                        
                        if (error.data.issues.some(issue => issue.issue && issue.issue.includes('not a working day'))) {
                            const currentStartDate = new Date(analysisData.analysisDate);
                            const workingDays = organizationSettings?.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                            const suggestedDate = adjustToNextWorkingDay(currentStartDate, workingDays);
                            
                            if (suggestedDate.getTime() !== currentStartDate.getTime()) {
                                const suggestedDateStr = suggestedDate.toLocaleDateString();
                                suggestion = `💡 Suggestion: Try starting on ${suggestedDateStr} (next working day) to avoid weekend conflicts.`;
                            } else {
                                suggestion = `💡 Suggestion: The current start date is fine, but daily scheduling hits weekends. Consider using "weekly" pattern instead.`;
                            }
                        }
                        
                        errorMessage = `${error.data.message}\n\nScheduling conflicts found:\n${issues}\n\n${suggestion}`;
                    }
                    
                } else if (typeof error.data === 'object' && error.data.errors) {
                    // Handle validation errors array
                    const validationErrors = error.data.errors.map(err => err.msg || err.message || err).join(', ');
                    errorMessage = `Validation errors: ${validationErrors}`;
                } else if (typeof error.data === 'string') {
                    errorMessage = error.data;
                }
                
                showToast(errorMessage, 'error');
            } else {
                showToast(getErrorMessage(error), 'error');
            }
            
            if (handleAuthError(error)) return;
            throw error;
        }
    }

    async function updateAnalysisStatus(analysisId, statusData) {
        try {
            await api.put(`/analyses/${analysisId}/status`, statusData);
            showToast(__('messages.success.statusUpdated'), 'success');
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
            showToast(`${__('messages.success.analysisPostponed')} ${data.newDate}`, 'success');
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
            showToast(__('messages.success.analysisCancelled'), 'success');
            loadAnalyses();
        } catch (error) {
            console.error('Cancel analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    // Dashboard functionality removed
    /*
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
    */

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

            const data = await api.get(`/admin/rooms/search/${encodeURIComponent(term)}?limit=10`);
            return data.data || [];
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
            showToast(__('messages.validation.doctorName'), 'error');
            return;
        }

        if (!specialization) {
            showToast(__('messages.validation.specialization'), 'error');
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
                showToast(`${__('messages.success.doctorCreated')} "${name}"`, 'success');
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
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--medium-gray);">${__('analyses.noAnalysesFound')}</td></tr>`;
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
                    <input type="checkbox" class="row-checkbox" data-id="${analysis.id}" ${analysis.status === 'Cancelled' || analysis.status === 'Completed' ? 'disabled' : ''}>
                </td>
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

        // Clear the data-selected-id attributes and values from search inputs
        const searchInputs = ['newAnalysisPatientSearch', 'newAnalysisDoctorSearch', 'newAnalysisRoomSearch'];
        searchInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
                input.removeAttribute('data-selected-id');
                input.style.backgroundColor = ''; // Clear any background color
            }
        });

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
            showToast(__('messages.success.bulkAction.loadingPatientDetails'), 'info');

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
                    showToast(`Auto-filled: ${autoFilledItems.join(' and ')}`, 'success');
                } else {
                    showToast(__('messages.success.bulkAction.noAssignedDoctorRoom'), 'warning');
                }
            } else {
                showToast(__('messages.success.bulkAction.failedLoadPatientDetails'), 'error');
            }
        } catch (error) {
            console.error('Error auto-filling patient details:', error);
            showToast(__('messages.success.bulkAction.failedAutoFillDetails'), 'error');
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

    /*
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
            showToast(__('messages.error.loadingDashboard'), 'error');
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
    */

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

    async function showAuditLogsModal(analysisId) {
        const analysis = analyses.find(a => a.id === analysisId);
        if (!analysis) return;

        const auditLogsPatientName = document.getElementById('auditLogsPatientName');
        const auditLogsAnalysisType = document.getElementById('auditLogsAnalysisType');
        const auditLogsAnalysisDate = document.getElementById('auditLogsAnalysisDate');
        const auditLogsTableBody = document.querySelector('#auditLogsTable tbody');

        // Set analysis info
        if(auditLogsPatientName) auditLogsPatientName.textContent = analysis.patient ? analysis.patient.name : 'N/A';
        if(auditLogsAnalysisType) auditLogsAnalysisType.textContent = getAnalysisTypeName(analysis.analysis_type);
        if(auditLogsAnalysisDate) {
            const date = new Date(analysis.analysis_date);
            auditLogsAnalysisDate.textContent = window.formatDate ? window.formatDate(date) : date.toLocaleDateString();
        }

        // Show modal
        auditLogsModal.classList.add('show');

        // Show loading state
        if(auditLogsTableBody) {
            auditLogsTableBody.innerHTML = '<tr><td colspan="3" class="audit-logs-loading">Loading audit logs...</td></tr>';
        }

        try {
            // Fetch audit logs
            const response = await api.get(`/analyses/${analysisId}/audit-logs`);
            
            if (response.success) {
                const auditLogs = response.data;
                
                if (auditLogs.length === 0) {
                    auditLogsTableBody.innerHTML = '<tr><td colspan="3" class="audit-logs-empty">No audit logs found for this analysis</td></tr>';
                } else {
                    auditLogsTableBody.innerHTML = auditLogs.map(log => `
                        <tr>
                            <td>
                                <div class="audit-log-date">${log.date}</div>
                            </td>
                            <td>
                                <div class="audit-log-action">${log.eventDescription}</div>
                            </td>
                            <td>
                                <div class="audit-log-user">${log.user ? log.user.name : 'System'}</div>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                auditLogsTableBody.innerHTML = '<tr><td colspan="3" class="audit-logs-empty">Failed to load audit logs</td></tr>';
                showToast(__('messages.success.bulkAction.failedLoadAuditLogs'), 'error');
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
            auditLogsTableBody.innerHTML = '<tr><td colspan="3" class="audit-logs-empty">Error loading audit logs</td></tr>';
            showToast('Error loading audit logs', 'error');
        }
    }

    async function handleCancelAnalysis(e) {
        e.preventDefault();

        const analysisId = parseInt(document.getElementById('cancelAnalysisId').value);
        const reason = document.getElementById('cancelAnalysisReason').value.trim();

        // Basic validation - detailed validation will be handled by server
        if (!reason) {
            showToast(__('messages.validation.cancellationReason'), 'error');
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

        // Add missing event listener for analysis date
        const newAnalysisDate = document.getElementById('newAnalysisDate');
        if (newAnalysisDate) {
            newAnalysisDate.addEventListener('change', updateRecurringPreview);
        }
    }

    async function updateRecurringPreview() {
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

        // Clear manual adjustments if key parameters changed (except when called from date picker)
        if (!window.isUpdatingFromDatePicker) {
            manuallyAdjustedDates = {};
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
        
        // Validate against company policy if available
        const validationResults = await validateDatesAgainstPolicy(dates);
        
        let previewHTML = '<div class="preview-dates">';
        
        // Show information about automatic adjustments
        previewHTML += '<div class="preview-info">';
        previewHTML += `<div class="preview-info-item">ℹ️ Dates are automatically adjusted to working days</div>`;
        previewHTML += '</div>';

        // Show warnings if any policy violations remain
        if (validationResults.hasViolations) {
            previewHTML += '<div class="preview-warnings">';
            if (validationResults.nonWorkingDays.length > 0) {
                previewHTML += `<div class="preview-warning">⚠️ ${validationResults.nonWorkingDays.length} dates still fall on non-working days</div>`;
            }
            if (validationResults.exceededDailyLimit.length > 0) {
                previewHTML += `<div class="preview-warning">⚠️ ${validationResults.exceededDailyLimit.length} dates may exceed daily analysis limit</div>`;
            }
            previewHTML += '</div>';
        }
        
        dates.forEach((date, index) => {
            // Use manually adjusted date if available, otherwise use generated date
            const effectiveDate = manuallyAdjustedDates[index] || date;
            const dateStr = formatDateForDisplay(effectiveDate);
            const isoDateStr = effectiveDate.toISOString().split('T')[0];
            const violations = validationResults.dateViolations[index] || {};
            const hasWarning = violations.nonWorkingDay || violations.exceededLimit;
            const warningClass = hasWarning ? 'preview-date-warning' : '';
            const warningIcon = hasWarning ? '⚠️ ' : '';
            const isManuallyAdjusted = manuallyAdjustedDates[index] ? 'manually-adjusted' : '';
            
            previewHTML += `
                <div class="preview-date ${warningClass} ${isManuallyAdjusted}" title="${violations.reason || ''}">
                    <span class="preview-date-number">${index + 1}.</span>
                    <span class="preview-date-value">${warningIcon}${dateStr}</span>
                    <button type="button" class="preview-date-picker-btn" data-index="${index}" data-date="${isoDateStr}" title="Change this date">
                        <span class="material-symbols-outlined">calendar_month</span>
                    </button>
                    <input type="date" class="preview-date-picker" id="datePicker${index}" value="${isoDateStr}" 
                           data-index="${index}" style="position: absolute; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none;">
                </div>
            `;
        });
        previewHTML += '</div>';

        previewContent.innerHTML = previewHTML;
        
        // Add event listeners for date picker buttons
        const datePickerBtns = previewContent.querySelectorAll('.preview-date-picker-btn');
        datePickerBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const currentDate = this.dataset.date;
                openDatePicker(index, currentDate);
            });
        });
        
        // Add event listeners for date inputs
        const datePickers = previewContent.querySelectorAll('.preview-date-picker');
        datePickers.forEach(picker => {
            picker.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const newDate = this.value;
                updateAnalysisDate(index, newDate);
            });
        });
        
        recurringPreview.style.display = 'block';
    }

    function resetRecurringPreview() {
        const recurringPreview = document.getElementById('recurringPreview');
        recurringPreview.style.display = 'none';
        // Clear manually adjusted dates when resetting
        manuallyAdjustedDates = {};
        // Clear any active date picker
        if (activeDatePicker && activeDatePicker.listener) {
            document.removeEventListener('click', activeDatePicker.listener);
        }
        activeDatePicker = null;
    }

    function resetAddAnalysisForm() {
        // Reset the form
        const addAnalysisForm = document.getElementById('addAnalysisForm');
        if (addAnalysisForm) {
            addAnalysisForm.reset();
        }

        // Clear the data-selected-id attributes and values from search inputs
        const searchInputs = ['newAnalysisPatientSearch', 'newAnalysisDoctorSearch', 'newAnalysisRoomSearch'];
        searchInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
                input.removeAttribute('data-selected-id');
                input.style.backgroundColor = ''; // Clear any background color
            }
        });

        // Reset recurring analysis fields
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

        // Clear and hide recurring preview
        resetRecurringPreview();

        // Clear search selections
        currentEditAnalysisId = null;
        
        // Reset any search inputs that might have selections
        const patientSearchInput = document.getElementById('patientSearchInput');
        const doctorSearchInput = document.getElementById('doctorSearchInput');
        const roomSearchInput = document.getElementById('roomSearchInput');
        
        if (patientSearchInput) patientSearchInput.value = '';
        if (doctorSearchInput) doctorSearchInput.value = '';
        if (roomSearchInput) roomSearchInput.value = '';
    }

    // Store active date picker info to manage cleanup
    let activeDatePicker = null;
    
    // Functions for date picker functionality
    function openDatePicker(index, currentDate) {
        // Close any existing date picker first
        if (activeDatePicker) {
            hideDatePicker(activeDatePicker.index, activeDatePicker.element.value);
        }
        
        const datePicker = document.getElementById(`datePicker${index}`);
        if (datePicker) {
            // Store reference to active picker
            activeDatePicker = { index, element: datePicker, listener: null };
            
            // Make the input temporarily visible and clickable
            datePicker.style.position = 'fixed';
            datePicker.style.top = '50%';
            datePicker.style.left = '50%';
            datePicker.style.transform = 'translate(-50%, -50%)';
            datePicker.style.zIndex = '10000';
            datePicker.style.opacity = '1';
            datePicker.style.width = 'auto';
            datePicker.style.height = 'auto';
            datePicker.style.pointerEvents = 'auto';
            datePicker.style.border = '2px solid var(--blood-red)';
            datePicker.style.borderRadius = '4px';
            datePicker.style.padding = '8px';
            datePicker.style.background = 'white';
            datePicker.style.fontSize = '16px';
            datePicker.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            
            // Focus and try to open the picker
            datePicker.focus();
            
            // For newer browsers, try showPicker
            if (typeof datePicker.showPicker === 'function') {
                try {
                    datePicker.showPicker();
                } catch (e) {
                    console.log('showPicker failed, fallback to manual input');
                }
            }
            
            // Add click outside listener to hide the picker
            const hideOnClickOutside = (e) => {
                if (!datePicker.contains(e.target)) {
                    hideDatePicker(index, datePicker.value);
                }
            };
            
            // Store listener reference for cleanup
            activeDatePicker.listener = hideOnClickOutside;
            
            // Add the listener after a short delay to avoid immediate triggering
            setTimeout(() => {
                document.addEventListener('click', hideOnClickOutside);
            }, 100);
        }
    }
    
    function hideDatePicker(index, newDateStr) {
        const datePicker = document.getElementById(`datePicker${index}`);
        
        // Remove click outside listener
        if (activeDatePicker && activeDatePicker.listener) {
            document.removeEventListener('click', activeDatePicker.listener);
        }
        activeDatePicker = null;
        
        // Hide the date picker
        if (datePicker) {
            datePicker.style.position = 'absolute';
            datePicker.style.top = '0';
            datePicker.style.left = '0';
            datePicker.style.width = '1px';
            datePicker.style.height = '1px';
            datePicker.style.opacity = '0';
            datePicker.style.pointerEvents = 'none';
            datePicker.style.transform = 'none';
            datePicker.style.zIndex = 'auto';
            datePicker.style.border = 'none';
            datePicker.style.borderRadius = 'initial';
            datePicker.style.padding = 'initial';
            datePicker.style.background = 'initial';
            datePicker.style.fontSize = 'initial';
            datePicker.style.boxShadow = 'none';
        }
        
        // Update the date if changed and not empty
        if (newDateStr && newDateStr.trim() !== '') {
            updateAnalysisDate(index, newDateStr);
        }
    }

    async function updateAnalysisDate(index, newDateStr) {
        if (newDateStr) {
            const newDate = new Date(newDateStr);
            
            // Validate against company policy
            if (organizationSettings) {
                const dayName = newDate.toLocaleDateString('en-US', { weekday: 'long' });
                const workingDays = organizationSettings.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                
                // Check if it's a working day
                if (!workingDays.includes(dayName)) {
                    showToast(`${dayName} ${__('messages.validation.workingDay')}`, 'error');
                    return;
                }
                
                // Check daily analysis limit
                const maxAnalysesPerDay = organizationSettings.max_analyses_per_day;
                if (maxAnalysesPerDay) {
                    try {
                        const dateStr = newDate.toISOString().split('T')[0];
                        const response = await api.get(`/analyses/count-by-date/${dateStr}`);
                        
                        if (response.count >= parseInt(maxAnalysesPerDay)) {
                            showToast(`${__('messages.validation.maxAnalysesReached')} ${dateStr}. Please select a different date.`, 'error');
                            return;
                        }
                    } catch (error) {
                        console.error('Error checking daily analysis count:', error);
                        // Continue anyway if we can't check the count
                    }
                }
            }
            
            manuallyAdjustedDates[index] = newDate;
            
            // Set flag to prevent clearing manual adjustments
            window.isUpdatingFromDatePicker = true;
            
            // Clear any active date picker before regenerating
            if (activeDatePicker) {
                if (activeDatePicker.listener) {
                    document.removeEventListener('click', activeDatePicker.listener);
                }
                activeDatePicker = null;
            }
            
            // Regenerate the preview to show updated date and validation
            const pattern = document.getElementById('recurrencePattern')?.value;
            const interval = document.getElementById('intervalDays')?.value;
            const total = document.getElementById('totalOccurrences')?.value;
            const startDate = document.getElementById('newAnalysisDate')?.value;
            
            if (pattern && total && startDate) {
                updateRecurringPreview();
            }
            
            // Clear flag after update
            window.isUpdatingFromDatePicker = false;
        }
    }

    // Function to get effective dates (including manual adjustments)
    function getEffectiveDates(generatedDates) {
        return generatedDates.map((date, index) => {
            return manuallyAdjustedDates[index] || date;
        });
    }

    function generateRecurringDates(startDate, pattern, interval, total) {
        const dates = [];
        const workingDays = organizationSettings?.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        // Adjust start date to next working day if needed
        let currentDate = new Date(startDate);
        currentDate = adjustToNextWorkingDay(currentDate, workingDays);
        dates.push(new Date(currentDate));
        
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
            
            // Adjust to next working day if needed
            const adjustedDate = adjustToNextWorkingDay(nextDate, workingDays);
            dates.push(adjustedDate);
        }
        
        return dates;
    }

    function adjustToNextWorkingDay(date, workingDays) {
        const adjustedDate = new Date(date);
        let attempts = 0;
        const maxAttempts = 14; // Prevent infinite loop
        
        while (attempts < maxAttempts) {
            const dayName = adjustedDate.toLocaleDateString('en-US', { weekday: 'long' });
            
            if (workingDays.includes(dayName)) {
                return adjustedDate;
            }
            
            // Move to next day
            adjustedDate.setDate(adjustedDate.getDate() + 1);
            attempts++;
        }
        
        // If we can't find a working day in 14 days, return original date
        return new Date(date);
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

    async function validateDatesAgainstPolicy(dates) {
        const result = {
            hasViolations: false,
            nonWorkingDays: [],
            exceededDailyLimit: [],
            adjustedDates: [],
            dateViolations: {}
        };

        if (!organizationSettings) {
            return result;
        }

        const workingDays = organizationSettings.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const maxAnalysesPerDay = organizationSettings.max_analyses_per_day || null;

        // Check each date
        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const violations = {};

            // Check if date was adjusted from original schedule
            // Note: Since we now auto-adjust dates, working day violations should be rare
            if (!workingDays.includes(dayName)) {
                violations.nonWorkingDay = true;
                violations.reason = `${dayName} is not a working day`;
                result.nonWorkingDays.push(date);
                result.hasViolations = true;
            }

            // Check daily limit (simplified check - would need to fetch existing analyses for accurate count)
            if (maxAnalysesPerDay && maxAnalysesPerDay > 0) {
                // Count how many analyses are already scheduled for this date among the recurring ones
                const sameDay = dates.filter(d => d.toDateString() === date.toDateString()).length;
                if (sameDay > 1) {
                    violations.exceededLimit = true;
                    violations.reason = violations.reason ? 
                        `${violations.reason}; Multiple analyses scheduled for same day` :
                        'Multiple analyses scheduled for same day';
                    result.exceededDailyLimit.push(date);
                    result.hasViolations = true;
                }
            }

            if (Object.keys(violations).length > 0) {
                result.dateViolations[i] = violations;
            }
        }

        return result;
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

        // Format date to ISO8601 format for backend
        const analysisDateValue = newAnalysisDate ? newAnalysisDate.value : '';
        let isoDate = analysisDateValue ? new Date(analysisDateValue).toISOString().split('T')[0] : '';

        // For recurring analysis, adjust start date to next working day if needed
        if (isRecurring && isoDate && organizationSettings) {
            const workingDays = organizationSettings.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const adjustedStartDate = adjustToNextWorkingDay(new Date(isoDate), workingDays);
            isoDate = adjustedStartDate.toISOString().split('T')[0];
            
            console.log('Original start date:', analysisDateValue);
            console.log('Adjusted start date:', isoDate);
        }

        const analysisData = {
            analysisDate: isoDate,
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
            
            // Only include intervalDays for custom patterns (backend validation marks it as optional)
            if (recurrencePattern && recurrencePattern.value === 'custom') {
                if (!intervalDays || !intervalDays.value || parseInt(intervalDays.value) < 1) {
                    showToast(__('messages.validation.intervalRequired'), 'error');
                    return;
                }
                analysisData.intervalDays = parseInt(intervalDays.value);
            }
            // For non-custom patterns, don't include intervalDays - let backend handle defaults
            
            analysisData.totalOccurrences = totalOccurrences ? parseInt(totalOccurrences.value) : null;
            
            // Generate the pre-calculated working day dates
            const startDate = new Date(analysisData.analysisDate);
            const interval = recurrencePattern && recurrencePattern.value === 'custom' ? 
                parseInt(intervalDays?.value || 1) : 1;
            const generatedDates = generateRecurringDates(
                startDate, 
                analysisData.recurrencePattern, 
                interval, 
                analysisData.totalOccurrences
            );
            
            // Apply manual adjustments to get effective dates
            const effectiveDates = getEffectiveDates(generatedDates);
            
            // Send the effective dates (including manual adjustments) to backend
            analysisData.calculatedDates = effectiveDates.map(date => date.toISOString().split('T')[0]);
            
            console.log('Sending pre-calculated working day dates to backend:', analysisData.calculatedDates);
        }

        // Enhanced validation with detailed error reporting
        const validationErrors = [];

        if (!analysisData.analysisDate) {
            validationErrors.push('Analysis date is required');
        }

        if (!analysisData.analysisType) {
            validationErrors.push('Analysis type is required');
        }

        if (!analysisData.patientId || analysisData.patientId < 1) {
            validationErrors.push('Please select a valid patient');
        }

        if (!analysisData.doctorId || analysisData.doctorId < 1) {
            validationErrors.push('Please select a valid doctor');
        }

        if (!analysisData.roomId || analysisData.roomId < 1) {
            validationErrors.push('Please select a valid room');
        }

        // Check if analysis type is valid (from loaded types)
        if (analysisData.analysisType && analysisTypes.length > 0) {
            const validType = analysisTypes.find(type => type.code === analysisData.analysisType);
            if (!validType) {
                validationErrors.push(`Invalid analysis type: ${analysisData.analysisType}. Available types: ${analysisTypes.map(t => t.code).join(', ')}`);
            }
        }

        // Backend compatibility check - warn if type is not in expected hardcoded list
        const backendExpectedTypes = ['XY', 'YZ', 'ZG', 'HG'];
        if (analysisData.analysisType && !backendExpectedTypes.includes(analysisData.analysisType)) {
            console.warn(`Analysis type '${analysisData.analysisType}' may not be supported by backend recurring analysis endpoint. Expected: ${backendExpectedTypes.join(', ')}`);
        }

        if (validationErrors.length > 0) {
            showToast(`${__('messages.validationErrors')}\n${validationErrors.join('\n')}`, 'error');
            console.error('Validation errors:', validationErrors);
            console.error('Analysis data:', analysisData);
            return;
        }

        // Recurring analysis validation
        if (isRecurring) {
            if (!analysisData.recurrencePattern) {
                showToast(__('messages.validation.recurrenceRequired'), 'error');
                return;
            }

            if (!analysisData.totalOccurrences || analysisData.totalOccurrences < 2) {
                showToast(__('messages.validation.totalOccurrencesMin'), 'error');
                return;
            }

            if (analysisData.intervalDays < 1) {
                showToast(__('messages.validation.intervalMin'), 'error');
                return;
            }

            if (analysisData.recurrencePattern === 'custom' && (!analysisData.intervalDays || analysisData.intervalDays < 1)) {
                showToast(__('messages.validation.validInterval'), 'error');
                return;
            }

            if (!analysisData.totalOccurrences || analysisData.totalOccurrences < 2 || analysisData.totalOccurrences > 100) {
                showToast(__('messages.validation.totalOccurrencesRange'), 'error');
                return;
            }
        }

        // Debug: Log the exact data being sent
        console.log('Sending analysis data to backend:', JSON.stringify(analysisData, null, 2));

        try {
            if (isRecurring) {
                await createRecurringAnalysis(analysisData);
                addAnalysisModal.classList.remove('show');
                showToast(`${__('messages.success.recurringCreated')} (${analysisData.totalOccurrences} analyses scheduled)`, 'success');
                loadAnalyses();
                resetAddAnalysisForm();
            } else {
                await createAnalysis(analysisData);
                addAnalysisModal.classList.remove('show');
                showToast(__('messages.success.analysisScheduled'), 'success');
                loadAnalyses();
                resetAddAnalysisForm();
            }
        } catch (error) {
            console.error('Failed to create analysis:', error);
            console.error('Analysis data that failed:', analysisData);
        }
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
                ${__('updateStatus')}
            </div>
        `;

        // Add prescription validation option for recurring analyses
        if (analysis.recurring_analysis_id) {
            dropdownHTML += `
                <div class="dropdown-item" data-action="validate-prescription">
                    <span class="material-symbols-outlined">medication</span>
                    ${__('validatePrescription')}
                </div>
            `;
        }

        if (analysis.status === 'Pending' || analysis.status === 'Delayed') {
            dropdownHTML += `
                <div class="dropdown-item" data-action="postpone">
                    <span class="material-symbols-outlined">schedule</span>
                    ${__('actions.postpone')}
                </div>
            `;
        }

        if (analysis.status !== 'Completed' && analysis.status !== 'Cancelled') {
            dropdownHTML += `
                <div class="dropdown-item" data-action="cancel">
                    <span class="material-symbols-outlined">cancel</span>
                    ${__('cancelAnalysis')}
                </div>
            `;
        }

        // Add audit logs option if user has permission
        // Note: Also check for system_admin role as they may not have the permissions in their token yet
        const hasAuditPermission = window.userPermissions && (
            window.userPermissions.includes('analyses.view_audit_logs') ||
            window.userPermissions.includes('analyses.view_all_audit_logs') ||
            window.userPermissions.includes('admin') ||
            (window.userRole && window.userRole === 'system_admin')
        );
        
        console.log('Audit logs permission check:', {
            userPermissions: window.userPermissions,
            userRole: window.userRole,
            hasAuditPermission
        });
        
        if (hasAuditPermission) {
            dropdownHTML += `
                <div class="dropdown-item" data-action="view-audit-logs">
                    <span class="material-symbols-outlined">history</span>
                    ${__('viewAuditLogs')}
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
                    case 'view-audit-logs':
                        showAuditLogsModal(analysisId);
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
            showToast(__('messages.error.notRecurringSeries'), 'error');
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
            showToast(__('messages.error.analysisNotFound'), 'error');
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
                showToast(__('messages.success.prescriptionValidated'), 'success');
                closePrescriptionValidationModal();
                loadAnalyses(); // Refresh the analyses list
            } else {
                showToast(result.message || __('messages.error.prescriptionFailed'), 'error');
            }
        })
        .catch(error => {
            console.error('Error validating prescription:', error);
            showToast(__('messages.error.errorValidatingPrescription'), 'error');
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
            showToast(__('messages.error.sessionExpired'), 'error');
            setTimeout(() => {
                // window.location.href = '/login';
            }, 2000);
            return true;
        }
        return false;
    }

    function showLoading() {
        if(tableBody){
            tableBody.innerHTML = '<tr><td colspan="9" class="loading"><span class="material-symbols-outlined">hourglass_empty</span><br>Loading analyses...</td></tr>';
        }
        if(recordCount){
            recordCount.textContent = 'Loading...';
        }
    }

    function showError(message) {
        if(tableBody){
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--dark-red);">${message}</td></tr>`;
        }
        if(recordCount){
            recordCount.textContent = 'Error loading analyses';
        }
    }

    function showToast(message, type = 'info', duration = 5000) {
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
        }, duration);
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