import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // Import auth and db from firebase.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // For creating/updating user profiles in Firestore

/**
 * Custom React Hook for Firebase Authentication and User Profile Management.
 * Provides user authentication state, loading status, errors, and authentication functions.
 * @returns {{
 * user: import('firebase/auth').User | null,
 * loading: boolean,
 * error: Error | null,
 * register: (email: string, password: string) => Promise<import('firebase/auth').User>,
 * login: (email: string, password: string) => Promise<import('firebase/auth').User>,
 * logout: () => Promise<void>
 * }}
 */
export const useAuth = () => {
  const [user, setUser] = useState(null); // Stores the Firebase User object when signed in
  const [loading, setLoading] = useState(true); // Indicates if the initial authentication state check is ongoing
  const [error, setError] = useState(null); // Stores any authentication-related errors

  /**
   * Effect hook to listen for changes in Firebase Authentication state.
   * This runs once on component mount and cleans up the listener on unmount.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in. Set the user state.
        setUser(firebaseUser);
        console.log("Firebase Auth State Changed: User signed in:", firebaseUser.uid);

        // Ensure a user document exists in Firestore for this user's UID.
        // This is where custom user profile data would typically be stored.
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          // IMPORTANT: The Firebase 'User' object (firebaseUser) itself does NOT have a 'profile' property.
          // If you saw a TypeError reading 'profile', it was likely from:
          // 1. An older version of your code or an injected script trying to access `firebaseUser.profile`.
          // 2. An assumption that 'profile' is directly on the Firebase User object.
          // Your current `setDoc` correctly accesses standard Firebase User properties.
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            createdAt: firebaseUser.metadata?.creationTime, // Use optional chaining for metadata
            lastSignInTime: firebaseUser.metadata?.lastSignInTime, // Use optional chaining
            displayName: firebaseUser.displayName || 'Anonymous User', // Provide a fallback if displayName is null
            // If you need custom profile data, ensure it's structured here (e.g., bio, favoriteTeam)
            // Example: customField: 'someValue',
          }, { merge: true }); // Use merge: true to update existing fields without overwriting the entire document
          console.log("User profile ensured in Firestore for:", firebaseUser.uid);
        } catch (firestoreError) {
          console.error("Error ensuring user profile in Firestore:", firestoreError);
          // Do not set error state here if it shouldn't block authentication flow; just log.
        }

      } else {
        // User is signed out (or initially not signed in). Clear the user state.
        setUser(null);
        console.log("Firebase Auth State Changed: User signed out.");
      }
      setLoading(false); // Authentication state check is complete, set loading to false.
    }, (authError) => {
      // Error occurred during authentication state change observation.
      console.error("Firebase Auth Listener Error:", authError);
      setError(authError); // Set error state
      setLoading(false); // Auth check is complete
    });

    // Cleanup function: Unsubscribe from the auth state listener when the component unmounts.
    return () => unsubscribe();
  }, []); // Empty dependency array means this effect runs only once on mount and cleans up on unmount.

  /**
   * Registers a new user with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<import('firebase/auth').User>} A promise that resolves with the Firebase User object.
   * @throws {Error} Throws a Firebase Auth error if registration fails.
   */
  const register = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // The `onAuthStateChanged` listener above will automatically update the `user` state.
      console.log("User registered:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Registration error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw to allow calling components to handle specific error messages.
    }
  };

  /**
   * Logs in an existing user with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<import('firebase/auth').User>} A promise that resolves with the Firebase User object.
   * @throws {Error} Throws a Firebase Auth error if login fails.
   */
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // The `onAuthStateChanged` listener above will automatically update the `user` state.
      console.log("User logged in:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Login error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw to allow calling components to handle specific error messages.
    }
  };

  /**
   * Logs out the current user.
   * @returns {Promise<void>} A promise that resolves when the user is signed out.
   * @throws {Error} Throws a Firebase Auth error if logout fails.
   */
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
      // The `onAuthStateChanged` listener will automatically set `user` to `null`.
      console.log("User logged out.");
    } catch (authError) {
      console.error("Logout error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw to allow calling components to handle specific error messages.
    }
  };

  // Return the user, loading state, error, and authentication functions for consumption by components.
  return { user, loading, error, register, login, logout };
};
