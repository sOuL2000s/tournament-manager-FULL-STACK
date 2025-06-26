import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; // Import onSnapshot, query, orderBy
import { db } from '../firebase';
import { useParams } from 'react-router-dom'; // Import useParams

export default function LeaderboardPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Reference to the 'leaderboard' subcollection for the specific tournament
      const leaderboardCollectionRef = collection(db, `tournaments/${tournamentId}/leaderboard`);
      // Create a query to order by points in descending order
      const q = query(leaderboardCollectionRef, orderBy('points', 'desc'));

      // Set up a real-time listener for leaderboard changes
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStandings(data);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time leaderboard:', err);
        setError('Failed to load leaderboard. Please try again.');
        setLoading(false);
      });

      // Clean up the listener when the component unmounts or tournamentId changes
      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up leaderboard listener:", err);
      setError("Failed to set up leaderboard listener.");
      setLoading(false);
    }
  }, [tournamentId]); // Re-run effect if tournamentId changes

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🏆 Leaderboard (Tournament: {tournamentId})</h2>

      {loading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : standings.length === 0 ? (
        <p className="text-gray-500">No leaderboard data available yet for this tournament.</p>
      ) : (
        <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-left">
              <th className="border px-4 py-2">#</th>
              <th className="border px-4 py-2">Team</th>
              <th className="border px-4 py-2">Wins</th>
              <th className="border px-4 py-2">Losses</th>
              <th className="border px-4 py-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, index) => (
              <tr key={team.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="border px-4 py-2 font-bold">{index + 1}</td>
                <td className="border px-4 py-2">{team.name || 'N/A'}</td>
                <td className="border px-4 py-2">{team.wins || 0}</td>
                <td className="border px-4 py-2">{team.losses || 0}</td>
                <td className="border px-4 py-2 font-semibold text-blue-600 dark:text-blue-400">{team.points || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
