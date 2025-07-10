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

    // Data storage
    let roomsData = [];
    let servicesData = [];
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};

    // Export columns configuration
    const exportColumns = {
        id: {
            label: 'Room ID',
            visible: true,
            category: 'basic'
        },
        roomNumber: {
            label: 'Room Number',
            visible: true,
            category: 'basic'
        },
        capacity: {
            label: 'Capacity',
            visible: true,
            category: 'basic'
        },
        serviceName: {
            label: 'Service Name',
            visible: true,
            category: 'basic'
        },
        floor: {
            label: 'Floor',
            visible: true,
            category: 'location'
        },
        department: {
            label: 'Department',
            visible: true,
            category: 'location'
        },
        equipment: {
            label: 'Equipment',
            visible: false,
            category: 'details'
        },
        notes: {
            label: 'Notes',
            visible: false,
            category: 'details'
        },
        active: {
            label: 'Status',
            visible: true,
            category: 'basic'
        },
        createdAt: {
            label: 'Created Date',
            visible: false,
            category: 'metadata'
        },
        updatedAt: {
            label: 'Last Modified',
            visible: false,
            category: 'metadata'
        }
    };

    // DOM Elements
    const elements = {
        roomsTableBody: document.getElementById('roomsTableBody'),
        searchInput: document.getElementById('searchInput'),
        filterService: document.getElementById('filterService'),
        createRoomBtn: document.getElementById('createRoomBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        exportDropdownBtn: document.getElementById('exportDropdownBtn'),
        exportDropdown: document.getElementById('exportDropdown'),
        recordCount: document.getElementById('recordCount'),
        pagination: document.getElementById('pagination'),
        limitInput: document.getElementById('limitInput')
    };

    // Initialize page
    function init() {
        setupEventListeners();
        loadData();
    }

    // Load data from API
    async function loadData() {
        try {
            await Promise.all([
                loadRooms(),
                loadServices()
            ]);
            populateServiceDropdowns();
            renderRoomsTable();
            updateRecordCount();
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load data', 'error');
        }
    }

    // Load rooms from API
    async function loadRooms() {
        try {
            const result = await api.get('admin/rooms');
            if (result.success) {
                roomsData = result.data || [];
                if (result.pagination) {
                    totalPages = result.pagination.totalPages || 1;
                    currentPage = result.pagination.currentPage || 1;
                }
            } else {
                throw new Error(result.message || 'Failed to load rooms');
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            showNotification('Failed to load rooms', 'error');
        }
    }

    // Load services from API
    async function loadServices() {
        try {
            const result = await api.get('/admin/services');
            if (result.success) {
                servicesData = result.data || [];
            } else {
                throw new Error(result.message || 'Failed to load services');
            }
        } catch (error) {
            console.error('Error loading services:', error);
            servicesData = [];
        }
    }

    // Populate service dropdowns
    function populateServiceDropdowns() {
        if (elements.filterService) {
            // Clear existing options except first
            elements.filterService.innerHTML = '<option value="">All Services</option>';
            
            servicesData.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                elements.filterService.appendChild(option);
            });
        }
    }

    // Render rooms table
    function renderRoomsTable() {
        if (!elements.roomsTableBody) return;

        elements.roomsTableBody.innerHTML = roomsData.map(room => {
            // Handle both nested service object and service_id
            const serviceId = room.service?.id || room.service_id;
            const service = room.service || servicesData.find(s => s.id === serviceId);
            
            return `
                <tr data-room-id="${room.id}">
                    <td>
                        <strong>${room.room_number}</strong>
                    </td>
                    <td>
                        <span class="assignment-name">${service ? service.name : 'Unassigned'}</span>
                    </td>
                    <td>${window.formatDate ? window.formatDate(room.created_at) : formatDate(room.created_at)}</td>
                    <td>
                        <button class="action-btn edit" onclick="editRoom(${room.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deleteRoom(${room.id})" title="Delete">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update record count
    function updateRecordCount() {
        const total = roomsData.length;
        if (elements.recordCount) {
            elements.recordCount.textContent = `Showing ${total} room${total !== 1 ? 's' : ''}`;
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        if (elements.createRoomBtn) {
            elements.createRoomBtn.addEventListener('click', showCreateRoomModal);
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => {
                loadData();
                showNotification('Data refreshed', 'success');
            });
        }

        if (elements.exportDropdownBtn) {
            elements.exportDropdownBtn.addEventListener('click', toggleExportDropdown);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        if (elements.filterService) {
            elements.filterService.addEventListener('change', handleFilter);
        }

        if (elements.limitInput) {
            elements.limitInput.addEventListener('change', handleLimitChange);
        }

        // Export dropdown actions
        if (elements.exportDropdown) {
            elements.exportDropdown.addEventListener('click', handleExportAction);
        }

        // Close export dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown-container')) {
                closeExportDropdown();
            }
        });

        // Modal event listeners
        const roomModal = document.getElementById('roomModal');
        const exportModal = document.getElementById('exportModal');
        
        // Room modal events
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const roomForm = document.getElementById('roomForm');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => roomModal.style.display = 'none');
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => roomModal.style.display = 'none');
        if (roomForm) roomForm.addEventListener('submit', handleRoomSubmit);
        
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
        if (roomModal) {
            roomModal.addEventListener('click', (e) => {
                if (e.target === roomModal) roomModal.style.display = 'none';
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
        currentFilters.service = elements.filterService.value;
        applyFilters();
    }

    // Apply filters
    function applyFilters() {
        let filteredData = [...roomsData];

        // Search filter
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            filteredData = filteredData.filter(room => 
                room.room_number.toLowerCase().includes(searchLower) ||
                (room.service?.name && room.service.name.toLowerCase().includes(searchLower))
            );
        }

        // Service filter
        if (currentFilters.service) {
            filteredData = filteredData.filter(room => {
                const serviceId = room.service?.id || room.service_id;
                return serviceId && serviceId.toString() === currentFilters.service;
            });
        }

        renderFilteredTable(filteredData);
        updateFilteredStats(filteredData);
    }

    // Handle limit change
    function handleLimitChange() {
        const limit = parseInt(elements.limitInput.value) || 20;
        // Implement pagination logic here if needed
        updateRecordCount();
    }

    // Toggle export dropdown
    function toggleExportDropdown() {
        if (elements.exportDropdown) {
            elements.exportDropdown.style.display = 
                elements.exportDropdown.style.display === 'block' ? 'none' : 'block';
        }
    }

    // Close export dropdown
    function closeExportDropdown() {
        if (elements.exportDropdown) {
            elements.exportDropdown.style.display = 'none';
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

    // Render filtered table
    function renderFilteredTable(data) {
        if (!elements.roomsTableBody) return;

        elements.roomsTableBody.innerHTML = data.map(room => {
            // Handle both nested service object and service_id
            const serviceId = room.service?.id || room.service_id;
            const service = room.service || servicesData.find(s => s.id === serviceId);
            
            return `
                <tr data-room-id="${room.id}">
                    <td>
                        <strong>${room.room_number}</strong>
                    </td>
                    <td>
                        <span class="assignment-name">${service ? service.name : 'Unassigned'}</span>
                    </td>
                    <td>${window.formatDate ? window.formatDate(room.created_at) : formatDate(room.created_at)}</td>
                    <td>
                        <button class="action-btn edit" onclick="editRoom(${room.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deleteRoom(${room.id})" title="Delete">
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
        
        if (elements.totalRooms) elements.totalRooms.textContent = total;
    }

    // Clear filters
    function clearFilters() {
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.filterService) elements.filterService.value = '';
        currentFilters = {};
        renderRoomsTable();
        updateRecordCount();
    }

    // Room management functions
    window.editRoom = function(roomId) {
        const room = roomsData.find(r => r.id === roomId);
        if (room) {
            showRoomModal(room);
        }
    };

    window.deleteRoom = async function(roomId) {
        if (!confirm('Are you sure you want to delete this room?')) return;
        
        try {
            const result = await api.delete(`admin/rooms/${roomId}`);
            if (result.success) {
                showNotification('Room deleted successfully', 'success');
                await loadRooms();
                renderRoomsTable();
                updateRecordCount();
            } else {
                showNotification(result.message || 'Failed to delete room', 'error');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            console.error('Error details:', error.data);
            showNotification(error.data?.message || 'Failed to delete room', 'error');
        }
    };

    // Show create room modal
    function showCreateRoomModal() {
        showRoomModal();
    }

    // Show room modal (create or edit)
    function showRoomModal(room = null) {
        const modal = document.getElementById('roomModal');
        const title = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitBtnText');
        const form = document.getElementById('roomForm');
        
        if (!modal) return;
        
        const isEdit = !!room;
        
        // Set modal title and button text
        if (title) title.textContent = isEdit ? 'Edit Room' : 'Create Room';
        if (submitBtn) submitBtn.textContent = isEdit ? 'Update Room' : 'Create Room';
        
        // Set form data attribute for edit mode
        if (form) {
            if (isEdit) {
                form.dataset.roomId = room.id;
            } else {
                delete form.dataset.roomId;
            }
        }
        
        // Populate service dropdown first
        populateModalServiceDropdown();
        
        // Populate form if editing (after dropdown is populated)
        if (isEdit && room) {
            const roomNumberInput = document.getElementById('roomNumber');
            const serviceIdSelect = document.getElementById('serviceId');
            
            if (roomNumberInput) roomNumberInput.value = room.room_number || '';
            if (serviceIdSelect) serviceIdSelect.value = room.service?.id || room.service_id || '';
        } else {
            // Clear form for new room
            if (form) form.reset();
        }
        
        // Show modal
        modal.style.display = 'flex';
    }
    
    // Populate service dropdown in modal
    function populateModalServiceDropdown() {
        const serviceSelect = document.getElementById('serviceId');
        if (!serviceSelect) return;
        
        // Clear existing options except first
        serviceSelect.innerHTML = '<option value="">Unassigned</option>';
        
        servicesData.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            serviceSelect.appendChild(option);
        });
    }

    // Export rooms
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

    // Handle room form submission
    async function handleRoomSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const roomData = {
            roomNumber: formData.get('roomNumber'),
            serviceId: formData.get('serviceId') || null
        };
        
        const isEdit = e.target.dataset.roomId;
        
        try {
            let result;
            if (isEdit) {
                result = await api.put(`admin/rooms/${isEdit}`, roomData);
            } else {
                result = await api.post('admin/rooms', roomData);
            }
            
            if (result.success) {
                showNotification(isEdit ? 'Room updated successfully' : 'Room created successfully', 'success');
                document.getElementById('roomModal').style.display = 'none';
                await loadRooms();
                renderRoomsTable();
                updateRecordCount();
            } else {
                showNotification(result.message || `Failed to ${isEdit ? 'update' : 'create'} room`, 'error');
            }
        } catch (error) {
            console.error('Error submitting room:', error);
            showNotification(`Failed to ${isEdit ? 'update' : 'create'} room`, 'error');
        }
    }

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
            
            let endpoint = 'admin/rooms/export';
            
            // Use professional Excel export for Excel format
            if (format === 'excel') {
                endpoint = 'admin/rooms/export/excel';
                
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
                        filters: currentFilters,
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
                    a.download = `ePick-Rooms-Export-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    // Complete
                    if (progressFill) progressFill.style.width = '100%';
                    if (progressText) progressText.textContent = 'Export completed!';
                    
                    showNotification('Rooms exported successfully (Excel)', 'success');
                    
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
                    filters: currentFilters
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
                    
                    showNotification('Rooms exported successfully', 'success');
                    
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
            console.error('Error exporting rooms:', error);
            showNotification('Export failed', 'error');
        } finally {
            // Reset button and hide progress after delay
            setTimeout(() => {
                if (exportBtn) exportBtn.disabled = false;
                if (progressDiv) progressDiv.style.display = 'none';
            }, 2000);
        }
    }

    // Update pagination info
    function updatePaginationInfo(filteredCount = null) {
        if (elements.paginationInfo) {
            const count = filteredCount !== null ? filteredCount : roomsData.length;
            const total = roomsData.length;
            if (filteredCount !== null && filteredCount !== total) {
                elements.paginationInfo.textContent = `Showing ${count} of ${total} rooms (filtered)`;
            } else {
                elements.paginationInfo.textContent = `Showing 1-${count} of ${count} rooms`;
            }
        }
    }

    // Utility functions
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="material-symbols-outlined">
                ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
            </span>
            ${message}
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove notification
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

    // Populate export columns
    function populateExportColumns() {
        const columnGrid = document.getElementById('columnGrid');
        if (!columnGrid) return;
        
        columnGrid.innerHTML = '';
        
        // Room export columns with sensitive flag
        const exportColumns = {
            id: { name: 'Room ID', description: 'Room internal ID', sensitive: true },
            roomNumber: { name: 'Room Number', description: 'Room identifier number', sensitive: false },
            capacity: { name: 'Capacity', description: 'Maximum room capacity', sensitive: false },
            serviceName: { name: 'Service Name', description: 'Assigned service department', sensitive: false },
            serviceId: { name: 'Service ID', description: 'Service internal ID', sensitive: true },
            floor: { name: 'Floor', description: 'Floor location', sensitive: false },
            department: { name: 'Department', description: 'Department assignment', sensitive: false },
            equipment: { name: 'Equipment', description: 'Room equipment details', sensitive: false },
            notes: { name: 'Notes', description: 'Room notes and comments', sensitive: true },
            active: { name: 'Status', description: 'Room active status', sensitive: false },
            createdAt: { name: 'Created Date', description: 'Room creation date', sensitive: false },
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
            // For rooms, safe columns are: id, roomNumber, capacity, serviceName, floor, department, status, createdAt
            const safeColumns = ['id', 'roomNumber', 'capacity', 'serviceName', 'floor', 'department', 'active', 'createdAt'];
            checkbox.checked = safeColumns.includes(checkbox.value);
        });
    }
    
    // Show current filters in export modal
    function showCurrentFilters() {
        const container = document.getElementById('currentFilters');
        if (!container) return;
        
        const filters = [];
        
        if (currentFilters.search) {
            filters.push(`Search: "${currentFilters.search}"`);
        }
        
        if (currentFilters.service) {
            const service = servicesData.find(s => s.id.toString() === currentFilters.service);
            if (service) {
                filters.push(`Service: ${service.name}`);
            }
        }
        
        if (filters.length > 0) {
            container.innerHTML = filters.map(f => `<span class="filter-tag">${f}</span>`).join('');
        } else {
            container.innerHTML = '<span class="no-filters">No filters applied - all rooms will be exported</span>';
        }
    }

    // Initialize the page
    init();
    updatePaginationInfo();
}