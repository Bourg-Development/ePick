// Mailing Lists Management Script
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {
        search: '',
        status: 'all',
        type: 'all'
    };
    let availableRoles = [];

    // Configure API utility
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Initialize page
    init();

    async function init() {
        await loadAvailableRoles();
        await loadMailingLists();
        bindEventListeners();
    }

    function bindEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = this.value;
                currentPage = 1;
                loadMailingLists();
            }, 300);
        });

        // Filter functionality
        document.getElementById('statusFilter').addEventListener('change', function() {
            currentFilters.status = this.value;
            currentPage = 1;
            loadMailingLists();
        });

        document.getElementById('typeFilter').addEventListener('change', function() {
            currentFilters.type = this.value;
            currentPage = 1;
            loadMailingLists();
        });

        // Create button
        document.getElementById('createListBtn').addEventListener('click', showCreateModal);

        // Form submission
        document.getElementById('mailingListForm').addEventListener('submit', handleFormSubmit);

        // Pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadMailingLists();
            }
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadMailingLists();
            }
        });

        // Modal close handlers
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                closeModal();
                closeDeleteModal();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                closeDeleteModal();
            }
        });
    }

    async function loadAvailableRoles() {
        try {
            const result = await api.get('/admin/roles');
            if (result.success && result.roles) {
                availableRoles = result.roles;
            } else {
                availableRoles = [];
            }
        } catch (error) {
            console.error('Error loading roles:', error);
            availableRoles = [];
        }
    }

    async function loadMailingLists() {
        showLoading();
        
        try {
            const params = {
                page: currentPage,
                limit: 10,
                ...currentFilters
            };

            const data = await api.get('/mailing', { params });

            if (data.success) {
                displayMailingLists(data.data.lists);
                updatePagination(data.data.pagination);
            } else {
                showToast('error', data.message || 'Failed to load mailing lists');
                showEmptyState();
            }
        } catch (error) {
            console.error('Error loading mailing lists:', error);
            showToast('error', error.data?.message || 'Failed to load mailing lists');
            showEmptyState();
        }
    }

    function displayMailingLists(lists) {
        const tbody = document.getElementById('mailingListsBody');
        const table = document.getElementById('mailingListsTable');
        const emptyState = document.getElementById('emptyState');
        const loadingSpinner = document.getElementById('loadingSpinner');

        loadingSpinner.style.display = 'none';

        if (lists.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        table.style.display = 'table';

        tbody.innerHTML = lists.map(list => `
            <tr>
                <td>
                    <div class="list-name">
                        <strong>${escapeHtml(list.name)}</strong>
                        ${list.is_internal ? '<span class="type-badge internal">Internal</span>' : '<span class="type-badge external">External</span>'}
                    </div>
                </td>
                <td>
                    <div class="list-description" title="${escapeHtml(list.description || '')}">
                        ${truncateText(list.description || 'No description', 80)}
                    </div>
                </td>
                <td>
                    ${list.is_internal ? 
                        '<span class="type-badge internal"><span class="material-symbols-outlined">business</span>Internal<div class="type-note">Users & Services only</div></span>' : 
                        '<span class="type-badge external"><span class="material-symbols-outlined">public</span>External<div class="type-note">All subscriber types</div></span>'
                    }
                </td>
                <td>
                    <div class="subscriber-count">
                        <span class="material-symbols-outlined">people</span>
                        ${list.subscriber_count || 0}
                        ${list.max_subscribers ? `/ ${list.max_subscribers}` : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${list.is_active ? 'active' : 'inactive'}">
                        <span class="material-symbols-outlined">${list.is_active ? 'check_circle' : 'cancel'}</span>
                        ${list.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${formatDate(list.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" onclick="viewList(${list.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="btn-action edit" onclick="editList(${list.id})" title="Edit List">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn-action subscribers" onclick="manageSubscribers(${list.id}, '${escapeHtml(list.name)}')" title="Manage Subscribers">
                            <span class="material-symbols-outlined">people</span>
                        </button>
                        <button class="btn-action delete" onclick="deleteList(${list.id}, '${escapeHtml(list.name)}')" title="Delete List">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function updatePagination(pagination) {
        const paginationContainer = document.getElementById('paginationContainer');
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageNumbers = document.getElementById('pageNumbers');

        // Hide pagination if no items or only one page
        if (pagination.total === 0 || pagination.pages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';
        totalPages = pagination.pages; // Use 'pages' instead of 'totalPages'

        // Calculate start and end items for display
        const startItem = (pagination.page - 1) * pagination.limit + 1;
        const endItem = Math.min(pagination.page * pagination.limit, pagination.total);
        
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${pagination.total} lists`;

        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Generate page numbers
        const pageRange = generatePageRange(currentPage, totalPages);
        pageNumbers.innerHTML = pageRange.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            }
            return `<a href="#" class="page-number ${page === currentPage ? 'active' : ''}" onclick="goToPage(${page})">${page}</a>`;
        }).join('');
    }

    function generatePageRange(current, total) {
        const range = [];
        const showPages = 5;
        
        if (total <= showPages) {
            for (let i = 1; i <= total; i++) {
                range.push(i);
            }
        } else {
            if (current <= 3) {
                for (let i = 1; i <= 4; i++) {
                    range.push(i);
                }
                range.push('...');
                range.push(total);
            } else if (current >= total - 2) {
                range.push(1);
                range.push('...');
                for (let i = total - 3; i <= total; i++) {
                    range.push(i);
                }
            } else {
                range.push(1);
                range.push('...');
                range.push(current - 1);
                range.push(current);
                range.push(current + 1);
                range.push('...');
                range.push(total);
            }
        }
        
        return range;
    }

    function showCreateModal() {
        const modal = document.getElementById('mailingListModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('mailingListForm');
        
        modalTitle.textContent = 'Create Mailing List';
        form.reset();
        document.getElementById('listId').value = '';
        
        populateRoleCheckboxes();
        modal.classList.add('show');
    }

    function populateRoleCheckboxes() {
        const container = document.getElementById('autoSubscribeRoles');
        
        if (!availableRoles || !Array.isArray(availableRoles)) {
            container.innerHTML = '<p>Loading roles...</p>';
            return;
        }
        
        container.innerHTML = availableRoles.map(role => `
            <label class="checkbox-label">
                <input type="checkbox" name="auto_subscribe_roles" value="${role.name}">
                <span class="checkmark"></span>
                ${role.name} (${role.description || 'No description'})
            </label>
        `).join('');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Handle checkboxes
        data.is_internal = document.getElementById('isInternal').checked;
        data.subscription_requires_approval = document.getElementById('requiresApproval').checked;
        
        // Handle auto subscribe roles
        const roleCheckboxes = document.querySelectorAll('input[name="auto_subscribe_roles"]:checked');
        data.auto_subscribe_roles = Array.from(roleCheckboxes).map(cb => cb.value);
        
        // Handle numeric fields
        if (data.max_subscribers) {
            data.max_subscribers = parseInt(data.max_subscribers);
        } else {
            delete data.max_subscribers;
        }

        // Clean up empty fields
        Object.keys(data).forEach(key => {
            if (data[key] === '' || data[key] === null) {
                delete data[key];
            }
        });

        const isEditing = !!(data.id && data.id !== '');
        
        // Remove id field for new records
        if (!isEditing) {
            delete data.id;
        }

        try {
            let result;
            if (isEditing) {
                result = await api.put(`/mailing/${data.id}`, data);
            } else {
                result = await api.post('/mailing', data);
            }

            if (result.success) {
                showToast('success', `Mailing list ${isEditing ? 'updated' : 'created'} successfully`);
                closeModal();
                loadMailingLists();
            } else {
                showToast('error', result.message || `Failed to ${isEditing ? 'update' : 'create'} mailing list`);
            }
        } catch (error) {
            console.error('Error saving mailing list:', error);
            showToast('error', error.data?.message || 'An error occurred while saving the mailing list');
        }
    }

    window.editList = async function(listId) {
        try {
            const result = await api.get(`/mailing/${listId}`);

            if (result.success) {
                const list = result.data;
                const modal = document.getElementById('mailingListModal');
                const modalTitle = document.getElementById('modalTitle');
                
                modalTitle.textContent = 'Edit Mailing List';
                
                // Populate form fields
                document.getElementById('listId').value = list.id;
                document.getElementById('listName').value = list.name;
                document.getElementById('listDescription').value = list.description || '';
                document.getElementById('senderEmail').value = list.sender_email || '';
                document.getElementById('senderName').value = list.sender_name || '';
                document.getElementById('isInternal').checked = list.is_internal;
                document.getElementById('requiresApproval').checked = list.subscription_requires_approval;
                document.getElementById('maxSubscribers').value = list.max_subscribers || '';
                
                populateRoleCheckboxes();
                
                // Check the appropriate role checkboxes
                if (list.auto_subscribe_roles) {
                    list.auto_subscribe_roles.forEach(role => {
                        const checkbox = document.querySelector(`input[name="auto_subscribe_roles"][value="${role}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
                
                modal.classList.add('show');
            } else {
                showToast('error', result.message || 'Failed to load mailing list details');
            }
        } catch (error) {
            console.error('Error loading mailing list:', error);
            showToast('error', error.data?.message || 'Failed to load mailing list details');
        }
    };

    window.viewList = function(listId) {
        // Navigate to detailed view page
        window.location.href = `/restricted/administration/mailing-lists/${listId}`;
    };

    // Subscriber Management Functions
    let currentListId = null;
    let currentListData = null;

    window.manageSubscribers = async function(listId, listName) {
        currentListId = listId;
        const modal = document.getElementById('subscribersModal');
        const listNameElement = document.getElementById('subscribersListName');
        
        listNameElement.textContent = listName;
        modal.classList.add('show');
        
        // Load list details to check if it's internal
        await loadCurrentListData();
        await loadSubscribers();
        await loadAvailableUsers();
        await loadAvailableServices();
    };

    async function loadCurrentListData() {
        try {
            const result = await api.get(`/mailing/${currentListId}`);
            if (result.success) {
                currentListData = result.data;
            }
        } catch (error) {
            console.error('Error loading list data:', error);
        }
    }

    window.closeSubscribersModal = function() {
        const modal = document.getElementById('subscribersModal');
        modal.classList.remove('show');
        currentListId = null;
    };

    window.showAddSubscriberModal = function() {
        const modal = document.getElementById('addSubscriberModal');
        modal.classList.add('show');
        
        // Reset form
        document.getElementById('addSubscriberForm').reset();
        document.querySelector('input[name="subscriberType"][value="user"]').checked = true;
        
        // Hide external email option for internal lists
        const externalRadio = document.querySelector('input[name="subscriberType"][value="external"]');
        const externalRadioLabel = externalRadio.closest('.radio-label');
        
        if (currentListData && currentListData.is_internal) {
            externalRadioLabel.style.display = 'none';
            // Make sure user is selected if external was previously selected
            if (externalRadio.checked) {
                document.querySelector('input[name="subscriberType"][value="user"]').checked = true;
            }
        } else {
            externalRadioLabel.style.display = 'flex';
        }
        
        toggleSubscriberType();
    };

    window.closeAddSubscriberModal = function() {
        const modal = document.getElementById('addSubscriberModal');
        modal.classList.remove('show');
    };

    window.toggleSubscriberType = function() {
        const selectedType = document.querySelector('input[name="subscriberType"]:checked').value;
        
        document.getElementById('userSelector').style.display = selectedType === 'user' ? 'block' : 'none';
        document.getElementById('serviceSelector').style.display = selectedType === 'service' ? 'block' : 'none';
        document.getElementById('externalInput').style.display = selectedType === 'external' ? 'block' : 'none';
    };

    async function loadSubscribers() {
        try {
            const result = await api.get(`/mailing/${currentListId}`);
            
            if (result.success && result.data && result.data.subscribers) {
                displaySubscribers(result.data.subscribers);
            } else {
                document.getElementById('subscribersList').innerHTML = '<p>No subscribers found.</p>';
            }
        } catch (error) {
            console.error('Error loading subscribers:', error);
            document.getElementById('subscribersList').innerHTML = '<p>Error loading subscribers.</p>';
        }
    }

    function displaySubscribers(subscribers) {
        const container = document.getElementById('subscribersList');
        
        if (!subscribers || subscribers.length === 0) {
            container.innerHTML = '<p>No subscribers found.</p>';
            return;
        }

        const html = subscribers.map(subscriber => {
            let name, email, type;
            
            if (subscriber.user) {
                name = subscriber.user.full_name || subscriber.user.username;
                email = subscriber.user.email;
                type = 'Internal User';
            } else if (subscriber.service) {
                name = subscriber.service.name;
                email = subscriber.service.email;
                type = 'Service';
            } else {
                name = subscriber.external_name || 'External Subscriber';
                email = subscriber.external_email;
                type = 'External';
            }

            const statusClass = subscriber.status === 'active' ? 'success' : 
                               subscriber.status === 'pending' ? 'warning' : 'danger';

            return `
                <div class="subscriber-item">
                    <div class="subscriber-info">
                        <div class="subscriber-name">${name}</div>
                        <div class="subscriber-email">${email}</div>
                        <div class="subscriber-meta">
                            <span class="subscriber-type">${type}</span>
                            <span class="subscriber-status status-${statusClass}">${subscriber.status}</span>
                        </div>
                    </div>
                    <div class="subscriber-actions">
                        ${subscriber.status === 'active' ? 
                            `<button class="btn btn-sm btn-danger" onclick="removeSubscriber(${subscriber.id}, '${name}')">
                                <span class="material-symbols-outlined">person_remove</span>
                                Remove
                            </button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    async function loadAvailableUsers() {
        try {
            const result = await api.get(`/mailing/${currentListId}/available-users`);
            const select = document.getElementById('userSelect');
            
            if (result.success && result.data) {
                const options = result.data.map(user => 
                    `<option value="${user.id}">${user.full_name || user.username} (${user.email})</option>`
                ).join('');
                
                select.innerHTML = '<option value="">Select a user...</option>' + options;
            } else {
                select.innerHTML = '<option value="">No available users</option>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
            document.getElementById('userSelect').innerHTML = '<option value="">Error loading users</option>';
        }
    }

    async function loadAvailableServices() {
        try {
            const result = await api.get(`/mailing/${currentListId}/available-services`);
            const select = document.getElementById('serviceSelect');
            
            if (result.success && result.data) {
                const options = result.data.map(service => 
                    `<option value="${service.id}">${service.name} (${service.email})</option>`
                ).join('');
                
                select.innerHTML = '<option value="">Select a service...</option>' + options;
            } else {
                select.innerHTML = '<option value="">No available services</option>';
            }
        } catch (error) {
            console.error('Error loading services:', error);
            document.getElementById('serviceSelect').innerHTML = '<option value="">Error loading services</option>';
        }
    }

    // Add subscriber form submission
    document.getElementById('addSubscriberForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const subscriberType = formData.get('subscriberType');
        
        const data = {};
        
        if (subscriberType === 'user') {
            const userId = formData.get('user_id') || document.getElementById('userSelect').value;
            if (!userId) {
                showToast('error', 'Please select a user');
                return;
            }
            data.user_id = parseInt(userId);
        } else if (subscriberType === 'service') {
            const serviceId = formData.get('service_id') || document.getElementById('serviceSelect').value;
            if (!serviceId) {
                showToast('error', 'Please select a service');
                return;
            }
            data.service_id = parseInt(serviceId);
        } else if (subscriberType === 'external') {
            const email = formData.get('external_email') || document.getElementById('externalEmail').value;
            if (!email) {
                showToast('error', 'Please enter an email address');
                return;
            }
            data.external_email = email;
            data.external_name = formData.get('external_name') || document.getElementById('externalName').value;
        }

        try {
            const result = await api.post(`/mailing/${currentListId}/subscribers`, data);
            
            if (result.success) {
                showToast('success', 'Subscriber added successfully');
                closeAddSubscriberModal();
                await loadSubscribers();
                await loadAvailableUsers(); // Refresh available users
                await loadAvailableServices(); // Refresh available services
            } else {
                showToast('error', result.message || 'Failed to add subscriber');
            }
        } catch (error) {
            console.error('Error adding subscriber:', error);
            showToast('error', error.data?.message || 'Failed to add subscriber');
        }
    });

    window.removeSubscriber = async function(subscriberId, subscriberName) {
        if (!confirm(`Are you sure you want to remove "${subscriberName}" from this mailing list?`)) {
            return;
        }

        try {
            const result = await api.delete(`/mailing/${currentListId}/subscribers/${subscriberId}`);
            
            if (result.success) {
                showToast('success', 'Subscriber removed successfully');
                await loadSubscribers();
                await loadAvailableUsers(); // Refresh available users
                await loadAvailableServices(); // Refresh available services
            } else {
                showToast('error', result.message || 'Failed to remove subscriber');
            }
        } catch (error) {
            console.error('Error removing subscriber:', error);
            showToast('error', error.data?.message || 'Failed to remove subscriber');
        }
    };

    window.searchSubscribers = function() {
        const searchTerm = document.getElementById('subscriberSearch').value.toLowerCase();
        const subscriberItems = document.querySelectorAll('.subscriber-item');
        
        subscriberItems.forEach(item => {
            const name = item.querySelector('.subscriber-name').textContent.toLowerCase();
            const email = item.querySelector('.subscriber-email').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || email.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    };

    window.deleteList = function(listId, listName) {
        const modal = document.getElementById('deleteModal');
        const nameElement = document.getElementById('deleteListName');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        nameElement.textContent = listName;
        
        confirmBtn.onclick = async function() {
            try {
                const result = await api.delete(`/mailing/${listId}`);

                if (result.success) {
                    showToast('success', 'Mailing list deleted successfully');
                    closeDeleteModal();
                    loadMailingLists();
                } else {
                    showToast('error', result.message || 'Failed to delete mailing list');
                }
            } catch (error) {
                console.error('Error deleting mailing list:', error);
                showToast('error', error.data?.message || 'Failed to delete mailing list');
            }
        };
        
        modal.classList.add('show');
    };

    window.goToPage = function(page) {
        currentPage = page;
        loadMailingLists();
    };

    window.closeModal = function() {
        const modal = document.getElementById('mailingListModal');
        modal.classList.remove('show');
    };

    window.closeDeleteModal = function() {
        const modal = document.getElementById('deleteModal');
        modal.classList.remove('show');
    };

    function showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.getElementById('mailingListsTable').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    function showEmptyState() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('mailingListsTable').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('paginationContainer').style.display = 'none';
    }

    function showToast(type, message) {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toastIcon');
        const messageEl = document.getElementById('toastMessage');
        
        toast.className = `toast ${type}`;
        messageEl.textContent = message;
        
        switch (type) {
            case 'success':
                icon.textContent = 'check_circle';
                break;
            case 'error':
                icon.textContent = 'error';
                break;
            case 'warning':
                icon.textContent = 'warning';
                break;
            default:
                icon.textContent = 'info';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return escapeHtml(text);
        return escapeHtml(text.substring(0, maxLength)) + '...';
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
});