document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('.content');

    // Check if mobile device
    const isMobile = window.matchMedia("(max-width: 991px)").matches;

    // Collapse by default on mobile
    if (isMobile) {
        sidebar.classList.add('collapsed');
        content.classList.remove('expanded');
    }

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.classList.toggle('rotated');
            content.classList.toggle('expanded');
        });
    }
});