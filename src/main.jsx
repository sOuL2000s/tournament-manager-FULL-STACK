import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// import { initializeAuth } from './firebase.js'; // No longer needed here directly

const root = document.getElementById('root');

// Display a loading message immediately while React app mounts and auth state is determined
root.innerHTML = '<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f3f4f6; color: #1f2937;">Loading application...</div>';

// Now just render the App component, which will handle auth state internally
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The error handling for initial Firebase auth setup (like config issues)
// will now be caught by the useAuth hook and propagated to the App component's error state.
