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
