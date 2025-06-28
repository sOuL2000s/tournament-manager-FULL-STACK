import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Import Page Components
import Dashboard from './pages/Dashboard';
import TournamentPage from './pages/TournamentPage';
import FixturesPage from './pages/FixturesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AuthPage from './pages/AuthPage'; // Authentications page (login/signup)
import KnockoutPage from './pages/KnockoutPage';
import AIPredictionPage from './pages/AIPredictionPage';
import StatsPage from './pages/StatsPage';
import PlayerPage from './pages/PlayerPage';

// Import Reusable Components
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute'; // Component to protect routes requiring authentication

// Import Custom Hooks
import { useAuth } from './hooks/useAuth'; // Custom hook for authentication state management

export default function App() {
  // Destructure user, loading state, and logout function from the useAuth hook
  const { user, loading, logout } = useAuth();

  // State for dark mode preference, initialized from localStorage
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true');

  // State for language preference, initialized from localStorage, defaults to 'en'
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  // useEffect to apply or remove the 'dark' class from the HTML document element
  // and persist the preference in localStorage whenever darkMode state changes.
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark', darkMode); // Persist dark mode setting
  }, [darkMode]);

  // useEffect to persist the language preference in localStorage whenever lang state changes.
  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  // Translations object for Internationalization (i18n)
  // Provides different language strings for UI elements.
  const translations = {
    en: { // English translations
      title: 'Tournament Manager',
      logout: 'Logout',
      light: 'Light Mode',
      dark: 'Dark Mode',
      dashboard: 'Dashboard',
    },
    hi: { // Hindi translations
      title: 'टूर्नामेंट प्रबंधन',
      logout: 'लॉग आउट',
      light: 'लाइट मोड',
      dark: 'डार्क मोड',
      dashboard: 'डैशबोर्ड',
    },
    bn: { // Bengali translations
      title: 'টুর্নামেন্ট ম্যানেজার',
      logout: 'লগ আউট',
      light: 'লাইট মোড',
      dark: 'ডার্ক মোড',
      dashboard: 'ড্যাশবোর্ড',
    },
  };

  // Select the current translation based on the 'lang' state, falling back to English if not found.
  const t = translations[lang] || translations.en;

  // Show a loading screen while Firebase Authentication is initializing.
  // This prevents UI flashes or errors before the user's auth status is known.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        Loading application...
      </div>
    );
  }

  // If the user is not logged in (user object is null after loading), render the AuthPage.
  // This acts as the unauthenticated entry point.
  if (!user) {
    return <AuthPage />;
  }

  // If the user is logged in, render the main application layout with routing.
  return (
    // BrowserRouter wraps the entire application to enable client-side routing.
    <BrowserRouter>
      <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white flex flex-col">
        {/* Header component: Displays app title, dark mode toggle, language selector, and logout button. */}
        <Header
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          lang={lang}
          setLang={setLang}
          t={t}
          // Pass the logout function from useAuth directly to the Header component.
          // The Header component's 'setToken' prop is used here to trigger logout.
          setToken={() => logout()}
        />

        {/* Main content area: Uses React Router's Routes component to define application routes. */}
        <div className="flex-grow">
          <Routes>
            {/* Root route: Displays the Dashboard page, protected by ProtectedRoute. */}
            <Route path="/" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />

            {/* Tournament-specific pages: These routes use a dynamic :id parameter to fetch tournament data. */}
            {/* Each is protected, ensuring only authenticated users can access them. */}
            <Route path="/tournament/:id" element={<ProtectedRoute user={user}><TournamentPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/fixtures" element={<ProtectedRoute user={user}><FixturesPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/leaderboard" element={<ProtectedRoute user={user}><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/knockout" element={<ProtectedRoute user={user}><KnockoutPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/ai-prediction" element={<ProtectedRoute user={user}><AIPredictionPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/stats" element={<ProtectedRoute user={user}><StatsPage /></ProtectedRoute>} />
            <Route path="/tournament/:id/players" element={<ProtectedRoute user={user}><PlayerPage /></ProtectedRoute>} />

            {/* Fallback route: If no other route matches, it redirects to the Dashboard. */}
            {/* This is also protected. */}
            <Route path="*" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
