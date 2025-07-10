// System Health Indicator
document.addEventListener('DOMContentLoaded', function() {
    const healthDot = document.getElementById('systemHealthDot');
    const healthText = document.getElementById('systemHealthText');
    const versionIndicator = document.getElementById('versionIndicator');
    const envIndicator = document.getElementById('envIndicator');
    
    if (!healthDot || !healthText) return;

    // Function to update system health
    function updateSystemHealth() {
        fetch('/status/data')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    const status = data.data.system_status.overall_status;
                    updateHealthIndicator(status);
                } else {
                    updateHealthIndicator('unknown');
                }
            })
            .catch(error => {
                console.error('Error fetching system health:', error);
                updateHealthIndicator('unknown');
            });
    }

    // Function to update the visual indicator
    function updateHealthIndicator(status) {
        // Remove existing classes
        healthDot.classList.remove('degraded', 'outage');
        
        switch (status) {
            case 'operational':
                healthText.textContent = 'All Systems Operational';
                break;
            case 'degraded':
                healthDot.classList.add('degraded');
                healthText.textContent = 'Degraded Performance';
                break;
            case 'partial_outage':
            case 'major_outage':
                healthDot.classList.add('outage');
                healthText.textContent = 'Service Issues';
                break;
            case 'maintenance':
                healthDot.classList.add('degraded');
                healthText.textContent = 'Maintenance Mode';
                break;
            default:
                healthDot.classList.add('degraded');
                healthText.textContent = 'Status Unknown';
        }
    }

    // Click handler to go to status page
    document.querySelector('.system-health-indicator').addEventListener('click', function() {
        window.open('/status', '_blank');
    });

    // Function to update version information
    function updateVersionInfo() {
        fetch('/api/system/version')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    if (versionIndicator) {
                        versionIndicator.textContent = data.data.version;
                    }
                    if (envIndicator) {
                        envIndicator.textContent = data.data.environment.charAt(0).toUpperCase() + data.data.environment.slice(1);
                        
                        // Add environment-specific styling
                        envIndicator.className = `env-${data.data.environment}`;
                    }
                } else {
                    if (versionIndicator) versionIndicator.textContent = '1.0.0';
                    if (envIndicator) envIndicator.textContent = 'Unknown';
                }
            })
            .catch(error => {
                console.error('Error fetching version info:', error);
                if (versionIndicator) versionIndicator.textContent = '1.0.0';
                if (envIndicator) envIndicator.textContent = 'Unknown';
            });
    }

    // Initial load
    updateSystemHealth();
    updateVersionInfo();
    
    // Update every 30 seconds
    setInterval(updateSystemHealth, 30000);
    
    // Update version info every 5 minutes
    setInterval(updateVersionInfo, 300000);
});