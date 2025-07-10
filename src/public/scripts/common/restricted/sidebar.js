document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    // Create overlay for mobile
    let sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (!sidebarOverlay) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
    }

    // Function to check if mobile
    function isMobile() {
        return window.matchMedia("(max-width: 768px)").matches;
    }

    // Initialize sidebar state
    function initializeSidebar() {
        if (isMobile()) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        } else {
            // Keep sidebar expanded by default on desktop
            sidebar.classList.remove('collapsed');
            sidebarToggle.classList.remove('rotated');
        }
    }

    // Initialize on load
    initializeSidebar();

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            if (isMobile()) {
                // Mobile: Toggle sidebar with overlay
                sidebar.classList.toggle('active');
                sidebarOverlay.classList.toggle('active');
                document.body.classList.toggle('sidebar-open');
            } else {
                // Desktop: Toggle collapsed state
                sidebar.classList.toggle('collapsed');
                sidebarToggle.classList.toggle('rotated');
            }
        });
    }

    // Close sidebar on overlay click (mobile)
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        initializeSidebar();
    });

    // Close sidebar on navigation (mobile)
    const sidebarLinks = sidebar.querySelectorAll('a[href]:not(.dropdown-toggle)');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.matchMedia("(max-width: 768px)").matches) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    });

    // Dropdown menu functionality
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            
            const parentLi = this.closest('li.dropdown');
            if (!parentLi) return; // Exit if no parent dropdown found
            
            // Check if sidebar is collapsed
            const isCollapsed = sidebar.classList.contains('collapsed');
            
            if (isCollapsed) {
                // When collapsed, navigate to the first submenu item instead of opening dropdown
                const firstSubmenuLink = parentLi.querySelector('.dropdown-menu li:first-child a');
                if (firstSubmenuLink) {
                    window.location.href = firstSubmenuLink.href;
                    return;
                }
            }
            
            // Close other open dropdowns (except those that should stay open due to current page)
            dropdownToggles.forEach(otherToggle => {
                if (otherToggle !== toggle) {
                    const otherParentLi = otherToggle.closest('li.dropdown');
                    if (otherParentLi && !otherParentLi.classList.contains('persistent-open')) {
                        otherParentLi.classList.remove('open');
                    }
                }
            });
            
            // Toggle current dropdown (only if not collapsed and not persistent)
            if (!isCollapsed && !parentLi.classList.contains('persistent-open')) {
                parentLi.classList.toggle('open');
            } else if (!isCollapsed && parentLi.classList.contains('persistent-open')) {
                // For persistent dropdowns, ensure they stay open
                parentLi.classList.add('open');
            }
        });
    });

    // Close dropdowns when clicking outside (except persistent ones)
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            dropdownToggles.forEach(toggle => {
                const parentLi = toggle.closest('li.dropdown');
                if (parentLi && !parentLi.classList.contains('persistent-open')) {
                    parentLi.classList.remove('open');
                }
            });
        }
    });

    // Keep dropdown open if current page is a submenu item
    const currentPath = window.location.pathname;
    
    // Handle administration dropdown
    if (currentPath.includes('/administration/')) {
        const administrationDropdown = document.querySelector('[data-dropdown="administration-menu"]');
        if (administrationDropdown) {
            const parentLi = administrationDropdown.closest('li.dropdown');
            parentLi.classList.add('open');
            parentLi.classList.add('persistent-open'); // Mark as persistent so it won't be closed by other interactions
            
            // Force the dropdown to always stay open on administration pages
            // Override any click handlers that might close it
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        // If someone tries to remove 'open' class, add it back
                        if (!parentLi.classList.contains('open')) {
                            parentLi.classList.add('open');
                        }
                    }
                });
            });
            observer.observe(parentLi, { attributes: true });
        }
    }
    
    // Handle settings dropdown
    if (currentPath.includes('/settings/')) {
        const settingsDropdown = document.querySelector('[data-dropdown="settings-menu"]');
        if (settingsDropdown) {
            const parentLi = settingsDropdown.closest('li.dropdown');
            parentLi.classList.add('open');
            parentLi.classList.add('persistent-open'); // Mark as persistent so it won't be closed by other interactions
            
            // Force the dropdown to always stay open on settings pages
            // Override any click handlers that might close it
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        // If someone tries to remove 'open' class, add it back
                        if (!parentLi.classList.contains('open')) {
                            parentLi.classList.add('open');
                        }
                    }
                });
            });
            observer.observe(parentLi, { attributes: true });
        }
    }
    
    // Update analyses counter
    updateAnalysesCounter();
    
    // Update counter every 5 minutes
    setInterval(updateAnalysesCounter, 5 * 60 * 1000);
});

async function updateAnalysesCounter() {
    try {
        const counter = document.getElementById('analysesCounter');
        if (!counter) return;
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch analyses for today
        const response = await fetch(`/api/analyses?startDate=${today}&endDate=${today}&limit=1000`);
        if (!response.ok) {
            console.error('Failed to fetch analyses count');
            return;
        }
        
        const result = await response.json();
        if (result.success && result.data) {
            const todayAnalyses = result.data.filter(analysis => {
                const analysisDate = new Date(analysis.analysis_date).toISOString().split('T')[0];
                // Only count non-cancelled analyses for today
                return analysisDate === today && analysis.status !== 'Cancelled';
            });
            
            // Update counter display
            const count = todayAnalyses.length;
            counter.textContent = count;
            
            // Hide badge if count is 0
            if (count === 0) {
                counter.style.display = 'none';
            } else {
                counter.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Error updating analyses counter:', error);
    }
}