// public/scripts/common/announcementManager.js

class AnnouncementManager {
    constructor() {
        this.announcements = [];
        this.unreadCount = 0;
        this.init();
    }

    init() {
        // Only initialize if user has announcement permissions
        if (this.hasAnnouncementPermissions()) {
            this.loadAnnouncements();
            this.setupEventListeners();
            this.setupPeriodicRefresh();
        }
    }

    hasAnnouncementPermissions() {
        // Check if user has announcement permissions
        // This would typically be set by the server in a global variable
        return window.userPermissions && (
            window.userPermissions.includes('announcements.view') ||
            window.userPermissions.includes('read.all')
        );
    }

    hasAdminPermissions() {
        return window.userPermissions && (
            window.userPermissions.includes('system.manage_announcements') ||
            window.userPermissions.includes('write.all')
        );
    }

    async loadAnnouncements() {
        try {
            const response = await api.get('/announcements/user?include_viewed=false&limit=10');
            if (response.success) {
                this.announcements = response.announcements || [];
                this.unreadCount = this.announcements.length;
                this.updateAnnouncementIndicator();
                this.renderAnnouncementsInNotificationDropdown();
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
        }
    }

    async markAsViewed(announcementId) {
        try {
            await api.post(`/announcements/${announcementId}/view`);
            // Update local state
            this.announcements = this.announcements.filter(a => a.id !== announcementId);
            this.unreadCount = this.announcements.length;
            this.updateAnnouncementIndicator();
            this.renderAnnouncementsInNotificationDropdown();
        } catch (error) {
            console.error('Error marking announcement as viewed:', error);
        }
    }

    async acknowledgeAnnouncement(announcementId) {
        try {
            await api.post(`/announcements/${announcementId}/acknowledge`);
            // Update local state
            this.announcements = this.announcements.filter(a => a.id !== announcementId);
            this.unreadCount = this.announcements.length;
            this.updateAnnouncementIndicator();
            this.renderAnnouncementsInNotificationDropdown();
        } catch (error) {
            console.error('Error acknowledging announcement:', error);
        }
    }

    updateAnnouncementIndicator() {
        // Update the notification badge to include announcement count
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge) {
            const currentCount = parseInt(notificationBadge.textContent) || 0;
            const totalCount = currentCount + this.unreadCount;
            notificationBadge.textContent = totalCount;
            notificationBadge.style.display = totalCount > 0 ? 'block' : 'none';
        }
    }

    renderAnnouncementsInNotificationDropdown() {
        const notificationsList = document.querySelector('.notifications-list');
        if (!notificationsList) return;

        // Remove existing announcement items
        notificationsList.querySelectorAll('.announcement-item').forEach(item => item.remove());

        // Add announcements at the top
        this.announcements.forEach(announcement => {
            const announcementElement = this.createAnnouncementElement(announcement);
            notificationsList.insertBefore(announcementElement, notificationsList.firstChild);
        });
    }

    createAnnouncementElement(announcement) {
        const div = document.createElement('div');
        div.className = 'notification-item announcement-item';
        div.setAttribute('data-announcement-id', announcement.id);

        const typeIcon = this.getAnnouncementTypeIcon(announcement.type);
        const priorityClass = this.getPriorityClass(announcement.priority);

        div.innerHTML = `
            <div class="notification-content ${priorityClass}">
                <div class="notification-header">
                    <span class="notification-icon">${typeIcon}</span>
                    <span class="notification-title">${this.escapeHtml(announcement.title)}</span>
                    <span class="notification-priority priority-${announcement.priority}">${announcement.priority.toUpperCase()}</span>
                </div>
                <div class="notification-message">${this.escapeHtml(announcement.message)}</div>
                <div class="notification-meta">
                    <span class="notification-time">${this.formatDateTime(announcement.published_at)}</span>
                    <span class="notification-author">By: ${announcement.creator?.username || 'System'}</span>
                </div>
                <div class="notification-actions">
                    <button class="btn btn-sm btn-primary acknowledge-btn" onclick="announcementManager.acknowledgeAnnouncement(${announcement.id})">
                        Acknowledge
                    </button>
                    <button class="btn btn-sm btn-secondary view-btn" onclick="announcementManager.markAsViewed(${announcement.id})">
                        Mark as Read
                    </button>
                </div>
            </div>
        `;

        return div;
    }

    getAnnouncementTypeIcon(type) {
        const icons = {
            'info': '<span class="material-symbols-outlined">info</span>',
            'warning': '<span class="material-symbols-outlined">warning</span>',
            'critical': '<span class="material-symbols-outlined">error</span>',
            'maintenance': '<span class="material-symbols-outlined">construction</span>',
            'success': '<span class="material-symbols-outlined">check_circle</span>'
        };
        return icons[type] || icons['info'];
    }

