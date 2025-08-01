document.addEventListener('DOMContentLoaded', function() {
    // Translation function fallback
    if (typeof __ === 'undefined') {
        window.__ = function(key) {
            // Temporary hardcoded translations for testing
            const hardcodedTranslations = {
                'archive.viewDetails': 'Voir les détails',
                'archive.loadingArchive': 'Chargement des analyses archivées...',
                'archive.noArchivedAnalyses': 'Aucune analyse archivée trouvée',
                'archive.showingRecords': 'Affichage des enregistrements',
                'common.loading': 'Chargement...',
                'status.unexpectedError': 'Erreur inattendue',
                'export.preparing': 'Préparation...',
                'export.exportData': 'Exporter les données',
                'export.usingCurrentFilters': 'Utilisation des filtres actuels',
                'export.quickCsv': 'Export CSV rapide'
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
                    const d = new Date(date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    
                    // Support different date formats
                    switch (window.userDateFormat) {
                        case 'MM/DD/YYYY':
                            return `${month}/${day}/${year}`;
                        case 'YYYY-MM-DD':
                            return `${year}-${month}-${day}`;
                        case 'DD/MM/YYYY':
                        default:
                            return `${day}/${month}/${year}`;
                    }
                };
            }
            if (!window.formatDateTime) {
                window.formatDateTime = function(date) {
                    const d = new Date(date);
                    const formattedDate = window.formatDate(d);
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    
                    if (window.userTimeFormat === '12h') {
                        const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
                        const hour12 = d.getHours() % 12 || 12;
                        return `${formattedDate} ${hour12}:${minutes} ${ampm}`;
                    } else {
                        return `${formattedDate} ${hours}:${minutes}`;
                    }
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
    let archivedAnalyses = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalArchives = 0;
    let limit = 20;
    let activeDropdown = null;
    let sortField = null;
    let sortDirection = 'desc'; // Default to newest first
    let activeExportDropdown = null;

    // DOM Elements
    const tableBody = document.querySelector('#archiveTable tbody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const analysisStartDateFilter = document.getElementById('analysisStartDateFilter');
    const analysisEndDateFilter = document.getElementById('analysisEndDateFilter');
    const archivedStartDateFilter = document.getElementById('archivedStartDateFilter');
    const archivedEndDateFilter = document.getElementById('archivedEndDateFilter');
    const limitInput = document.getElementById('limitInput');
    const recordCount = document.getElementById('recordCount');
    const pagination = document.getElementById('pagination');
    const refreshBtn = document.getElementById('refreshBtn');
    const statisticsBtn = null;
    const cleanupBtn = document.getElementById('cleanupBtn');

    // Export elements
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportModal = document.getElementById('exportModal');

    // Modals
    const archiveDetailsModal = document.getElementById('archiveDetailsModal');
    const cleanupModal = document.getElementById('cleanupModal');
    const toast = document.getElementById('toast');

    const keybinds = {
        'Escape': () => {
            if(activeDropdown !== null) return closeDropdown();
            if(activeExportDropdown !== null) return closeExportDropdown();
            archiveDetailsModal?.classList.remove('show');
            cleanupModal?.classList.remove('show');
            exportModal?.classList.remove('show');
        },
        'Control+r': () => {
            loadArchivedAnalyses();
        }
    };

    // Initialize
    init();

    async function init() {
        setupEventListeners();
        await loadArchivedAnalyses();
    }

    function setupEventListeners() {
        // Search and filters
        if(searchInput){
            searchInput.addEventListener('input', debounce(() => {
                currentPage = 1;
                loadArchivedAnalyses();
            }, 500));
        }

        if(statusFilter){
            statusFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(typeFilter){
            typeFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(priorityFilter){
            priorityFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(analysisStartDateFilter){
            analysisStartDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(analysisEndDateFilter){
            analysisEndDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(archivedStartDateFilter){
            archivedStartDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(archivedEndDateFilter){
            archivedEndDateFilter.addEventListener('change', () => {
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        if(limitInput){
            limitInput.addEventListener('change', () => {
                limit = parseInt(limitInput.value) || 20;
                currentPage = 1;
                loadArchivedAnalyses();
            });
        }

        // Buttons
        if(refreshBtn){
            refreshBtn.addEventListener('click', loadArchivedAnalyses);
        }
        if(cleanupBtn){
            cleanupBtn.addEventListener('click', showCleanupModal);
        }

        // Export functionality
        if (exportDropdownBtn) {
            setupExportEventListeners();
        }

        // Column sorting
        const sortableHeaders = document.querySelectorAll('#archiveTable th[data-sort]');
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
            selectAllColumnsBtn.addEventListener('click', () => selectAllColumns());
        }
        if(selectNoneColumnsBtn) {
            selectNoneColumnsBtn.addEventListener('click', () => selectNoneColumns());
        }
        if(selectSafeColumnsBtn) {
            selectSafeColumnsBtn.addEventListener('click', () => selectSafeColumns());
        }
    }

    function setupModalEventListeners() {
        // Archive Details Modal
        const closeArchiveDetailsModalBtn = document.getElementById('closeArchiveDetailsModalBtn');
        const closeArchiveDetailsBtn = document.getElementById('closeArchiveDetailsBtn');

        if(closeArchiveDetailsModalBtn) {
            closeArchiveDetailsModalBtn.addEventListener('click', () => {
                archiveDetailsModal.classList.remove('show');
            });
        }
        if(closeArchiveDetailsBtn) {
            closeArchiveDetailsBtn.addEventListener('click', () => {
                archiveDetailsModal.classList.remove('show');
            });
        }

        // Cleanup Modal
        const closeCleanupModalBtn = document.getElementById('closeCleanupModalBtn');
        const cancelCleanupBtn = document.getElementById('cancelCleanupBtn');
        const cleanupForm = document.getElementById('cleanupForm');

        if(closeCleanupModalBtn) {
            closeCleanupModalBtn.addEventListener('click', () => {
                cleanupModal.classList.remove('show');
            });
        }
        if(cancelCleanupBtn) {
            cancelCleanupBtn.addEventListener('click', () => {
                cleanupModal.classList.remove('show');
            });
        }
        if(cleanupForm) {
            cleanupForm.addEventListener('submit', handleCleanup);
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
        // Update current filters display
        updateCurrentFiltersDisplay();
        
        // Populate column selection
        populateColumnSelection();

        // Reset form
        const exportForm = document.getElementById('exportForm');
        if(exportForm) {
            exportForm.reset();
        }
        const csvRadio = document.querySelector('input[name="exportFormat"][value="csv"]');
        if(csvRadio) {
            csvRadio.checked = true;
        }

        exportModal.classList.add('show');
    }

    function updateCurrentFiltersDisplay() {
        const currentFilters = document.getElementById('currentFilters');
        if(!currentFilters) return;

        const activeFilters = [];

        if (searchInput && searchInput.value.trim()) {
            activeFilters.push(`${__('common.search')}: "${searchInput.value.trim()}"`);
        }

        if (statusFilter && statusFilter.value) {
            activeFilters.push(`${__('table.status')}: ${statusFilter.value}`);
        }

        if (typeFilter && typeFilter.value) {
            activeFilters.push(`${__('table.type')}: ${typeFilter.value}`);
        }

        if (priorityFilter && priorityFilter.value) {
            activeFilters.push(`${__('table.priority')}: ${priorityFilter.value}`);
        }

        if (analysisStartDateFilter && analysisStartDateFilter.value) {
            activeFilters.push(`${__('filter.analysisStartDate')}: ${analysisStartDateFilter.value}`);
        }

        if (analysisEndDateFilter && analysisEndDateFilter.value) {
            activeFilters.push(`${__('filter.analysisEndDate')}: ${analysisEndDateFilter.value}`);
        }

        if (archivedStartDateFilter && archivedStartDateFilter.value) {
            activeFilters.push(`${__('filter.archivedStartDate')}: ${archivedStartDateFilter.value}`);
        }

        if (archivedEndDateFilter && archivedEndDateFilter.value) {
            activeFilters.push(`${__('filter.archivedEndDate')}: ${archivedEndDateFilter.value}`);
        }

        if (activeFilters.length > 0) {
            currentFilters.innerHTML = activeFilters.map(filter =>
                `<span class="filter-tag">${filter}</span>`
            ).join('');
        } else {
            currentFilters.innerHTML = `<span class="filter-info">${__('export.usingCurrentFilters')}</span>`;
        }
    }

    async function handleExportSubmit(e) {
        e.preventDefault();

        const password = document.getElementById('exportPassword').value;
        const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatRadio ? formatRadio.value : 'csv';
        const selectedColumns = getSelectedColumns();

        if (!password) {
            showToast(__('export.passwordRequired'), 'error');
            return;
        }

        if (selectedColumns.length === 0) {
            showToast(__('export.selectAtLeastOneColumn'), 'error');
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
        showExportModal();

        // Pre-select the format
        const formatRadio = document.querySelector(`input[name="exportFormat"][value="${format}"]`);
        if(formatRadio) {
            formatRadio.checked = true;
        }

        // Auto-submit the form after a brief delay
        setTimeout(() => {
            const exportForm = document.getElementById('exportForm');
            if(exportForm) {
                // Set a default password prompt
                const passwordInput = document.getElementById('exportPassword');
                if(passwordInput && !passwordInput.value) {
                    passwordInput.focus();
                    showToast(__('export.enterPasswordToContinue'), 'info');
                }
            }
        }, 100);
    }

    async function performExport(format, password, columns) {
        const exportData = {
            filters: getCurrentFilters(),
            format: format,
            password: password,
            columns: columns
        };

        try {
            // For CSV, we need to handle the response differently since it returns plain text
            if (format === 'csv') {
                const response = await fetch(api.buildUrl('/archive/export'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(exportData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP Error: ${response.status}`);
                }

                const csvData = await response.text();
                const dateStr = window.formatDate ? window.formatDate(new Date()).replace(/\/|\.|\s/g, '-') : new Date().toISOString().split('T')[0];
                downloadTextFile(csvData, `archived_analyses_export_${dateStr}.csv`, 'text/csv');
            } else {
                // For JSON and Excel, use the API wrapper
                const data = await api.post('/archive/export', exportData);
                const dateStr = window.formatDate ? window.formatDate(new Date()).replace(/\/|\.|\s/g, '-') : new Date().toISOString().split('T')[0];
                
                if (format === 'json') {
                    downloadJsonFile(data.data, `archived_analyses_export_${dateStr}.json`);
                } else if (format === 'excel') {
                    // For Excel, we need to handle binary data
                    downloadBinaryFile(data.data, `archived_analyses_export_${dateStr}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                }
            }
        } catch (error) {
            console.error('Export request error:', error);
            throw error;
        }
    }

    function getCurrentFilters() {
        const filters = {};

        if (searchInput && searchInput.value.trim()) {
            filters.patientName = searchInput.value.trim();
        }

        if (statusFilter && statusFilter.value) {
            filters.status = statusFilter.value;
        }

        if (typeFilter && typeFilter.value) {
            filters.analysisType = typeFilter.value;
        }

        if (analysisStartDateFilter && analysisStartDateFilter.value) {
            filters.startDate = analysisStartDateFilter.value;
        }

        if (analysisEndDateFilter && analysisEndDateFilter.value) {
            filters.endDate = analysisEndDateFilter.value;
        }

        if (archivedStartDateFilter && archivedStartDateFilter.value) {
            filters.archivedStartDate = archivedStartDateFilter.value;
        }

        if (archivedEndDateFilter && archivedEndDateFilter.value) {
            filters.archivedEndDate = archivedEndDateFilter.value;
        }

        return filters;
    }

    function downloadTextFile(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                    ${__('export.preparing')}
                `;
            } else {
                exportBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 16px;">download</span>
                    ${__('export.exportData')}
                `;
            }
        }
    }

    // API Functions
    async function loadArchivedAnalyses() {
        try {
            showLoading();

            let endpoint = '/archive?';
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

            archivedAnalyses = data.data || [];
            totalArchives = data.pagination?.total || 0;
            totalPages = data.pagination?.totalPages || 1;

            renderTable();
            renderPagination();
            updateRecordCount();

        } catch (error) {
            console.error('Load archived analyses error:', error);
            console.error('Error details:', error.data);
            if (handleAuthError(error)) return;
            showError(getErrorMessage(error));
        }
    }

    async function getArchivedAnalysisById(archiveId) {
        try {
            const data = await api.get(`/archive/${archiveId}`);
            return data.data;
        } catch (error) {
            console.error('Get archived analysis error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }



    async function performCleanup(olderThanDays, reason) {
        try {
            const cleanupData = {
                olderThanDays: parseInt(olderThanDays)
            };

            const data = await api.delete('/archive/cleanup', { data: cleanupData });
            return data;
        } catch (error) {
            console.error('Cleanup error:', error);
            if (handleAuthError(error)) return;
            showToast(getErrorMessage(error), 'error');
            throw error;
        }
    }

    // UI Functions
    function renderTable() {
        if(!tableBody) return;

        if (archivedAnalyses.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--medium-gray);">${__('archive.noArchivedAnalyses')}</td></tr>`;
            return;
        }

        tableBody.innerHTML = '';

        archivedAnalyses.forEach(archive => {
            const row = document.createElement('tr');
            row.dataset.id = archive.id;

            const analysisDate = new Date(archive.analysis_date);
            const archivedDate = new Date(archive.archived_at);
            const now = new Date();
            const daysSinceArchived = Math.floor((now - archivedDate) / (1000 * 60 * 60 * 24));

            const archivedDateClass = daysSinceArchived <= 7 ? 'recent' : (daysSinceArchived > 365 ? 'old' : '');
            const statusClass = getStatusClass(archive.status);
            const typeClass = getTypeClass(archive.analysis_type);

            const patientDisplay = getPatientDisplay(archive);
            const doctorDisplay = getDoctorDisplay(archive);
            const roomDisplay = getRoomDisplay(archive);
            const postponementDisplay = getPostponementDisplay(archive.postponed_count);

            row.innerHTML = `
                <td>
                    <span class="archive-date">
                        ${window.formatDate ? window.formatDate(analysisDate) : analysisDate.toLocaleDateString()}
                    </span>
                </td>
                <td>
                    <span class="archive-date ${archivedDateClass}">
                        ${window.formatDate ? window.formatDate(archivedDate) : archivedDate.toLocaleDateString()}
                    </span>
                </td>
                <td>${patientDisplay}</td>
                <td>${doctorDisplay}</td>
                <td>${roomDisplay}</td>
                <td>
                    <span class="type-badge ${typeClass}">${archive.analysis_type}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${archive.status}</span>
                </td>
                <td>${postponementDisplay}</td>
                <td>
                    <div class="dropdown-container">
                        <button class="action-button" data-id="${archive.id}">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                    </div>
                </td>
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

    function getPriorityClass(priority) {
        const priorityClasses = {
            'Low': 'priority-low',
            'Normal': 'priority-normal',
            'High': 'priority-high',
            'Urgent': 'priority-urgent'
        };
        return priorityClasses[priority] || 'priority-normal';
    }

    function getPatientDisplay(archive) {
        if (!archive.patient_name) {
            return `<span class="patient-none">${__('archive.noPatient')}</span>`;
        }

        let matriculeDisplay = '';
        if (archive.patient && archive.patient.matricule_national) {
            matriculeDisplay = `<span class="patient-id">${archive.patient.matricule_national}</span>`;
        }

        return `
            <div class="patient-info">
                <span class="patient-name">${archive.patient_name}</span>
                ${matriculeDisplay}
            </div>
        `;
    }

    function getDoctorDisplay(archive) {
        if (!archive.doctor_name) {
            return `<span class="doctor-none">${__('archive.noDoctor')}</span>`;
        }

        return `
            <div class="doctor-info">
                <span class="doctor-name">${archive.doctor_name}</span>
            </div>
        `;
    }

    function getRoomDisplay(archive) {
        if (!archive.room_number) {
            return `<span class="room-none">${__('archive.noRoom')}</span>`;
        }

        return `
            <div class="room-info">
                <span class="room-number">${archive.room_number}</span>
            </div>
        `;
    }

    function getPostponementDisplay(count) {
        if (!count || count === 0) {
            return '<span class="postponement-count">0</span>';
        }

        let className = 'postponement-count';
        if (count >= 5) {
            className += ' very-high';
        } else if (count >= 3) {
            className += ' high';
        }

        return `<span class="${className}">${count}</span>`;
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
        const end = Math.min(currentPage * limit, totalArchives);
        recordCount.textContent = `${__('archive.showingRecords')}`
            .replace('{start}', start)
            .replace('{end}', end)
            .replace('{total}', totalArchives);
    }

    async function showArchiveDetailsModal(archiveId) {
        try {
            archiveDetailsModal.classList.add('show');

            // Show loading state
            const archiveDetailsContent = document.getElementById('archiveDetailsContent');
            if(archiveDetailsContent) {
                archiveDetailsContent.innerHTML = `<div class="loading">${__('archive.loadingDetails')}</div>`;
            }

            const archiveData = await getArchivedAnalysisById(archiveId);

            // Render archive details
            renderArchiveDetails(archiveData);

        } catch (error) {
            console.error('Archive details error:', error);
            showToast(__('archive.failedToLoadDetails'), 'error');
        }
    }

    function renderArchiveDetails(archive) {
        const archiveDetailsContent = document.getElementById('archiveDetailsContent');
        if(!archiveDetailsContent) return;

        const analysisDate = new Date(archive.analysis_date);
        const archivedDate = new Date(archive.archived_at);
        const completedDate = archive.completed_at ? new Date(archive.completed_at) : null;

        archiveDetailsContent.innerHTML = `
            <div class="archive-info-section">
                <h3>${__('archive.basicInformation')}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">${__('archive.archiveId')}:</span>
                        <span class="info-value">${archive.id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('archive.originalAnalysisId')}:</span>
                        <span class="info-value">${archive.original_analysis_id || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('table.type')}:</span>
                        <span class="info-value">
                            <span class="type-badge ${getTypeClass(archive.analysis_type)}">${archive.analysis_type}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('table.priority')}:</span>
                        <span class="info-value">
                            <span class="priority-badge ${getPriorityClass(archive.priority)}">${archive.priority || 'Normal'}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('table.status')}:</span>
                        <span class="info-value">
                            <span class="status-badge ${getStatusClass(archive.status)}">${archive.status}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="archive-info-section">
                <h3>${__('archive.patientInformation')}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">${__('table.patient')}:</span>
                        <span class="info-value">${archive.patient_name || 'N/A'}</span>
                    </div>
                    ${archive.patient ? `
                        <div class="info-item">
                            <span class="info-label">${__('patient.matricule')}:</span>
                            <span class="info-value">${archive.patient.matricule_national || 'N/A'}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="archive-info-section">
                <h3>${__('archive.medicalTeam')}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">${__('table.doctor')}:</span>
                        <span class="info-value">${archive.doctor_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('table.room')}:</span>
                        <span class="info-value">${archive.room_number || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="archive-info-section">
                <h3>${__('archive.timeline')}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">${__('table.analysisDate')}:</span>
                        <span class="info-value">${window.formatDateTime ? window.formatDateTime(analysisDate) : analysisDate.toLocaleDateString() + ' ' + analysisDate.toLocaleTimeString()}</span>
                    </div>
                    ${completedDate ? `
                        <div class="info-item">
                            <span class="info-label">${__('analysis.completedDate')}:</span>
                            <span class="info-value">${window.formatDateTime ? window.formatDateTime(completedDate) : completedDate.toLocaleDateString() + ' ' + completedDate.toLocaleTimeString()}</span>
                        </div>
                    ` : ''}
                    <div class="info-item">
                        <span class="info-label">${__('table.archivedDate')}:</span>
                        <span class="info-value">${window.formatDateTime ? window.formatDateTime(archivedDate) : archivedDate.toLocaleDateString() + ' ' + archivedDate.toLocaleTimeString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${__('table.postponements')}:</span>
                        <span class="info-value">${getPostponementDisplay(archive.postponed_count)}</span>
                    </div>
                </div>
            </div>

            <div class="archive-info-section">
                <h3>${__('archive.archiveInformation')}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">${__('archive.archivedBy')}:</span>
                        <span class="info-value">${archive.archivedBy?.username || __('archive.system')}</span>
                    </div>
                    ${archive.creator ? `
                        <div class="info-item">
                            <span class="info-label">${__('archive.createdBy')}:</span>
                            <span class="info-value">${archive.creator.username}</span>
                        </div>
                    ` : ''}
                    ${archive.completedBy ? `
                        <div class="info-item">
                            <span class="info-label">${__('archive.completedBy')}:</span>
                            <span class="info-value">${archive.completedBy.username}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }



    function showCleanupModal() {
        const cleanupForm = document.getElementById('cleanupForm');
        if(cleanupForm) {
            cleanupForm.reset();
        }

        cleanupModal.classList.add('show');

        // Focus on days input
        setTimeout(() => {
            const cleanupDays = document.getElementById('cleanupDays');
            if(cleanupDays) {
                cleanupDays.focus();
            }
        }, 100);
    }

    async function handleCleanup(e) {
        e.preventDefault();

        const cleanupDays = document.getElementById('cleanupDays');
        const cleanupReason = document.getElementById('cleanupReason');

        const days = parseInt(cleanupDays.value);
        const reason = cleanupReason.value.trim();

        // Validation
        if (!days || days < 365) {
            showToast(__('archive.cleanupMinDays'), 'error');
            return;
        }

        if (!reason || reason.length < 20) {
            showToast(__('archive.cleanupDetailedReason'), 'error');
            return;
        }

        // Confirmation
        const confirmed = confirm(__('archive.cleanupConfirmation').replace('{days}', days));
        if (!confirmed) {
            return;
        }

        try {
            const result = await performCleanup(days, reason);
            cleanupModal.classList.remove('show');
            showToast(result.message, 'success');

            // Reload the archives to reflect changes
            loadArchivedAnalyses();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Event Handlers
    function handleActionClick(e) {
        e.stopPropagation();

        if (activeDropdown) {
            closeDropdown();
        }

        const button = e.currentTarget;
        const archiveId = parseInt(button.dataset.id);
        const container = button.closest('.dropdown-container');

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu action-dropdown show';

        dropdown.innerHTML = `
            <div class="dropdown-item" data-action="view-details">
                <span class="material-symbols-outlined">visibility</span>
                ${__('archive.viewDetails')}
            </div>
        `;

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();

                const action = this.dataset.action;

                switch (action) {
                    case 'view-details':
                        showArchiveDetailsModal(archiveId);
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

        archivedAnalyses.sort((a, b) => {
            let aVal, bVal;

            switch (field) {
                case 'analysis_date':
                    aVal = new Date(a.analysis_date);
                    bVal = new Date(b.analysis_date);
                    break;
                case 'archived_at':
                    aVal = new Date(a.archived_at);
                    bVal = new Date(b.archived_at);
                    break;
                case 'patient_name':
                    aVal = a.patient_name || '';
                    bVal = b.patient_name || '';
                    break;
                case 'doctor_name':
                    aVal = a.doctor_name || '';
                    bVal = b.doctor_name || '';
                    break;
                case 'room_number':
                    aVal = a.room_number || '';
                    bVal = b.room_number || '';
                    break;
                case 'analysis_type':
                    aVal = a.analysis_type;
                    bVal = b.analysis_type;
                    break;
                case 'priority':
                    aVal = a.priority || 'Normal';
                    bVal = b.priority || 'Normal';
                    break;
                case 'status':
                    aVal = a.status;
                    bVal = b.status;
                    break;
                case 'postponed_count':
                    aVal = a.postponed_count || 0;
                    bVal = b.postponed_count || 0;
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

    // Utility Functions
    function getErrorMessage(error) {
        if (error.status === 401) {
            return __('status.sessionExpired');
        }

        if (error.status === 403) {
            return __('status.permissionDenied');
        }

        if (error.message.includes('Network error')) {
            return __('status.networkError');
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
                return __('status.badRequest');
            case 404:
                return __('status.notFound');
            case 429:
                return __('status.tooManyRequests');
            case 500:
                return __('status.serverError');
            default:
                return error.message || __('status.unexpectedError');
        }
    }

    function handleAuthError(error) {
        if (error.status === 401) {
            showToast(__('status.sessionExpired'), 'error');
            setTimeout(() => {
                // window.location.href = '/login';
            }, 2000);
            return true;
        }
        return false;
    }

    function showLoading() {
        if(tableBody){
            tableBody.innerHTML = `<tr><td colspan="9" class="loading"><span class="material-symbols-outlined">hourglass_empty</span><br>${__('archive.loadingArchive')}</td></tr>`;
        }
        if(recordCount){
            recordCount.textContent = __('common.loading');
        }
    }

    function showError(message) {
        if(tableBody){
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--dark-red);">${message}</td></tr>`;
        }
        if(recordCount){
            recordCount.textContent = __('status.unexpectedError');
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
            loadArchivedAnalyses();
        }
    };

    // Column selection functions
    function populateColumnSelection() {
        const columnGrid = document.getElementById('columnGrid');
        if (!columnGrid) return;

        const columns = [
            { id: 'analysis_date', label: __('table.analysisDate'), safe: true },
            { id: 'archived_at', label: __('table.archivedDate'), safe: true },
            { id: 'patient_name', label: __('table.patient'), safe: false, sensitive: true },
            { id: 'patient_matricule', label: __('patient.matricule'), safe: false, sensitive: true },
            { id: 'doctor_name', label: __('table.doctor'), safe: true },
            { id: 'room_number', label: __('table.room'), safe: true },
            { id: 'analysis_type', label: __('table.type'), safe: true },
            { id: 'status', label: __('table.status'), safe: true },
            { id: 'postponed_count', label: __('table.postponements'), safe: true },
            { id: 'priority', label: __('table.priority'), safe: true },
            { id: 'completed_at', label: __('analysis.completedDate'), safe: true },
            { id: 'notes', label: __('table.notes'), safe: false }
        ];

        columnGrid.innerHTML = columns.map(col => `
            <div class="column-checkbox ${col.sensitive ? 'sensitive' : ''}">
                <input type="checkbox" id="col_${col.id}" name="columns" value="${col.id}" ${col.safe ? 'checked' : ''}>
                <label for="col_${col.id}">${col.label}</label>
            </div>
        `).join('');

        // Update sensitive warning visibility
        updateSensitiveWarning();

        // Add change listeners
        columnGrid.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateSensitiveWarning);
        });
    }

    function selectAllColumns() {
        document.querySelectorAll('#columnGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        updateSensitiveWarning();
    }

    function selectNoneColumns() {
        document.querySelectorAll('#columnGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateSensitiveWarning();
    }

    function selectSafeColumns() {
        document.querySelectorAll('#columnGrid .column-checkbox').forEach(div => {
            const checkbox = div.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !div.classList.contains('sensitive');
            }
        });
        updateSensitiveWarning();
    }

    function getSelectedColumns() {
        const selected = [];
        document.querySelectorAll('#columnGrid input[type="checkbox"]:checked').forEach(cb => {
            selected.push(cb.value);
        });
        return selected;
    }

    function updateSensitiveWarning() {
        const hasSensitive = Array.from(document.querySelectorAll('#columnGrid .sensitive input[type="checkbox"]:checked')).length > 0;
        const sensitiveWarning = document.getElementById('sensitiveWarning');
        if (sensitiveWarning) {
            sensitiveWarning.style.display = hasSensitive ? 'flex' : 'none';
        }
    }

    function downloadBinaryFile(base64Data, filename, mimeType) {
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

}