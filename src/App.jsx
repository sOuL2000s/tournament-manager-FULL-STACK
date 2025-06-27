import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import TournamentPage from './pages/TournamentPage';
import FixturesPage from './pages/FixturesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AuthPage from './pages/AuthPage'; // Renamed LoginPage to AuthPage
import KnockoutPage from './pages/KnockoutPage';
import AIPredictionPage from './pages/AIPredictionPage';
import StatsPage from './pages/StatsPage';
import PlayerPage from './pages/PlayerPage';

// Components
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute'; // Still useful for clarity

// Hooks
import { useAuth } from './hooks/useAuth'; // Import useAuth hook

export default function App() {
  const { user, loading, logout } = useAuth(); // Use the auth hook
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  // Effect to apply dark mode class to HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark', darkMode);
  }, [darkMode]);

  // Effect to save language preference
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

  // Show a loading screen while Firebase Auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        Loading application...
      </div>
    );
  }

  // If not logged in (user is null), render the AuthPage
  if (!user) {
    return <AuthPage />;
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
          // Pass logout function directly
          setToken={() => logout()} // setToken prop on Header now triggers logout
        />

        {/* Main content area with flexible routing */}
        <div className="flex-grow">
          <Routes>
            {/* Dashboard is the root protected route */}
            <Route path="/" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />

            {/* Tournament-specific pages, now using :id parameter */}
            <Route path="/tournament/:id" element={<ProtectedRoute user={user}><TournamentPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/fixtures" element={<ProtectedRoute user={user}><FixturesPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/leaderboard" element={<ProtectedRoute user={user}><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/knockout" element={<ProtectedRoute user={user}><KnockoutPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/predict" element={<ProtectedRoute user={user}><AIPredictionPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/stats" element={<ProtectedRoute user={user}><StatsPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/players" element={<ProtectedRoute user={user}><PlayerPage /></ProtectedRoute>} />

            {/* Fallback for undefined routes (optional) */}
            <Route path="*" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
