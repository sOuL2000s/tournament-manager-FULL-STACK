// 📁 src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'; // Import Link for navigation in Header/Sidebar

// Pages
import Dashboard from './pages/Dashboard';
import TournamentPage from './pages/TournamentPage'; // This is now a tournament-specific page
import FixturesPage from './pages/FixturesPage'; // Will be tournament-specific
import LeaderboardPage from './pages/LeaderboardPage'; // Will be tournament-specific
import LoginPage from './pages/LoginPage';
import KnockoutPage from './pages/KnockoutPage'; // Will be tournament-specific
import AIPredictionPage from './pages/AIPredictionPage'; // Will be tournament-specific
import StatsPage from './pages/StatsPage'; // Will be tournament-specific
import PlayerPage from './pages/PlayerPage'; // Will be tournament-specific

// Components
import Header from './components/Header'; // Import the Header component
import LanguageSwitcher from './components/LanguageSwitcher'; // Kept for standalone use if needed, but Header now includes it
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  // Initialize states from localStorage for persistence
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  // Effect to apply dark mode class to HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Also save the preference whenever it changes
    localStorage.setItem('dark', darkMode);
  }, [darkMode]);

  // Effect to save language preference (though LanguageSwitcher already does this on change)
  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  // Translations object for i18n
  const translations = {
    en: {
      title: 'Tournament Manager',
      logout: 'Logout',
      light: 'Light Mode',
      dark: 'Dark Mode',
      dashboard: 'Dashboard',
    },
    hi: {
      title: 'टूर्नामेंट प्रबंधन',
      logout: 'लॉग आउट',
      light: 'लाइट मोड',
      dark: 'डार्क मोड',
      dashboard: 'डैशबोर्ड',
    },
    bn: {
      title: 'টুর্নামেন্ট ম্যানেজার',
      logout: 'লগ আউট',
      light: 'লাইট মোড',
      dark: 'ডার্ক মোড',
      dashboard: 'ড্যাশবোর্ড',
    },
  };

  // Select current translation based on `lang` state
  const t = translations[lang] || translations.en;

  // If not logged in, render the LoginPage
  if (!token) {
    return <LoginPage setToken={setToken} />;
  }

  // Render the main application layout if logged in
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white flex flex-col">
        {/* Header component */}
        <Header
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          lang={lang}
          setLang={setLang}
          t={t}
          setToken={setToken}
        />

        {/* Main content area with flexible routing */}
        <div className="flex-grow">
          <Routes>
            {/* Dashboard is the root protected route */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            {/* Tournament-specific pages, now using :id parameter */}
            <Route path="/tournament/:id" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/fixtures" element={<ProtectedRoute><FixturesPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/knockout" element={<ProtectedRoute><KnockoutPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/predict" element={<ProtectedRoute><AIPredictionPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/players" element={<ProtectedRoute><PlayerPage /></ProtectedRoute>} />

            {/* Fallback for undefined routes (optional) */}
            <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
