import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore'; // Import onSnapshot, query, orderBy
import { db } from '../firebase';

export function useTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Add error state

  useEffect(() => {
    // Set up a real-time listener for tournaments
    const tournamentsCollectionRef = collection(db, 'tournaments');
    const q = query(tournamentsCollectionRef, orderBy('createdAt', 'desc')); // Order by creation date

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(data);
        setLoading(false);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Error fetching real-time tournaments:', err);
        setError('Failed to load tournaments.'); // Set error message
        setLoading(false);
      }
    }, (err) => {
      // Error callback for onSnapshot
      console.error('Real-time listener error for tournaments:', err);
      setError('Real-time updates failed.');
      setLoading(false);
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array means this effect runs once on mount

  return { tournaments, loading, error }; // Return error state as well
}

export async function createTournament(tournament) {
  try {
    const docRef = await addDoc(collection(db, 'tournaments'), {
      ...tournament,
      createdAt: serverTimestamp(), // Use Firestore's server timestamp
    });
    return docRef.id;
  } catch (err) {
    console.error('Error creating tournament:', err);
    // It's better to throw the error or return a specific error indicator
    // rather than just null, so the calling component can handle it.
    throw new Error('Failed to create tournament.');
  }
}
