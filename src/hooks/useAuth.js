import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // Import auth and db from firebase.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider, // Import GoogleAuthProvider
  signInWithPopup,    // Import signInWithPopup
  sendPasswordResetEmail // Import sendPasswordResetEmail
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
 * loginWithGoogle: () => Promise<import('firebase/auth').User>, // New function
 * resetPassword: (email: string) => Promise<void>,             // New function
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
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            createdAt: firebaseUser.metadata?.creationTime,
            lastSignInTime: firebaseUser.metadata?.lastSignInTime,
            displayName: firebaseUser.displayName || 'Anonymous User',
          }, { merge: true });
          console.log("User profile ensured in Firestore for:", firebaseUser.uid);
        } catch (firestoreError) {
          console.error("Error ensuring user profile in Firestore:", firestoreError);
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
  }, []);

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
      console.log("User registered:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Registration error:", authError);
      setError(authError);
      setLoading(false);
      throw authError;
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
      console.log("User logged in:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Login error:", authError);
      setError(authError);
      setLoading(false);
      throw authError;
    }
  };

  /**
   * Logs in a user using Google authentication.
   * @returns {Promise<import('firebase/auth').User>} A promise that resolves with the Firebase User object.
   * @throws {Error} Throws a Firebase Auth error if login fails.
   */
  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      console.log("User logged in with Google:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Google login error:", authError);
      setError(authError);
      setLoading(false);
      throw authError;
    }
  };

  /**
   * Sends a password reset email to the specified email address.
   * @param {string} email - The user's email address.
   * @returns {Promise<void>} A promise that resolves when the email is sent.
   * @throws {Error} Throws a Firebase Auth error if sending fails.
   */
  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("Password reset email sent to:", email);
    } catch (authError) {
      console.error("Password reset error:", authError);
      setError(authError);
      throw authError;
    } finally {
      setLoading(false);
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
      console.log("User logged out.");
    } catch (authError) {
      console.error("Logout error:", authError);
      setError(authError);
      setLoading(false);
      throw authError;
    }
  };

  // Return the user, loading state, error, and authentication functions for consumption by components.
  return { user, loading, error, register, login, loginWithGoogle, resetPassword, logout };
};