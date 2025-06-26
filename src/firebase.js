// 📁 src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithCustomToken, signInAnonymously } from "firebase/auth"; // Import Firebase Auth methods

// ✅ Firebase config from environment variables
// Use __firebase_config global variable provided by Canvas
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ✅ Initialize Firebase App
const app = initializeApp(firebaseConfig);

// ✅ Get Firestore instance
const db = getFirestore(app);

// ✅ Get Auth instance
const auth = getAuth(app);

// Authentication initialization for Canvas environment
// This needs to be called when your app mounts, typically in App.jsx or main.jsx's useEffect
export const initializeAuth = async () => {
  if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    console.log("Signing in with custom token...");
    try {
      await signInWithCustomToken(auth, __initial_auth_token);
      console.log("Signed in with custom token successfully.");
    } catch (error) {
      console.error("Error signing in with custom token:", error);
      // Fallback to anonymous sign-in if custom token fails
      console.log("Attempting anonymous sign-in...");
      await signInAnonymously(auth);
      console.log("Signed in anonymously.");
    }
  } else {
    console.log("No custom auth token found, attempting anonymous sign-in...");
    await signInAnonymously(auth);
    console.log("Signed in anonymously.");
  }
};


// ✅ Export to use in other modules
export { db, app, auth }; // Export auth as well
