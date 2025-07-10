// Status page JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Auto-refresh functionality
    let autoRefreshInterval;

    // Refresh status function
    function refreshStatus() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        const refreshBtn = document.querySelector('.refresh-btn');
        
        // Show loading state
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="refresh-icon spinning">⟳</i> Refreshing...';
        }

        fetch('/status/data')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update last updated time
                    if (lastUpdatedElement) {
                        lastUpdatedElement.textContent = new Date().toLocaleString();
                    }
                    
                    // For now, just reload the page to show updated data
                    // In a more advanced implementation, you could update the DOM directly
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                    
                    console.log('Status refreshed successfully');
                } else {
                    console.error('Failed to refresh status:', data.message);
                    showToast('Failed to refresh status', 'error');
                }
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                showToast('Error refreshing status', 'error');
            })
            .finally(() => {
                // Reset button state
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="refresh-icon">⟳</i> Refresh';
                }
            });
    }

    // Setup auto-refresh functionality
    function setupAutoRefresh() {
        const checkbox = document.getElementById('autoRefresh');
        
        if (!checkbox) return;
        
        function toggleAutoRefresh() {
            if (checkbox.checked) {
                // Start auto-refresh every 30 seconds
                autoRefreshInterval = setInterval(refreshStatus, 30000);
                localStorage.setItem('statusPageAutoRefresh', 'true');
                console.log('Auto-refresh enabled (30 seconds)');
            } else {
                // Stop auto-refresh
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
                localStorage.setItem('statusPageAutoRefresh', 'false');
                console.log('Auto-refresh disabled');
            }
        }
        
        // Restore auto-refresh setting from localStorage
        const savedSetting = localStorage.getItem('statusPageAutoRefresh');
        if (savedSetting === 'false') {
            checkbox.checked = false;
        } else {
            checkbox.checked = true; // Default to enabled
        }
        
        // Set up the initial state
        toggleAutoRefresh();
        
        // Listen for changes
        checkbox.addEventListener('change', toggleAutoRefresh);
    }

    // Simple toast notification function
    function showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Style the toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background-color: ${type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Show with animation
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Add spinning animation to refresh icon
    function addSpinningCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .refresh-icon.spinning {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .refresh-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize everything
    addSpinningCSS();
    setupAutoRefresh();
    
    // Add click handler for manual refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshStatus);
    }

    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });

    console.log('Status page initialized');
});

