import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function LeaderboardPage() {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const querySnapshot = await getDocs(collection(db, 'leaderboard'));
      const data = querySnapshot.docs.map(doc => doc.data());
      const sorted = data.sort((a, b) => b.points - a.points);
      setStandings(sorted);
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🏆 Leaderboard</h2>
      <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-600">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="border px-4 py-2">#</th>
            <th className="border px-4 py-2">Team</th>
            <th className="border px-4 py-2">Wins</th>
            <th className="border px-4 py-2">Losses</th>
            <th className="border px-4 py-2">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => (
            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="border px-4 py-2 font-bold">{index + 1}</td>
              <td className="border px-4 py-2">{team.name}</td>
              <td className="border px-4 py-2">{team.wins}</td>
              <td className="border px-4 py-2">{team.losses}</td>
              <td className="border px-4 py-2 font-semibold">{team.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
