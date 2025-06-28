import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase'; // Import auth from firebase.js

export const useTournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null); // State to store the current user's ID

  // Listen for Firebase Auth state changes to get the user ID
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null); // Clear userId if user logs out
        setTournaments([]); // Clear tournaments if no user
        setLoading(false); // Stop loading if no user to fetch for
      }
    });
    return () => unsubscribeAuth();
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  // Real-time listener for tournaments, now filtered by userId
  useEffect(() => {
    if (!userId) { // Only fetch if a userId is available
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query tournaments where 'userId' field matches the current user's UID
      const tournamentsCollectionRef = collection(db, 'tournaments');
      const q = query(
        tournamentsCollectionRef,
        where('userId', '==', userId), // Filter by the current user's ID
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(list);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time tournaments for user:', userId, err);
        setError('Failed to load your tournaments. Please try again.');
        setLoading(false);
      });

      return () => unsubscribe(); // Clean up the listener
    } catch (err) {
      console.error("Error setting up tournaments listener:", err);
      setError("Failed to set up tournaments listener.");
      setLoading(false);
    }
  }, [userId]); // Re-run effect when userId changes

  // Function to create a new tournament, now requiring userId
  const createTournament = async (tournamentData) => {
    if (!userId) {
      // It's good to provide a more specific error or handle this in the UI
      console.error('Attempted to create tournament without authenticated user.');
      throw new Error('Authentication required to create a tournament.');
    }
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        ...tournamentData,
        userId: userId, // Associate tournament with the creator's ID
        createdAt: serverTimestamp(), // Use server timestamp for consistency
      });
      console.log("New tournament created with ID:", docRef.id);
      return docRef.id;
    } catch (err) {
      console.error('Error creating tournament:', err);
      throw new Error('Failed to create tournament.'); // Re-throw a generic error for the calling component
    }
  };

  return { tournaments, loading, error, createTournament };
};
