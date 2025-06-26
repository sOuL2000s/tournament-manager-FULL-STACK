// Inside src/components/Header.jsx
import React from 'react';
import LanguageSwitcher from './LanguageSwitcher'; // Ensure LanguageSwitcher is imported

export default function Header({ darkMode, setDarkMode, lang, setLang, t, setToken }) {
  return (
    <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b dark:border-gray-700">
      {/* Application Title */}
      <h1 className="text-xl font-bold text-center sm:text-left">{t.title}</h1>

      {/* Action buttons and Language Switcher */}
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        {/* Language Switcher Component */}
        <LanguageSwitcher lang={lang} setLang={setLang} />

        {/* Dark Mode / Light Mode Toggle Button */}
        <button
          onClick={() => {
            setDarkMode(!darkMode); // Toggle the darkMode state
            localStorage.setItem('dark', !darkMode); // Persist dark mode preference
          }}
          className="bg-gray-200 dark:bg-gray-700 px-4 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {darkMode ? t.light : t.dark} {/* Display text based on current mode */}
        </button>

        {/* Logout Button */}
        <button
          onClick={() => {
            localStorage.removeItem('token'); // Remove the authentication token from local storage
            setToken(null); // Set the token state to null, triggering re-render to LoginPage
          }}
          className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition-colors"
        >
          {t.logout} {/* Display logout text */}
        </button>
      </div>
    </div>
  );
}
