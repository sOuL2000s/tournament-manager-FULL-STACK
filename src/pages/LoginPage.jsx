// 📁 src/pages/LoginPage.jsx
import React, { useState } from 'react';

export default function LoginPage({ setToken }) {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // State to store error messages

  // Define the admin password (can be from environment variables for production)
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

  const handleLogin = () => {
    // Clear any previous error messages
    setErrorMessage('');

    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('token', 'sample-token'); // Store a sample token
      setToken('sample-token'); // Update the parent component's token state
    } else {
      setErrorMessage('❌ Invalid password. Please try again.'); // Set error message for invalid password
      // Do NOT use alert(), as per instructions.
    }
  };

  const handleKeyPress = (e) => {
    // Allow login on 'Enter' key press
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">🔐 Admin Login</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress} // Listen for Enter key press
          placeholder="Enter admin password"
          className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Admin password" // Accessibility improvement
        />
        {errorMessage && (
          <p className="text-red-500 text-sm mb-4 text-center">{errorMessage}</p> // Display error message
        )}
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Login
        </button>
      </div>
    </div>
  );
}
