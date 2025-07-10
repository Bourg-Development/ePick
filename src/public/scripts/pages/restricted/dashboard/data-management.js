// Data Management Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Wait for API to be available
    if (typeof api === 'undefined') {
        console.log('API not yet available, waiting...');
        setTimeout(() => document.dispatchEvent(new Event('DOMContentLoaded')), 100);
        return;
    }
    
    api.setConfig({
        baseURL: '/api',
        timeout: 30000 // Longer timeout for import/export operations
    });

    // Initialize page
    initializeDataManagement();
});

function initializeDataManagement() {
    setupEventListeners();
    loadImportExportHistory();
}

function setupEventListeners() {
    // Main action buttons
    document.getElementById('importDataBtn')?.addEventListener('click', showImportModal);
    document.getElementById('exportDataBtn')?.addEventListener('click', showExportModal);
    document.getElementById('templatesBtn')?.addEventListener('click', showTemplatesModal);
    document.getElementById('viewHistoryBtn')?.addEventListener('click', scrollToHistory);
    document.getElementById('refreshHistoryBtn')?.addEventListener('click', loadImportExportHistory);

    // Modal close buttons
    document.getElementById('closeImportBtn')?.addEventListener('click', hideImportModal);
    document.getElementById('closeExportBtn')?.addEventListener('click', hideExportModal);
    document.getElementById('closeTemplatesBtn')?.addEventListener('click', hideTemplatesModal);
    document.getElementById('closeProgressBtn')?.addEventListener('click', hideProgressModal);

    // Modal cancel buttons
    document.getElementById('cancelImportBtn')?.addEventListener('click', hideImportModal);
    document.getElementById('cancelExportBtn')?.addEventListener('click', hideExportModal);
    document.getElementById('closeTemplatesModalBtn')?.addEventListener('click', hideTemplatesModal);

    // Form submissions
    document.getElementById('importForm')?.addEventListener('submit', handleImport);
    document.getElementById('exportForm')?.addEventListener('submit', handleExport);

    // File upload handling
    const fileInput = document.getElementById('importFile');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const removeFileBtn = document.getElementById('removeFileBtn');

    if (fileInput && fileUploadArea) {
        fileInput.addEventListener('change', handleFileSelection);
        removeFileBtn?.addEventListener('click', clearFileSelection);
        
        // Drag and drop functionality
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('dragleave', handleDragLeave);
        fileUploadArea.addEventListener('drop', handleFileDrop);
    }

    // Entity type change handler
    document.getElementById('importEntityType')?.addEventListener('change', handleEntityTypeChange);
    document.getElementById('exportEntityType')?.addEventListener('change', handleExportEntityTypeChange);

    // Template download buttons
    document.querySelectorAll('.template-actions button').forEach(btn => {
        btn.addEventListener('click', handleTemplateDownload);
    });

    // Download template button in import modal
    document.getElementById('downloadTemplateBtn')?.addEventListener('click', handleImportTemplateDownload);

    // History filter
    document.getElementById('historyTypeFilter')?.addEventListener('change', filterHistory);

    // Modal click outside to close
    document.getElementById('importModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'importModal') hideImportModal();
    });
    document.getElementById('exportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'exportModal') hideExportModal();
    });
    document.getElementById('templatesModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'templatesModal') hideTemplatesModal();
    });
}

// Import Modal Functions
function showImportModal() {
    document.getElementById('importModal').style.display = 'flex';
    resetImportForm();
}

function hideImportModal() {
    document.getElementById('importModal').style.display = 'none';
    resetImportForm();
}

function resetImportForm() {
    document.getElementById('importForm').reset();
    clearFileSelection();
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('downloadTemplateBtn').style.display = 'none';
}

// Export Modal Functions
function showExportModal() {
    document.getElementById('exportModal').style.display = 'flex';
    resetExportForm();
}

function hideExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

function resetExportForm() {
    document.getElementById('exportForm').reset();
    document.getElementById('dateFilters').style.display = 'none';
    document.getElementById('createdAfterFilter').style.display = 'none';
}

// Templates Modal Functions
function showTemplatesModal() {
    document.getElementById('templatesModal').style.display = 'flex';
}

function hideTemplatesModal() {
    document.getElementById('templatesModal').style.display = 'none';
}

