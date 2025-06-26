// 📁 src/pages/PlayerPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export default function PlayerPage() {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchStats, setMatchStats] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState('');
  const [statEntry, setStatEntry] = useState({
    matchId: '',
    playerId: '',
    goals: '',
    assists: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const ps = await getDocs(collection(db, 'players'));
      const ms = await getDocs(collection(db, 'matches'));
      const st = await getDocs(collection(db, 'match_stats'));
      setPlayers(ps.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setMatches(ms.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setMatchStats(st.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  const validateAdmin = () => {
    if (password === ADMIN_PASS) {
      setAdminMode(true);
    } else {
      alert('❌ Incorrect password');
    }
  };

  const addMatchStat = async () => {
    if (!statEntry.matchId || !statEntry.playerId) {
      alert('⚠️ Please select both match and player.');
      return;
    }

    const docRef = await addDoc(collection(db, 'match_stats'), {
      ...statEntry,
      goals: parseInt(statEntry.goals) || 0,
      assists: parseInt(statEntry.assists) || 0
    });

    setMatchStats(prev => [
      ...prev,
      {
        id: docRef.id,
        ...statEntry,
        goals: parseInt(statEntry.goals),
        assists: parseInt(statEntry.assists)
      }
    ]);

    setStatEntry({ matchId: '', playerId: '', goals: '', assists: '' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {!adminMode ? (
        <div className="max-w-sm mx-auto bg-white shadow p-6 rounded">
          <h2 className="text-xl font-semibold mb-4">🔐 Admin Login</h2>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border px-4 py-2 rounded w-full mb-4"
          />
          <button onClick={validateAdmin} className="bg-blue-600 text-white px-4 py-2 rounded w-full">
            Login
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">📋 Match List</h2>
          {matches.length === 0 ? (
            <p className="text-gray-500">No matches found.</p>
          ) : (
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-200 dark:bg-gray-700">
                  <th className="border px-2 py-1">Date</th>
                  <th className="border px-2 py-1">Team 1</th>
                  <th className="border px-2 py-1">Team 2</th>
                  <th className="border px-2 py-1">Goals 1</th>
                  <th className="border px-2 py-1">Goals 2</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(match => (
                  <tr key={match.id} className="text-center">
                    <td className="border px-2 py-1">{match.date}</td>
                    <td className="border px-2 py-1">{match.team1}</td>
                    <td className="border px-2 py-1">{match.team2}</td>
                    <td className="border px-2 py-1">{match.goals1}</td>
                    <td className="border px-2 py-1">{match.goals2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="text-xl font-bold mt-8 mb-2">📌 Add Player Stats</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <select
              value={statEntry.matchId}
              onChange={(e) => setStatEntry({ ...statEntry, matchId: e.target.value })}
              className="border px-2 py-1 rounded"
            >
              <option value="">Select Match</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  {m.team1} vs {m.team2}
                </option>
              ))}
            </select>
            <select
              value={statEntry.playerId}
              onChange={(e) => setStatEntry({ ...statEntry, playerId: e.target.value })}
              className="border px-2 py-1 rounded"
            >
              <option value="">Select Player</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Goals"
              value={statEntry.goals}
              onChange={(e) => setStatEntry({ ...statEntry, goals: e.target.value })}
              className="border px-2 py-1 rounded"
              min="0"
            />
            <input
              type="number"
              placeholder="Assists"
              value={statEntry.assists}
              onChange={(e) => setStatEntry({ ...statEntry, assists: e.target.value })}
              className="border px-2 py-1 rounded"
              min="0"
            />
            <button
              onClick={addMatchStat}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              ➕ Add Stat
            </button>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">🧾 Match Stats Entries</h3>
          {matchStats.length === 0 ? (
            <p className="text-gray-500">No match stats recorded yet.</p>
          ) : (
            <ul className="text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded space-y-1">
              {matchStats.map((s, i) => {
                const p = players.find(p => p.id === s.playerId);
                const m = matches.find(m => m.id === s.matchId);
                return (
                  <li key={i}>
                    {p?.name} ({p?.team}) → <strong>{s.goals}</strong> goals, <strong>{s.assists}</strong> assists in{' '}
                    {m?.team1} vs {m?.team2} on {m?.date}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
