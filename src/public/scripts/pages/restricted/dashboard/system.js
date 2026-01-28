// System Administration Page
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Configure API utility
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Initialize page
    init();

    async function init() {
        await loadSystemStats();
        await loadActivityLogs();
        initializeEventListeners();
        
        // Auto-refresh stats every 30 seconds
        setInterval(loadSystemStats, 30000);
    }

    function initializeEventListeners() {
        // Refresh button
        document.getElementById('refreshStatsBtn').addEventListener('click', loadSystemStats);

        // Maintenance mode toggle
        document.getElementById('maintenanceToggle').addEventListener('change', toggleMaintenanceMode);

        // System update buttons
        document.getElementById('createUpdateBtn').addEventListener('click', openCreateUpdateModal);
        document.getElementById('viewUpdatesBtn').addEventListener('click', openViewUpdatesModal);
        document.getElementById('githubStatusBtn').addEventListener('click', openGitHubStatusModal);

        // Control buttons
        document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
        document.getElementById('viewLogsBtn').addEventListener('click', showLogViewer);
        document.getElementById('downloadLogsBtn').addEventListener('click', downloadLogs);
        document.getElementById('shutdownSystemBtn').addEventListener('click', confirmSystemShutdown);

        // Activity tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                switchActivityTab(this.dataset.tab);
            });
        });

        // Log viewer
        document.getElementById('refreshLogsBtn').addEventListener('click', refreshLogs);
        document.getElementById('logFileSelect').addEventListener('change', refreshLogs);

        // Modal close handlers
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeAllModals();
            }
        });

        // System update form submission
        document.getElementById('createUpdateForm').addEventListener('submit', createSystemUpdate);

        // System update management buttons
        document.getElementById('refreshUpdatesBtn').addEventListener('click', loadSystemUpdates);
        document.getElementById('updateStatusFilter').addEventListener('change', loadSystemUpdates);
        document.getElementById('updatePriorityFilter').addEventListener('change', loadSystemUpdates);

        // GitHub integration buttons
        document.getElementById('refreshGitHubStatusBtn').addEventListener('click', loadGitHubStatus);

        // Category checkbox handlers
        document.querySelectorAll('.category-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const categoryItems = this.closest('.change-category').querySelector('.category-items');
                if (this.checked) {
                    categoryItems.style.display = 'block';
                } else {
                    categoryItems.style.display = 'none';
                    categoryItems.querySelector('.category-textarea').value = '';
                }
            });
        });
    }

    // Load system statistics
    async function loadSystemStats() {
        try {
            const response = await api.get('/admin/system/stats');
            
            if (response.success) {
                updateSystemStats(response.data);
            } else {
                console.error('Failed to load system stats:', response.message);
                showToast(__('messages.error.failedLoadSystemStats'), 'error');
            }
        } catch (error) {
            console.error('Error loading system stats:', error);
            // If we can load the page, the system is online - just show default values
            updateSystemStats({
                status: 'online',
                uptime: 'Unable to load',
                lastRestart: 'Unable to load',
                environment: 'Unable to load',
                performance: { cpu: 0, memory: 0, disk: 0 },
                database: { status: 'Unable to load', connections: '0', size: 'Unable to load' },
                application: { activeSessions: '0', totalUsers: '0', activeMailingLists: '0' },
                maintenanceMode: false
            });
        }
    }

    // Update system statistics in the UI
    function updateSystemStats(data) {
        // System Status
        updateSystemStatus(data.status || 'online');
        updateElement('systemUptime', data.uptime || 'Unknown');
        updateElement('lastRestart', data.lastRestart || 'Unknown');
        updateElement('environment', data.environment || 'Unknown');

        // Performance Stats
        updatePerformanceStat('cpu', data.performance?.cpu || 0);
        updatePerformanceStat('memory', data.performance?.memory || 0);
        updatePerformanceStat('disk', data.performance?.disk || 0);

        // Database Stats
        updateElement('dbStatus', data.database?.status || 'Unknown');
        updateElement('dbConnections', data.database?.connections || '0');
        updateElement('dbSize', data.database?.size || 'Unknown');

        // Application Stats
        updateElement('activeSessions', data.application?.activeSessions || '0');
        updateElement('totalUsers', data.application?.totalUsers || '0');
        updateElement('activeMailingLists', data.application?.activeMailingLists || '0');

        // Maintenance Mode
        updateMaintenanceMode(data.maintenanceMode || false);
    }

    function updateSystemStatus(status) {
        const statusElement = document.getElementById('systemStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.childNodes[2]; // Text node after the dot

        statusDot.className = `status-dot ${status}`;
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

        if (status === 'online') {
            statusElement.style.background = 'rgba(40, 167, 69, 0.1)';
            statusElement.style.color = '#28a745';
        } else if (status === 'offline') {
            statusElement.style.background = 'rgba(220, 53, 69, 0.1)';
            statusElement.style.color = '#dc3545';
        } else {
            statusElement.style.background = 'rgba(255, 193, 7, 0.1)';
            statusElement.style.color = '#ffc107';
        }
    }

    function updatePerformanceStat(type, percentage) {
        const usageElement = document.getElementById(`${type}Usage`);
        const progressElement = document.getElementById(`${type}Progress`);

        if (usageElement) {
            usageElement.textContent = `${percentage}%`;
        }

        if (progressElement) {
            progressElement.style.width = `${percentage}%`;
            
            // Update progress bar color based on usage
            if (percentage < 70) {
                progressElement.className = 'progress-fill';
            } else if (percentage < 90) {
                progressElement.className = 'progress-fill warning';
            } else {
                progressElement.className = 'progress-fill danger';
            }
        }
    }

    function updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function updateMaintenanceMode(enabled) {
        const toggle = document.getElementById('maintenanceToggle');
        if (toggle) {
            toggle.checked = enabled;
        }
    }

    // Toggle maintenance mode
    async function toggleMaintenanceMode() {
        const toggle = document.getElementById('maintenanceToggle');
        const enabled = toggle.checked;
        
        try {
            const endpoint = enabled ? '/api/admin/system/maintenance/enable' : '/api/admin/system/maintenance/disable';
            const response = await api.post(endpoint);
            
            if (response.success) {
                showToast(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`, 'success');
                updateMaintenanceMode(enabled);
            } else {
                showToast(`Failed to ${enabled ? 'enable' : 'disable'} maintenance mode`, 'error');
                toggle.checked = !enabled; // Revert toggle state
            }
        } catch (error) {
            console.error('Toggle maintenance mode error:', error);
            showToast(`Failed to ${enabled ? 'enable' : 'disable'} maintenance mode`, 'error');
            toggle.checked = !enabled; // Revert toggle state
        }
    }

    // Clear cache
    async function clearCache() {
        try {
            const response = await api.post('/admin/system/clear-cache');

            if (response.success) {
                showToast(__('messages.success.cacheCleared'), 'success');
            } else {
                showToast(__('messages.error.failedClearCache'), 'error');
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            showToast(__('messages.error.failedClearCache'), 'error');
        }
    }

    // Show log viewer modal
    function showLogViewer() {
        document.getElementById('logViewerModal').classList.add('show');
        refreshLogs();
    }

    // Close log viewer modal
    window.closeLogViewer = function() {
        document.getElementById('logViewerModal').classList.remove('show');
    };

    // Refresh logs
    async function refreshLogs() {
        const logType = document.getElementById('logFileSelect').value;
        const logText = document.getElementById('logText');

        logText.textContent = 'Loading logs...';

        try {
            const response = await api.get(`/admin/system/logs/${logType}`);

            if (response.success) {
                logText.textContent = response.data.content || 'No logs available';
            } else {
                logText.textContent = 'Failed to load logs';
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            logText.textContent = 'Error loading logs';
        }
    }

    // Download logs
    async function downloadLogs() {
        try {
            // Use fetch directly for file download
            const response = await fetch('/api/admin/system/logs/download', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include cookies for authentication
            });

            if (response.ok) {
                // Get the response as blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                showToast(__('messages.success.logsDownloaded'), 'success');
            } else {
                showToast(__('messages.error.failedDownloadLogs'), 'error');
            }
        } catch (error) {
            console.error('Error downloading logs:', error);
            showToast(__('messages.error.failedDownloadLogs'), 'error');
        }
    }

    // Confirm system shutdown
    function confirmSystemShutdown() {
        showConfirmModal(
            __('system.shutdownSystem'),
            __('system.shutdownConfirmMessage'),
            __('system.shutdown'),
            shutdownSystem
        );
    }

    // Shutdown system
    async function shutdownSystem() {
        try {
            const response = await api.post('/admin/system/shutdown');

            if (response.success) {
                showToast(__('messages.info.shutdownInitiated'), 'info');
                closeConfirmModal();

                // Show message about system shutdown
                showToast(__('messages.warning.systemShuttingDown'), 'warning');
            } else {
                showToast(__('messages.error.failedShutdown'), 'error');
            }
        } catch (error) {
            console.error('Error shutting down system:', error);
            showToast(__('messages.error.failedShutdown'), 'error');
        }
    }

    // Load activity logs
    async function loadActivityLogs() {
        await loadSystemEvents();
        await loadUserActivity();
        await loadErrorLogs();
    }

    async function loadSystemEvents() {
        try {
            const response = await api.get('/admin/system/events');
            
            if (response.success) {
                renderActivityList('systemEventsList', response.data.events || []);
            }
        } catch (error) {
            console.error('Error loading system events:', error);
            renderActivityError('systemEventsList', 'Failed to load system events');
        }
    }

    async function loadUserActivity() {
        try {
            const response = await api.get('/admin/system/user-activity');
            
            if (response.success) {
                renderActivityList('userActivityList', response.data.activity || []);
            }
        } catch (error) {
            console.error('Error loading user activity:', error);
            renderActivityError('userActivityList', 'Failed to load user activity');
        }
    }

    async function loadErrorLogs() {
        try {
            const response = await api.get('/admin/system/error-logs');
            
            if (response.success) {
                renderActivityList('errorLogsList', response.data.errors || []);
            }
        } catch (error) {
            console.error('Error loading error logs:', error);
            renderActivityError('errorLogsList', 'Failed to load error logs');
        }
    }

    function renderActivityList(containerId, items) {
        const container = document.getElementById(containerId);
        
        if (items.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No items to display</div>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="activity-item">
                <div class="activity-icon ${item.type || 'info'}">
                    <span class="material-symbols-outlined">
                        ${getActivityIcon(item.type)}
                    </span>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(item.title || item.message)}</div>
                    <div class="activity-description">${escapeHtml(item.description || '')}</div>
                    <div class="activity-time">${formatDate(item.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    function renderActivityError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `<div class="loading-placeholder">${message}</div>`;
    }

    function getActivityIcon(type) {
        const icons = {
            info: 'info',
            warning: 'warning',
            error: 'error',
            success: 'check_circle',
            user: 'person',
            system: 'computer'
        };
        return icons[type] || 'info';
    }

    // Switch activity tab
    function switchActivityTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
    }

    // Show confirmation modal
    function showConfirmModal(title, message, actionText, actionCallback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        const actionBtn = document.getElementById('confirmActionBtn');
        actionBtn.textContent = actionText;
        actionBtn.onclick = actionCallback;

        document.getElementById('confirmModal').classList.add('show');
    }

    // Close confirmation modal
    window.closeConfirmModal = function() {
        document.getElementById('confirmModal').classList.remove('show');
    };

    // Close all modals
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }


    // ===== SYSTEM UPDATE FUNCTIONS =====

    // Open create update modal
    function openCreateUpdateModal() {
        document.getElementById('createUpdateModal').classList.add('show');
    }

    // Close create update modal
    window.closeCreateUpdateModal = function() {
        document.getElementById('createUpdateModal').classList.remove('show');
        document.getElementById('createUpdateForm').reset();
        // Reset category checkboxes and hide items
        document.querySelectorAll('.category-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            const categoryItems = checkbox.closest('.change-category').querySelector('.category-items');
            categoryItems.style.display = 'none';
            categoryItems.querySelector('.category-textarea').value = '';
        });
    };

    // Open view updates modal
    function openViewUpdatesModal() {
        document.getElementById('viewUpdatesModal').classList.add('show');
        loadSystemUpdates();
    }

    // Close view updates modal
    window.closeViewUpdatesModal = function() {
        document.getElementById('viewUpdatesModal').classList.remove('show');
    };

    // Close update details modal
    window.closeUpdateDetailsModal = function() {
        document.getElementById('updateDetailsModal').classList.remove('show');
    };

    // Handle create update form submission
    async function createSystemUpdate(e) {
        e.preventDefault();
        
        // Collect changes data
        const changes = [];
        document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
            const category = checkbox.value;
            const textarea = checkbox.closest('.change-category').querySelector('.category-textarea');
            const items = textarea.value.split('\n').filter(item => item.trim()).map(item => item.trim());
            
            if (items.length > 0) {
                changes.push({
                    category: category,
                    items: items
                });
            }
        });

        const formData = {
            version: document.getElementById('updateVersion').value,
            title: document.getElementById('updateTitle').value,
            description: document.getElementById('updateDescription').value,
            release_type: document.getElementById('updateReleaseType').value,
            priority: document.getElementById('updatePriority').value,
            changes: changes.length > 0 ? changes : null,
            requires_acknowledgment: document.getElementById('updateRequiresAck').checked,
            show_popup: document.getElementById('updateShowPopup').checked,
            popup_duration_days: parseInt(document.getElementById('updatePopupDuration').value)
        };

        try {
            const response = await api.post('/system-updates', formData);
            
            if (response.success) {
                showToast(__('messages.success.updateCreated'), 'success');
                closeCreateUpdateModal();
                // Refresh updates list if open
                if (document.getElementById('viewUpdatesModal').classList.contains('show')) {
                    loadSystemUpdates();
                }
            } else {
                showToast(__('messages.error.failedCreateUpdate') + ': ' + response.message, 'error');
            }
        } catch (error) {
            console.error('Create system update error:', error);
            showToast(__('messages.error.failedCreateUpdate') + ': ' + error.message, 'error');
        }
    }

    // Load system updates
    async function loadSystemUpdates() {
        const listContainer = document.getElementById('updatesList');
        listContainer.innerHTML = '<div class="loading-state"><span class="material-symbols-outlined spinning">hourglass_empty</span>Loading...</div>';

        try {
            const statusFilter = document.getElementById('updateStatusFilter').value;
            const priorityFilter = document.getElementById('updatePriorityFilter').value;
            
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);

            const response = await api.get(`/system-updates?${params.toString()}`);
            
            if (response.success) {
                renderUpdatesList(response.data.updates);
            } else {
                listContainer.innerHTML = '<div class="error-state">Failed to load system updates</div>';
            }
        } catch (error) {
            listContainer.innerHTML = '<div class="error-state">Failed to load system updates</div>';
        }
    }

    // Render updates list
    function renderUpdatesList(updates) {
        const listContainer = document.getElementById('updatesList');
        
        if (!updates || updates.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No system updates found</div>';
            return;
        }

        const html = updates.map(update => `
            <div class="update-item ${update.status}" onclick="viewUpdateDetails(${update.id})">
                <div class="update-header">
                    <div>
                        <div class="update-version">Version ${escapeHtml(update.version)}</div>
                        <h4>${escapeHtml(update.title)}</h4>
                    </div>
                    <div class="update-badges">
                        <span class="badge release-${update.release_type}">${update.release_type}</span>
                        <span class="badge priority-${update.priority}">${update.priority}</span>
                        <span class="badge status-${update.status}">${update.status}</span>
                    </div>
                </div>
                <div class="update-meta">
                    <div class="meta-item">
                        <span class="material-symbols-outlined">person</span>
                        Published by: ${update.publisher ? escapeHtml(`${update.publisher.first_name} ${update.publisher.last_name}`) : 'Unknown'}
                    </div>
                    ${update.published_at ? `
                        <div class="meta-item">
                            <span class="material-symbols-outlined">schedule</span>
                            Published: ${formatDate(update.published_at)}
                        </div>
                    ` : ''}
                </div>
                ${update.description ? `<div class="update-description">${escapeHtml(update.description)}</div>` : ''}
                <div class="update-actions">
                    ${update.status === 'draft' ? `
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); publishUpdate(${update.id})">Publish</button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editUpdate(${update.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteUpdate(${update.id})">Delete</button>
                    ` : ''}
                    ${update.status === 'published' ? `
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); getUpdateStats(${update.id})">View Stats</button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); resendNotifications(${update.id})">Resend Notifications</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        listContainer.innerHTML = html;
    }

    // View update details
    window.viewUpdateDetails = async function(updateId) {
        try {
            const response = await api.get(`/system-updates/${updateId}`);
            
            if (response.success) {
                renderUpdateDetails(response.data);
                document.getElementById('updateDetailsModal').classList.add('show');
            } else {
                showToast(__('messages.error.failedLoadUpdateDetails'), 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedLoadUpdateDetails'), 'error');
        }
    };

    // Render update details
    function renderUpdateDetails(update) {
        const content = document.getElementById('updateDetailsContent');
        
        let changesHtml = '';
        if (update.changes && Array.isArray(update.changes)) {
            changesHtml = `
                <div class="update-changes-section">
                    <h4 class="update-changes-title">Changes</h4>
                    ${update.changes.map(changeGroup => `
                        <div class="update-change-category">
                            <h5>${getCategoryDisplay(changeGroup.category)}</h5>
                            <ul class="update-change-list">
                                ${changeGroup.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const html = `
            <div class="update-details">
                <div class="detail-section">
                    <h4>Version ${escapeHtml(update.version)} - ${escapeHtml(update.title)}</h4>
                    <div class="detail-badges">
                        <span class="badge release-${update.release_type}">${update.release_type}</span>
                        <span class="badge priority-${update.priority}">${update.priority}</span>
                        <span class="badge status-${update.status}">${update.status}</span>
                    </div>
                </div>

                ${update.description ? `
                    <div class="detail-section">
                        <h5>Description</h5>
                        <p>${escapeHtml(update.description)}</p>
                    </div>
                ` : ''}

                ${changesHtml}

                <div class="detail-section">
                    <h5>Settings</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Requires Acknowledgment:</strong> ${update.requires_acknowledgment ? 'Yes' : 'No'}
                        </div>
                        <div class="detail-item">
                            <strong>Show Popup:</strong> ${update.show_popup ? 'Yes' : 'No'}
                        </div>
                        <div class="detail-item">
                            <strong>Popup Duration:</strong> ${update.popup_duration_days} days
                        </div>
                        <div class="detail-item">
                            <strong>Email Sent:</strong> ${update.email_sent ? 'Yes' : 'No'}
                        </div>
                    </div>
                </div>

                ${update.status === 'published' ? `
                    <div class="acknowledgment-stats">
                        <h5>User Engagement</h5>
                        <div class="stats-grid" id="updateStatsGrid">
                            <div class="loading-state">Loading stats...</div>
                        </div>
                    </div>
                ` : ''}

                <div class="update-actions">
                    ${update.status === 'draft' ? `
                        <button class="btn btn-primary" onclick="publishUpdate(${update.id})">Publish Update</button>
                        <button class="btn btn-secondary" onclick="editUpdate(${update.id})">Edit Update</button>
                        <button class="btn btn-danger" onclick="deleteUpdate(${update.id})">Delete Update</button>
                    ` : ''}
                    ${update.status === 'published' ? `
                        <button class="btn btn-secondary" onclick="resendNotifications(${update.id})">Resend Notifications</button>
                    ` : ''}
                </div>
            </div>
        `;

        content.innerHTML = html;

        // Load stats if published
        if (update.status === 'published') {
            loadUpdateStats(update.id);
        }
    }

    // Get category display name
    function getCategoryDisplay(category) {
        const categoryMap = {
            'new': 'New Features',
            'improved': 'Improvements',
            'fixed': 'Bug Fixes',
            'removed': 'Removed Features',
            'security': 'Security Updates',
            'performance': 'Performance Improvements',
            'ui': 'UI/UX Changes',
            'api': 'API Changes',
            'other': 'Other Changes'
        };
        return categoryMap[category] || 'Changes';
    }

    // Load update stats
    async function loadUpdateStats(updateId) {
        try {
            const response = await api.get(`/system-updates/${updateId}/stats`);
            
            if (response.success) {
                const stats = response.data;
                const statsGrid = document.getElementById('updateStatsGrid');
                
                statsGrid.innerHTML = `
                    <div class="stat-box">
                        <div class="stat-number">${stats.totalUsers}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.acknowledgedCount}</div>
                        <div class="stat-label">Acknowledged</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.popupShownCount}</div>
                        <div class="stat-label">Popup Shown</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.acknowledgmentRate}%</div>
                        <div class="stat-label">Ack Rate</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading update stats:', error);
        }
    }

    // Publish update
    window.publishUpdate = async function(updateId) {
        if (!confirm('Are you sure you want to publish this update? This will send email notifications to all users.')) {
            return;
        }

        try {
            const response = await api.post(`/system-updates/${updateId}/publish`);

            if (response.success) {
                showToast(__('messages.success.updatePublished'), 'success');
                loadSystemUpdates();
                closeUpdateDetailsModal();
            } else {
                showToast(__('messages.error.failedPublishUpdate'), 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedPublishUpdate'), 'error');
        }
    };

    // Delete update
    window.deleteUpdate = async function(updateId) {
        if (!confirm(__('messages.confirm.deleteUpdate'))) {
            return;
        }

        try {
            const response = await api.delete(`/system-updates/${updateId}`);

            if (response.success) {
                showToast(__('messages.success.updateDeleted'), 'success');
                loadSystemUpdates();
                closeUpdateDetailsModal();
            } else {
                showToast(__('messages.error.failedDeleteUpdate'), 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedDeleteUpdate'), 'error');
        }
    };

    // Resend notifications
    window.resendNotifications = async function(updateId) {
        if (!confirm(__('messages.confirm.resendNotifications'))) {
            return;
        }

        try {
            const response = await api.post(`/system-updates/${updateId}/resend-notifications`);

            if (response.success) {
                showToast(__('messages.success.notificationsSent', response.data.sent), 'success');
            } else {
                showToast(__('messages.error.failedResendNotifications'), 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedResendNotifications'), 'error');
        }
    };

    // Edit update (placeholder for future implementation)
    window.editUpdate = function(updateId) {
        showToast(__('messages.info.editFutureUpdate'), 'info');
    };

    // Get update stats (placeholder for future implementation)
    window.getUpdateStats = function(updateId) {
        viewUpdateDetails(updateId);
    };

    // ===== GITHUB INTEGRATION FUNCTIONS =====

    // Open GitHub status modal
    function openGitHubStatusModal() {
        document.getElementById('githubStatusModal').classList.add('show');
        loadGitHubStatus();
    }

    // Close GitHub status modal
    window.closeGitHubStatusModal = function() {
        document.getElementById('githubStatusModal').classList.remove('show');
    };

    // Load GitHub status
    async function loadGitHubStatus() {
        const content = document.getElementById('githubStatusContent');
        content.innerHTML = '<div class="loading-state"><span class="material-symbols-outlined spinning">hourglass_empty</span>Loading GitHub status...</div>';

        try {
            const response = await api.get('/system-updates/github-status');
            
            if (response.success) {
                renderGitHubStatus(response.data);
            } else {
                content.innerHTML = '<div class="error-state">Failed to load GitHub status</div>';
            }
        } catch (error) {
            content.innerHTML = '<div class="error-state">Failed to load GitHub status</div>';
        }
    }

    // Render GitHub status
    function renderGitHubStatus(data) {
        const content = document.getElementById('githubStatusContent');
        
        if (!data.enabled) {
            content.innerHTML = `
                <div class="github-status-card disabled">
                    <div class="status-header">
                        <span class="material-symbols-outlined">sync_disabled</span>
                        <h4>GitHub Integration Disabled</h4>
                    </div>
                    <p>${data.error || 'GitHub integration is not configured'}</p>
                    <div class="github-help">
                        <h5>To enable GitHub integration:</h5>
                        <ol>
                            <li>Set GITHUB_TOKEN in environment variables</li>
                            <li>Set GITHUB_OWNER to your GitHub username/organization</li>
                            <li>Set GITHUB_REPO to your repository name</li>
                            <li>Set GITHUB_SYNC_ENABLED=true</li>
                        </ol>
                    </div>
                </div>
            `;
            return;
        }

        const latestRelease = data.latestRelease;
        const repository = data.repository;

        content.innerHTML = `
            <div class="github-status-card enabled">
                <div class="status-header">
                    <span class="material-symbols-outlined">sync</span>
                    <h4>GitHub Integration Active</h4>
                </div>
                
                <div class="github-info">
                    <div class="info-section">
                        <h5>Repository</h5>
                        <div class="repo-info">
                            <span class="repo-name">${data.owner}/${data.repo}</span>
                            ${repository ? `<span class="repo-desc">${repository.description || ''}</span>` : ''}
                        </div>
                    </div>

                    ${latestRelease ? `
                        <div class="info-section">
                            <h5>Latest Release</h5>
                            <div class="release-info">
                                <div class="release-header">
                                    <span class="release-version">${latestRelease.tag_name}</span>
                                    <span class="release-name">${latestRelease.name || ''}</span>
                                    <span class="release-status ${data.latestReleaseImported ? 'imported' : 'not-imported'}">
                                        ${data.latestReleaseImported ? 'Imported' : 'Not Imported'}
                                    </span>
                                </div>
                                <div class="release-date">Published: ${formatDate(latestRelease.published_at)}</div>
                                <div class="release-actions">
                                    <a href="${latestRelease.html_url}" target="_blank" class="btn btn-sm btn-secondary">
                                        <span class="material-symbols-outlined">open_in_new</span>
                                        View on GitHub
                                    </a>
                                    ${!data.latestReleaseImported ? `
                                        <button class="btn btn-sm btn-primary" onclick="importGitHubRelease('${latestRelease.tag_name}')">
                                            <span class="material-symbols-outlined">download</span>
                                            Import Release
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="info-section">
                            <p>No releases found in repository</p>
                        </div>
                    `}
                </div>

                <div class="github-actions">
                    <button class="btn btn-primary" onclick="syncWithGitHub()">
                        <span class="material-symbols-outlined">sync</span>
                        Sync with GitHub
                    </button>
                    <button class="btn btn-secondary" onclick="autoPublishGitHubReleases()">
                        <span class="material-symbols-outlined">publish</span>
                        Auto-Publish Drafts
                    </button>
                </div>
            </div>
        `;
    }

    // Sync with GitHub
    window.syncWithGitHub = async function() {
        try {
            showToast(__('messages.info.syncingGitHub'), 'info');
            const response = await api.post('/system-updates/sync-github');

            if (response.success) {
                showToast(response.message, 'success');
                loadGitHubStatus(); // Refresh status

                // Refresh the updates list if it's open
                if (document.getElementById('viewUpdatesModal').classList.contains('show')) {
                    loadSystemUpdates();
                }
            } else {
                showToast(__('messages.error.failedSyncGitHub') + ': ' + response.message, 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedSyncGitHub') + ': ' + error.message, 'error');
        }
    };

    // Import specific GitHub release
    window.importGitHubRelease = async function(tag) {
        try {
            showToast(__('messages.info.importingRelease', tag), 'info');
            const response = await api.post(`/system-updates/import-github/${tag}`);

            if (response.success) {
                showToast(response.message, 'success');
                loadGitHubStatus(); // Refresh status

                // Refresh the updates list if it's open
                if (document.getElementById('viewUpdatesModal').classList.contains('show')) {
                    loadSystemUpdates();
                }
            } else {
                showToast(__('messages.error.failedImportRelease') + ': ' + response.message, 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedImportRelease') + ': ' + error.message, 'error');
        }
    };

    // Auto-publish GitHub releases
    window.autoPublishGitHubReleases = async function() {
        try {
            showToast(__('messages.info.autoPublishingReleases'), 'info');
            const response = await api.post('/system-updates/auto-publish-github');

            if (response.success) {
                showToast(response.message, 'success');

                // Refresh the updates list if it's open
                if (document.getElementById('viewUpdatesModal').classList.contains('show')) {
                    loadSystemUpdates();
                }
            } else {
                showToast(__('messages.error.failedAutoPublish') + ': ' + response.message, 'error');
            }
        } catch (error) {
            showToast(__('messages.error.failedAutoPublish') + ': ' + error.message, 'error');
        }
    };

    // Note: Using global showToast function from main.js
});