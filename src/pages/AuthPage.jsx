import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FaEye, FaEyeSlash, FaGoogle } from 'react-icons/fa'; // Import icons
import { getPasswordStrength, getStrengthColor } from '../utils/passwordStrength'; // We'll create this utility

export default function AuthPage() {
  const { login, register, loginWithGoogle, resetPassword, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); // New state for success messages
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [passwordStrength, setPasswordStrength] = useState(0); // State for password strength (0-4)

  // Effect to listen to the global error from useAuth and display it
  useEffect(() => {
    if (error) {
      let friendlyError = 'An unexpected error occurred.';
      switch (error.code) {
        case 'auth/invalid-email':
          friendlyError = 'Invalid email address format.';
          break;
        case 'auth/user-disabled':
          friendlyError = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          friendlyError = 'Invalid email or password.';
          break;
        case 'auth/email-already-in-use':
          friendlyError = 'This email is already registered. Try logging in.';
          break;
        case 'auth/weak-password':
          friendlyError = 'Password is too weak. It should be at least 6 characters.';
          break;
        case 'auth/network-request-failed':
          friendlyError = 'Network error. Please check your internet connection.';
          break;
        case 'auth/popup-closed-by-user': // For social login
          friendlyError = 'Login window closed. Please try again.';
          break;
        case 'auth/cancelled-popup-request': // For social login
          friendlyError = 'Another login attempt is in progress. Please wait or try again.';
          break;
        default:
          friendlyError = error.message;
      }
      setErrorMessage(friendlyError);
      setSuccessMessage(''); // Clear any success messages
    } else if (!loading) { // Clear errors when auth state is stable and no error
      setErrorMessage('');
    }
  }, [error, loading]);

  // Handle password change for strength indicator
  useEffect(() => {
    if (isRegisterMode) {
      setPasswordStrength(getPasswordStrength(password));
    } else {
      setPasswordStrength(0); // Reset strength when not in register mode
    }
  }, [password, isRegisterMode]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isRegisterMode) {
        await register(email, password);
        setSuccessMessage('Registration successful! Please log in.');
        setIsRegisterMode(false); // Switch to login mode after successful registration
        setEmail(''); // Clear form fields
        setPassword('');
      } else {
        await login(email, password);
        // On successful login, useAuth hook's listener will update user state in App.jsx,
        // triggering navigation.
      }
    } catch (err) {
      // Error handled by useEffect listening to 'error' from useAuth
      console.error("Auth operation failed in AuthPage:", err);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await loginWithGoogle();
      // On successful login, useAuth hook's listener will update user state in App.jsx,
      // triggering navigation.
    } catch (err) {
      // Error handled by useEffect listening to 'error' from useAuth
      console.error("Google login failed:", err);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!email) {
      setErrorMessage('Please enter your email to reset password.');
      return;
    }
    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent! Check your inbox (and spam folder).');
      setEmail('');
    } catch (err) {
      console.error("Forgot password failed:", err);
      // Error handled by useEffect listening to 'error' from useAuth
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-8 relative overflow-hidden">
      {/* Background overlay for subtle texture/gradient matching the app's dark theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-800 to-gray-900 opacity-20"></div>
      <div className="absolute inset-0 bg-pattern-dots opacity-5"></div> {/* Optional subtle pattern */}

      <div className="relative z-10 bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-red-700 backdrop-blur-sm bg-opacity-90 transition-all duration-300 hover:shadow-red-500/20">
        <div className="flex justify-center mb-6">
          {/* You can replace this with your actual logo component or image */}
          <img src="/logo.png" alt="Tournament Manager Logo" className="h-20 w-auto" onError={(e) => e.target.style.display = 'none'} />
          {/* Fallback text if image doesn't load or no logo is provided */}
          <h1 className="text-4xl font-extrabold text-red-500 hidden" style={{ display: 'none' }}>LTC</h1>
        </div>
        <h2 className="text-3xl font-extrabold mb-8 text-center text-white">
          {isRegisterMode ? '📝 Create Account' : '🔐 Welcome Back!'}
        </h2>

        {/* Dynamic Message Area */}
        {errorMessage && (
          <div className="bg-red-900 text-red-200 p-3 rounded-md mb-4 text-center text-sm animate-fade-in-down border border-red-700">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-700 text-green-100 p-3 rounded-md mb-4 text-center text-sm animate-fade-in-down border border-green-500">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-5 py-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              required
            />
          </div>
          <div className="mb-4 relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-5 py-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white focus:outline-none transition-colors duration-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {isRegisterMode && password && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-300 mb-1">
                Password Strength: <span className={`${getStrengthColor(passwordStrength)}`}>
                  {passwordStrength === 0 ? 'Too Short' : passwordStrength === 1 ? 'Weak' : passwordStrength === 2 ? 'Moderate' : passwordStrength === 3 ? 'Good' : 'Strong'}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300`}
                  style={{
                    width: `${(passwordStrength / 4) * 100}%`,
                    backgroundColor: getStrengthColor(passwordStrength).replace('text-', 'bg-') // Map text color to background color
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {passwordStrength < 3 && 'Use 8+ characters, mixed case, numbers, and symbols for a stronger password.'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white px-5 py-3 rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
          >
            {loading ? (isRegisterMode ? 'Registering...' : 'Logging In...') : isRegisterMode ? 'Register Account' : 'Login'}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
          <div className="flex-grow border-t border-gray-600"></div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center bg-gray-700 text-white px-5 py-3 rounded-lg font-semibold text-lg hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
        >
          <FaGoogle className="mr-3 text-xl" />
          {loading ? 'Signing In...' : 'Sign in with Google'}
        </button>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-red-400 hover:text-red-300 hover:underline text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
          >
            {isRegisterMode ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
          <button
            onClick={handleForgotPassword}
            className="text-gray-400 hover:text-gray-300 hover:underline text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-md p-1"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}