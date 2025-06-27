import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // Import auth and db from firebase.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // For creating user profiles in Firestore

export const useAuth = () => {
  const [user, setUser] = useState(null); // Firebase User object
  const [loading, setLoading] = useState(true); // Loading state for initial auth check
  const [error, setError] = useState(null); // Error state for auth operations

  // Listener for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in. You might fetch additional user profile data here if needed.
        setUser(firebaseUser);
        console.log("Firebase Auth State Changed: User signed in:", firebaseUser.uid);

        // Ensure user document exists in Firestore (e.g., /users/{uid})
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            createdAt: firebaseUser.metadata.creationTime,
            lastSignInTime: firebaseUser.metadata.lastSignInTime,
          }, { merge: true }); // Use merge to avoid overwriting existing data
          console.log("User profile ensured in Firestore for:", firebaseUser.uid);
        } catch (firestoreError) {
          console.error("Error ensuring user profile in Firestore:", firestoreError);
          // Don't block auth, but log the error
        }

      } else {
        // User is signed out
        setUser(null);
        console.log("Firebase Auth State Changed: User signed out.");
      }
      setLoading(false); // Auth check is complete
    }, (authError) => {
      console.error("Firebase Auth Listener Error:", authError);
      setError(authError);
      setLoading(false);
    });

    // Clean up the listener on component unmount
    return () => unsubscribe();
  }, []);

  // Function to register a new user
  const register = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // userCredential.user is automatically set by onAuthStateChanged listener
      console.log("User registered:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Registration error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw to allow component to catch and display specific errors
    }
  };

  // Function to log in an existing user
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // userCredential.user is automatically set by onAuthStateChanged listener
      console.log("User logged in:", userCredential.user.uid);
      return userCredential.user;
    } catch (authError) {
      console.error("Login error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw
    }
  };

  // Function to log out the current user
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
      // setUser(null) is handled by onAuthStateChanged listener
      console.log("User logged out.");
    } catch (authError) {
      console.error("Logout error:", authError);
      setError(authError);
      setLoading(false);
      throw authError; // Re-throw
    }
  };

  return { user, loading, error, register, login, logout };
};
