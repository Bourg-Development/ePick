document.addEventListener('DOMContentLoaded', async function() {
    // Get recurring analysis ID from URL
    const pathParts = window.location.pathname.split('/');
    const recurringAnalysisId = pathParts[pathParts.length - 1];
    
    if (!recurringAnalysisId || isNaN(recurringAnalysisId)) {
        showError('Invalid recurring analysis ID');
        return;
    }

    // Configure API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Load analysis data
    await loadAnalysisData(recurringAnalysisId);

    // Setup form submission
    const form = document.getElementById('prescriptionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPrescriptionValidation(recurringAnalysisId);
    });
});

async function loadAnalysisData(recurringAnalysisId) {
    try {
        const response = await api.get(`/prescriptions/validate/${recurringAnalysisId}`);
        
        if (!response.success) {
            showError(response.message || 'Failed to load analysis data');
            return;
        }

        const { recurringAnalysis, existingPrescriptions } = response.data;
        
        // Hide loading, show content
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('contentArea').style.display = 'block';
        
        // Populate analysis information
        document.getElementById('patientName').textContent = recurringAnalysis.patientName;
        document.getElementById('patientMatricule').textContent = recurringAnalysis.patientMatricule;
        document.getElementById('doctorName').textContent = recurringAnalysis.doctorName;
        document.getElementById('analysisType').textContent = recurringAnalysis.analysisType;
        document.getElementById('recurrencePattern').textContent = formatRecurrencePattern(recurringAnalysis.recurrencePattern);
        document.getElementById('nextDueDate').textContent = formatDate(recurringAnalysis.nextDueDate);
        document.getElementById('progress').textContent = `${recurringAnalysis.completedOccurrences} of ${recurringAnalysis.totalOccurrences} completed`;
        
        const statusElement = document.getElementById('status');
        statusElement.textContent = recurringAnalysis.isActive ? 'Active' : 'Inactive';
        statusElement.className = recurringAnalysis.isActive ? 'status-active' : 'status-inactive';
        
        // Display existing prescriptions
        displayExistingPrescriptions(existingPrescriptions);
        
        // Set minimum date for prescription validity
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('validFrom').min = today;
        document.getElementById('validUntil').min = today;
        
    } catch (error) {
        console.error('Error loading analysis data:', error);
        showError('Failed to load analysis data. Please try again.');
    }
}

function displayExistingPrescriptions(prescriptions) {
    const container = document.getElementById('existingPrescriptions');
    
    if (!prescriptions || prescriptions.length === 0) {
        container.innerHTML = '<p class="no-data">No prescriptions found for this recurring analysis.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'prescriptions-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Prescription #</th>
                <th>Valid From</th>
                <th>Valid Until</th>
                <th>Analyses</th>
                <th>Status</th>
                <th>Verified By</th>
                <th>Verified At</th>
            </tr>
        </thead>
        <tbody>
            ${prescriptions.map(p => `
                <tr>
                    <td>${p.prescriptionNumber}</td>
                    <td>${formatDate(p.validFrom)}</td>
                    <td>${formatDate(p.validUntil)}</td>
                    <td>${p.remainingAnalyses} / ${p.totalAnalysesPrescribed}</td>
                    <td><span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span></td>
                    <td>${p.verifiedBy}</td>
                    <td>${formatDateTime(p.verifiedAt)}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

async function submitPrescriptionValidation(recurringAnalysisId) {
    const form = document.getElementById('prescriptionForm');
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Disable form during submission
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Validating...';
    
    // Get form data
    const formData = {
        prescriptionNumber: document.getElementById('prescriptionNumber').value.trim(),
        validFrom: document.getElementById('validFrom').value,
        validUntil: document.getElementById('validUntil').value,
        totalAnalysesPrescribed: parseInt(document.getElementById('totalAnalysesPrescribed').value),
        validationNotes: document.getElementById('validationNotes').value.trim()
    };
    
    // Validate dates
    if (new Date(formData.validFrom) > new Date(formData.validUntil)) {
        showError('Valid from date cannot be after valid until date');
        submitButton.disabled = false;
        submitButton.innerHTML = '<span class="material-symbols-outlined">verified</span> Verify Prescription';
        return;
    }
    
    try {
        const response = await api.post(`/prescriptions/validate/${recurringAnalysisId}`, formData);
        
        if (response.success) {
            // Show success message
            showSuccess('Prescription validated successfully!');
            
            // Reset form
            form.reset();
            
            // Reload the page data
            await loadAnalysisData(recurringAnalysisId);
            
        } else {
            showError(response.message || 'Failed to validate prescription');
        }
        
    } catch (error) {
        console.error('Error validating prescription:', error);
        showError('Failed to validate prescription. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<span class="material-symbols-outlined">verified</span> Verify Prescription';
    }
}

function formatRecurrencePattern(pattern) {
    const patterns = {
        'daily': 'Daily',
        'weekly': 'Weekly',
        'monthly': 'Monthly',
        'custom': 'Custom Interval'
    };
    return patterns[pattern] || pattern;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('loadingSpinner').style.display = 'none';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    // Insert after error message
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.parentNode.insertBefore(successDiv, errorDiv.nextSibling);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}