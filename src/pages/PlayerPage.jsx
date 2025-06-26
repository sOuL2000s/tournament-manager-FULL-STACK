// 📁 src/pages/PlayerPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore'; // Added onSnapshot, doc, deleteDoc, updateDoc
import { useParams } from 'react-router-dom'; // Import useParams

// Define the admin password (can be from environment variables for production)
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export default function PlayerPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchStats, setMatchStats] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(''); // For admin login errors
  const [statEntry, setStatEntry] = useState({
    matchId: '',
    playerId: '',
    goals: '',
    assists: ''
  });
  const [newPlayerName, setNewPlayerName] = useState(''); // State for new player name
  const [newPlayerTeam, setNewPlayerTeam] = useState(''); // State for new player team
  const [addPlayerError, setAddPlayerError] = useState(''); // State for add player errors
  const [statEntryError, setStatEntryError] = useState(''); // State for stat entry errors

  // Real-time listener for players
  useEffect(() => {
    if (!tournamentId) return; // Do nothing if no tournamentId

    const playersCollectionRef = collection(db, `tournaments/${tournamentId}/players`);
    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time players:', err);
    });

    return () => unsubscribePlayers();
  }, [tournamentId]);

  // Real-time listener for matches
  useEffect(() => {
    if (!tournamentId) return; // Do nothing if no tournamentId

    const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`); // Assuming matches are fixtures
    const unsubscribeMatches = onSnapshot(matchesCollectionRef, (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time matches:', err);
    });

    return () => unsubscribeMatches();
  }, [tournamentId]);

  // Real-time listener for match stats
  useEffect(() => {
    if (!tournamentId) return; // Do nothing if no tournamentId

    const matchStatsCollectionRef = collection(db, `tournaments/${tournamentId}/match_stats`);
    const unsubscribeStats = onSnapshot(matchStatsCollectionRef, (snapshot) => {
      setMatchStats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time match stats:', err);
    });

    return () => unsubscribeStats();
  }, [tournamentId]);


  const validateAdmin = () => {
    setLoginError(''); // Clear previous login errors
    if (password === ADMIN_PASS) {
      setAdminMode(true);
    } else {
      setLoginError('❌ Incorrect password.'); // Set error message for display
    }
  };

  const handleAddPlayer = async () => {
    setAddPlayerError(''); // Clear previous errors
    if (!newPlayerName.trim() || !newPlayerTeam.trim()) {
      setAddPlayerError('Player name and team cannot be empty.');
      return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/players`), {
        name: newPlayerName,
        team: newPlayerTeam
      });
      setNewPlayerName('');
      setNewPlayerTeam('');
    } catch (err) {
      console.error('Error adding player:', err);
      setAddPlayerError('Failed to add player.');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (window.confirm('Are you sure you want to delete this player?')) { // Consider custom modal instead of window.confirm
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/players`, playerId));
      } catch (err) {
        console.error('Error deleting player:', err);
        alert('Failed to delete player.'); // Using alert, but custom modal is preferred
      }
    }
  };

  const addMatchStat = async () => {
    setStatEntryError(''); // Clear previous errors
    if (!statEntry.matchId || !statEntry.playerId) {
      setStatEntryError('⚠️ Please select both match and player.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/match_stats`), {
        ...statEntry,
        goals: parseInt(statEntry.goals) || 0,
        assists: parseInt(statEntry.assists) || 0
      });

      // No need to manually update state here as onSnapshot will handle it.
      setStatEntry({ matchId: '', playerId: '', goals: '', assists: '' });
    } catch (err) {
      console.error('Error adding match stat:', err);
      setStatEntryError('Failed to add match stat.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">👤 Player Management (Tournament: {tournamentId})</h2>
      {!adminMode ? (
        <div className="max-w-sm mx-auto bg-white dark:bg-gray-800 shadow-lg p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-center">🔐 Admin Login</h3>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') validateAdmin(); }}
            className="border px-4 py-2 rounded-md w-full mb-4 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loginError && <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>}
          <button onClick={validateAdmin} className="bg-blue-600 text-white px-4 py-2 rounded-md w-full hover:bg-blue-700 transition-colors">
            Login
          </button>
        </div>
      ) : (
        <>
          {/* Add New Player Section */}
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-3">➕ Add New Player</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Player Name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white flex-grow min-w-[150px]"
              />
              <input
                type="text"
                placeholder="Team Name"
                value={newPlayerTeam}
                onChange={(e) => setNewPlayerTeam(e.target.value)}
                className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white flex-grow min-w-[150px]"
              />
              <button
                onClick={handleAddPlayer}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Add Player
              </button>
            </div>
            {addPlayerError && <p className="text-red-500 text-sm mt-2">{addPlayerError}</p>}
          </div>

          {/* Player List */}
          <h3 className="text-2xl font-bold mt-8 mb-4">👥 Players List</h3>
          {players.length === 0 ? (
            <p className="text-gray-500">No players found yet. Add some!</p>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 text-left">
                    <th className="px-4 py-2 border-b dark:border-gray-600">Name</th>
                    <th className="px-4 py-2 border-b dark:border-gray-600">Team</th>
                    <th className="px-4 py-2 border-b dark:border-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(player => (
                    <tr key={player.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2">{player.name}</td>
                      <td className="px-4 py-2">{player.team}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Player Stats Section */}
          <h3 className="text-2xl font-bold mt-8 mb-4">📌 Add Match Stats</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
            <select
              value={statEntry.matchId}
              onChange={(e) => setStatEntry({ ...statEntry, matchId: e.target.value })}
              className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Match</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  {m.teamA} vs {m.teamB} ({m.date || 'No Date'})
                </option>
              ))}
            </select>
            <select
              value={statEntry.playerId}
              onChange={(e) => setStatEntry({ ...statEntry, playerId: e.target.value })}
              className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
            <input
              type="number"
              placeholder="Assists"
              value={statEntry.assists}
              onChange={(e) => setStatEntry({ ...statEntry, assists: e.target.value })}
              className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
            <button
              onClick={addMatchStat}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              ➕ Add Stat
            </button>
          </div>
          {statEntryError && <p className="text-red-500 text-sm mt-2">{statEntryError}</p>}


          {/* Match Stats Entries */}
          <h3 className="text-2xl font-bold mt-8 mb-4">🧾 Match Stats Entries</h3>
          {matchStats.length === 0 ? (
            <p className="text-gray-500">No match stats recorded yet for this tournament.</p>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 text-left">
                    <th className="px-4 py-2 border-b dark:border-gray-600">Player</th>
                    <th className="px-4 py-2 border-b dark:border-gray-600">Match</th>
                    <th className="px-4 py-2 border-b dark:border-gray-600">Goals</th>
                    <th className="px-4 py-2 border-b dark:border-gray-600">Assists</th>
                  </tr>
                </thead>
                <tbody>
                  {matchStats.map((s) => {
                    const player = players.find(p => p.id === s.playerId);
                    const match = matches.find(m => m.id === s.matchId);
                    return (
                      <tr key={s.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2">{player?.name} ({player?.team})</td>
                        <td className="px-4 py-2">{match?.teamA} vs {match?.teamB}</td>
                        <td className="px-4 py-2">{s.goals}</td>
                        <td className="px-4 py-2">{s.assists}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
