// 📁 src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import TournamentPage from './pages/TournamentPage';
import FixturesPage from './pages/FixturesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LoginPage from './pages/LoginPage';
import KnockoutPage from './pages/KnockoutPage';
import AIPredictionPage from './pages/AIPredictionPage';
import StatsPage from './pages/StatsPage';
import PlayerPage from './pages/PlayerPage';

// Components
import LanguageSwitcher from './components/LanguageSwitcher';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  // Toggle dark mode on load/change
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Store language preference
  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const translations = {
    en: {
      title: 'Tournament Manager',
      logout: 'Logout',
      light: 'Light Mode',
      dark: 'Dark Mode',
    },
    hi: {
      title: 'टूर्नामेंट प्रबंधन',
      logout: 'लॉग आउट',
      light: 'लाइट मोड',
      dark: 'डार्क मोड',
    },
    bn: {
      title: 'টুর্নামেন্ট ম্যানেজার',
      logout: 'লগ আউট',
      light: 'লাইট মোড',
      dark: 'ডার্ক মোড',
    },
  };

  const t = translations[lang] || translations.en;

  // If not logged in, show login
  if (!token) return <LoginPage setToken={setToken} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white">
        {/* Header */}
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b dark:border-gray-700">
          <h1 className="text-xl font-bold text-center sm:text-left">{t.title}</h1>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <LanguageSwitcher lang={lang} setLang={setLang} />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="bg-gray-200 dark:bg-gray-700 px-4 py-1 rounded"
            >
              {darkMode ? t.light : t.dark}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                setToken(null);
              }}
              className="bg-red-500 text-white px-4 py-1 rounded"
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Main Routing */}
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tournament/:id" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/fixtures" element={<ProtectedRoute><FixturesPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/knockout" element={<ProtectedRoute><KnockoutPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/predict" element={<ProtectedRoute><AIPredictionPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/tournament/:id/players" element={<ProtectedRoute><PlayerPage /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
