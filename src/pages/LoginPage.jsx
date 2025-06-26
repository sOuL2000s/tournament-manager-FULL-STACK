// 📁 src/pages/LoginPage.jsx
import React, { useState } from 'react';

export default function LoginPage({ setToken }) {
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (password === 'admin123') {
      localStorage.setItem('token', 'sample-token');
      setToken('sample-token');
    } else {
      alert('❌ Invalid password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-white">🔐 Admin Login</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password"
          className="w-full px-4 py-2 mb-4 border rounded dark:bg-gray-700 dark:text-white"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </div>
    </div>
  );
}
