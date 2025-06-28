import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore'; // Added doc, getDoc

export default function LeaderboardPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Effect to fetch the specific tournament's name
  useEffect(() => {
    if (!tournamentId) return;
    const fetchTournamentName = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);
        if (tournamentSnap.exists()) {
          setTournamentName(tournamentSnap.data().name);
        } else {
          // If tournament doesn't exist, set error and name accordingly
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setError('Failed to fetch tournament name.'); // Set error for UI
      }
    };
    fetchTournamentName();
  }, [tournamentId]);

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
      // If two teams have the same points, sort by goalDifference (descending)
      // Then, by goalsFor (descending)
      // Finally, by name (ascending) for consistent tie-breaking
      const q = query(
        leaderboardCollectionRef,
        orderBy('points', 'desc'),
        orderBy('goalDifference', 'desc'), // Secondary sort
        orderBy('goalsFor', 'desc'),      // Tertiary sort
        orderBy('name', 'asc')            // Quaternary sort
      );

      // Set up a real-time listener for leaderboard changes
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStandings(data);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time leaderboard:', err);
        setError('Failed to load leaderboard. Please try again.'); // Set error message
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        {/* Changed 'Players' to 'Top Scorers' here as well, consistent with other navs */}
        <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        {/* Added Knockout link if applicable for this tournament */}
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">🏆 Leaderboard ({tournamentName})</h2>

        {loading ? (
          <p className="text-gray-500 text-center">Loading leaderboard...</p>
        ) : error ? (
          <p className="text-red-500 text-center">Error: {error}</p>
        ) : standings.length === 0 ? (
          <p className="text-gray-500 text-center">No leaderboard data available yet for this tournament. Play some matches!</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-lg border border-gray-300 dark:border-gray-600">
            <table className="min-w-full table-auto text-sm md:text-base"> {/* Adjusted font size for responsiveness */}
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                  <th className="px-2 py-2 border-b dark:border-gray-700">P</th> {/* Position */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">Team</th>
                  <th className="px-2 py-2 border-b dark:border-gray-700">Pl</th> {/* Played */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">W</th> {/* Wins */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">D</th> {/* Draws */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">L</th> {/* Losses */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">GF</th> {/* Goals For */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">GA</th> {/* Goals Against */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">GD</th> {/* Goal Difference */}
                  <th className="px-2 py-2 border-b dark:border-gray-700">Pts</th> {/* Points */}
                </tr>
              </thead>
              <tbody>
                {standings.map((team, index) => (
                  <tr
                    key={team.id || index}
                    className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                      ${index < 2 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : ''} /* Green for top 2 (Promotion) */
                      ${index >= standings.length - 2 ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' : ''} /* Red for bottom 2 (Relegation) */
                    `}
                  >
                    <td className="px-2 py-2 font-bold">{index + 1}</td>
                    <td className="px-2 py-2">{team.name || 'N/A'}</td>
                    <td className="px-2 py-2">{team.played || 0}</td>
                    <td className="px-2 py-2">{team.wins || 0}</td>
                    <td className="px-2 py-2">{team.draws || 0}</td>
                    <td className="px-2 py-2">{team.losses || 0}</td>
                    <td className="px-2 py-2">{team.goalsFor || 0}</td>
                    <td className="px-2 py-2">{team.goalsAgainst || 0}</td>
                    <td className="px-2 py-2">{team.goalDifference || 0}</td>
                    <td className="px-2 py-2 font-semibold text-blue-600 dark:text-blue-400">{team.points || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
