document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const settingsToggle = document.querySelector('.settings-toggle');
    const settingsMenu = document.querySelector('.settings-menu');

    // Check if mobile device
    const isMobile = window.matchMedia("(max-width: 991px)").matches;

    // Collapse by default on mobile
    if (isMobile) {
        sidebar.classList.add('collapsed');
        if (sidebarToggle) {
            sidebarToggle.classList.add('rotated');
        }
    }

    // Main sidebar collapse/expand functionality
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.classList.toggle('rotated');

            // Close settings submenu when sidebar is collapsed
            if (sidebar.classList.contains('collapsed')) {
                settingsMenu.classList.remove('expanded');
            }
        });
    }

    // Settings submenu toggle functionality
    if (settingsToggle && settingsMenu) {
        settingsToggle.addEventListener('click', function(e) {
            e.preventDefault();

            // Check if sidebar is collapsed
            const isCollapsed = sidebar.classList.contains('collapsed');
            
            if (isCollapsed) {
                // When collapsed, navigate to the first submenu item instead of opening dropdown
                const firstSubmenuLink = settingsMenu.querySelector('.submenu li:first-child a');
                if (firstSubmenuLink) {
                    window.location.href = firstSubmenuLink.href;
                    return;
                }
            }

            // Toggle submenu (only if not collapsed)
            settingsMenu.classList.toggle('expanded');
        });
    }

    // Auto-expand settings if we're on a settings page
    if (settingsMenu && settingsMenu.classList.contains('active')) {
        // Only expand if sidebar is not collapsed
        if (!sidebar.classList.contains('collapsed')) {
            settingsMenu.classList.add('expanded');
            // Mark as persistent so it won't be closed by outside clicks
            settingsMenu.classList.add('persistent-open');
        }
    }

    // Handle clicks on submenu items
    const submenuItems = document.querySelectorAll('.submenu li a');
    submenuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Let the navigation happen normally
            // The active state will be set by the server when the page loads
        });
    });

    // Close submenu when clicking outside (except persistent ones)
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.settings-menu') && !sidebar.classList.contains('collapsed')) {
            // Only close if clicking outside, sidebar is not collapsed, and not persistent
            const clickedElement = e.target.closest('.sidebar');
            if (!clickedElement && !settingsMenu.classList.contains('persistent-open')) {
                settingsMenu.classList.remove('expanded');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        const isMobileNow = window.matchMedia("(max-width: 991px)").matches;

        if (isMobileNow && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            if (sidebarToggle) {
                sidebarToggle.classList.add('rotated');
            }
            settingsMenu.classList.remove('expanded');
        }
    });
});