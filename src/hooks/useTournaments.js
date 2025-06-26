import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export function useTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'tournaments'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(data);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  return { tournaments, loading };
}

export async function createTournament(tournament) {
  try {
    const docRef = await addDoc(collection(db, 'tournaments'), {
      ...tournament,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('Error creating tournament:', err);
    return null;
  }
}
