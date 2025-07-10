// Loading Animation Logic
document.addEventListener('DOMContentLoaded', function() {
    initializeLoadingAnimation();
});

function initializeLoadingAnimation() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;

    // Track page load time for session timeout detection
    sessionStorage.setItem('epick_last_page_load', Date.now().toString());

    // Check if user is coming from outside (external source or direct URL)
    const shouldShowLoading = checkIfExternalAccess();
    
    if (shouldShowLoading) {
        // Show loading animation
        loadingOverlay.style.display = 'flex';
        
        // Clean up login URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('login')) {
            urlParams.delete('login');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
        }
        
        // Hide loading animation after animation completes (about 3.5 seconds)
        setTimeout(() => {
            hideLoadingAnimation();
            // Only mark as internal navigation AFTER the loading animation is shown
            // This ensures login redirects always show the animation
            sessionStorage.setItem('epick_internal_navigation', 'true');
        }, 3500);
    } else {
        // If not showing loading, still mark as internal for future navigation
        sessionStorage.setItem('epick_internal_navigation', 'true');
    }
}

function checkIfExternalAccess() {
    // Check referrer to see if coming from external source or auth pages
    const referrer = document.referrer;
    const currentDomain = window.location.hostname;
    const currentUrl = window.location.href;
    let hasInternalFlag = sessionStorage.getItem('epick_internal_navigation');
    
    
    // Check for login URL parameter (indicates fresh login)
    const urlParams = new URLSearchParams(window.location.search);
    const isLoginRedirect = urlParams.has('login');
    
    // Clear session storage if coming from logout or login (fresh session)
    if ((referrer && (referrer.includes('/auth/logout') || referrer.includes('/auth/login') || referrer.includes('/auth/register'))) || isLoginRedirect) {
        sessionStorage.removeItem('epick_internal_navigation');
        sessionStorage.removeItem('epick_last_page_load');
        hasInternalFlag = null; // Update local variable since we just cleared it
    }
    
    // FIRST CHECK: If we have internal navigation flag, don't show animation (except for auth redirects)
    if (hasInternalFlag) {
        // Exception: Always show animation if coming from auth pages
        if (referrer && (referrer.includes('/auth/login') || referrer.includes('/auth/register'))) {
            return true;
        }
        return false;
    }
    
    // If no internal flag, determine if this should show animation
    const isDashboardUrl = currentUrl.includes('/restricted');
    
    // Always show loading if coming from login/register pages
    if (referrer && (referrer.includes('/auth/login') || referrer.includes('/auth/register'))) {
        return true;
    }
    
    // Check for URL parameters that indicate fresh login/redirect
    if (urlParams.has('redirect')) {
        return true;
    }
    
    // If no referrer and on restricted area (likely fresh login)
    if (!referrer && isDashboardUrl) {
        return true;
    }
    
    // If no referrer or referrer is from different domain, show loading
    if (!referrer || !referrer.includes(currentDomain)) {
        return true;
    }
    
    return false;
}

function hideLoadingAnimation() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        // Fade out the loading overlay
        loadingOverlay.style.transition = 'opacity 0.5s ease-out';
        loadingOverlay.style.opacity = '0';
        
        // Remove from DOM after fade out
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }
}

// Mark internal navigation for all clicks within the app
document.addEventListener('click', function(e) {
    // Check if the clicked element or its parent is a link within the app
    const link = e.target.closest('a');
    if (link && link.href && link.href.includes(window.location.hostname)) {
        // This is internal navigation
        sessionStorage.setItem('epick_internal_navigation', 'true');
    }
});

// Clear internal navigation flag when user navigates away from the domain or logs out
window.addEventListener('beforeunload', function() {
    // Check if navigating to external site
    const currentDomain = window.location.hostname;
    // Note: We can't access the target URL in beforeunload, so we'll rely on
    // the next page load to determine if it's external
});

// Clear session storage if user logs out
document.addEventListener('click', function(e) {
    // Check if clicked on logout link/button
    const element = e.target.closest('a, button');
    if (element && (element.href && element.href.includes('/logout') || 
                   element.onclick && element.onclick.toString().includes('logout') ||
                   element.textContent.toLowerCase().includes('logout') ||
                   element.innerHTML.toLowerCase().includes('logout'))) {
        // User is logging out - clear session storage
        sessionStorage.removeItem('epick_internal_navigation');
        sessionStorage.removeItem('epick_last_page_load');
    }
});


// Function to show a toast notification
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = String(type).charAt(0).toUpperCase() + String(type).slice(1) + ": " + message;

    // Add to container
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    // Trigger animation (need to delay for transition to work)
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300); // Wait for fade out animation
    }, 3000);
}
