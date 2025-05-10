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

    // Function to create notification item
    function createNotificationItem(notification) {
        const div = document.createElement('div');
        div.className = `notification-item ${notification.unread ? 'unread' : ''}`;
        div.dataset.notificationId = notification.id; // Store ID for backend calls

        div.innerHTML = `
            <div class="notification-icon ${notification.unread ? '' : 'read'}"></div>
            <div class="notification-content">
                <div class="notification-text">${notification.text}</div>
                <div class="notification-time">${notification.time}</div>
            </div>
        `;

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

    // Sample notifications data - replace this with your backend call
    const sampleNotifications = [
        {
            id: 1,
            text: "New message from John Doe",
            time: "5 minutes ago",
            unread: true
        },
        {
            id: 2,
            text: "Your order has been shipped",
            time: "1 hour ago",
            unread: true
        },
        {
            id: 3,
            text: "Meeting reminder: Team standup in 15 minutes",
            time: "15 minutes",
            unread: true
        },
        {
            id: 4,
            text: "Password changed successfully",
            time: "2 hours ago",
            unread: false
        }
    ];

    // Initialize notifications - Replace this with your backend call
    populateNotifications(sampleNotifications);

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

    // Function to fetch notifications from backend (to be implemented)
    async function fetchNotifications() {
        try {
            // Replace this with your actual API endpoint
            // TODO implement actual api endpoint
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const notifications = await response.json();
                populateNotifications(notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            // Fall back to sample data if there's an error
            populateNotifications(sampleNotifications);
        }
    }

    // Function to mark notification as read in backend (to be implemented)
    async function markNotificationAsRead(notificationId) {
        try {
            //TODO implement actual api endpoint
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PUT',
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

    // Function to mark all notifications as read in backend (to be implemented)
    async function markAllNotificationsAsRead() {
        try {
            // TODO implement actual api endpoint
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to mark all notifications as read');
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // You can call fetchNotifications() instead of populateNotifications(sampleNotifications)
    // when you have your backend ready:
    // fetchNotifications();

    // Optionally, set up periodic refresh of notifications
    // setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
});