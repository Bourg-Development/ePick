document.addEventListener('DOMContentLoaded', function() {
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
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Data storage
    let servicesData = [];
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};

    // DOM Elements
    const elements = {
        totalServices: document.getElementById('totalServices'),
        activeServices: document.getElementById('activeServices'),
        totalUsers: document.getElementById('totalUsers'),
        totalRooms: document.getElementById('totalRooms'),
        servicesTableBody: document.getElementById('servicesTableBody'),
        paginationInfo: document.getElementById('paginationInfo'),
        searchInput: document.getElementById('searchInput'),
        filterStatus: document.getElementById('statusFilter'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        createServiceBtn: document.getElementById('createServiceBtn'),
        exportServicesBtn: document.getElementById('exportDropdownBtn')
    };

    // Initialize page
    function init() {
        setupEventListeners();
        loadData();
    }

    // Load data from API
    async function loadData() {
        try {
            await loadServices();
            renderServicesTable();
            updateStats();
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load data', 'error');
        }
    }

    // Load services from API
    async function loadServices() {
        try {
            const result = await api.get('/admin/services');
            if (result.success) {
                servicesData = result.data || [];
                if (result.pagination) {
                    totalPages = result.pagination.totalPages || 1;
                    currentPage = result.pagination.currentPage || 1;
                }
            } else {
                throw new Error(result.message || 'Failed to load services');
            }
        } catch (error) {
            console.error('Error loading services:', error);
            showNotification('Failed to load services', 'error');
        }
    }

    // Render services table
    function renderServicesTable() {
        if (!elements.servicesTableBody) return;

        elements.servicesTableBody.innerHTML = servicesData.map(service => {
            return `
                <tr data-service-id="${service.id}">
                    <td>
                        <strong>${service.name}</strong>
                    </td>
                    <td>
                        <a href="mailto:${service.email}" class="text-link">${service.email}</a>
                    </td>
                    <td>
                        <span class="metric-badge">${service.roomCount || 0}</span>
                    </td>
                    <td>
                        <span class="metric-badge">${service.userCount || 0}</span>
                    </td>
                    <td>
                        <span class="status-badge ${service.active ? 'active' : 'inactive'}">
                            ${service.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn view" onclick="viewService(${service.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="action-btn edit" onclick="editService(${service.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deleteService(${service.id})" title="Delete">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update statistics
    function updateStats() {
        const total = servicesData.length;
        const active = servicesData.filter(service => service.active).length;
        const users = servicesData.reduce((sum, service) => sum + (service.userCount || 0), 0);
        const rooms = servicesData.reduce((sum, service) => sum + (service.roomCount || 0), 0);
        
        if (elements.totalServices) elements.totalServices.textContent = total;
        if (elements.activeServices) elements.activeServices.textContent = active;
        if (elements.totalUsers) elements.totalUsers.textContent = users;
        if (elements.totalRooms) elements.totalRooms.textContent = rooms;
    }

    // Setup event listeners
    function setupEventListeners() {
        if (elements.clearFiltersBtn) {
            elements.clearFiltersBtn.addEventListener('click', clearFilters);
        }

        if (elements.createServiceBtn) {
            elements.createServiceBtn.addEventListener('click', showCreateServiceModal);
        }

        if (elements.exportServicesBtn) {
            elements.exportServicesBtn.addEventListener('click', toggleExportDropdown);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        if (elements.filterStatus) {
            elements.filterStatus.addEventListener('change', handleFilter);
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadData();
                showNotification('Data refreshed', 'success');
            });
        }

        // Export dropdown actions
        const exportDropdown = document.getElementById('exportDropdown');
        if (exportDropdown) {
            exportDropdown.addEventListener('click', handleExportAction);
        }

        // Close export dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown-container')) {
                closeExportDropdown();
            }
        });

        // Modal event listeners
        const serviceModal = document.getElementById('serviceModal');
        const exportModal = document.getElementById('exportModal');
        
        // Service modal events
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const serviceForm = document.getElementById('serviceForm');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => serviceModal.style.display = 'none');
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => serviceModal.style.display = 'none');
        if (serviceForm) serviceForm.addEventListener('submit', handleServiceSubmit);
        
        // Export modal events
        const closeExportModalBtn = document.getElementById('closeExportModalBtn');
        const cancelExportBtn = document.getElementById('cancelExportBtn');
        const exportForm = document.getElementById('exportForm');
        const selectAllBtn = document.getElementById('selectAllColumnsBtn');
        const selectNoneBtn = document.getElementById('selectNoneColumnsBtn');
        const selectSafeBtn = document.getElementById('selectSafeColumnsBtn');
        
        if (closeExportModalBtn) closeExportModalBtn.addEventListener('click', () => exportModal.classList.remove('show'));
        if (cancelExportBtn) cancelExportBtn.addEventListener('click', () => exportModal.classList.remove('show'));
        if (exportForm) exportForm.addEventListener('submit', handleExportSubmit);
        if (selectAllBtn) selectAllBtn.addEventListener('click', () => selectAllExportColumns(true));
        if (selectNoneBtn) selectNoneBtn.addEventListener('click', () => selectAllExportColumns(false));
        if (selectSafeBtn) selectSafeBtn.addEventListener('click', selectSafeColumns);
        
        // Close modals when clicking outside
        if (serviceModal) {
            serviceModal.addEventListener('click', (e) => {
                if (e.target === serviceModal) serviceModal.style.display = 'none';
            });
        }
        if (exportModal) {
            exportModal.addEventListener('click', (e) => {
                if (e.target === exportModal) exportModal.classList.remove('show');
            });
        }
    }

    // Handle search
    function handleSearch() {
        const searchTerm = elements.searchInput.value.trim();
        currentFilters.search = searchTerm;
        applyFilters();
    }

    // Handle filter
    function handleFilter() {
        currentFilters.status = elements.filterStatus.value;
        applyFilters();
    }

    // Apply filters
    function applyFilters() {
        let filteredData = [...servicesData];

        // Search filter
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            filteredData = filteredData.filter(service => 
                service.name.toLowerCase().includes(searchLower) ||
                (service.email && service.email.toLowerCase().includes(searchLower))
            );
        }

        // Status filter
        if (currentFilters.status) {
            const isActive = currentFilters.status === 'active';
            filteredData = filteredData.filter(service => service.active === isActive);
        }

        renderFilteredTable(filteredData);
        updateFilteredStats(filteredData);
        updatePaginationInfo(filteredData.length);
    }

    // Render filtered table
    function renderFilteredTable(data) {
        if (!elements.servicesTableBody) return;

        elements.servicesTableBody.innerHTML = data.map(service => {
            return `
                <tr data-service-id="${service.id}">
                    <td>
                        <strong>${service.name}</strong>
                    </td>
                    <td>
                        <a href="mailto:${service.email}" class="text-link">${service.email}</a>
                    </td>
                    <td>
                        <span class="metric-badge">${service.roomCount || 0}</span>
                    </td>
                    <td>
                        <span class="metric-badge">${service.userCount || 0}</span>
                    </td>
                    <td>
                        <span class="status-badge ${service.active ? 'active' : 'inactive'}">
                            ${service.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn view" onclick="viewService(${service.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="action-btn edit" onclick="editService(${service.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deleteService(${service.id})" title="Delete">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update filtered stats
    function updateFilteredStats(data) {
        const total = data.length;
        const active = data.filter(service => service.active).length;
        const users = data.reduce((sum, service) => sum + (service.userCount || 0), 0);
        const rooms = data.reduce((sum, service) => sum + (service.roomCount || 0), 0);
        
        if (elements.totalServices) elements.totalServices.textContent = total;
        if (elements.activeServices) elements.activeServices.textContent = active;
        if (elements.totalUsers) elements.totalUsers.textContent = users;
        if (elements.totalRooms) elements.totalRooms.textContent = rooms;
    }

    // Clear filters
    function clearFilters() {
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.filterStatus) elements.filterStatus.value = '';
        currentFilters = {};
        renderServicesTable();
        updateStats();
        updatePaginationInfo();
        showNotification('Filters cleared', 'success');
    }

    // Service management functions
    window.viewService = async function(serviceId) {
        const service = servicesData.find(s => s.id === serviceId);
        if (service) {
            showServiceDetailsModal(service);
        }
    };

    window.editService = function(serviceId) {
        const service = servicesData.find(s => s.id === serviceId);
        if (service) {
            showServiceModal(service);
        }
    };

    window.deleteService = async function(serviceId) {
        if (!confirm('Are you sure you want to delete this service?')) return;
        
        try {
            const result = await api.delete(`/admin/service/${serviceId}`);
            if (result.success) {
                showNotification('Service deleted successfully', 'success');
                await loadServices();
                renderServicesTable();
                updateStats();
            } else {
                showNotification(result.message || 'Failed to delete service', 'error');
            }
        } catch (error) {
            console.error('Error deleting service:', error);
            console.error('Error details:', error.data);
            showNotification(error.data?.message || 'Failed to delete service', 'error');
        }
    };

    // Show create service modal
    function showCreateServiceModal() {
        showServiceModal();
    }

    // Show service modal (create or edit)
    function showServiceModal(service = null) {
        const modal = document.getElementById('serviceModal');
        const title = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitBtnText');
        const form = document.getElementById('serviceForm');
        
        if (!modal) return;
        
        const isEdit = !!service;
        
        // Set modal title and button text
        if (title) title.textContent = isEdit ? 'Edit Service' : 'Create Service';
        if (submitBtn) submitBtn.textContent = isEdit ? 'Update Service' : 'Create Service';
        
        // Set form data attribute for edit mode
        if (form) {
            if (isEdit) {
                form.dataset.serviceId = service.id;
            } else {
                delete form.dataset.serviceId;
            }
        }
        
        // Populate form if editing
        if (isEdit && service) {
            const nameInput = document.getElementById('serviceName');
            const emailInput = document.getElementById('serviceEmail');
            const activeInput = document.getElementById('serviceActive');
            const descriptionInput = document.getElementById('serviceDescription');
            const canViewAllInput = document.getElementById('canViewAllAnalyses');
            
            if (nameInput) nameInput.value = service.name || '';
            if (emailInput) emailInput.value = service.email || '';
            if (activeInput) activeInput.checked = service.active || false;
            if (descriptionInput) descriptionInput.value = service.description || '';
            if (canViewAllInput) canViewAllInput.checked = service.can_view_all_analyses || false;
        } else {
            // Clear form for new service
            if (form) form.reset();
        }
        
        // Show modal
        modal.style.display = 'flex';
    }

    // Show service details modal
    function showServiceDetailsModal(service) {
        const modal = document.getElementById('serviceDetailsModal');
        if (!modal) {
            // Create and show details in a simple alert for now
            const details = `Service Details:\n\nName: ${service.name}\nEmail: ${service.email}\nRooms: ${service.roomCount || 0}\nUsers: ${service.userCount || 0}\nStatus: ${service.active ? 'Active' : 'Inactive'}`;
            alert(details);
            return;
        }
        
        // If modal exists, populate and show it
        const nameElement = modal.querySelector('.service-name');
        const emailElement = modal.querySelector('.service-email');
        const roomsElement = modal.querySelector('.service-rooms');
        const usersElement = modal.querySelector('.service-users');
        const statusElement = modal.querySelector('.service-status');
        
        if (nameElement) nameElement.textContent = service.name;
        if (emailElement) emailElement.textContent = service.email;
        if (roomsElement) roomsElement.textContent = service.roomCount || 0;
        if (usersElement) usersElement.textContent = service.userCount || 0;
        if (statusElement) statusElement.textContent = service.active ? 'Active' : 'Inactive';
        
        modal.style.display = 'flex';
    }

    // Toggle export dropdown
    function toggleExportDropdown(e) {
        e?.preventDefault();
        e?.stopPropagation();
        
        const exportDropdown = document.getElementById('exportDropdown');
        const exportContainer = document.querySelector('.export-dropdown-container');
        
        if (exportDropdown) {
            const isVisible = exportDropdown.classList.contains('show');
            
            // Close all other dropdowns first
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== exportDropdown) {
                    menu.classList.remove('show');
                }
            });
            
            // Toggle this dropdown
            exportDropdown.classList.toggle('show', !isVisible);
            
            // Also toggle container class for arrow animation
            if (exportContainer) {
                exportContainer.classList.toggle('show', !isVisible);
            }
        }
    }

    // Close export dropdown
    function closeExportDropdown() {
        const exportDropdown = document.getElementById('exportDropdown');
        const exportContainer = document.querySelector('.export-dropdown-container');
        
        if (exportDropdown) {
            exportDropdown.classList.remove('show');
        }
        if (exportContainer) {
            exportContainer.classList.remove('show');
        }
    }

    // Handle export actions
    function handleExportAction(e) {
        const action = e.target.closest('.dropdown-item')?.dataset.action;
        if (!action) return;

        closeExportDropdown();

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

    // Show export modal
    function showExportModal() {
        const modal = document.getElementById('exportModal');
        if (!modal) return;
        
        // Clear previous selections
        document.getElementById('exportForm')?.reset();
        
        // Populate column selections
        populateExportColumns();
        
        // Show current filters
        showCurrentFilters();
        
        // Reset progress
        const progressDiv = document.getElementById('exportProgress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
        
        // Show modal
        modal.classList.add('show');
    }

    // Perform quick export (opens modal with format pre-selected)
    async function performQuickExport(format) {
        // For quick export, just open the export modal with the format pre-selected
        showExportModal();

        // Pre-select the format
        const formatRadio = document.querySelector(`input[name="exportFormat"][value="${format}"]`);
        if(formatRadio) {
            formatRadio.checked = true;
        }

        // Select all columns by default for quick export
        selectAllExportColumns(true);

        showNotification(`Quick ${format.toUpperCase()} export - please enter your password`, 'info');
    }

    // Update pagination info
    function updatePaginationInfo(filteredCount = null) {
        if (elements.paginationInfo) {
            const count = filteredCount !== null ? filteredCount : servicesData.length;
            const total = servicesData.length;
            if (filteredCount !== null && filteredCount !== total) {
                elements.paginationInfo.textContent = `Showing ${count} of ${total} services (filtered)`;
            } else {
                elements.paginationInfo.textContent = `Showing 1-${count} of ${count} services`;
            }
        }
    }

    // Utility functions
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="material-symbols-outlined">
                ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
            </span>
            ${message}
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Handle service form submission
    async function handleServiceSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const serviceData = {
            name: formData.get('serviceName'),
            email: formData.get('serviceEmail'),
            active: formData.get('serviceActive') === 'on',
            description: formData.get('serviceDescription'),
            canViewAllAnalyses: formData.get('canViewAllAnalyses') === 'on'
        };
        
        const isEdit = e.target.dataset.serviceId;
        
        try {
            let result;
            if (isEdit) {
                result = await api.put(`/admin/service/${isEdit}`, serviceData);
            } else {
                result = await api.post('/admin/service', serviceData);
            }
            
            if (result.success) {
                showNotification(isEdit ? 'Service updated successfully' : 'Service created successfully', 'success');
                document.getElementById('serviceModal').style.display = 'none';
                await loadServices();
                renderServicesTable();
                updateStats();
            } else {
                showNotification(result.message || `Failed to ${isEdit ? 'update' : 'create'} service`, 'error');
            }
        } catch (error) {
            console.error('Error submitting service:', error);
            showNotification(`Failed to ${isEdit ? 'update' : 'create'} service`, 'error');
        }
    }

    // Handle export form submission
    // Handle export form submission
    async function handleExportSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const format = formData.get('exportFormat') || 'csv';
        const password = formData.get('exportPassword');
        
        // Get selected columns
        const selectedColumns = [];
        document.querySelectorAll('input[name="exportColumns"]:checked').forEach(checkbox => {
            selectedColumns.push(checkbox.value);
        });
        
        // Show progress
        const progressDiv = document.getElementById('exportProgress');
        const progressText = document.querySelector('.progress-text');
        const progressFill = document.querySelector('.progress-fill');
        const exportBtn = document.getElementById('executeExportBtn');
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
            progressText.textContent = 'Preparing export...';
            progressFill.style.width = '0%';
        }
        if (exportBtn) exportBtn.disabled = true;
        
        try {
            // Update progress
            setTimeout(() => {
                if (progressFill) progressFill.style.width = '30%';
                if (progressText) progressText.textContent = 'Validating password...';
            }, 100);
            
            let endpoint = '/admin/services/export';
            
            // Use professional Excel export for Excel format
            if (format === 'excel') {
                endpoint = '/admin/services/export/excel';
                
                // Update progress
                setTimeout(() => {
                    if (progressFill) progressFill.style.width = '60%';
                    if (progressText) progressText.textContent = 'Generating Excel file...';
                }, 500);
                
                // For Excel, download the file directly
                const response = await fetch('/api' + endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        password: password,
                        filters: {},
                        includeColumns: selectedColumns.length > 0 ? selectedColumns : null
                    })
                });

                if (response.ok) {
                    // Update progress
                    if (progressFill) progressFill.style.width = '90%';
                    if (progressText) progressText.textContent = 'Downloading file...';
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ePick-Services-Export-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    // Complete
                    if (progressFill) progressFill.style.width = '100%';
                    if (progressText) progressText.textContent = 'Export completed!';
                    
                    showNotification('Services exported successfully (Excel)', 'success');
                    
                    // Close modal after delay
                    setTimeout(() => {
                        document.getElementById('exportModal').classList.remove('show');
                        e.target.reset();
                    }, 1000);
                } else {
                    const errorData = await response.json();
                    showNotification(errorData.message || 'Export failed', 'error');
                }
            } else {
                // For CSV/JSON, use the original API
                const exportData = {
                    format: format,
                    password: password,
                    includeColumns: selectedColumns.length > 0 ? selectedColumns : null,
                    filters: {}
                };
                
                // Update progress
                setTimeout(() => {
                    if (progressFill) progressFill.style.width = '60%';
                    if (progressText) progressText.textContent = `Generating ${format.toUpperCase()} file...`;
                }, 500);
                
                const result = await api.post(endpoint, exportData);
                
                if (result.success) {
                    // Update progress
                    if (progressFill) progressFill.style.width = '100%';
                    if (progressText) progressText.textContent = 'Export completed!';
                    
                    // Download the file
                    if (result.data && result.filename) {
                        const mimeType = result.format === 'json' ? 'application/json' : 'text/csv';
                        const blob = new Blob([result.data], { type: mimeType });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = result.filename;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }
                    
                    showNotification('Services exported successfully', 'success');
                    
                    // Close modal after delay
                    setTimeout(() => {
                        document.getElementById('exportModal').classList.remove('show');
                        e.target.reset();
                    }, 1000);
                } else {
                    showNotification(result.message || 'Export failed', 'error');
                }
            }
        } catch (error) {
            console.error('Error exporting services:', error);
            showNotification('Export failed', 'error');
        } finally {
            // Reset button and hide progress after delay
            setTimeout(() => {
                if (exportBtn) exportBtn.disabled = false;
                if (progressDiv) progressDiv.style.display = 'none';
            }, 2000);
        }
    }

    // Populate export columns
    function populateExportColumns() {
        const columnGrid = document.getElementById('columnGrid');
        if (!columnGrid) return;
        
        columnGrid.innerHTML = '';
        
        // Service export columns with sensitive flag
        const exportColumns = {
            id: { name: 'Service ID', description: 'Service internal ID', sensitive: true },
            name: { name: 'Service Name', description: 'Service department name', sensitive: false },
            email: { name: 'Email Address', description: 'Service contact email', sensitive: true },
            description: { name: 'Description', description: 'Service description details', sensitive: false },
            active: { name: 'Status', description: 'Service active status', sensitive: false },
            canViewAllAnalyses: { name: 'View All Analyses', description: 'Permission to view all analyses', sensitive: true },
            userCount: { name: 'Number of Users', description: 'Total users in service', sensitive: false },
            roomCount: { name: 'Number of Rooms', description: 'Total rooms assigned', sensitive: false },
            createdAt: { name: 'Created Date', description: 'Service creation date', sensitive: false },
            updatedAt: { name: 'Last Modified', description: 'Last update timestamp', sensitive: false }
        };
        
        Object.entries(exportColumns).forEach(([key, column]) => {
            const option = document.createElement('div');
            option.className = `column-option${column.sensitive ? ' sensitive' : ''}`;

            option.innerHTML = `
                <input type="checkbox" class="column-checkbox" name="exportColumns" value="${key}" id="col_${key}" checked>
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
    
    // Select/deselect all export columns
    function selectAllExportColumns(select) {
        document.querySelectorAll('input[name="exportColumns"]').forEach(checkbox => {
            checkbox.checked = select;
        });
    }
    
    // Select only safe columns (non-sensitive data)
    function selectSafeColumns() {
        document.querySelectorAll('input[name="exportColumns"]').forEach(checkbox => {
            // For services, safe columns are: id, name, active, userCount, roomCount, createdAt
            const safeColumns = ['id', 'name', 'active', 'userCount', 'roomCount', 'createdAt'];
            checkbox.checked = safeColumns.includes(checkbox.value);
        });
    }
    
    // Show current filters in export modal
    function showCurrentFilters() {
        const container = document.getElementById('currentFilters');
        if (!container) return;
        
        const filters = [];
        
        // Add any active filters here based on service filtering logic
        // For now, just show no filters message
        
        if (filters.length > 0) {
            container.innerHTML = filters.map(f => `<span class="filter-tag">${f}</span>`).join('');
        } else {
            container.innerHTML = '<span class="filter-info">No filters applied - all services will be exported</span>';
        }
    }

    // Initialize the page
    init();
    updatePaginationInfo();
}