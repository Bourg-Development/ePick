// Navbar functionality with dynamic notifications
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const notificationToggle = document.getElementById('notificationToggle');
    const notificationMenu = document.getElementById('notificationMenu');
    const profileToggle = document.getElementById('profileToggle');
    const profileMenu = document.getElementById('profileMenu');
    const menuOverlay = document.getElementById('menuOverlay');

    // Check if all required elements exist
    if (!notificationToggle || !notificationMenu || !profileToggle || !profileMenu || !menuOverlay) {
        return;
    }

    // Load user profile data
    loadUserProfile();

    // Function to create notification item
    function createNotificationItem(notification) {
        const div = document.createElement('div');
        div.className = `notification-item ${notification.unread ? 'unread' : ''}`;
        div.dataset.notificationId = notification.id; // Store ID for backend calls

        // Handle priority styling
        if (notification.priority && notification.priority !== 'normal') {
            div.classList.add(`priority-${notification.priority}`);
        }

        // Handle action required styling
        if (notification.actionRequired) {
            div.classList.add('action-required');
        }

        div.innerHTML = `
            <div class="notification-icon ${notification.unread ? '' : 'read'}"></div>
            <div class="notification-content">
                <div class="notification-text">${notification.text}</div>
                <div class="notification-time">${notification.time}</div>
            </div>
        `;

        // Add click handler for action URL
        if (notification.actionUrl) {
            div.style.cursor = 'pointer';
            div.addEventListener('click', function(e) {
                e.stopPropagation();
                window.location.href = notification.actionUrl;
            });
        }

        return div;
    }

    // Function to update notification count badge
    function updateNotificationCount(count) {
        const countBadge = notificationToggle.querySelector('.count-badge');
        if (countBadge) {
            countBadge.textContent = count;
            countBadge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // Function to populate notifications
    function populateNotifications(notifications) {
        const notificationList = notificationMenu.querySelector('.notification-list');
        const viewAllSection = notificationMenu.querySelector('.view-all');

        // Clear existing notifications
        notificationList.innerHTML = '';

        // Add notifications to the list
        notifications.forEach(notification => {
            notificationList.appendChild(createNotificationItem(notification));
        });

        // Count unread notifications
        const unreadCount = notifications.filter(n => n.unread).length;
        updateNotificationCount(unreadCount);

        // Show/hide "view all" section based on notifications
        if (viewAllSection) {
            viewAllSection.style.display = notifications.length > 0 ? 'block' : 'none';
        }
    }


    // Initialize notifications - Load from API
    fetchNotifications();

    // Function to close all menus
    function closeAllMenus() {
        notificationMenu.classList.remove('active');
        profileMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
    }

    // Toggle notification menu
    notificationToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const isActive = notificationMenu.classList.contains('active');

        // Close profile menu if open
        profileMenu.classList.remove('active');

        if (isActive) {
            notificationMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
        } else {
            notificationMenu.classList.add('active');
            menuOverlay.classList.add('active');
        }
    });

    // Toggle profile menu
    profileToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const isActive = profileMenu.classList.contains('active');

        // Close notification menu if open
        notificationMenu.classList.remove('active');

        if (isActive) {
            profileMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
        } else {
            profileMenu.classList.add('active');
            menuOverlay.classList.add('active');
        }
    });

    // Close menus when clicking overlay
    menuOverlay.addEventListener('click', function() {
        closeAllMenus();
    });

    // Close menus when clicking outside (but not inside the dropdowns)
    document.addEventListener('click', function(e) {
        // Don't close if clicking inside the notification toggle or menu
        if (e.target.closest('#notificationToggle') ||
            e.target.closest('#notificationMenu') ||
            e.target.closest('#profileToggle') ||
            e.target.closest('#profileMenu')) {
            return;
        }
        closeAllMenus();
    });

    // Handle clicks within the notification menu
    notificationMenu.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent triggering the document click listener

        // Mark notification as read when clicking on notification item
        const notificationItem = e.target.closest('.notification-item');
        if (notificationItem && notificationItem.classList.contains('unread')) {
            notificationItem.classList.remove('unread');

            const icon = notificationItem.querySelector('.notification-icon');
            if (icon) {
                icon.classList.add('read');
            }

            // Update count badge
            const countBadge = notificationToggle.querySelector('.count-badge');
            if (countBadge) {
                let count = parseInt(countBadge.textContent) || 0;
                if (count > 0) {
                    count--;
                    countBadge.textContent = count;
                    if (count === 0) {
                        countBadge.style.display = 'none';
                    }
                }
            }

            // Call backend function to mark as read
            const notificationId = notificationItem.dataset.notificationId;
            if (notificationId) {
                markNotificationAsRead(notificationId);
            }
        }

        // Handle "Mark all as read" click
        if (e.target.closest('.mark-all-read')) {
            e.preventDefault();

            const unreadItems = notificationMenu.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                const icon = item.querySelector('.notification-icon');
                if (icon) {
                    icon.classList.add('read');
                }
            });

            // Hide count badge
            const countBadge = notificationToggle.querySelector('.count-badge');
            if (countBadge) {
                countBadge.textContent = '0';
                countBadge.style.display = 'none';
            }

            // Call backend function to mark all as read
            markAllNotificationsAsRead();
        }

        // Handle "View all notifications" click
        if (e.target.closest('.view-all a')) {
            // Let the link work normally, but close the menu
            closeAllMenus();
        }
    });

    // Handle clicks within the profile menu
    profileMenu.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent triggering the document click listener

        // If a profile menu item link is clicked, let it work and close the menu
        if (e.target.closest('.profile-menu-item') && !e.target.closest('a')) {
            const link = e.target.closest('.profile-menu-item');
            if (link.href) {
                closeAllMenus();
            }
        }
    });

    // Hamburger menu functionality
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            this.classList.toggle('rotated');
            // Add your sidebar toggle functionality here if needed
        });
    }

    // Function to format time ago
    function formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return 'just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 2592000) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    // Function to fetch notifications from backend
    async function fetchNotifications() {
        try {
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    // Transform API data to match frontend format
                    const transformedNotifications = result.data.map(notification => ({
                        id: notification.id,
                        text: notification.message,
                        time: formatTimeAgo(notification.created_at),
                        unread: !notification.is_read,
                        type: notification.type,
                        priority: notification.priority,
                        actionRequired: notification.action_required,
                        actionUrl: notification.action_url,
                        title: notification.title
                    }));
                    populateNotifications(transformedNotifications);
                } else {
                    console.error('Invalid API response format');
                    populateNotifications([]);
                }
            } else {
                console.error('Failed to fetch notifications:', response.status);
                populateNotifications([]);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            // Show empty notifications on error instead of sample data
            populateNotifications([]);
        }
    }

    // Function to mark notification as read in backend
    async function markNotificationAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to mark notification as read');
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Function to mark all notifications as read in backend
    async function markAllNotificationsAsRead() {
        try {
            // Get all unread notification IDs from current display
            const unreadItems = notificationMenu.querySelectorAll('.notification-item.unread');
            const notificationIds = Array.from(unreadItems).map(item => 
                parseInt(item.dataset.notificationId)
            ).filter(id => !isNaN(id));

            if (notificationIds.length === 0) {
                return; // No unread notifications to mark
            }

            const response = await fetch('/api/notifications/read-multiple', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notificationIds: notificationIds
                })
            });

            if (!response.ok) {
                console.error('Failed to mark all notifications as read');
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.profile) {
                    updateProfileDisplay(data.profile);
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // Update profile display with user data
    function updateProfileDisplay(userData) {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        
        if (profileName) {
            profileName.textContent = userData.full_name || userData.username || 'User';
        }
        if (profileEmail) {
            profileEmail.textContent = userData.email || 'No email';
        }
    }

    // Set up periodic refresh of notifications
    setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
});