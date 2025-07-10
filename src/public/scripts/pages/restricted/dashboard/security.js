document.addEventListener('DOMContentLoaded', function() {
    // Wait for API to be available
    if (typeof api === 'undefined') {
        console.log('API not yet available, waiting...');
        setTimeout(() => document.dispatchEvent(new Event('DOMContentLoaded')), 100);
        return;
    }
    
    api.setConfig({
        baseURL: '/api',
        timeout: 30000 // Longer timeout for forensics operations
    });

    // Initialize page
    initializeSecurityDashboard();
});

function initializeSecurityDashboard() {
    setupEventListeners();
    loadSecurityDashboard();
    
    // Auto-refresh every 5 minutes
    setInterval(loadSecurityDashboard, 5 * 60 * 1000);
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadSecurityDashboard();
        showNotification('Dashboard refreshed', 'success');
    });

    // Generate report button
    document.getElementById('generateReportBtn')?.addEventListener('click', showReportModal);

    // Investigate button
    document.getElementById('investigateBtn')?.addEventListener('click', showInvestigationModal);

    // Modal close buttons
    document.getElementById('closeInvestigationBtn')?.addEventListener('click', hideInvestigationModal);
    document.getElementById('cancelInvestigationBtn')?.addEventListener('click', hideInvestigationModal);
    document.getElementById('closeReportBtn')?.addEventListener('click', hideReportModal);
    document.getElementById('cancelReportBtn')?.addEventListener('click', hideReportModal);
    document.getElementById('closeResultsBtn')?.addEventListener('click', hideResultsModal);
    document.getElementById('closeResultsModalBtn')?.addEventListener('click', hideResultsModal);

    // Form submissions
    document.getElementById('investigationForm')?.addEventListener('submit', handleInvestigation);
    document.getElementById('reportForm')?.addEventListener('submit', handleReportGeneration);

    // Event type filter
    document.getElementById('eventTypeFilter')?.addEventListener('change', filterSecurityEvents);

    // Modal click outside to close
    document.getElementById('investigationModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'investigationModal') hideInvestigationModal();
    });
    document.getElementById('reportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reportModal') hideReportModal();
    });
    document.getElementById('investigationResultsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'investigationResultsModal') hideResultsModal();
    });
}

async function loadSecurityDashboard() {
    try {
        showLoading();
        
        // Load security dashboard data
        const response = await api.get('/forensics/dashboard');
        
        if (response.success) {
            updateSecurityMetrics(response.data);
            updateSecurityStatus(response.data);
            // Display events from the dashboard response
            if (response.data.recentEvents) {
                displaySecurityEvents(response.data.recentEvents);
            } else {
                loadRecentSecurityEvents();
            }
        } else {
            throw new Error(response.message || 'Failed to load security dashboard');
        }
        
    } catch (error) {
        console.error('Error loading security dashboard:', error);
        showNotification('Failed to load security dashboard', 'error');
        updateSecurityStatus({ alerts: [], recentActivity: {} });
    } finally {
        hideLoading();
    }
}

function updateSecurityMetrics(data) {
    // Update security status
    const statusElement = document.getElementById('securityStatus');
    const alertsCount = data.alerts?.length || 0;
    
    if (alertsCount === 0) {
        statusElement.textContent = 'SECURE';
        statusElement.className = 'status-good';
    } else if (alertsCount < 3) {
        statusElement.textContent = 'MODERATE';
        statusElement.className = 'status-warning';
    } else {
        statusElement.textContent = 'HIGH RISK';
        statusElement.className = 'status-danger';
    }

    // Update metrics
    document.getElementById('activeAlerts').textContent = alertsCount;
    document.getElementById('highRiskUsers').textContent = data.recentActivity?.highRiskUsers || 0;
    document.getElementById('suspiciousIPs').textContent = data.recentActivity?.suspiciousIPs || 0;
    
    // Update alert breakdown
    const highAlerts = data.alerts?.filter(alert => alert.severity === 'high').length || 0;
    const mediumAlerts = data.alerts?.filter(alert => alert.severity === 'medium').length || 0;
    document.getElementById('highAlerts').textContent = highAlerts;
    document.getElementById('mediumAlerts').textContent = mediumAlerts;
    
    // Update last check time
    document.getElementById('lastSecurityCheck').textContent = new Date().toLocaleTimeString();
    
    // Show/hide alerts section
    const alertsSection = document.getElementById('alertsSection');
    if (alertsCount > 0) {
        alertsSection.style.display = 'block';
        displayAlerts(data.alerts);
    } else {
        alertsSection.style.display = 'none';
    }
}

