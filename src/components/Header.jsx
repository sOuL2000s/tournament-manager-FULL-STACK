import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Import useAuth hook
import { RiMenu3Line, RiCloseLine } from 'react-icons/ri'; // Import menu icons

export default function Header({ darkMode, setDarkMode, lang, setLang, t }) {
  const { user, logout } = useAuth(); // Get user and logout from useAuth
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu visibility

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="bg-red-600 text-white p-4 shadow-md flex justify-between items-center relative">
      {/* Tournament Title/Link */}
      <Link to="/" className="text-xl font-bold tracking-wide z-20" onClick={() => setIsMobileMenuOpen(false)}>
        {t.title}
      </Link>

      {/* Hamburger/Close Icon for Mobile */}
      <div className="md:hidden z-20">
        <button
          onClick={toggleMobileMenu}
          className="p-2 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? (
            <RiCloseLine className="h-6 w-6" />
          ) : (
            <RiMenu3Line className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Navigation and Controls - Desktop */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Language Switcher */}
        <div className="relative">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-red-700 text-white p-2 rounded-md appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Select Language"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="bn">বাংলা</option>
          </select>
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
          aria-label={darkMode ? t.light : t.dark}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        {/* Logout Button */}
        {user && (
          <button
            onClick={handleLogout}
            className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {t.logout}
          </button>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-0 left-0 w-full h-screen bg-red-600 z-10 flex flex-col items-center justify-center space-y-6 pt-16 pb-8">
          {/* Language Switcher */}
          <div className="relative w-48"> {/* Fixed width for mobile select */}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-red-700 text-white p-3 rounded-md appearance-none pr-8 w-full focus:outline-none focus:ring-2 focus:ring-white text-lg"
              aria-label="Select Language"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="bn">বাংলা</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
              <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => { setDarkMode(!darkMode); setIsMobileMenuOpen(false); }}
            className="p-3 rounded-md hover:bg-red-700 transition-colors text-xl w-48"
            aria-label={darkMode ? t.light : t.dark}
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          {/* Logout Button */}
          {user && (
            <button
              onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
              className="bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-6 rounded-md transition-colors text-lg w-48"
            >
              {t.logout}
            </button>
          )}
        </div>
      )}
    </header>
  );
}