import React from 'react';
import ReactDOM from 'react-dom/client'; // Correct import for React 18+
import App from './App.jsx'; // Main application component
import './index.css'; // Global CSS imports, including TailwindCSS

// Get the root DOM element where the React application will be mounted.
const rootElement = document.getElementById('root');

// Create a React root. This is the new API for React 18+ concurrent mode.
const root = ReactDOM.createRoot(rootElement);

// Display a loading message immediately before the React app fully mounts.
// This provides a user-friendly experience while initial assets and authentication state are determined.
// This is done by directly manipulating the innerHTML of the root element.
// Note: While this works, typically a dedicated loading component within App.jsx
// or a splash screen managed by a loading state in App.jsx is more React-idiomatic.
if (rootElement) { // Ensure rootElement exists before modifying it
  rootElement.innerHTML = '<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f3f4f6; color: #1f2937;">Loading application...</div>';
}

// Render the main App component into the React root.
// <React.StrictMode> is a tool for highlighting potential problems in an application.
// It does not render any visible UI. It activates additional checks and warnings for its descendants.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Any initial Firebase auth setup or error handling (like config issues)
// is now handled internally by the useAuth hook within App.jsx and its child components.
// The previous comment "// import { initializeAuth } from './firebase.js';" is correctly commented out
// as explicit initialization of auth from here is no longer needed with the current setup.
