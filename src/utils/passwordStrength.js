// src/utils/passwordStrength.js

export const getPasswordStrength = (password) => {
    let strength = 0;

    // Check for length
    if (password.length >= 8) {
        strength++;
    }

    // Check for uppercase and lowercase characters
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        strength++;
    }

    // Check for numbers
    if (/\d/.test(password)) {
        strength++;
    }

    // Check for special characters
    if (/[^a-zA-Z0-9]/.test(password)) {
        strength++;
    }

    // Cap strength at 4
    return Math.min(strength, 4);
};

export const getStrengthColor = (strength) => {
    switch (strength) {
        case 0:
            return 'text-gray-400'; // Too Short / No Input
        case 1:
            return 'text-red-500'; // Weak
        case 2:
            return 'text-orange-500'; // Moderate
        case 3:
            return 'text-yellow-500'; // Good
        case 4:
            return 'text-green-500'; // Strong
        default:
            return 'text-gray-400';
    }
};