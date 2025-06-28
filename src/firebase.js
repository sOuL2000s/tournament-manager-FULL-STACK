import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Only getAuth is needed here for export

// Firebase configuration.
// It prioritizes the __firebase_config global variable provided by the Canvas environment.
// If __firebase_config is not defined (e.g., in a local development setup),
// it falls back to environment variables loaded via import.meta.env.
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config) // Parse the stringified config from the Canvas environment
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

// Initialize the Firebase application with the provided configuration.
const app = initializeApp(firebaseConfig);

// Get a reference to the Firestore database service.
// This is the primary way to interact with your Firestore data.
const db = getFirestore(app);

// Get a reference to the Firebase Authentication service.
// This is used for user authentication (sign-in, sign-up, etc.).
const auth = getAuth(app);

// Export the initialized Firebase app, Firestore database, and Authentication instances.
// These can then be imported and used in other parts of your React application.
export { db, app, auth };
