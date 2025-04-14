document.querySelector('.auth-form').addEventListener('submit', function(e) {
    e.preventDefault();
    let isValid = true;

    // Username validation
    const usernameInput = document.getElementById('username');
    const usernameValue = usernameInput.value.trim();
    const usernameError = usernameInput.nextElementSibling;

    if (!/^\d{6}$/.test(usernameValue)) {
        usernameError.textContent = 'Username must be a 6-digit number.';
        usernameError.classList.add('show');
        isValid = false;
    } else {
        usernameError.classList.remove('show');
    }

    // Password validation (only checks if empty)
    const passwordInput = document.getElementById('password');
    const passwordValue = passwordInput.value.trim();
    const passwordError = passwordInput.nextElementSibling;

    if (passwordValue === '') {
        passwordError.textContent = 'Password cannot be empty.';
        passwordError.classList.add('show');
        isValid = false;
    } else {
        passwordError.classList.remove('show');
    }

    if (isValid) {
        // Form is valid, submit it
        this.submit();
    }
});

// Add error message elements if they don't exist
document.querySelectorAll('.form-control').forEach(input => {
    if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('error-message')) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        input.parentNode.insertBefore(errorElement, input.nextSibling);
    }
});