// Validation function
const validatePassword = (password) => {
    const errors = [];
    if (password.length < 12 || password.length > 50) errors.push('length');
    if (!/[A-Z]/.test(password)) errors.push('upper');
    if (!/[a-z]/.test(password)) errors.push('lower');
    if (!/\d/.test(password)) errors.push('number');
    return errors;
};
document.addEventListener('DOMContentLoaded', () => {

    const refCode = getQueryParam('refCode');
    if(refCode){
        const formattedCode = formatRefCode(refCode);
        const input = document.getElementById('refCode');
        if(input){
            input.value = formattedCode;
            setTimeout(() => {
                document.getElementById('verifyRefCode').click();
            }, 100)
        }
    }

    const togglePassword = document.getElementById('password-toggle')
    const toggleConfirm = document.getElementById('confirm-toggle')
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    if (togglePassword && passwordInput && confirmPasswordInput) {
        togglePassword.addEventListener('click', function() {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';

            const icon = document.querySelector('.password-icon');
            if (icon) {
                icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        });
        toggleConfirm.addEventListener('click', () => {
            const isPassword = confirmPasswordInput.type === 'password';
            confirmPasswordInput.type = isPassword ? 'text' : 'password';
            const icon = document.querySelector('.confirm-icon');
            if (icon) {
                icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        })
    }

    document.getElementById('verifyRefCode').addEventListener('click', function() {
        const refCode = document.getElementById('refCode').value.trim();
        const errorElement = document.getElementById('refCodeError');

        if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i.test(refCode)) {
            errorElement.textContent = 'Invalid format. Use XXX-XXX-XXX format';
            errorElement.style.display = 'block';
            return;
        }

        // After successful verification
        setTimeout(() => {
            document.getElementById('refCodeSection').style.display = 'none';
            const registrationFields = document.getElementById('registrationFields');
            registrationFields.style.display = 'block';

            // Add required attributes dynamically
            document.getElementById('password').required = true;
            document.getElementById('confirmPassword').required = true;

            document.getElementById('username').value = 'EMP-'+refCode.replace(/-/g, '');
        }, 500);

    });

    document.getElementById('registrationForm').addEventListener('submit', function(e) {
        e.preventDefault();

        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });

        let isValid = true;
        const password = document.getElementById('password').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        // Manual validation
        if (password === '') {
            document.getElementById('passwordError').textContent = 'Password is required';
            document.getElementById('passwordError').style.display = 'block';
            isValid = false;
        }

        if (confirmPassword === '') {
            document.getElementById('confirmPasswordError').textContent = 'Confirm Password is required';
            document.getElementById('confirmPasswordError').style.display = 'block';
            isValid = false;
        }

        // Only validate complexity if password isn't empty
        if (password !== '' && validatePassword(password).length > 0) {
            document.getElementById('passwordError').textContent = 'Password requirements not met';
            document.getElementById('passwordError').style.display = 'block';
            isValid = false;
        }

        if (password !== confirmPassword) {
            document.getElementById('confirmPasswordError').textContent = 'Passwords do not match';
            document.getElementById('confirmPasswordError').style.display = 'block';
            isValid = false;
        }

        if (isValid) {
            // Submit the form
            alert('Registration successful!');
            // this.submit(); // Uncomment for real form submission
        }
    });

// Real-time password validation
    document.getElementById('password').addEventListener('input', function(e) {
        const password = e.target.value;
        const errors = validatePassword(password);

        // Update visual indicators
        document.getElementById('lengthRule').style.color =
            errors.includes('length') ? '#e63946' : '#666666';
        document.getElementById('upperRule').style.color =
            errors.includes('upper') ? '#e63946' : '#666666';
        document.getElementById('lowerRule').style.color =
            errors.includes('lower') ? '#e63946' : '#666666';
        document.getElementById('numberRule').style.color =
            errors.includes('number') ? '#e63946' : '#666666';
    });

    function getQueryParam(param){
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function formatRefCode(code) {
        return code.replace(/\D/g, '') // remove non-digits just in case
            .replace(/(.{3})/g, '$1-') // insert dash every 3 digits
            .replace(/-$/, ''); // remove trailing dash
    }


})
