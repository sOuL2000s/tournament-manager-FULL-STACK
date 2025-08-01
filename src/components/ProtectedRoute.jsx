import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Import useAuth hook

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth(); // Destructure user and loading from useAuth

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-lg font-semibold animate-pulse">Checking authentication...</p>
      </div>
    );
  }

  // If user is not logged in, redirect to the login page
  if (!user) {
    return <Navigate to="/login" replace />; // Redirects to /login
  }

  // If user is logged in, render the children components
  return children;
}