document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    // Check if mobile device
    const isMobile = window.matchMedia("(max-width: 991px)").matches;

    // Collapse by default on mobile
    if (isMobile) {
        sidebar.classList.add('collapsed');
        sidebarToggle.classList.add('rotated');
        // We're not toggling 'expanded' class anymore
    }

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.classList.toggle('rotated');
            // Removed toggling of 'expanded' class as we're using CSS selectors now
        });
    }
});