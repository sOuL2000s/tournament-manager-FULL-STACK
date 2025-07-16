import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';

export default function LeaderboardPage() {
  const { id: tournamentId } = useParams();
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) return;
    const fetchTournamentName = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);
        if (tournamentSnap.exists()) {
          setTournamentName(tournamentSnap.data().name);
        } else {
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setError('Failed to fetch tournament name.');
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
      const leaderboardCollectionRef = collection(db, `tournaments/${tournamentId}/leaderboard`);

      const q = query(
        leaderboardCollectionRef,
        orderBy('points', 'desc'),
        orderBy('goalDifference', 'desc'),
        orderBy('goalsFor', 'desc'),
        orderBy('name', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStandings(data);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time leaderboard:', err);
        setError('Failed to load leaderboard. Please try again.');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up leaderboard listener:", err);
      setError("Failed to set up leaderboard listener.");
      setLoading(false);
    }
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl">Loading Leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-900 text-red-500">
        <p className="text-xl">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* Tournament Navigation */}
      <div className="bg-red-600 text-white p-4 flex flex-wrap justify-center gap-2 font-bold text-lg w-full max-w-4xl rounded-md shadow-md mb-6">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px]">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px]">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px]">PLAYERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px]">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px]">KNOCKOUT</Link>
      </div>

      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-6 text-center">{tournamentName} Leaderboard</h2>

      {standings.length === 0 ? (
        <p className="text-base sm:text-xl text-gray-600 dark:text-gray-400 mt-8">No standings to display yet. Play some matches!</p>
      ) : (
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs sm:text-sm md:text-base leading-normal">
                <th className="py-3 px-3 sm:px-6 text-left">Rank</th>
                <th className="py-3 px-3 sm:px-6 text-left">Team</th>
                <th className="py-3 px-3 sm:px-6 text-center">Played</th>
                <th className="py-3 px-3 sm:px-6 text-center">Win</th>
                <th className="py-3 px-3 sm:px-6 text-center">Draw</th>
                <th className="py-3 px-3 sm:px-6 text-center">Loss</th>
                <th className="py-3 px-3 sm:px-6 text-center">GF</th>
                <th className="py-3 px-3 sm:px-6 text-center">GA</th>
                <th className="py-3 px-3 sm:px-6 text-center">GD</th>
                <th className="py-3 px-3 sm:px-6 text-center">Points</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
              {standings.map((team, index) => (
                <tr key={team.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-3 sm:px-6 text-left whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-bold">{index + 1}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-6 text-left">
                    <span className="font-medium">{team.name}</span>
                  </td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.matchesPlayed}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.wins}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.draws}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.losses}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.goalsFor}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.goalsAgainst}</td>
                  <td className="py-3 px-3 sm:px-6 text-center">{team.goalDifference}</td>
                  <td className="py-3 px-3 sm:px-6 text-center font-bold">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}