function updateSecurityStatus(data) {
    // This function can be expanded to show more detailed status information
    console.log('Security dashboard updated:', data);
}

async function loadRecentSecurityEvents() {
    try {
        // Load actual events from the dashboard data
        const response = await api.get('/forensics/dashboard');
        
        if (response.success && response.data.recentEvents) {
            displaySecurityEvents(response.data.recentEvents);
        } else {
            displaySecurityEvents([]);
        }
    } catch (error) {
        console.error('Error loading security events:', error);
        displaySecurityEvents([]);
    }
}

function displaySecurityEvents(events) {
    const tbody = document.getElementById('securityEventsTableBody');
    
    // Store events globally for detail viewing
    window.currentSecurityEvents = events;
    
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent security events</td></tr>';
        return;
    }
    
    tbody.innerHTML = events.map(event => `
        <tr>
            <td>${formatDateTime(event.timestamp)}</td>
            <td>
                <span class="event-type ${event.eventType.includes('failed') ? 'event-warning' : ''}">
                    ${formatEventType(event.eventType)}
                </span>
            </td>
            <td>${event.user || 'Unknown'}</td>
            <td>
                <span class="ip-address">${event.ipAddress}</span>
            </td>
            <td>
                <span class="risk-level risk-${event.riskLevel}">
                    ${event.riskLevel.toUpperCase()}
                </span>
            </td>
            <td>
                <button class="action-btn view" onclick="viewEventDetails(${event.id})" title="View Details">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function displayAlerts(alerts) {
    const container = document.getElementById('alertsContainer');
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.severity}">
            <div class="alert-header">
                <span class="material-symbols-outlined">
                    ${alert.severity === 'high' ? 'error' : 'warning'}
                </span>
                <h4>${alert.type.replace(/_/g, ' ').toUpperCase()}</h4>
                <span class="alert-severity">${alert.severity.toUpperCase()}</span>
            </div>
            <div class="alert-body">
                <p>${alert.message}</p>
                ${alert.count ? `<small>Count: ${alert.count}</small>` : ''}
            </div>
        </div>
    `).join('');
}

function showInvestigationModal() {
    // Set default date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    document.getElementById('investigationStartDate').value = formatDateTimeInput(startDate);
    document.getElementById('investigationEndDate').value = formatDateTimeInput(endDate);
    
    document.getElementById('investigationModal').style.display = 'flex';
}

function hideInvestigationModal() {
    document.getElementById('investigationModal').style.display = 'none';
}

function showReportModal() {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('reportStartDate').value = formatDateTimeInput(startDate);
    document.getElementById('reportEndDate').value = formatDateTimeInput(endDate);
    
    document.getElementById('reportModal').style.display = 'flex';
}

function hideReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

function showResultsModal() {
    document.getElementById('investigationResultsModal').style.display = 'flex';
}

function hideResultsModal() {
    document.getElementById('investigationResultsModal').style.display = 'none';
}

