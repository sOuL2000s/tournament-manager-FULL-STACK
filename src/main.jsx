// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initializeAuth } from './firebase.js'; // Import the initializeAuth function

// Initialize Firebase Auth when the application starts
// This ensures the user is authenticated before the App component renders fully.
initializeAuth().then(() => {
  const root = document.getElementById('root');
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch(error => {
  console.error("Failed to initialize Firebase Auth:", error);
  // Optionally display an error message to the user if auth initialization fails
  const root = document.getElementById('root');
  root.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Error loading application: Could not connect to authentication services.</div>';
});
