import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Import useAuth hook

export default function Header({ darkMode, setDarkMode, lang, setLang, t }) {
  const { user, logout } = useAuth(); // Get user and logout from useAuth

  const handleLogout = async () => {
    try {
      await logout();
      // No need to clear local storage token here, as useAuth handles Firebase state and App.jsx handles UI redirect
    } catch (error) {
      console.error("Failed to log out:", error);
      // Display error to user if logout fails (consider using a modal for user-friendly feedback)
    }
  };

  return (
    <header className="bg-red-600 text-white p-4 shadow-md flex justify-between items-center">
      {/* Tournament Title/Link */}
      <Link to="/" className="text-xl font-bold tracking-wide">{t.title}</Link>

      <div className="flex items-center space-x-4">
        {/* Language Switcher */}
        <div className="relative">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-red-700 text-white p-2 rounded-md appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Select Language" // Added for accessibility
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="bn">বাংলা</option>
          </select>
          {/* Custom SVG for dropdown arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-md hover:bg-red-700 transition-colors"
          aria-label={darkMode ? t.light : t.dark} // Accessible label
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        {/* Logout Button (only if user is authenticated) */}
        {user && ( // Only show logout button if a user is logged in
          <button
            onClick={handleLogout}
            className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {t.logout}
          </button>
        )}
      </div>
    </header>
  );
}
