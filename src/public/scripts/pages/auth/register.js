// Validation function
const validatePassword = (password) => {
    const errors = [];
    if (password.length < 12 || password.length > 50) errors.push('length');
    if (!/[A-Z]/.test(password)) errors.push('upper');
    if (!/[a-z]/.test(password)) errors.push('lower');
    if (!/\d/.test(password)) errors.push('number');
    return errors;
};

// Helper function to get CSS variable value
const getCSSVariable = (varName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
};

// Global variable to store validated reference code data
let validatedRefCodeData = null;

document.addEventListener('DOMContentLoaded', () => {
    const refCode = getQueryParam('refCode');

    // Initialize the masked input
    const refCodeInput = document.getElementById('refCode');
    if (refCodeInput) {
        refCodeInput.value = '___-___-___';
    }

    if(refCode){
        const digits = refCode.replace(/\D/g, ''); // Extract digits only
        if (digits.length <= 9) {
            // Populate the masked input with the digits
            let maskedValue = '___-___-___';
            let digitIndex = 0;
            let result = '';

            for (let i = 0; i < maskedValue.length; i++) {
                if (maskedValue[i] === '_' && digitIndex < digits.length) {
                    result += digits[digitIndex];
                    digitIndex++;
                } else if (maskedValue[i] === '_') {
                    result += '_';
                } else {
                    result += maskedValue[i];
                }
            }

            refCodeInput.value = result;

            // Use the checkComplete function for consistent behavior
            setTimeout(() => {
                refCodeInput.checkComplete();
            }, 200);
        }
    }

    // Auto-format reference code as user types with masked input
    // Auto-format reference code as user types with masked input
    if (refCodeInput) {
        // Initialize with mask if not already set
        if (!refCodeInput.value || refCodeInput.value === '') {
            refCodeInput.value = '___-___-___';
        }

        refCodeInput.addEventListener('focus', function(e) {
            // Position cursor at first underscore, or if none, at end
            const firstUnderscore = e.target.value.indexOf('_');
            if (firstUnderscore !== -1) {
                setTimeout(() => {
                    e.target.setSelectionRange(firstUnderscore, firstUnderscore);
                }, 0);
            } else {
                // If no underscores, position at end for potential editing
                setTimeout(() => {
                    const lastPos = e.target.value.length;
                    e.target.setSelectionRange(lastPos, lastPos);
                }, 0);
            }
        });

        refCodeInput.addEventListener('click', function(e) {
            // Move cursor to appropriate position on click
            const cursorPos = e.target.selectionStart;
            const value = e.target.value;
            let newPos = cursorPos;

            // If clicked on a dash, move to next available position
            if (value[cursorPos] === '-') {
                // Find next available position (underscore or digit)
                for (let i = cursorPos + 1; i < value.length; i++) {
                    if (value[i] === '_') {
                        newPos = i;
                        break;
                    }
                }
                // If no underscores found, just stay where we are
            }

            setTimeout(() => {
                e.target.setSelectionRange(newPos, newPos);
            }, 0);
        });

        refCodeInput.addEventListener('keydown', function(e) {
            const cursorPos = e.target.selectionStart;
            const value = e.target.value;

            // Allow Ctrl+A (Select All)
            if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                return; // Let browser handle Ctrl+A
            }

            // Allow Ctrl+C (Copy)
            if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                return; // Let browser handle Ctrl+C
            }

            // Allow Ctrl+X (Cut)
            if (e.ctrlKey && e.key.toLowerCase() === 'x') {
                // Let browser handle the cut operation, then clean up the result
                setTimeout(() => {
                    const currentValue = this.value;
                    const digits = currentValue.replace(/[^0-9]/g, '');

                    // Rebuild the masked format with remaining digits
                    let maskedValue = '___-___-___';
                    let digitIndex = 0;
                    let result = '';

                    for (let i = 0; i < maskedValue.length; i++) {
                        if (maskedValue[i] === '_' && digitIndex < digits.length) {
                            result += digits[digitIndex];
                            digitIndex++;
                        } else if (maskedValue[i] === '_') {
                            result += '_';
                        } else {
                            result += maskedValue[i];
                        }
                    }

                    this.value = result;

                    // Position cursor at first underscore
                    const firstUnderscore = result.indexOf('_');
                    if (firstUnderscore !== -1) {
                        this.setSelectionRange(firstUnderscore, firstUnderscore);
                    }

                    // Check if still complete (unlikely after cut, but good to be safe)
                    this.checkComplete();
                }, 0);
                return; // Let browser handle Ctrl+X
            }

            // Allow Ctrl+V (Paste) - will be handled by paste event
            if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                return; // Let browser handle Ctrl+V, paste event will handle the logic
            }

            // Allow digits
            if (/[0-9]/.test(e.key)) {
                e.preventDefault();

                // If user has selected text, replace the selection
                const selectionStart = e.target.selectionStart;
                const selectionEnd = e.target.selectionEnd;

                if (selectionStart !== selectionEnd) {
                    // User has selected text, replace selected portion
                    this.handleDigitInput(e.key, selectionStart, value);
                } else {
                    // Normal single digit input
                    this.handleDigitInput(e.key, cursorPos, value);
                }
                return;
            }

            // Handle backspace
            if (e.key === 'Backspace') {
                e.preventDefault();
                const selectionStart = e.target.selectionStart;
                const selectionEnd = e.target.selectionEnd;

                if (selectionStart !== selectionEnd) {
                    // User has selected text, clear the selection
                    this.clearSelection(selectionStart, selectionEnd, value);
                } else {
                    // Normal backspace
                    let targetPos = cursorPos - 1;

                    // Skip over dashes when going backward
                    if (targetPos >= 0 && value[targetPos] === '-') {
                        targetPos--;
                    }

                    // Replace the digit with underscore
                    if (targetPos >= 0 && value[targetPos] !== '_' && value[targetPos] !== '-') {
                        const newValue = value.substring(0, targetPos) + '_' + value.substring(targetPos + 1);
                        e.target.value = newValue;
                        e.target.setSelectionRange(targetPos, targetPos);
                        this.checkComplete();
                    }
                }
                return;
            }

            // Handle delete
            if (e.key === 'Delete') {
                e.preventDefault();
                const selectionStart = e.target.selectionStart;
                const selectionEnd = e.target.selectionEnd;

                if (selectionStart !== selectionEnd) {
                    // User has selected text, clear the selection
                    this.clearSelection(selectionStart, selectionEnd, value);
                } else {
                    // Normal delete
                    let targetPos = cursorPos;

                    // Skip over dashes when going forward
                    if (value[targetPos] === '-') {
                        targetPos++;
                    }

                    // Replace the digit with underscore
                    if (targetPos < value.length && value[targetPos] !== '_' && value[targetPos] !== '-') {
                        const newValue = value.substring(0, targetPos) + '_' + value.substring(targetPos + 1);
                        e.target.value = newValue;
                        this.checkComplete();
                    }
                }
                return;
            }

            // Handle arrow keys
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                let newPos = cursorPos - 1;
                if (newPos >= 0 && value[newPos] === '-') {
                    newPos--;
                }
                if (newPos >= 0) {
                    e.target.setSelectionRange(newPos, newPos);
                }
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                let newPos = cursorPos + 1;
                if (newPos < value.length && value[newPos] === '-') {
                    newPos++;
                }
                if (newPos <= value.length) {
                    e.target.setSelectionRange(newPos, newPos);
                }
                return;
            }

            // Allow tab, enter, escape
            if (['Tab', 'Enter', 'Escape'].includes(e.key)) {
                return;
            }

            // Prevent all other keys
            e.preventDefault();
        });

        // Helper function to handle digit input
        refCodeInput.handleDigitInput = function(digit, startPos, currentValue) {
            let targetPos = startPos;

            // If we're on a dash, move to next underscore
            if (currentValue[targetPos] === '-') {
                for (let i = targetPos + 1; i < currentValue.length; i++) {
                    if (currentValue[i] === '_') {
                        targetPos = i;
                        break;
                    }
                }
            }

            // If we're on an underscore OR a digit (allow overwriting), replace it
            if (targetPos < currentValue.length && (currentValue[targetPos] === '_' || /[0-9]/.test(currentValue[targetPos]))) {
                const newValue = currentValue.substring(0, targetPos) + digit + currentValue.substring(targetPos + 1);
                this.value = newValue;

                // Move cursor to next underscore or appropriate position
                let nextPos = targetPos + 1;
                if (nextPos < newValue.length && newValue[nextPos] === '-') {
                    nextPos++;
                }

                this.setSelectionRange(nextPos, nextPos);
                this.checkComplete();
            }
        };

        // Helper function to clear selection
        refCodeInput.clearSelection = function(start, end, currentValue) {
            let newValue = currentValue;

            // Replace all selected digits with underscores
            for (let i = start; i < end; i++) {
                if (newValue[i] !== '-') {
                    newValue = newValue.substring(0, i) + '_' + newValue.substring(i + 1);
                }
            }

            this.value = newValue;
            this.setSelectionRange(start, start);
            this.checkComplete();
        };

        // Helper function to check if code is complete and auto-verify
        refCodeInput.checkComplete = function() {
            const digits = this.value.replace(/[^0-9]/g, '');
            if (digits.length === 9) {
                // Add visual feedback using success color
                this.style.borderColor = '#28a745'; // Success green
                this.style.backgroundColor = getCSSVariable('--off-white');

                // Show brief "Complete!" message
                const errorElement = document.getElementById('refCodeError');
                if (errorElement) {
                    errorElement.textContent = 'Code complete! Verifying...';
                    errorElement.style.color = '#28a745'; // Success green
                    errorElement.style.display = 'block';
                }

                // Small delay to show feedback, then auto-verify
                setTimeout(() => {
                    document.getElementById('verifyRefCode').click();
                }, 300);
            } else {
                // Reset styling if incomplete - using your color variables
                this.style.borderColor = getCSSVariable('--medium-gray');
                this.style.backgroundColor = getCSSVariable('--off-white');

                // Hide any previous messages
                const errorElement = document.getElementById('refCodeError');
                if (errorElement && (errorElement.style.color === 'rgb(40, 167, 69)' || errorElement.style.color === '#28a745')) {
                    errorElement.style.display = 'none';
                }
            }
        };

        // Prevent paste of invalid content
        refCodeInput.addEventListener('paste', function(e) {
            e.preventDefault();

            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const digits = pastedText.replace(/\D/g, ''); // Extract only digits

            if (digits.length > 0) {
                // Build new masked value with pasted digits
                let maskedValue = '___-___-___';
                let digitIndex = 0;
                let result = '';

                for (let i = 0; i < maskedValue.length; i++) {
                    if (maskedValue[i] === '_' && digitIndex < digits.length && digitIndex < 9) {
                        result += digits[digitIndex];
                        digitIndex++;
                    } else if (maskedValue[i] === '_') {
                        result += '_';
                    } else {
                        result += maskedValue[i];
                    }
                }

                e.target.value = result;

                // Position cursor after last entered digit
                let lastDigitPos = 0;
                let digitCount = 0;

                for (let i = 0; i < result.length; i++) {
                    if (result[i] !== '_' && result[i] !== '-') {
                        digitCount++;
                        if (digitCount === Math.min(digits.length, 9)) {
                            lastDigitPos = i + 1;
                            break;
                        }
                    }
                }

                // Skip dash if positioned on one
                if (lastDigitPos < result.length && result[lastDigitPos] === '-') {
                    lastDigitPos++;
                }

                e.target.setSelectionRange(lastDigitPos, lastDigitPos);

                // Check if complete and auto-verify
                this.checkComplete();
            }
        });
    }

    const togglePassword = document.getElementById('password-toggle');
    const toggleConfirm = document.getElementById('confirm-toggle');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    if (togglePassword && passwordInput && confirmPasswordInput) {
        togglePassword.addEventListener('click', function() {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';

            const icon = this.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        });

        toggleConfirm.addEventListener('click', () => {
            const isPassword = confirmPasswordInput.type === 'password';
            confirmPasswordInput.type = isPassword ? 'text' : 'password';

            const icon = this.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        });
    }

    document.getElementById('verifyRefCode').addEventListener('click', async function() {
        const refCodeRaw = document.getElementById('refCode').value.trim();
        const errorElement = document.getElementById('refCodeError');
        const button = this;

        // Extract actual digits from the masked input
        const refCode = refCodeRaw.replace(/[^0-9]/g, '');

        // Clear previous errors and reset input styling
        errorElement.style.display = 'none';
        errorElement.textContent = '';
        errorElement.style.color = getCSSVariable('--blood-red');

        // Reset input styling using your color variables
        const refCodeInput = document.getElementById('refCode');
        refCodeInput.style.borderColor = getCSSVariable('--medium-gray');
        refCodeInput.style.backgroundColor = getCSSVariable('--off-white');

        // Check if we have exactly 9 digits
        if (refCode.length !== 9) {
            errorElement.textContent = 'Please enter all 9 digits of the reference code';
            errorElement.style.display = 'block';
            return;
        }

        // Format for API call
        const formattedRefCode = refCode.replace(/(.{3})/g, '$1-').replace(/-$/, '');

        // Show loading state
        const originalText = button.textContent;
        button.textContent = 'Verifying...';
        button.disabled = true;

        try {
            // Call the validation API - GET request with code in URL
            const response = await fetch(`/api/auth/reference-code/${formattedRefCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                // Store validated data for later use
                validatedRefCodeData = data;

                // Hide reference code section
                document.getElementById('refCodeSection').style.display = 'none';

                // Show registration fields
                const registrationFields = document.getElementById('registrationFields');
                registrationFields.style.display = 'block';
                registrationFields.classList.remove('hidden');

                // Populate user information
                document.getElementById('username').value = data.username;
                document.getElementById('username-display').textContent = data.username;
                document.getElementById('userRole').textContent = data.role;

                // Show 2FA requirement if needed
                const twoFANotice = document.getElementById('twoFANotice');
                if (data.require2FA && twoFANotice) {
                    twoFANotice.style.display = 'block';
                }

                // Add required attributes dynamically
                document.getElementById('password').required = true;
                document.getElementById('confirmPassword').required = true;

                // Focus on password field
                document.getElementById('password').focus();

            } else {
                errorElement.textContent = data.message || 'Invalid or expired reference code';
                errorElement.style.display = 'block';
                // Reset input styling on error using your color variables
                refCodeInput.style.borderColor = getCSSVariable('--blood-red');
                refCodeInput.style.backgroundColor = getCSSVariable('--off-white');
            }
        } catch (error) {
            console.error('Reference code validation error:', error);
            errorElement.textContent = 'Unable to verify reference code. Please try again.';
            errorElement.style.display = 'block';
            // Reset input styling on error using your color variables
            refCodeInput.style.borderColor = getCSSVariable('--blood-red');
            refCodeInput.style.backgroundColor = getCSSVariable('--off-white');
        } finally {
            // Reset button state
            button.textContent = originalText;
            button.disabled = false;
        }
    });

    document.getElementById('registrationForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!validatedRefCodeData) {
            alert('Please verify your reference code first.');
            return;
        }

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

        if (!isValid) {
            return;
        }

        // Show loading state
        const submitButton = document.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Creating Account...';
        submitButton.disabled = true;

        try {
            // Submit registration
            const refCodeRaw = document.getElementById('refCode').value.trim();
            const refCodeDigits = refCodeRaw.replace(/[^0-9]/g, '');
            const formattedRefCode = refCodeDigits.replace(/(.{3})/g, '$1-').replace(/-$/, '');

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referenceCode: formattedRefCode,
                    password: password,
                    confirmPassword: confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                showSuccessMessage('Registration completed successfully! Redirecting to login...');

                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = '/auth/login';
                }, 2000);
            } else {
                // Show error message
                const errorContainer = document.getElementById('registrationError');
                if (errorContainer) {
                    errorContainer.textContent = data.message || 'Registration failed. Please try again.';
                    errorContainer.style.display = 'block';
                } else {
                    alert(data.message || 'Registration failed. Please try again.');
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorContainer = document.getElementById('registrationError');
            if (errorContainer) {
                errorContainer.textContent = 'Network error. Please check your connection and try again.';
                errorContainer.style.display = 'block';
            } else {
                alert('Network error. Please check your connection and try again.');
            }
        } finally {
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });

    // Real-time password validation
    document.getElementById('password').addEventListener('input', function(e) {
        const password = e.target.value;
        const errors = validatePassword(password);

        // Update visual indicators using CSS variables
        const bloodRed = getCSSVariable('--blood-red');
        const mediumGray = getCSSVariable('--medium-gray');

        document.getElementById('lengthRule').style.color =
            errors.includes('length') ? bloodRed : mediumGray;
        document.getElementById('upperRule').style.color =
            errors.includes('upper') ? bloodRed : mediumGray;
        document.getElementById('lowerRule').style.color =
            errors.includes('lower') ? bloodRed : mediumGray;
        document.getElementById('numberRule').style.color =
            errors.includes('number') ? bloodRed : mediumGray;
    });

    function getQueryParam(param){
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function formatRefCode(code) {
        // Extract only digits
        const digits = code.replace(/\D/g, '');

        // For the verification, we still need the XXX-XXX-XXX format
        if (digits.length === 9) {
            return digits.replace(/(.{3})/g, '$1-').replace(/-$/, '');
        }

        return code;
    }

    function showSuccessMessage(message) {
        // Create or update success message element
        let successElement = document.getElementById('successMessage');
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.id = 'successMessage';
            successElement.style.cssText = `
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                border-radius: 4px;
                padding: 12px;
                margin: 16px 0;
                display: block;
            `;
            document.getElementById('registrationFields').insertBefore(
                successElement,
                document.querySelector('button[type="submit"]')
            );
        }
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
});