document.addEventListener('DOMContentLoaded', function() {
    // Sample data
    const analysisData = [
        {id: 1, date: '2025-05-01', name: 'Jean-Claude Schultz', doctor: 'Jean' , room: '4125', status: 'pending', statusText: 'Pending', type: 'XY'},
        {id: 2, date: '2025-05-02', name: 'Marie-Anne du Coin', doctor: 'Jean', room: '4153', status: 'pending', statusText: 'Pending', type: 'YZ'},
        {id: 3, date: '2025-05-03', name: 'Claude Meier', doctor: 'Jean', room: '4178', status: 'delayed', statusText: 'Delayed', type: 'ZG'},
        {id: 4, date: '2025-05-04', name: 'Sophie Schneider', doctor: 'Jean', room: '4587', status: 'completed', statusText: 'Completed', type: 'HG'}
    ];

    // Patient names for suggestions
    const patientNames =analysisData.map(entry => entry.name);
    const doctorNames = analysisData.map(entry => entry.doctor).sort().filter(function(item, pos, ary) {
        return !pos || item != ary[pos - 1];
    });


    const keybinds = {
        'Escape': () => {
            if(suggestionsShown === true) return hideSuggestions()
            if(activeDropdown !== null) return closeDropdown()
            editModal.classList.remove('show');
            confirmModal.classList.remove('show')
        }
    }

    // DOM Elements
    const tableBody = document.querySelector('#analysisTable tbody');
    const searchInput = document.getElementById('searchInput');
    const newPatientInput = document.getElementById('patientName');
    const newPatientDoctorInput = document.getElementById('doctor');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const recordCount = document.getElementById('recordCount');
    const addNewBtn = document.getElementById('addNewBtn');
    const editModal = document.getElementById('editModal');
    const confirmModal = document.getElementById('confirmModal');
    const analysisForm = document.getElementById('analysisForm');
    const modalTitle = document.getElementById('modalTitle');
    const confirmBtn = document.getElementById('confirmBtn');
    const confirmMessage = document.getElementById('confirmMessage');
    const printButton = document.getElementById('printBtn');


    // State variables
    let currentEditId = null;
    let nextId = 5;
    let activeDropdown = null;
    let suggestionsShown = false;

    // Initialize
    renderTable();
    setupEventListeners();

    /**
     * Setup all event listeners
     */
    function setupEventListeners() {
        // Search input
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('focus', showDefaultSuggestions);

        //TODO
        // New Patient name input
        newPatientInput.addEventListener('input', handleSearchInput);
        newPatientInput.addEventListener('focus', showDefaultSuggestions);


        //TODO
        // New patient doctor input
        newPatientDoctorInput.addEventListener('input', handleSearchInput);
        newPatientDoctorInput.addEventListener('focus', showDefaultSuggestions)

        // Filter changes
        statusFilter.addEventListener('change', renderTable);
        typeFilter.addEventListener('change', renderTable);

        // Add new button
        addNewBtn.addEventListener('click', function() {
            showEditModal();
        });

        // Form submission
        analysisForm.addEventListener('submit', handleFormSubmit);

        // Document printing
        printButton.addEventListener('click', openPrintDialog);

        // Column sorting
        document.querySelectorAll('#analysisTable th[data-sort]').forEach(th => {
            th.addEventListener('click', function() {
                const field = this.getAttribute('data-sort');
                sortData(field);
                resetSortIcons()
                th.children[0].textContent = 'arrow_downward';
            });
        });

        // Modal close buttons
        document.getElementById('closeModalBtn').addEventListener('click', function() {
            editModal.classList.remove('show');
        });

        document.getElementById('cancelBtn').addEventListener('click', function() {
            editModal.classList.remove('show');
        });

        document.getElementById('closeConfirmBtn').addEventListener('click', function() {
            confirmModal.classList.remove('show');
        });

        document.getElementById('cancelConfirmBtn').addEventListener('click', function() {
            confirmModal.classList.remove('show');
        });

        // Global click for closing dropdowns
        document.addEventListener('click', function(e) {
            if (activeDropdown && !e.target.closest('.dropdown-container')) {
                closeDropdown();
            }

            if (!e.target.closest('.search-box')) {
                hideSuggestions();
            }
        });

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

    /**
     * Get view as PDF and open print dialog
     */
    function openPrintDialog(){
        fetch('https://app3-prod-01-fra.b0urg.com/static/media/brochure.pdf')
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const printWindow = window.open(url);
                if (printWindow) {
                    printWindow.onload = () => {
                        printWindow.focus();
                        printWindow.print();
                    };
                } else {
                    console.error("Popup blocked");
                }
            });
    }

    /**
     * Handle search input changes
     */
    function handleSearchInput(e) {
        const query = e.target.value.toLowerCase();

        if (query.length > 0) {
            let filtered;
            const isDoctors = e.target.id.includes('doctor');
            if(isDoctors){
                filtered = doctorNames.filter(name =>
                    name.toLowerCase().includes(query)
                );
            }else{
                filtered = patientNames.filter(name =>
                    name.toLowerCase().includes(query)
                );
            }
            if (filtered.length > 0) {
                showSuggestions(filtered, e.target.id);
            } else {
                if(e.target.id === 'searchInput'){
                    renderTable()
                    hideSuggestions()
                    return
                }
                showSuggestions([ `Add ${e.target.value}...` ], e.target.id, true)
            }
        } else {
            hideSuggestions();
        }

        renderTable();
    }

    /**
     * Show all patient name suggestions
     */
    function showDefaultSuggestions(e) {
        const id = e.currentTarget.id
        if(e.target.value.length > 0) return handleSearchInput(e)
        if(id.includes('doctor')){
            if (doctorNames.length > 0){
                showSuggestions(doctorNames.slice(0, 5), id)
            }
        }else{
            if (patientNames.length > 0) {
                showSuggestions(patientNames.slice(0, 5), id);
            }
        }
    }

    /**
     * Show search suggestions
     */
    function showSuggestions(suggestions, id, addOnClick=false) {
        if(suggestionsShown) hideSuggestions()
        let suggestionsContainer;
        switch (id){
            case 'searchInput': {
                suggestionsContainer = document.getElementById('main-search__searchSuggestions')
                break
            }
            case 'patientName': {
                suggestionsContainer = document.getElementById('add-form-patient__searchSuggestions')
                break
            }
            case 'doctor': {
                suggestionsContainer = document.getElementById('add-form-doctors__searchSuggestions')
                break
            }
        }
        suggestionsContainer.innerHTML = '';

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;

            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                if(addOnClick){
                    if(id.includes('doctor')){
                        doctorNames.push(document.getElementById(id).value)
                    } else{
                        patientNames.push(document.getElementById(id).value)
                    }
                }
                document.getElementById(id).value = addOnClick ? suggestion.slice(4, -3) :  suggestion;
                hideSuggestions();
                if(id.includes('search')) renderTable();
            });

            suggestionsContainer.appendChild(item);
        });

        suggestionsContainer.classList.add('show');
        suggestionsShown = true;
    }

    /**
     * Hide all search suggestions
     */
    function hideSuggestions() {
        const suggestionContainers = [ 'main-search__searchSuggestions', 'add-form-patient__searchSuggestions', 'add-form-doctors__searchSuggestions' ]
        suggestionContainers.forEach(id => {
            document.getElementById(id).classList.remove('show');
            suggestionsShown = false;
        })
    }

    /**
     * Render the table with filtered data
     */
    function renderTable() {
        tableBody.innerHTML = '';

        const filtered = getFilteredData();

        filtered.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;

            const statusClass = `status-${item.status}`;

            row.innerHTML = `
                        <td>${item.date}</td>
                        <td>${item.name}</td>
                        <td>${item.doctor}</td>
                        <td>${item.room}</td>
                        <td>
                            <div class="dropdown-container">
                                <span class="status-badge ${statusClass}" data-id="${item.id}">${item.statusText}</span>
                            </div>
                        </td>
                        <td>${item.type}</td>
                        <td>
                            <div class="dropdown-container">
                                <button class="action-button" data-id="${item.id}">
                                    <span class="material-symbols-outlined">
                                        more_vert
                                    </span>
                                </button>
                            </div>
                        </td>
                    `;

            tableBody.appendChild(row);
        });

        // Update record count
        recordCount.textContent = `Showing ${filtered.length} analyses`;

        // Add click handlers for status badges and action buttons
        document.querySelectorAll('.status-badge').forEach(badge => {
            badge.addEventListener('click', handleStatusClick);
        });

        document.querySelectorAll('.action-button').forEach(btn => {
            btn.addEventListener('click', handleActionClick);
        });
    }

    /**
     * Get filtered data based on search and filters
     */
    function getFilteredData() {
        const searchTerm = searchInput.value.toLowerCase();
        const status = statusFilter.value;
        const type = typeFilter.value;

        return analysisData.filter(item => {
            const matchSearch = searchTerm === '' || item.name.toLowerCase().includes(searchTerm) ||item.doctor.toLowerCase().includes(searchTerm) || item.room.includes(searchTerm);
            const matchStatus = status === '' || item.status === status;
            const matchType = type === '' || item.type === type;

            return matchSearch && matchStatus && matchType;
        });
    }

    /**
     * Sort data by column
     */
    function sortData(field) {
        analysisData.sort((a, b) => {
            if (field === 'date') {
                return new Date(a.date) - new Date(b.date);
            } else if (field === 'name' || field === 'doctor') {
                return a[field].localeCompare(b[field]);
            } else if (field === 'room') {
                return parseInt(a.room) - parseInt(b.room);
            }
            return 0;
        });

        renderTable();
    }

    /**
     * Handle status badge click
     */
    function handleStatusClick(e) {
        e.stopPropagation();
        const badge = e.currentTarget;

        if (badge.textContent !== 'Pending') return;

        // Close any existing dropdown
        if (activeDropdown) {
            closeDropdown();
        }

        const id = parseInt(badge.dataset.id);
        const container = badge.closest('.dropdown-container');

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu status-dropdown show';
        dropdown.innerHTML = `
                    <div class="dropdown-item status-completed">Completed</div>
                    <div class="dropdown-item status-pending">Pending</div>
                `;

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();

                const status = this.classList.contains('status-completed') ? 'completed' :
                    this.classList.contains('status-delayed') ? 'delayed' : 'pending';
                const statusText = status.charAt(0).toUpperCase() + status.slice(1);

                updateStatus(id, status, statusText);
                closeDropdown();
            });
        });

        container.appendChild(dropdown);
        activeDropdown = dropdown;
    }

    /**
     * Handle action button click
     */
    function handleActionClick(e) {
        e.stopPropagation();

        // Close any existing dropdown
        if (activeDropdown) {
            closeDropdown();
        }

        const button = e.currentTarget;
        const id = parseInt(button.dataset.id);
        const container = button.closest('.dropdown-container');
        const row = button.closest('tr');
        const status = row.querySelector('.status-badge').classList.contains('status-delayed');

        // Create dropdown with or without postpone option
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu action-dropdown show';

        if (status) {
            // No postpone option for already delayed items
            dropdown.innerHTML = `
                        <div class="dropdown-item" data-action="edit">
                            <span class="material-symbols-outlined">
                                edit
                            </span>
                        ️   Edit
                        </div>
                        <div class="dropdown-item" data-action="delete">
                            <span class="material-symbols-outlined">
                                delete
                            </span>
                            Delete
                         </div>
                    `;
        } else {
            dropdown.innerHTML = `
                        <div class="dropdown-item" data-action="edit">
                            <span class="material-symbols-outlined">
                                edit
                            </span>
                            Edit
                         </div>
                        <div class="dropdown-item" data-action="postpone">
                            <span class="material-symbols-outlined">
                                more_time
                            </span>
                            Postpone
                         </div>
                        <div class="dropdown-item" data-action="delete">
                            <span class="material-symbols-outlined">
                                delete
                            </span>
                            Delete
                         </div>
                    `;
        }

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();

                const action = this.dataset.action;

                if (action === 'edit') {
                    showEditModal(id);
                } else if (action === 'postpone') {
                    showConfirmModal('postpone', id);
                } else if (action === 'delete') {
                    showConfirmModal('delete', id);
                }

                closeDropdown();
            });
        });

        container.appendChild(dropdown);
        activeDropdown = dropdown;
    }

    /**
     * Close active dropdown
     */
    function closeDropdown() {
        if (activeDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
        }
    }

    /**
     * Update status of an analysis
     */
    function updateStatus(id, status, statusText) {
        const item = analysisData.find(item => item.id === id);
        if (item) {
            item.status = status;
            item.statusText = statusText;
            renderTable();
        }
    }

    /**
     * Show edit modal to add or edit an analysis
     */
    function showEditModal(id = null) {
        analysisForm.reset();

        if (id) {
            // Edit existing
            const item = analysisData.find(item => item.id === id);
            if (item) {
                document.getElementById('analysisDate').value = item.date;
                document.getElementById('patientName').value = item.name;
                document.getElementById('patientRoom').value = item.room;
                document.getElementById('doctor').value = item.doctor;
                document.getElementById('analysisStatus').value = item.status;
                document.getElementById('analysisType').value = item.type;

                modalTitle.textContent = 'Edit Analysis';
                currentEditId = id;
            }
        } else {
            // Add new
            document.getElementById('analysisDate').value = new Date().toISOString().split('T')[0];
            modalTitle.textContent = 'Add New Analysis';
            currentEditId = null;
        }

        editModal.classList.add('show');
    }

    /**
     * Show confirmation modal
     */
    function showConfirmModal(action, id) {
        if (action === 'delete') {
            confirmMessage.textContent = 'Are you sure you want to delete this analysis?';
            confirmBtn.onclick = function() {
                deleteAnalysis(id);
                confirmModal.classList.remove('show');
            };
        } else if (action === 'postpone') {
            confirmMessage.textContent = 'Are you sure you want to postpone this analysis?';
            confirmBtn.onclick = function() {
                postponeAnalysis(id);
                confirmModal.classList.remove('show');
            };
        }

        confirmModal.classList.add('show');
    }

    /**
     * Handle form submission
     */
    function handleFormSubmit(e) {
        e.preventDefault();

        const date = document.getElementById('analysisDate').value;
        const name = document.getElementById('patientName').value;
        const doctor = document.getElementById('doctor').value;
        const room = document.getElementById('patientRoom').value;
        const status = document.getElementById('analysisStatus').value;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        const type = document.getElementById('analysisType').value;

        // Validate data

        if(room.length !== 4){
            return showToast('Invalid Room', 'error')
        }

        if (currentEditId) {
            // Update existing
            const item = analysisData.find(item => item.id === currentEditId);
            if (item) {
                item.date = date;
                item.name = name;
                item.doctor = doctor;
                item.room = room;
                item.status = status;
                item.statusText = statusText;
                item.type = type;
            }
        } else {
            // Add new
            analysisData.push({
                id: nextId++,
                date,
                name,
                doctor,
                room,
                status,
                statusText,
                type,
            });
        }

        // Add to patient names if not already there
        if (!patientNames.includes(name)) {
            patientNames.push(name);
        }

        // Add to doctor names if not already there
        if(!doctorNames.includes(doctor)){
            doctorNames.push(doctor);
        }

        editModal.classList.remove('show');
        showToast('Entry created successfully', 'success')
        renderTable();
    }

    /**
     * Delete an analysis
     */
    function deleteAnalysis(id) {
        const index = analysisData.findIndex(item => item.id === id);
        if (index !== -1) {
            analysisData.splice(index, 1);
            renderTable();
        }
    }

    /**
     * Postpone an analysis
     */
    function postponeAnalysis(id) {
        const item = analysisData.find(item => item.id === id);
        if (item) {
            item.status = 'delayed';
            item.statusText = 'Delayed';
            renderTable();
        }
    }

    /**
     * Reset all sort icons
     */
    function resetSortIcons(){
        document.querySelectorAll('th[data-sort]').forEach(th => th.children[0].textContent = 'swap_vert');
    }

});
