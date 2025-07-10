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
    let patientsData = [];
    let roomsData = [];
    let doctorsData = [];
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};

    // DOM Elements
    const elements = {
        totalPatients: document.getElementById('totalPatients'),
        malePatients: document.getElementById('malePatients'),
        femalePatients: document.getElementById('femalePatients'),
        assignedRooms: document.getElementById('assignedRooms'),
        patientsTableBody: document.getElementById('patientsTableBody'),
        paginationInfo: document.getElementById('paginationInfo'),
        searchInput: document.getElementById('searchInput'),
        filterRoom: document.getElementById('filterRoom'),
        filterDoctor: document.getElementById('filterDoctor'),
        filterGender: document.getElementById('filterGender'),
        filterStatus: document.getElementById('statusFilter'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        createPatientBtn: document.getElementById('createPatientBtn'),
        exportPatientsBtn: document.getElementById('exportDropdownBtn'),
        refreshBtn: document.getElementById('refreshBtn')
    };

    // Initialize page
    function init() {
        setupEventListeners();
        loadData();
    }

    // Load data from API
    async function loadData(page = 1, search = '') {
        try {
            await Promise.all([
                loadPatients(page, search),
                loadRooms(),
                loadDoctors()
            ]);
            populateDropdowns();
            renderPatientsTable();
            updateStats();
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load data', 'error');
        }
    }

    // Load patients from API with pagination
    async function loadPatients(page = 1, search = '') {
        try {
            showLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20', // Load 20 patients per page
                ...(search && { search })
            });
            
            const result = await api.get(`/admin/patients?${params}`);
            if (result.success) {
                patientsData = result.data || [];
                if (result.pagination) {
                    totalPages = result.pagination.totalPages || 1;
                    currentPage = result.pagination.currentPage || 1;
                    updatePaginationInfo(result.pagination);
                }
            } else {
                throw new Error(result.message || 'Failed to load patients');
            }
        } catch (error) {
            console.error('Error loading patients:', error);
            showNotification('Failed to load patients', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    // Show/hide loading indicator
    function showLoading(show) {
        const table = document.getElementById('patientsTableBody');
        if (show) {
            table.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading patients...</td></tr>';
        }
    }
    
    // Update pagination info and controls
    function updatePaginationInfo(pagination) {
        if (elements.paginationInfo) {
            const start = ((pagination.currentPage - 1) * 20) + 1;
            const end = Math.min(pagination.currentPage * 20, pagination.total);
            elements.paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} patients`;
        }
        
        // Update pagination buttons
        updatePaginationButtons();
    }
    
    // Update pagination buttons
    function updatePaginationButtons() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInfo = document.getElementById('currentPageInfo');
        
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    // Load rooms from API
    async function loadRooms() {
        try {
            const result = await api.get('/admin/rooms');
            if (result.success) {
                roomsData = result.data || [];
            } else {
                throw new Error(result.message || 'Failed to load rooms');
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            roomsData = [];
        }
    }

    // Load doctors from API
    async function loadDoctors() {
        try {
            const result = await api.get('/admin/doctors');
            if (result.success) {
                doctorsData = result.data || [];
                console.log('Loaded doctors:', doctorsData);
            } else {
                throw new Error(result.message || 'Failed to load doctors');
            }
        } catch (error) {
            console.error('Error loading doctors:', error);
            doctorsData = [];
        }
    }

    // Populate dropdowns
    function populateDropdowns() {
        // Populate room dropdown
        if (elements.filterRoom) {
            elements.filterRoom.innerHTML = '<option value="">All Rooms</option>';
            roomsData.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `Room ${room.room_number}`;
                elements.filterRoom.appendChild(option);
            });
        }

        // Populate doctor dropdown
        if (elements.filterDoctor) {
            elements.filterDoctor.innerHTML = '<option value="">All Doctors</option>';
            doctorsData.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.id;
                option.textContent = doctor.name || 'Unknown Doctor';
                elements.filterDoctor.appendChild(option);
            });
        }
    }

    // Render patients table
    function renderPatientsTable() {
        if (!elements.patientsTableBody) return;

        elements.patientsTableBody.innerHTML = patientsData.map(patient => {
            const room = roomsData.find(r => r.id === patient.room_id);
            const doctor = doctorsData.find(d => d.id === patient.doctor_id);
            
            return `
                <tr data-patient-id="${patient.id}">
                    <td>
                        <strong>${patient.name || 'Unknown Patient'}</strong>
                    </td>
                    <td>
                        <strong>${patient.matricule_national}</strong>
                    </td>
                    <td>
                        <div class="patient-age">
                            <span class="age-years">${calculateAge(patient.date_of_birth)} years</span>
                            <small>${window.formatDate ? window.formatDate(patient.date_of_birth) : formatDate(patient.date_of_birth)}</small>
                        </div>
                    </td>
                    <td>
                        <span class="gender-badge ${patient.gender ? patient.gender.toLowerCase() : 'unknown'}">
                            <span class="material-symbols-outlined">${getGenderIcon(patient.gender)}</span>
                            ${getGenderLabel(patient.gender)}
                        </span>
                    </td>
                    <td>
                        <span class="assignment-name">${room ? `Room ${room.room_number}` : 'Unassigned'}</span>
                    </td>
                    <td>
                        <span class="assignment-name">${doctor ? doctor.name : 'Unassigned'}</span>
                    </td>
                    <td>
                        <button class="action-btn view" onclick="viewPatient(${patient.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="action-btn edit" onclick="editPatient(${patient.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deletePatient(${patient.id})" title="Delete">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update statistics
    function updateStats() {
        const total = patientsData.length;
        const male = patientsData.filter(patient => patient.gender === 'Male' || patient.gender === 'M').length;
        const female = patientsData.filter(patient => patient.gender === 'Female' || patient.gender === 'F').length;
        const assignedRooms = patientsData.filter(patient => patient.room_id).length;
        
        if (elements.totalPatients) elements.totalPatients.textContent = total;
        if (elements.malePatients) elements.malePatients.textContent = male;
        if (elements.femalePatients) elements.femalePatients.textContent = female;
        if (elements.assignedRooms) elements.assignedRooms.textContent = assignedRooms;
    }

    // Setup event listeners
    function setupEventListeners() {
        if (elements.clearFiltersBtn) {
            elements.clearFiltersBtn.addEventListener('click', clearFilters);
        }

        if (elements.createPatientBtn) {
            elements.createPatientBtn.addEventListener('click', showCreatePatientModal);
        }

        if (elements.exportPatientsBtn) {
            elements.exportPatientsBtn.addEventListener('click', toggleExportDropdown);
        } else {
            const exportBtn = document.getElementById('exportDropdownBtn');
            if (exportBtn) {
                exportBtn.addEventListener('click', toggleExportDropdown);
            }
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => {
                currentPage = 1;
                const searchTerm = elements.searchInput?.value || '';
                loadData(currentPage, searchTerm);
                showNotification('Data refreshed', 'success');
            });
        }

        // Export dropdown actions
        const exportDropdown = document.getElementById('exportDropdown');
        if (exportDropdown) {
            exportDropdown.addEventListener('click', (e) => {
                const dropdownItem = e.target.closest('.dropdown-item');
                if (dropdownItem) {
                    const action = dropdownItem.getAttribute('data-action');
                    if (action) {
                        handleExportAction(action);
                        closeExportDropdown();
                    }
                }
            });
        }

        // Close export dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown-container')) {
                closeExportDropdown();
            }
        });

        // Modal event listeners
        const patientModal = document.getElementById('patientModal');
        const exportModal = document.getElementById('exportModal');
        
        // Patient modal events
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const patientForm = document.getElementById('patientForm');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => patientModal.style.display = 'none');
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => patientModal.style.display = 'none');
        if (patientForm) patientForm.addEventListener('submit', handlePatientSubmit);
        
        // Export modal events
        const closeExportModalBtn = document.getElementById('closeExportModalBtn');
        const cancelExportBtn = document.getElementById('cancelExportBtn');
        const exportForm = document.getElementById('exportForm');
        if (closeExportModalBtn) closeExportModalBtn.addEventListener('click', () => {
            if (exportModal) exportModal.classList.remove('show');
        });
        if (cancelExportBtn) cancelExportBtn.addEventListener('click', () => {
            if (exportModal) exportModal.classList.remove('show');
        });
        if (exportForm) exportForm.addEventListener('submit', handleExportSubmit);

        // Column selection buttons
        const selectAllColumnsBtn = document.getElementById('selectAllColumnsBtn');
        const selectNoneColumnsBtn = document.getElementById('selectNoneColumnsBtn');
        const selectSafeColumnsBtn = document.getElementById('selectSafeColumnsBtn');

        if (selectAllColumnsBtn) {
            selectAllColumnsBtn.addEventListener('click', () => {
                selectAllColumns(true);
            });
        }
        if (selectNoneColumnsBtn) {
            selectNoneColumnsBtn.addEventListener('click', () => {
                selectAllColumns(false);
            });
        }
        if (selectSafeColumnsBtn) {
            selectSafeColumnsBtn.addEventListener('click', () => {
                selectSafeColumns();
            });
        }

        // Column checkbox change events (will be attached dynamically)
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('column-checkbox')) {
                updateSensitiveWarning();
            }
        });
        
        // Close modals when clicking outside
        if (patientModal) {
            patientModal.addEventListener('click', (e) => {
                if (e.target === patientModal) patientModal.style.display = 'none';
            });
        }
        if (exportModal) {
            exportModal.addEventListener('click', (e) => {
                if (e.target === exportModal) exportModal.classList.remove('show');
            });
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        // Pagination event listeners
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadData(currentPage, elements.searchInput?.value || '');
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    loadData(currentPage, elements.searchInput?.value || '');
                }
            });
        }

        if (elements.filterRoom) {
            elements.filterRoom.addEventListener('change', handleFilter);
        }

        if (elements.filterDoctor) {
            elements.filterDoctor.addEventListener('change', handleFilter);
        }
        
        if (elements.filterGender) {
            elements.filterGender.addEventListener('change', handleFilter);
        }

        if (elements.filterStatus) {
            elements.filterStatus.addEventListener('change', handleFilter);
        }
    }

    // Handle search
    function handleSearch() {
        const searchTerm = elements.searchInput.value.trim();
        currentPage = 1; // Reset to first page when searching
        loadData(currentPage, searchTerm);
    }

    // Handle filter
    function handleFilter() {
        currentFilters.room = elements.filterRoom ? elements.filterRoom.value : '';
        currentFilters.doctor = elements.filterDoctor ? elements.filterDoctor.value : '';
        currentFilters.gender = elements.filterGender ? elements.filterGender.value : '';
        currentFilters.status = elements.filterStatus ? elements.filterStatus.value : '';
        applyFilters();
    }

    // Apply filters
    function applyFilters() {
        let filteredData = [...patientsData];

        // Search filter
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            filteredData = filteredData.filter(patient => 
                patient.first_name.toLowerCase().includes(searchLower) ||
                patient.last_name.toLowerCase().includes(searchLower) ||
                patient.matricule_national.toLowerCase().includes(searchLower)
            );
        }

        // Room filter
        if (currentFilters.room) {
            filteredData = filteredData.filter(patient => 
                patient.room_id && patient.room_id.toString() === currentFilters.room
            );
        }

        // Doctor filter
        if (currentFilters.doctor) {
            filteredData = filteredData.filter(patient => 
                patient.doctor_id && patient.doctor_id.toString() === currentFilters.doctor
            );
        }
        
        // Gender filter
        if (currentFilters.gender) {
            filteredData = filteredData.filter(patient => patient.gender === currentFilters.gender);
        }

        // Status filter
        if (currentFilters.status) {
            const isActive = currentFilters.status === 'active';
            filteredData = filteredData.filter(patient => patient.is_active === isActive);
        }

        renderFilteredTable(filteredData);
        updateFilteredStats(filteredData);
        updatePaginationInfo(filteredData.length);
    }

    // Render filtered table
    function renderFilteredTable(data) {
        if (!elements.patientsTableBody) return;

        elements.patientsTableBody.innerHTML = data.map(patient => {
            const room = roomsData.find(r => r.id === patient.room_id);
            const doctor = doctorsData.find(d => d.id === patient.doctor_id);
            
            return `
                <tr data-patient-id="${patient.id}">
                    <td>
                        <strong>${patient.first_name} ${patient.last_name}</strong>
                    </td>
                    <td>
                        <strong>${patient.matricule_national}</strong>
                    </td>
                    <td>
                        <div class="patient-age">
                            <span class="age-years">${calculateAge(patient.date_of_birth)} years</span>
                            <small>${window.formatDate ? window.formatDate(patient.date_of_birth) : formatDate(patient.date_of_birth)}</small>
                        </div>
                    </td>
                    <td>
                        <span class="gender-badge ${patient.gender ? patient.gender.toLowerCase() : 'unknown'}">
                            <span class="material-symbols-outlined">${getGenderIcon(patient.gender)}</span>
                            ${getGenderLabel(patient.gender)}
                        </span>
                    </td>
                    <td>
                        <span class="assignment-name">${room ? `Room ${room.room_number}` : 'Unassigned'}</span>
                    </td>
                    <td>
                        <span class="assignment-name">${doctor ? doctor.name : 'Unassigned'}</span>
                    </td>
                    <td>
                        <button class="action-btn view" onclick="viewPatient(${patient.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="action-btn edit" onclick="editPatient(${patient.id})" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="deletePatient(${patient.id})" title="Delete">
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
        const male = data.filter(patient => patient.gender === 'Male' || patient.gender === 'M').length;
        const female = data.filter(patient => patient.gender === 'Female' || patient.gender === 'F').length;
        const assignedRooms = data.filter(patient => patient.room_id).length;
        
        if (elements.totalPatients) elements.totalPatients.textContent = total;
        if (elements.malePatients) elements.malePatients.textContent = male;
        if (elements.femalePatients) elements.femalePatients.textContent = female;
        if (elements.assignedRooms) elements.assignedRooms.textContent = assignedRooms;
    }

    // Clear filters
    function clearFilters() {
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.filterRoom) elements.filterRoom.value = '';
        if (elements.filterDoctor) elements.filterDoctor.value = '';
        if (elements.filterGender) elements.filterGender.value = '';
        if (elements.filterStatus) elements.filterStatus.value = '';
        currentFilters = {};
        renderPatientsTable();
        updateStats();
        updatePaginationInfo();
        showNotification('Filters cleared', 'success');
    }

    // Patient management functions
    window.viewPatient = async function(patientId) {
        const patient = patientsData.find(p => p.id === patientId);
        if (patient) {
            showPatientDetailsModal(patient);
        }
    };

    window.editPatient = function(patientId) {
        const patient = patientsData.find(p => p.id === patientId);
        if (patient) {
            showPatientModal(patient);
        }
    };

    window.deletePatient = async function(patientId) {
        if (!confirm('Are you sure you want to delete this patient?')) return;
        
        try {
            const result = await api.delete(`/admin/patients/${patientId}`);
            if (result.success) {
                showNotification('Patient deleted successfully', 'success');
                await loadPatients();
                renderPatientsTable();
                updateStats();
            } else {
                showNotification(result.message || 'Failed to delete patient', 'error');
            }
        } catch (error) {
            console.error('Error deleting patient:', error);
            showNotification('Failed to delete patient', 'error');
        }
    };

    // Show create patient modal
    function showCreatePatientModal() {
        showPatientModal();
    }

    // Show patient modal (create or edit)
    function showPatientModal(patient = null) {
        const modal = document.getElementById('patientModal');
        const title = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitBtnText');
        const form = document.getElementById('patientForm');
        
        if (!modal) return;
        
        const isEdit = !!patient;
        
        // Set modal title and button text
        if (title) title.textContent = isEdit ? 'Edit Patient' : 'Create Patient';
        if (submitBtn) submitBtn.textContent = isEdit ? 'Update Patient' : 'Create Patient';
        
        // Set form data attribute for edit mode
        if (form) {
            if (isEdit) {
                form.dataset.patientId = patient.id;
            } else {
                delete form.dataset.patientId;
            }
        }
        
        // Populate form if editing
        if (isEdit && patient) {
            const firstNameInput = document.getElementById('firstName');
            const lastNameInput = document.getElementById('lastName');
            const matriculeInput = document.getElementById('matriculeNational');
            const dobInput = document.getElementById('dateOfBirth');
            const genderSelect = document.getElementById('gender');
            const roomSelect = document.getElementById('roomId');
            const doctorSelect = document.getElementById('doctorId');
            
            // Split combined name field for editing
            const nameParts = (patient.name || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            if (firstNameInput) firstNameInput.value = firstName;
            if (lastNameInput) lastNameInput.value = lastName;
            if (matriculeInput) matriculeInput.value = patient.matricule_national || '';
            if (dobInput) dobInput.value = patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '';
            if (genderSelect) genderSelect.value = patient.gender || '';
            if (roomSelect) roomSelect.value = patient.room_id || '';
            
            // Handle doctor search input
            const doctorSearchInput = document.getElementById('doctorIdSearch');
            if (doctorSearchInput && patient.doctor_id) {
                const doctor = doctorsData.find(d => d.id === patient.doctor_id);
                if (doctor) {
                    doctorSearchInput.value = doctor.name;
                    doctorSearchInput.setAttribute('data-selected-id', patient.doctor_id);
                }
            } else if (doctorSearchInput) {
                doctorSearchInput.value = '';
                doctorSearchInput.setAttribute('data-selected-id', '');
            }
        } else {
            // Clear form for new patient
            if (form) form.reset();
        }
        
        // Populate dropdowns and setup enhanced search
        populateModalDropdowns();
        setupEnhancedSearchInputs();
        
        // Show modal
        modal.style.display = 'flex';
    }

    // Show patient details modal
    function showPatientDetailsModal(patient) {
        const room = roomsData.find(r => r.id === patient.room_id);
        const doctor = doctorsData.find(d => d.id === patient.doctor_id);
        const age = calculateAge(patient.date_of_birth);
        
        const details = `Patient Details:\n\nName: ${patient.first_name} ${patient.last_name}\nMatricule National: ${patient.matricule_national}\nAge: ${age} years\nDate of Birth: ${formatDate(patient.date_of_birth)}\nGender: ${getGenderLabel(patient.gender)}\nRoom: ${room ? `Room ${room.room_number}` : 'Unassigned'}\nDoctor: ${doctor ? doctor.name : 'Unassigned'}`;
        alert(details);
    }

    // Toggle export dropdown
    function toggleExportDropdown() {
        const exportDropdown = document.getElementById('exportDropdown');
        if (exportDropdown) {
            exportDropdown.style.display = 
                exportDropdown.style.display === 'block' ? 'none' : 'block';
        }
    }

    // Close export dropdown
    function closeExportDropdown() {
        const exportDropdown = document.getElementById('exportDropdown');
        if (exportDropdown) {
            exportDropdown.style.display = 'none';
        }
    }

    // Handle export actions (removed duplicate function)

    // Show export modal (removed duplicate - using the complete implementation below)

    // Patient export column definitions
    const exportColumns = {
        id: { name: 'ID', description: 'Patient internal ID', sensitive: false },
        firstName: { name: 'First Name', description: 'Patient first name', sensitive: true },
        lastName: { name: 'Last Name', description: 'Patient last name', sensitive: true },
        fullName: { name: 'Full Name', description: 'Patient complete name', sensitive: true },
        matriculeNational: { name: 'National ID', description: 'National registration number', sensitive: true },
        dateOfBirth: { name: 'Date of Birth', description: 'Patient birth date', sensitive: true },
        age: { name: 'Age', description: 'Calculated age in years', sensitive: false },
        gender: { name: 'Gender', description: 'Patient gender', sensitive: false },
        phone: { name: 'Phone', description: 'Contact phone number', sensitive: true },
        address: { name: 'Address', description: 'Patient address', sensitive: true },
        roomId: { name: 'Room ID', description: 'Room internal ID', sensitive: false },
        roomNumber: { name: 'Room Number', description: 'Assigned room number', sensitive: false },
        doctorId: { name: 'Doctor ID', description: 'Doctor internal ID', sensitive: false },
        doctorName: { name: 'Doctor Name', description: 'Assigned doctor name', sensitive: false },
        active: { name: 'Status', description: 'Patient active status', sensitive: false },
        createdAt: { name: 'Created Date', description: 'Patient creation date', sensitive: false },
        updatedAt: { name: 'Last Updated', description: 'Last modification date', sensitive: false }
    };

    // Safe columns (non-sensitive, commonly exported)
    const safeColumns = ['id', 'age', 'gender', 'roomNumber', 'doctorName', 'active', 'createdAt'];

    // Export patients (now called from dropdown)
    async function exportPatients(format = 'csv') {
        const password = prompt('Enter your password to confirm export:');
        if (!password) return;
        
        try {
            await performPatientExport(format, password);
            showNotification('Patients exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting patients:', error);
            showNotification('Export failed', 'error');
        }
    }

    async function performPatientExport(format, password) {
        const exportData = {
            password: password,
            filters: getCurrentPatientFilters()
        };

        let endpoint;
        switch (format) {
            case 'csv':
                endpoint = '/admin/patients/export/csv';
                break;
            case 'excel':
                endpoint = '/admin/patients/export/excel';
                break;
            case 'json':
                endpoint = '/admin/patients/export/json';
                break;
            default:
                throw new Error('Invalid export format');
        }

        try {
            if (format === 'json') {
                const data = await api.post(endpoint, exportData);
                downloadJsonFile(data, `patients_export_${new Date().toISOString().split('T')[0]}.json`);
            } else {
                await downloadFileExport(endpoint, exportData, format);
            }
        } catch (error) {
            console.error('Export request error:', error);
            throw error;
        }
    }

    function getCurrentPatientFilters() {
        const filters = {};
        
        // Add any current filters from the UI
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            filters.search = searchInput.value.trim();
        }
        
        return filters;
    }

    function downloadJsonFile(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        downloadBlob(blob, filename);
    }

    // Export modal functions (matching analyses.js)
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

        const exportModal = document.getElementById('exportModal');
        if(exportModal) {
            exportModal.classList.add('show');
        }
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

    function selectSafeColumns() {
        document.querySelectorAll('.column-checkbox').forEach(checkbox => {
            checkbox.checked = safeColumns.includes(checkbox.value);
        });
        updateSensitiveWarning();
    }

    function selectAllColumns(select) {
        document.querySelectorAll('.column-checkbox').forEach(checkbox => {
            checkbox.checked = select;
        });
        updateSensitiveWarning();
    }

    function updateSensitiveWarning() {
        const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked'))
            .map(cb => cb.value);
        
        const hasSensitive = selectedColumns.some(col => exportColumns[col]?.sensitive);
        const sensitiveWarning = document.getElementById('sensitiveWarning');
        
        if(sensitiveWarning) {
            sensitiveWarning.style.display = hasSensitive ? 'block' : 'none';
        }
    }

    function updateCurrentFiltersDisplay() {
        const currentFilters = document.getElementById('currentFilters');
        if(!currentFilters) return;

        const filters = getCurrentPatientFilters();
        const filterTexts = [];

        if(filters.search) {
            filterTexts.push(`Search: "${filters.search}"`);
        }

        if(filterTexts.length === 0) {
            currentFilters.innerHTML = '<span class="filter-info">No filters applied - exporting all patients</span>';
        } else {
            currentFilters.innerHTML = filterTexts.map(text => 
                `<span class="filter-tag">${text}</span>`
            ).join('');
        }
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
    }

    async function handleExportSubmit(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const format = formData.get('exportFormat');
        const password = formData.get('exportPassword');

        if (!password) {
            showNotification('Password is required', 'error');
            return;
        }

        // Get selected columns
        const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked'))
            .map(cb => cb.value);

        if (selectedColumns.length === 0) {
            showNotification('Please select at least one column to export', 'error');
            return;
        }

        try {
            showExportProgress(true);
            await performExportWithColumns(format, password, selectedColumns);
            const exportModal = document.getElementById('exportModal');
            if(exportModal) {
                exportModal.classList.remove('show');
            }
            showNotification(`Export completed successfully (${format.toUpperCase()})`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification(getErrorMessage(error), 'error');
        } finally {
            showExportProgress(false);
        }
    }

    async function performExportWithColumns(format, password, selectedColumns) {
        const exportData = {
            password: password,
            filters: getCurrentPatientFilters(),
            includeColumns: selectedColumns
        };

        let endpoint;
        switch (format) {
            case 'csv':
                endpoint = '/admin/patients/export/csv';
                break;
            case 'excel':
                endpoint = '/admin/patients/export/excel';
                break;
            case 'json':
                endpoint = '/admin/patients/export/json';
                break;
            default:
                throw new Error('Invalid export format');
        }

        try {
            if (format === 'json') {
                const data = await api.post(endpoint, exportData);
                downloadJsonFile(data, `patients_export_${new Date().toISOString().split('T')[0]}.json`);
            } else {
                await downloadFileExport(endpoint, exportData, format);
            }
        } catch (error) {
            console.error('Export request error:', error);
            throw error;
        }
    }

    function showExportProgress(show) {
        const progressElement = document.getElementById('exportProgress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }

        const exportBtn = document.getElementById('executeExportBtn');
        if (exportBtn) {
            exportBtn.disabled = show;
            if (show) {
                exportBtn.innerHTML = '<span class="material-symbols-outlined rotating" style="font-size: 16px;">refresh</span> Exporting...';
            } else {
                exportBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">download</span> Export Data';
            }
        }
    }

    function getErrorMessage(error) {
        if (error.data && error.data.message) {
            return error.data.message;
        }
        if (error.message) {
            return error.message;
        }
        return 'Export failed. Please try again.';
    }

    // Export dropdown helper functions
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

    // File download utility functions
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
                `patients_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;

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

    // Update pagination info
    function updatePaginationInfo(filteredCount = null) {
        if (elements.paginationInfo) {
            const count = filteredCount !== null ? filteredCount : patientsData.length;
            const total = patientsData.length;
            if (filteredCount !== null && filteredCount !== total) {
                elements.paginationInfo.textContent = `Showing ${count} of ${total} patients (filtered)`;
            } else {
                elements.paginationInfo.textContent = `Showing 1-${count} of ${count} patients`;
            }
        }
    }

    // Utility functions
    function calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    function getGenderIcon(gender) {
        switch (gender) {
            case 'M':
            case 'Male': return 'male';
            case 'F':
            case 'Female': return 'female';
            default: return 'transgender';
        }
    }

    function getGenderLabel(gender) {
        switch (gender) {
            case 'M': return 'Male';
            case 'F': return 'Female';
            case 'Male': return 'Male';
            case 'Female': return 'Female';
            case 'Other': return 'Other';
            default: return 'Other';
        }
    }

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

    // Populate modal dropdowns
    function populateModalDropdowns() {
        // Populate room dropdown
        const roomSelect = document.getElementById('roomId');
        if (roomSelect) {
            roomSelect.innerHTML = '<option value="">Select a room</option>';
            roomsData.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `Room ${room.room_number}`;
                roomSelect.appendChild(option);
            });
        }
        
        // Populate doctor dropdown (will be replaced by enhanced search)
        const doctorSelect = document.getElementById('doctorId');
        if (doctorSelect) {
            doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
            doctorsData.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.id;
                option.textContent = `${doctor.first_name} ${doctor.last_name}`;
                doctorSelect.appendChild(option);
            });
        }
    }
    
    // Setup enhanced search inputs
    function setupEnhancedSearchInputs() {
        const doctorSelect = document.getElementById('doctorId');
        if (!doctorSelect || doctorSelect.hasAttribute('data-enhanced')) return;
        
        // Create search container
        const container = document.createElement('div');
        container.className = 'search-container';
        
        // Create search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'form-control search-input-enhanced';
        searchInput.placeholder = 'Search doctors or type new doctor name...';
        searchInput.setAttribute('data-selected-id', '');
        searchInput.id = 'doctorIdSearch';
        
        // Create dropdown for results
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        dropdown.style.display = 'none';
        
        // Create clear button
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'search-clear-btn';
        clearBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">close</span>';
        clearBtn.title = 'Clear selection';
        
        // Create "Add new doctor" button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'search-add-btn';
        addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">add</span>';
        addBtn.title = 'Add new doctor';
        addBtn.style.display = 'none';
        
        // Assemble container
        container.appendChild(searchInput);
        container.appendChild(clearBtn);
        container.appendChild(addBtn);
        container.appendChild(dropdown);
        
        // Replace original select
        doctorSelect.parentNode.replaceChild(container, doctorSelect);
        doctorSelect.setAttribute('data-enhanced', 'true');
        
        // Setup event listeners
        setupDoctorSearchListeners(searchInput, dropdown, clearBtn, addBtn);
    }
    
    // Setup doctor search event listeners
    function setupDoctorSearchListeners(searchInput, dropdown, clearBtn, addBtn) {
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            if (term.length === 0) {
                hideDoctorDropdown(dropdown);
                addBtn.style.display = 'none';
            } else if (term.length >= 2) {
                // Show loading state
                showDoctorDropdown(searchInput, dropdown, [{ id: 'loading', name: 'Searching...', isLoading: true }]);
                
                // Debounced search
                searchTimeout = setTimeout(async () => {
                    const results = await searchDoctors(term);
                    showDoctorDropdown(searchInput, dropdown, results);
                    
                    // Show "Add new doctor" button if no exact match
                    const exactMatch = results.find(d => 
                        d.name.toLowerCase() === term.toLowerCase() ||
                        `${d.first_name} ${d.last_name}`.toLowerCase() === term.toLowerCase()
                    );
                    addBtn.style.display = exactMatch ? 'none' : 'inline-flex';
                }, 300);
            } else {
                hideDoctorDropdown(dropdown);
                addBtn.style.display = 'none';
            }
        });
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.setAttribute('data-selected-id', '');
            hideDoctorDropdown(dropdown);
            addBtn.style.display = 'none';
            searchInput.focus();
        });
        
        addBtn.addEventListener('click', () => {
            showAddDoctorModal(searchInput.value.trim());
        });
    }
    
    // Search doctors function
    async function searchDoctors(term) {
        try {
            // Ensure doctorsData exists and is an array
            if (!Array.isArray(doctorsData)) {
                console.warn('doctorsData is not an array:', doctorsData);
                return [];
            }
            
            // First search in existing doctors
            const filteredDoctors = doctorsData.filter(doctor => {
                // Ensure doctor object exists
                if (!doctor || typeof doctor !== 'object') {
                    return false;
                }
                
                // Safely get properties with fallbacks
                const name = doctor.name || '';
                const specialization = doctor.specialization || '';
                
                const searchTerm = term.toLowerCase();
                
                return name.toLowerCase().includes(searchTerm) ||
                       specialization.toLowerCase().includes(searchTerm);
            });
            
            // Format results
            return filteredDoctors.map(doctor => ({
                id: doctor?.id || 0,
                name: doctor?.name || 'Unknown Doctor',
                specialization: doctor?.specialization || 'General Medicine'
            }));
        } catch (error) {
            console.error('Error searching doctors:', error);
            return [];
        }
    }
    
    // Show doctor dropdown
    function showDoctorDropdown(searchInput, dropdown, results) {
        if (!results || results.length === 0) {
            hideDoctorDropdown(dropdown);
            return;
        }
        
        dropdown.innerHTML = results.map(doctor => {
            if (doctor.isLoading) {
                return `<div class="search-item loading">${doctor.name}</div>`;
            }
            return `
                <div class="search-item" data-id="${doctor.id}">
                    <div class="search-item-main">${doctor.name}</div>
                    <div class="search-item-sub">${doctor.specialization}</div>
                </div>
            `;
        }).join('');
        
        // Add click listeners to items
        dropdown.querySelectorAll('.search-item:not(.loading)').forEach(item => {
            item.addEventListener('click', () => {
                const doctorId = item.dataset.id;
                const doctor = results.find(d => d.id.toString() === doctorId);
                if (doctor) {
                    searchInput.value = doctor.name;
                    searchInput.setAttribute('data-selected-id', doctorId);
                    hideDoctorDropdown(dropdown);
                }
            });
        });
        
        dropdown.style.display = 'block';
    }
    
    // Hide doctor dropdown
    function hideDoctorDropdown(dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Show add doctor modal
    function showAddDoctorModal(doctorName) {
        // For now, just show a simple prompt
        // In a full implementation, you'd create a proper modal
        const specialization = prompt(`Add new doctor: ${doctorName}\n\nEnter specialization:`, 'General Medicine');
        if (specialization) {
            addNewDoctor(doctorName, specialization);
        }
    }
    
    // Add new doctor
    async function addNewDoctor(fullName, specialization) {
        try {
            const nameParts = fullName.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            const doctorData = {
                firstName: firstName,
                lastName: lastName,
                specialization: specialization
            };
            
            const result = await api.post('/admin/doctors', doctorData);
            if (result.success) {
                showNotification('Doctor added successfully', 'success');
                // Reload doctors data
                await loadDoctors();
                populateDropdowns();
                
                // Update the search input with the new doctor
                const searchInput = document.getElementById('doctorIdSearch');
                if (searchInput && result.data) {
                    searchInput.value = result.data.name;
                    searchInput.setAttribute('data-selected-id', result.data.id);
                }
            } else {
                showNotification(result.message || 'Failed to add doctor', 'error');
            }
        } catch (error) {
            console.error('Error adding doctor:', error);
            showNotification('Failed to add doctor', 'error');
        }
    }

    // Handle patient form submission
    async function handlePatientSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        const doctorSearchInput = document.getElementById('doctorIdSearch');
        const doctorId = doctorSearchInput ? doctorSearchInput.getAttribute('data-selected-id') : null;
        
        // Log the form data for debugging
        console.log('Form data being sent:', {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            matriculeNational: formData.get('matriculeNational'),
            dateOfBirth: formData.get('dateOfBirth'),
            gender: formData.get('gender'),
            roomId: formData.get('roomId'),
            doctorId: doctorId
        });
        
        // Map gender values to expected format
        const genderMap = {
            'M': 'Male',
            'F': 'Female',
            'O': 'Other'
        };
        
        const roomIdValue = formData.get('roomId');
        
        const patientData = {
            name: `${formData.get('firstName')} ${formData.get('lastName')}`.trim(),
            matriculeNational: formData.get('matriculeNational'),
            dateOfBirth: formData.get('dateOfBirth'),
            gender: genderMap[formData.get('gender')] || formData.get('gender'),
            roomId: roomIdValue && roomIdValue !== '' ? parseInt(roomIdValue) : null,
            doctorId: doctorId ? parseInt(doctorId) : null
        };
        
        const isEdit = e.target.dataset.patientId;
        
        try {
            let result;
            if (isEdit) {
                result = await api.put(`/admin/patients/${isEdit}`, patientData);
            } else {
                result = await api.post('/admin/patients', patientData);
            }
            
            if (result.success) {
                showNotification(isEdit ? 'Patient updated successfully' : 'Patient created successfully', 'success');
                document.getElementById('patientModal').style.display = 'none';
                await loadPatients();
                renderPatientsTable();
                updateStats();
            } else {
                showNotification(result.message || `Failed to ${isEdit ? 'update' : 'create'} patient`, 'error');
            }
        } catch (error) {
            console.error('Error submitting patient:', error);
            console.error('Error details:', error.data);
            let errorMessage = `Failed to ${isEdit ? 'update' : 'create'} patient`;
            
            // Try to extract more specific error information
            if (error.data) {
                if (typeof error.data === 'object' && error.data.message) {
                    errorMessage += ': ' + error.data.message;
                } else if (typeof error.data === 'string') {
                    errorMessage += ': ' + error.data;
                }
            }
            
            showNotification(errorMessage, 'error');
        }
    }

    // Handle export form submission (removed duplicate - using the complete implementation above)

    // Initialize the page
    init();
    updatePaginationInfo();
}