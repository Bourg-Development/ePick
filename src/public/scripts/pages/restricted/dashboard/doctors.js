document.addEventListener('DOMContentLoaded', function() {
    // Translation function fallback
    if (typeof __ === 'undefined') {
        window.__ = function(key, ...args) {
            if (window.translations) {
                const keys = key.split('.');
                let value = window.translations;
                for (const k of keys) {
                    value = value[k];
                    if (!value) break;
                }
                
                // If translation found and has arguments, handle placeholder replacement
                if (value && typeof value === 'string' && args.length > 0) {
                    args.forEach((arg, index) => {
                        value = value.replace(`{${index}}`, arg);
                    });
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
            initializePage();
        } else if (attempts < maxAttempts) {
            setTimeout(waitForDateFormatter, 100);
        } else {
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
    // Wait for API to be available
    if (typeof api === 'undefined') {
        console.log('API not yet available, waiting...');
        setTimeout(initializePage, 100);
        return;
    }
    
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Data storage
    let doctorsData = [];
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let currentSort = { field: null, direction: 'asc' };

    // DOM Elements
    const elements = {
        doctorsTableBody: document.getElementById('doctorsTableBody'),
        searchInput: document.getElementById('searchInput'),
        filterSpecialty: document.getElementById('filterSpecialty'),
        filterStatus: document.getElementById('statusFilter'),
        limitInput: document.getElementById('limitInput'),
        createDoctorBtn: document.getElementById('createDoctorBtn'),
        exportDropdownBtn: document.getElementById('exportDropdownBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        pagination: document.getElementById('pagination'),
        
        // Modal elements
        doctorModal: document.getElementById('doctorModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalClose: document.getElementById('modalClose'),
        doctorForm: document.getElementById('doctorForm'),
        doctorId: document.getElementById('doctorId'),
        doctorName: document.getElementById('doctorName'),
        specialization: document.getElementById('specialization'),
        status: document.getElementById('status'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        cancelBtn: document.getElementById('cancelBtn'),
        submitBtn: document.getElementById('submitBtn'),
        
        // Delete modal elements
        deleteModal: document.getElementById('deleteModal'),
        deleteModalClose: document.getElementById('deleteModalClose'),
        deleteMessage: document.getElementById('deleteMessage'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        
        // Export modal elements
        exportModal: document.getElementById('exportModal'),
        exportModalClose: document.getElementById('exportModalClose'),
        exportForm: document.getElementById('exportForm'),
        cancelExportBtn: document.getElementById('cancelExportBtn'),
        startExportBtn: document.getElementById('startExportBtn')
    };

    let doctorToDelete = null;

    // Initialize page
    function init() {
        setupEventListeners();
        loadData();
    }

    // Load data from API
    async function loadData() {
        try {
            await loadDoctors();
            populateDropdowns();
            renderDoctorsTable();
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification(__('dashboard.doctors.failedLoadData'), 'error');
        }
    }

    // Load doctors from API
    async function loadDoctors() {
        try {
            showLoading(true);
            
            // Build query parameters
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: elements.limitInput?.value || '20'
            });
            
            // Add filters
            if (currentFilters.search) params.append('search', currentFilters.search);
            if (currentFilters.specialty) params.append('specialization', currentFilters.specialty);
            if (currentFilters.status) params.append('active', currentFilters.status === 'active' ? 'true' : 'false');
            
            // Add sorting
            if (currentSort.field) {
                params.append('sortBy', currentSort.field);
                params.append('sortOrder', currentSort.direction);
            }
            
            const result = await api.get(`/doctors?${params}`);
            if (result.success) {
                doctorsData = result.data || [];
                if (result.pagination) {
                    totalPages = result.pagination.totalPages || 1;
                    currentPage = result.pagination.currentPage || 1;
                    updatePagination(result.pagination);
                }
                renderDoctorsTable();
            } else {
                throw new Error(result.message || __('dashboard.doctors.failedLoadDoctors'));
            }
        } catch (error) {
            console.error('Error loading doctors:', error);
            showNotification(__('dashboard.doctors.failedLoadDoctors'), 'error');
        } finally {
            showLoading(false);
        }
    }


    // Populate dropdown filters
    function populateDropdowns() {
        // Populate specialty filter with unique values from doctors
        if (elements.filterSpecialty) {
            const specialties = [...new Set(doctorsData.map(doctor => doctor.specialization).filter(Boolean))];
            elements.filterSpecialty.innerHTML = '<option value="">' + __('filters.allSpecialties') + '</option>';
            specialties.forEach(specialty => {
                const option = document.createElement('option');
                option.value = specialty;
                option.textContent = specialty;
                elements.filterSpecialty.appendChild(option);
            });
        }
    }

    // Render doctors table
    function renderDoctorsTable() {
        if (!elements.doctorsTableBody) return;

        elements.doctorsTableBody.innerHTML = '';

        if (doctorsData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" class="text-center">${__('dashboard.doctors.noDoctorsFound')}</td>`;
            elements.doctorsTableBody.appendChild(row);
            return;
        }

        doctorsData.forEach(doctor => {
            const row = document.createElement('tr');
            
            // Fix status display - use active boolean field from database
            const isActive = doctor.active === true || doctor.active === 'true' || doctor.active === 1;
            const statusClass = isActive ? 'active' : 'inactive';
            const statusText = isActive ? __('common.active') : __('common.inactive');

            row.innerHTML = `
                <td>
                    <div class="doctor-info">
                        <div class="doctor-name">${escapeHtml(doctor.name || '')}</div>
                    </div>
                </td>
                <td>${escapeHtml(doctor.specialization || '')}</td>
                <td>${escapeHtml(doctor.email || '')}</td>
                <td>${escapeHtml(doctor.phone || '')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions">
                    ${window.userPermissions && window.userPermissions.includes('doctors.update') ? 
                        `<button class="action-btn edit edit-btn" data-id="${doctor.id}" title="${__('buttons.edit')}">
                            <span class="material-symbols-outlined">edit</span>
                        </button>` : ''
                    }
                    ${window.userPermissions && window.userPermissions.includes('doctors.delete') ? 
                        `<button class="action-btn delete delete-btn" data-id="${doctor.id}" title="${__('buttons.delete')}">
                            <span class="material-symbols-outlined">delete</span>
                        </button>` : ''
                    }
                </td>
            `;
            
            elements.doctorsTableBody.appendChild(row);
        });

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const doctorId = parseInt(e.currentTarget.dataset.id);
                openEditModal(doctorId);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const doctorId = parseInt(e.currentTarget.dataset.id);
                openDeleteModal(doctorId);
            });
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search input
        if (elements.searchInput) {
            let searchTimeout;
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentFilters.search = e.target.value;
                    currentPage = 1;
                    loadDoctors();
                }, 500);
            });
        }

        // Filter dropdowns
        if (elements.filterSpecialty) {
            elements.filterSpecialty.addEventListener('change', (e) => {
                currentFilters.specialty = e.target.value;
                currentPage = 1;
                loadDoctors();
            });
        }
        
        if (elements.filterStatus) {
            elements.filterStatus.addEventListener('change', (e) => {
                currentFilters.status = e.target.value;
                currentPage = 1;
                loadDoctors();
            });
        }

        // Limit input
        if (elements.limitInput) {
            elements.limitInput.addEventListener('change', () => {
                currentPage = 1;
                loadDoctors();
            });
        }

        // Create doctor button
        if (elements.createDoctorBtn) {
            elements.createDoctorBtn.addEventListener('click', openCreateModal);
        }

        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => {
                currentFilters = {};
                currentPage = 1;
                if (elements.searchInput) elements.searchInput.value = '';
                if (elements.filterSpecialty) elements.filterSpecialty.value = '';
                if (elements.filterStatus) elements.filterStatus.value = '';
                loadData();
            });
        }

        // Modal event listeners
        setupModalEventListeners();
        
        // Export functionality
        setupExportEventListeners();

        // Table sorting
        setupTableSorting();
        
        // Pagination event listeners
        setupPaginationEventListeners();
    }

    // Setup modal event listeners
    function setupModalEventListeners() {
        // Close modal buttons
        [elements.modalClose, elements.cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', closeModal);
            }
        });

        // Delete modal close buttons
        [elements.deleteModalClose, elements.cancelDeleteBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', closeDeleteModal);
            }
        });

        // Export modal close buttons
        [elements.exportModalClose, elements.cancelExportBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', closeExportModal);
            }
        });

        // Form submission
        if (elements.doctorForm) {
            elements.doctorForm.addEventListener('submit', handleFormSubmit);
        }

        // Delete confirmation
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', handleDelete);
        }

        // Close modals when clicking outside
        [elements.doctorModal, elements.deleteModal, elements.exportModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        if (modal === elements.doctorModal) closeModal();
                        else if (modal === elements.deleteModal) closeDeleteModal();
                        else if (modal === elements.exportModal) closeExportModal();
                    }
                });
            }
        });
    }

    // Setup export event listeners
    function setupExportEventListeners() {
        if (elements.exportDropdownBtn) {
            elements.exportDropdownBtn.addEventListener('click', () => {
                const dropdown = document.getElementById('exportDropdown');
                if (dropdown) {
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        // Export dropdown items
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="export-advanced"]')) {
                document.getElementById('exportDropdown').style.display = 'none';
                openExportModal();
            } else if (e.target.closest('[data-action="export-quick-csv"]')) {
                document.getElementById('exportDropdown').style.display = 'none';
                quickExport('csv');
            } else if (e.target.closest('[data-action="export-quick-excel"]')) {
                document.getElementById('exportDropdown').style.display = 'none';
                quickExport('excel');
            } else if (!e.target.closest('.export-dropdown-container')) {
                const dropdown = document.getElementById('exportDropdown');
                if (dropdown) dropdown.style.display = 'none';
            }
        });

        if (elements.exportForm) {
            elements.exportForm.addEventListener('submit', handleExport);
        }
    }

    // Setup table sorting
    function setupTableSorting() {
        const headers = document.querySelectorAll('#doctorsTable th[data-sort]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                if (currentSort.field === field) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = field;
                    currentSort.direction = 'asc';
                }
                
                // Update header indicators
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                header.classList.add(`sort-${currentSort.direction}`);
                
                loadDoctors();
            });
        });
    }

    // Setup pagination event listeners
    function setupPaginationEventListeners() {
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadDoctors();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    loadDoctors();
                }
            });
        }
    }

    // Modal functions
    function openCreateModal() {
        resetForm();
        elements.modalTitle.textContent = __('dashboard.doctors.createDoctor');
        elements.submitBtn.textContent = __('buttons.create');
        elements.doctorModal.style.display = 'flex';
    }

    function openEditModal(doctorId) {
        const doctor = doctorsData.find(d => d.id === doctorId);
        if (!doctor) return;

        resetForm();
        elements.modalTitle.textContent = __('dashboard.doctors.editDoctor');
        elements.submitBtn.textContent = __('buttons.update');
        
        // Populate form
        elements.doctorId.value = doctor.id;
        elements.doctorName.value = doctor.name || '';
        
        elements.specialization.value = doctor.specialization || '';
        elements.status.value = doctor.active ? 'true' : 'false';
        elements.email.value = doctor.email || '';
        elements.phone.value = doctor.phone || '';
        
        elements.doctorModal.style.display = 'flex';
    }

    function openDeleteModal(doctorId) {
        const doctor = doctorsData.find(d => d.id === doctorId);
        if (!doctor) return;

        doctorToDelete = doctorId;
        elements.deleteMessage.textContent = __('dialogs.deleteDoctorConfirm') + `: ${doctor.name}?`;
        elements.deleteModal.style.display = 'flex';
    }

    function openExportModal() {
        elements.exportModal.style.display = 'flex';
    }

    function closeModal() {
        elements.doctorModal.style.display = 'none';
        resetForm();
    }

    function closeDeleteModal() {
        elements.deleteModal.style.display = 'none';
        doctorToDelete = null;
    }

    function closeExportModal() {
        elements.exportModal.style.display = 'none';
    }

    function resetForm() {
        elements.doctorForm.reset();
        elements.doctorId.value = '';
    }

    // Form submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const doctorData = {
            name: formData.get('name') || '',
            specialization: formData.get('specialization') || null,
            active: formData.get('status') === 'true',
            email: formData.get('email') || null,
            phone: formData.get('phone') || null
        };

        try {
            showLoading(true);
            const doctorId = elements.doctorId.value;
            let result;

            if (doctorId) {
                // Update existing doctor
                result = await api.put(`/doctors/${doctorId}`, doctorData);
            } else {
                // Create new doctor
                result = await api.post('/doctors', doctorData);
            }

            if (result.success) {
                showNotification(__('dashboard.doctors.saveSuccess'), 'success');
                closeModal();
                loadDoctors();
            } else {
                showNotification(result.message || __('dashboard.doctors.saveError'), 'error');
            }
        } catch (error) {
            console.error('Error saving doctor:', error);
            showNotification(__('dashboard.doctors.saveError'), 'error');
        } finally {
            showLoading(false);
        }
    }

    // Delete doctor
    async function handleDelete() {
        if (!doctorToDelete) return;

        try {
            showLoading(true);
            const result = await api.delete(`/doctors/${doctorToDelete}`);

            if (result.success) {
                showNotification(__('dashboard.doctors.deleteSuccess'), 'success');
                closeDeleteModal();
                loadDoctors();
            } else {
                showNotification(result.message || __('dashboard.doctors.deleteError'), 'error');
            }
        } catch (error) {
            console.error('Error deleting doctor:', error);
            showNotification(__('dashboard.doctors.deleteError'), 'error');
        } finally {
            showLoading(false);
        }
    }

    // Export functions
    async function quickExport(format) {
        try {
            showLoading(true);
            const params = new URLSearchParams({
                format,
                limit: '100',
                ...currentFilters
            });

            const response = await fetch(api.buildUrl(`/api/admin/doctors/export?${params}`), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${api.getToken()}`,
                    'X-CSRF-Token': api.getCsrfToken()
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `doctors-export.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showNotification(__('export.success'), 'success');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showNotification(__('export.error'), 'error');
        } finally {
            showLoading(false);
        }
    }

    async function handleExport(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const exportData = {
            format: formData.get('format'),
            columns: formData.getAll('columns'),
            limit: formData.get('limit'),
            ...currentFilters
        };

        try {
            showLoading(true);
            const params = new URLSearchParams(exportData);

            const response = await fetch(api.buildUrl(`/api/admin/doctors/export?${params}`), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${api.getToken()}`,
                    'X-CSRF-Token': api.getCsrfToken()
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `doctors-export.${exportData.format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showNotification(__('export.success'), 'success');
                closeExportModal();
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showNotification(__('export.error'), 'error');
        } finally {
            showLoading(false);
        }
    }

    // Update pagination
    function updatePagination(pagination) {
        // Update pagination info
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo && pagination) {
            paginationInfo.textContent = __('pagination.pageInfo')
                .replace('{current}', currentPage)
                .replace('{total}', totalPages)
                .replace('{count}', pagination.total || 0);
        }

        // Update current page info
        const currentPageInfo = document.getElementById('currentPageInfo');
        if (currentPageInfo) {
            currentPageInfo.textContent = `${__('pagination.page')} ${currentPage} ${__('pagination.of')} ${totalPages}`;
        }

        // Update prev/next buttons
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage === totalPages;
        }
    }

    // Utility functions
    function showLoading(show) {
        const table = document.getElementById('doctorsTableBody');
        if (show && table) {
            table.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading doctors...</td></tr>';
        } else if (!show && table) {
            // Clear loading message - the table will be populated by renderDoctorsTable
            // Only clear if it still contains the loading message
            if (table.innerHTML.includes('Loading doctors...')) {
                table.innerHTML = '';
            }
        }
    }

    function showNotification(message, type = 'info') {
        // Use the global notification system
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize the page
    init();
}