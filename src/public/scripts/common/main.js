// Global utility functions

// Global notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? 'check_circle' : 
                 type === 'error' ? 'error' : 'info';
    
    notification.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide notification after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Global function to clear authentication tokens
function clearAuthTokens() {
    // Clear cookies
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Clear sessionStorage
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    
    console.log('Authentication tokens cleared');
}

// Global function to handle authentication errors
function handleAuthError() {
    clearAuthTokens();
    if (!window.location.pathname.includes('/auth/login')) {
        window.location.href = '/auth/login';
    }
}

// Make functions available globally
window.clearAuthTokens = clearAuthTokens;
window.handleAuthError = handleAuthError;
window.showNotification = showNotification;

// Debug function to check authentication state
function debugAuth() {
    console.log('Authentication Debug:');
    console.log('Current URL:', window.location.href);
    console.log('Access Token Cookie:', document.cookie.split('; ').find(row => row.startsWith('accessToken=')));
    console.log('Refresh Token Cookie:', document.cookie.split('; ').find(row => row.startsWith('refreshToken=')));
    console.log('LocalStorage tokens:', {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        user: localStorage.getItem('user')
    });
}

window.debugAuth = debugAuth;