async function handleInvestigation(e) {
    e.preventDefault();
    
    try {
        showLoading('Starting investigation...');
        
        const formData = new FormData(e.target);
        const startDate = document.getElementById('investigationStartDate').value;
        const endDate = document.getElementById('investigationEndDate').value;
        const riskThreshold = parseInt(document.getElementById('riskThreshold').value);
        const eventTypesSelect = document.getElementById('eventTypesFilter');
        const eventTypes = Array.from(eventTypesSelect.selectedOptions).map(option => option.value);
        const specificIPs = document.getElementById('specificIPs').value
            .split(',')
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);

        const investigationData = {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            riskThreshold,
            eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
            ipAddresses: specificIPs.length > 0 ? specificIPs : undefined
        };

        const response = await api.post('/forensics/investigate', investigationData);
        
        if (response.success) {
            hideInvestigationModal();
            displayInvestigationResults(response.data);
            showNotification('Investigation completed successfully', 'success');
        } else {
            throw new Error(response.message || 'Investigation failed');
        }
        
    } catch (error) {
        console.error('Investigation error:', error);
        showNotification('Investigation failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function handleReportGeneration(e) {
    e.preventDefault();
    
    try {
        showLoading('Generating audit report...');
        
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        const includeUserActivity = document.getElementById('includeUserActivity').checked;
        const includeSystemEvents = document.getElementById('includeSystemEvents').checked;
        const includeSecurityEvents = document.getElementById('includeSecurityEvents').checked;
        const format = document.getElementById('reportFormat').value;

        const reportData = {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            includeUserActivity,
            includeSystemEvents,
            includeSecurityEvents,
            format
        };

        const response = await api.post('/forensics/audit-report', reportData);
        
        if (response.success) {
            hideReportModal();
            downloadReport(response.data);
            showNotification('Audit report generated successfully', 'success');
        } else {
            throw new Error(response.message || 'Report generation failed');
        }
        
    } catch (error) {
        console.error('Report generation error:', error);
        showNotification('Report generation failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayInvestigationResults(results) {
    const container = document.getElementById('investigationResults');
    
    let html = `
        <div class="investigation-summary">
            <h3>Investigation Summary</h3>
            <p><strong>Period:</strong> ${formatDateTime(results.period.startDate)} - ${formatDateTime(results.period.endDate)}</p>
            <p><strong>Findings:</strong> ${results.findings.length}</p>
            <p><strong>High-Risk Users:</strong> ${results.highRiskUsers.length}</p>
            <p><strong>Suspicious IPs:</strong> ${results.suspiciousIPs.length}</p>
        </div>
    `;
    
    if (results.findings.length > 0) {
        html += '<div class="investigation-findings"><h4>Key Findings</h4>';
        results.findings.forEach(finding => {
            html += `
                <div class="finding-card finding-${finding.severity}">
                    <h5>${finding.category}</h5>
                    <p>${finding.description}</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (results.recommendations.length > 0) {
        html += '<div class="investigation-recommendations"><h4>Recommendations</h4>';
        results.recommendations.forEach(rec => {
            html += `
                <div class="recommendation-card priority-${rec.priority}">
                    <h5>${rec.action}</h5>
                    <p>${rec.details}</p>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
    showResultsModal();
}

function downloadReport(reportData) {
    // Create a downloadable JSON file of the report
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function filterSecurityEvents() {
    // This would filter the events table based on the selected event type
    // For now, just reload the events
    loadRecentSecurityEvents();
}

function viewEventDetails(eventId) {
    // Find the event in the current data
    const event = window.currentSecurityEvents?.find(e => e.id == eventId);
    
    if (!event) {
        showNotification('Event not found', 'error');
        return;
    }
    
    // Create a modal to show event details
    const modalHtml = `
        <div class="modal-overlay" id="eventDetailsModal" style="display: flex;">
            <div class="modal">
                <div class="modal-header">
                    <h2>Security Event Details</h2>
                    <button class="modal-close" onclick="document.getElementById('eventDetailsModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="event-details">
                        <div class="detail-row">
                            <label>Event ID:</label>
                            <span>${event.id}</span>
                        </div>
                        <div class="detail-row">
                            <label>Timestamp:</label>
                            <span>${formatDateTime(event.timestamp)}</span>
                        </div>
                        <div class="detail-row">
                            <label>Event Type:</label>
                            <span class="event-type ${event.eventType.includes('failed') ? 'event-warning' : ''}">
                                ${formatEventType(event.eventType)}
                            </span>
                        </div>
                        <div class="detail-row">
                            <label>User:</label>
                            <span>${event.user || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <label>IP Address:</label>
                            <span class="ip-address">${event.ipAddress}</span>
                        </div>
                        <div class="detail-row">
                            <label>Risk Level:</label>
                            <span class="risk-level risk-${event.riskLevel}">
                                ${event.riskLevel.toUpperCase()}
                            </span>
                        </div>
                        ${event.metadata && Object.keys(event.metadata).length > 0 ? `
                            <div class="detail-row">
                                <label>Additional Details:</label>
                                <pre>${JSON.stringify(event.metadata, null, 2)}</pre>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('eventDetailsModal').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Store events globally for detail viewing
window.currentSecurityEvents = [];

// Utility functions
function formatDateTime(date) {
    return new Date(date).toLocaleString();
}

function formatDateTimeInput(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function formatEventType(eventType) {
    return eventType.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function showLoading(message = 'Loading...') {
    // Show loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.id = 'securityLoading';
    loadingEl.className = 'loading-overlay';
    loadingEl.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(loadingEl);
}

function hideLoading() {
    const loadingEl = document.getElementById('securityLoading');
    if (loadingEl) {
        document.body.removeChild(loadingEl);
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined">
            ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
        </span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 5000);
}