// Progress Modal Functions
function showProgressModal(title = 'Processing...') {
    document.getElementById('progressTitle').textContent = title;
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = 'Initializing...';
    document.getElementById('progressResults').style.display = 'none';
    document.getElementById('closeProgressBtn').style.display = 'none';
    document.getElementById('progressModal').style.display = 'flex';
}

function hideProgressModal() {
    document.getElementById('progressModal').style.display = 'none';
}

function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = text;
}

function showProgressResults(results) {
    document.getElementById('progressResults').style.display = 'block';
    document.getElementById('closeProgressBtn').style.display = 'block';
    
    document.getElementById('totalRecords').textContent = results.totalRecords || 0;
    document.getElementById('importedRecords').textContent = results.imported || 0;
    document.getElementById('skippedRecords').textContent = results.skipped || 0;
    document.getElementById('failedRecords').textContent = results.failed || 0;
    
    // Show errors if any
    if (results.errors && results.errors.length > 0) {
        document.getElementById('errorDetails').style.display = 'block';
        document.getElementById('errorList').innerHTML = results.errors
            .map(error => `<div>${error.error || error}</div>`)
            .join('');
    } else {
        document.getElementById('errorDetails').style.display = 'none';
    }
}

// File Handling Functions
function handleFileSelection(event) {
    const file = event.target.files[0];
    if (file) {
        showSelectedFile(file);
    }
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        document.getElementById('importFile').files = files;
        showSelectedFile(file);
    }
    
    event.target.classList.remove('dragover');
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('dragover');
}

function showSelectedFile(file) {
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);
    document.getElementById('selectedFileInfo').style.display = 'flex';
    document.getElementById('fileUploadArea').style.display = 'none';
}

function clearFileSelection() {
    document.getElementById('importFile').value = '';
    document.getElementById('selectedFileInfo').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Entity Type Change Handlers
function handleEntityTypeChange(event) {
    const entityType = event.target.value;
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    
    if (entityType) {
        downloadTemplateBtn.style.display = 'inline-flex';
        downloadTemplateBtn.setAttribute('data-entity', entityType);
    } else {
        downloadTemplateBtn.style.display = 'none';
    }
}

function handleExportEntityTypeChange(event) {
    const entityType = event.target.value;
    const dateFilters = document.getElementById('dateFilters');
    const createdAfterFilter = document.getElementById('createdAfterFilter');
    
    // Show appropriate filters based on entity type
    if (entityType === 'analyses') {
        dateFilters.style.display = 'flex';
        createdAfterFilter.style.display = 'none';
    } else if (entityType === 'patients' || entityType === 'doctors') {
        dateFilters.style.display = 'none';
        createdAfterFilter.style.display = 'block';
    } else {
        dateFilters.style.display = 'none';
        createdAfterFilter.style.display = 'none';
    }
}

// Import Handler
async function handleImport(event) {
    event.preventDefault();
    
    const formData = new FormData();
    const entityType = document.getElementById('importEntityType').value;
    const file = document.getElementById('importFile').files[0];
    const updateExisting = document.getElementById('updateExisting').checked;
    
    if (!file) {
        showNotification('Please select a file to import', 'error');
        return;
    }
    
    formData.append('file', file);
    formData.append('updateExisting', updateExisting);
    
    try {
        hideImportModal();
        showProgressModal('Importing Data...');
        
        updateProgress(10, 'Validating file format...');
        
        const response = await fetch(`/api/data/${entityType}/import`, {
            method: 'POST',
            body: formData
        });
        
        updateProgress(50, 'Processing records...');
        
        const result = await response.json();
        
        updateProgress(100, 'Import completed');
        
        if (result.success) {
            showProgressResults({
                totalRecords: (result.imported || 0) + (result.skipped || 0) + (result.failed || 0),
                imported: result.imported || 0,
                skipped: result.skipped || 0,
                failed: result.failed || 0,
                errors: result.errors || []
            });
            
            showNotification('Data imported successfully', 'success');
            loadImportExportHistory();
        } else {
            showProgressResults({
                totalRecords: 0,
                imported: 0,
                skipped: 0,
                failed: 0,
                errors: result.errors || [result.message || 'Import failed']
            });
            
            showNotification(result.message || 'Import failed', 'error');
        }
        
    } catch (error) {
        hideProgressModal();
        console.error('Import error:', error);
        showNotification('Import failed: ' + error.message, 'error');
    }
}

// Export Handler
async function handleExport(event) {
    event.preventDefault();
    
    const entityType = document.getElementById('exportEntityType').value;
    const format = document.getElementById('exportFormat').value;
    const includePersonalData = document.getElementById('includePersonalData').checked;
    
    // Build query parameters
    const params = new URLSearchParams({
        format,
        includePersonalData
    });
    
    // Add filters based on entity type
    if (entityType === 'analyses') {
        const dateFrom = document.getElementById('exportDateFrom').value;
        const dateTo = document.getElementById('exportDateTo').value;
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
    } else {
        const createdAfter = document.getElementById('exportCreatedAfter').value;
        if (createdAfter) params.append('createdAfter', createdAfter);
    }
    
    try {
        hideExportModal();
        showProgressModal('Exporting Data...');
        
        updateProgress(30, 'Gathering data...');
        
        const response = await fetch(`/api/data/${entityType}/export?${params}`);
        
        updateProgress(70, 'Generating file...');
        
        if (response.ok) {
            updateProgress(100, 'Download starting...');
            
            // Trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entityType}_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            hideProgressModal();
            showNotification('Data exported successfully', 'success');
            loadImportExportHistory();
        } else {
            const error = await response.json();
            hideProgressModal();
            showNotification(error.message || 'Export failed', 'error');
        }
        
    } catch (error) {
        hideProgressModal();
        console.error('Export error:', error);
        showNotification('Export failed: ' + error.message, 'error');
    }
}

// Template Download Handlers
async function handleTemplateDownload(event) {
    const entity = event.target.getAttribute('data-entity');
    const format = event.target.getAttribute('data-format');
    
    try {
        const response = await fetch(`/api/data/${entity}/template?format=${format}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entity}_import_template.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('Template downloaded successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to download template', 'error');
        }
        
    } catch (error) {
        console.error('Template download error:', error);
        showNotification('Failed to download template: ' + error.message, 'error');
    }
}

async function handleImportTemplateDownload() {
    const entityType = document.getElementById('importEntityType').value;
    if (!entityType) {
        showNotification('Please select a data type first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/data/${entityType}/template?format=csv`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entityType}_import_template.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('Template downloaded successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to download template', 'error');
        }
        
    } catch (error) {
        console.error('Template download error:', error);
        showNotification('Failed to download template: ' + error.message, 'error');
    }
}

