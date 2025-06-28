import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth'; // Import the new useAuth hook

export default function AuthPage() {
  const { login, register, loading, error } = useAuth(); // Use the auth hook
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false); // State to toggle between login/register views
  const [errorMessage, setErrorMessage] = useState(''); // Local error message for UI display

  // Effect to listen to the global error from useAuth and display it
  // This ensures any backend authentication errors caught by the hook are reflected here.
  React.useEffect(() => {
    if (error) {
      // Mapping Firebase error codes to user-friendly messages for immediate display
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
        default:
          friendlyError = error.message; // Fallback to Firebase's message
      }
      setErrorMessage(friendlyError);
    }
  }, [error]); // Depend on the 'error' state from useAuth

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Clear previous error messages before new attempt

    try {
      if (isRegisterMode) {
        await register(email, password);
        setErrorMessage('Registration successful! Please log in.');
        setIsRegisterMode(false); // Switch to login mode after successful registration
      } else {
        await login(email, password);
        // On successful login, useAuth hook's listener will update user state in App.jsx,
        // triggering navigation. No explicit setToken or localStorage.setItem('token') needed here.
      }
    } catch (err) {
      // The useAuth hook already sets the global 'error' state, which this component's
      // useEffect will pick up. No need to set local errorMessage here again.
      console.error("Auth operation failed in AuthPage:", err); // Log full error for debugging
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          {isRegisterMode ? '📝 Register' : '🔐 Login'}
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Email address"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Password"
            required
          />
          {errorMessage && ( // Display local error messages
            <p className="text-red-500 text-sm mb-4 text-center">{errorMessage}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : isRegisterMode ? 'Register' : 'Login'}
          </button>
        </form>
        <button
          onClick={() => setIsRegisterMode(!isRegisterMode)}
          className="w-full mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          {isRegisterMode ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
}