    getPriorityClass(priority) {
        return `priority-${priority}`;
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Add admin announcement creation interface if user has permissions
        if (this.hasAdminPermissions()) {
            this.setupAdminInterface();
        }
    }

    setupAdminInterface() {
        // Add announcement creation button to admin interface
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) {
            const createAnnouncementItem = document.createElement('a');
            createAnnouncementItem.href = '#';
            createAnnouncementItem.className = 'profile-menu-item';
            createAnnouncementItem.innerHTML = `
                <span class="material-symbols-outlined">campaign</span>
                <span>Create Announcement</span>
            `;
            createAnnouncementItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAnnouncementCreationModal();
            });
            
            // Insert after the first item (usually profile)
            const firstItem = profileMenu.querySelector('.profile-menu-item');
            if (firstItem) {
                // Use insertAdjacentElement for safer insertion
                firstItem.insertAdjacentElement('afterend', createAnnouncementItem);
            } else {
                // If no first item found, just append to the menu
                profileMenu.appendChild(createAnnouncementItem);
            }
        }
    }

    showAnnouncementCreationModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="announcementModal">
                <div class="modal announcement-modal">
                    <div class="modal-header">
                        <h2>Create System Announcement</h2>
                        <button class="modal-close" onclick="announcementManager.closeAnnouncementModal()">&times;</button>
                    </div>
                    <form id="announcementForm">
                        <div class="form-section">
                            <label class="form-label" for="announcementTitle">Title <span class="required">*</span></label>
                            <input type="text" class="form-control" id="announcementTitle" required maxlength="200" placeholder="Enter announcement title">
                        </div>
                        
                        <div class="form-section">
                            <label class="form-label" for="announcementMessage">Message <span class="required">*</span></label>
                            <textarea class="form-control" id="announcementMessage" required maxlength="5000" rows="4" placeholder="Enter announcement message"></textarea>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-label" for="announcementType">Type</label>
                            <select class="form-control" id="announcementType">
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="critical">Critical</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="success">Success</option>
                            </select>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-label" for="announcementPriority">Priority</label>
                            <select class="form-control" id="announcementPriority">
                                <option value="low">Low</option>
                                <option value="normal" selected>Normal</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-label" for="announcementAudience">Target Audience</label>
                            <select class="form-control" id="announcementAudience">
                                <option value="all" selected>All Users</option>
                                <option value="admins">Administrators Only</option>
                                <option value="staff">Staff Only</option>
                            </select>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-label" for="announcementExpiry">Expires At (Optional)</label>
                            <input type="datetime-local" class="form-control" id="announcementExpiry">
                        </div>
                        
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="announcementManager.closeAnnouncementModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Announcement</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = document.getElementById('announcementModal');
        modal.classList.add('show');
        
        // Setup form submission
        const form = document.getElementById('announcementForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAnnouncement();
        });
    }

    closeAnnouncementModal() {
        const modal = document.getElementById('announcementModal');
        if (modal) {
            modal.remove();
        }
    }

    async createAnnouncement() {
        const title = document.getElementById('announcementTitle').value;
        const message = document.getElementById('announcementMessage').value;
        const type = document.getElementById('announcementType').value;
        const priority = document.getElementById('announcementPriority').value;
        const target_audience = document.getElementById('announcementAudience').value;
        const expires_at = document.getElementById('announcementExpiry').value;

        if (!title || !message) {
            this.showToast('Title and message are required', 'error');
            return;
        }

        try {
            const announcementData = {
                title,
                message,
                type,
                priority,
                target_audience,
                expires_at: expires_at || null,
                publish_immediately: true
            };

            const response = await api.post('/announcements/admin', announcementData);

            if (response.success) {
                this.showToast('Announcement created successfully', 'success');
                this.closeAnnouncementModal();
                this.loadAnnouncements(); // Refresh announcements
            } else {
                this.showToast(response.message || 'Failed to create announcement', 'error');
            }
        } catch (error) {
            console.error('Error creating announcement:', error);
            this.showToast('Error creating announcement', 'error');
        }
    }

    showToast(message, type) {
        // Use existing toast system or create a simple one
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    setupPeriodicRefresh() {
        // Refresh announcements every 5 minutes
        setInterval(() => {
            this.loadAnnouncements();
        }, 5 * 60 * 1000);
    }
}

// Initialize announcement manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof api !== 'undefined') {
        window.announcementManager = new AnnouncementManager();
    }
});