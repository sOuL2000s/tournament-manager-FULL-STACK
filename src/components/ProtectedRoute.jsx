// 📁 src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  // Retrieve the authentication token from local storage
  const token = localStorage.getItem('token');

  // If a token exists, render the children (the protected content)
  // Otherwise, redirect to the login page ("/") and replace the current entry in history
  return token ? children : <Navigate to="/" replace />;
}