// History Functions
async function loadImportExportHistory() {
    try {
        const response = await api.get('/data/history?limit=50');
        
        if (response.success) {
            displayHistory(response.history);
        } else {
            showNotification('Failed to load history', 'error');
        }
        
    } catch (error) {
        console.error('History load error:', error);
        showNotification('Failed to load history: ' + error.message, 'error');
    }
}

function displayHistory(history) {
    const tbody = document.getElementById('historyTableBody');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No import/export history found</td></tr>';
        return;
    }
    
    tbody.innerHTML = history.map(item => `
        <tr>
            <td>
                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">
                    ${item.type === 'import' ? 'file_upload' : 'file_download'}
                </span>
                ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </td>
            <td>${item.entityType || 'N/A'}</td>
            <td>${item.format || 'N/A'}</td>
            <td>${item.recordCount || 0}</td>
            <td>
                <span class="status-badge status-${item.status}">
                    ${item.status}
                </span>
            </td>
            <td>${item.user || 'Unknown'}</td>
            <td>${formatDateTime(item.timestamp)}</td>
            <td>
                <button class="action-btn" onclick="viewHistoryDetails('${item.id}')" title="View Details">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterHistory() {
    const filterType = document.getElementById('historyTypeFilter').value;
    const rows = document.querySelectorAll('#historyTableBody tr');
    
    rows.forEach(row => {
        if (row.cells.length < 8) return; // Skip header or empty rows
        
        const typeCell = row.cells[0];
        const type = typeCell.textContent.toLowerCase().includes('import') ? 'import' : 'export';
        
        if (!filterType || type === filterType) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function viewHistoryDetails(itemId) {
    // This would show detailed information about the import/export operation
    showNotification('History details feature coming soon', 'info');
}

function scrollToHistory() {
    document.querySelector('.dashboard-section').scrollIntoView({ behavior: 'smooth' });
}

// Utility Functions
function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
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