// 📁 src/pages/KnockoutPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'; // Import necessary Firestore functions

export default function KnockoutPage() {
  const { id: tournamentId } = useParams();
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMatch, setNewMatch] = useState({
    round: '',
    teamA: '',
    teamB: '',
    winner: null,
    scoreA: 0,
    scoreB: 0,
    status: 'scheduled'
  });
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null); // State for editing match
  const [editMatchData, setEditMatchData] = useState({}); // State for edited match data

  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }

    const fetchTournamentDetails = async () => {
      try {
        const docRef = doc(db, 'tournaments', tournamentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTournamentName(docSnap.data().name);
        } else {
          setTournamentName('Tournament Not Found');
          setError('Tournament details could not be loaded.');
        }
      } catch (err) {
        console.error('Error fetching tournament details:', err);
        setError('Failed to fetch tournament details.');
      }
    };
    fetchTournamentDetails();

    // Set up a real-time listener for knockout matches
    const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);
    const q = query(matchesCollectionRef, orderBy('round', 'asc'), orderBy('teamA', 'asc')); // Order by round and then by team name

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const fetchedMatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          scoreA: doc.data().scoreA || 0, // Default to 0 if not present
          scoreB: doc.data().scoreB || 0, // Default to 0 if not present
        }));

        // Group matches by round
        const groupedRounds = fetchedMatches.reduce((acc, match) => {
          const roundName = match.round || 'Unknown Round'; // Handle cases where round might be missing
          if (!acc[roundName]) {
            acc[roundName] = [];
          }
          acc[roundName].push(match);
          return acc;
        }, {});

        // Convert to an array of { name: "Round Name", matches: [...] }
        const sortedRounds = Object.keys(groupedRounds)
          .sort((a, b) => {
            // Simple sorting by round name, can be enhanced for more complex round naming (e.g., QF, SF, Final)
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          })
          .map(name => ({ name, matches: groupedRounds[name] }));

        setRounds(sortedRounds);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching real-time knockout matches:', err);
        setError('Failed to load knockout matches.');
        setLoading(false);
      }
    }, (err) => {
      console.error('Real-time listener error for knockout matches:', err);
      setError('Real-time updates failed for knockout matches.');
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener
  }, [tournamentId]);

  const handleAddMatch = async () => {
    if (!newMatch.round.trim() || !newMatch.teamA.trim() || !newMatch.teamB.trim()) {
      alert('Please fill in all match details.');
      return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/knockoutMatches`), newMatch);
      setNewMatch({ round: '', teamA: '', teamB: '', winner: null, scoreA: 0, scoreB: 0, status: 'scheduled' });
      setIsAddingMatch(false);
    } catch (err) {
      console.error('Error adding match:', err);
      alert('Failed to add match. Please try again.');
    }
  };

  const handleUpdateMatch = async (matchId) => {
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchId);
      const updatedData = {
        scoreA: parseInt(editMatchData.scoreA),
        scoreB: parseInt(editMatchData.scoreB),
        status: 'completed',
        winner: editMatchData.scoreA > editMatchData.scoreB ? editMatchData.teamA : editMatchData.teamB // Determine winner
      };
      await updateDoc(matchRef, updatedData);
      setEditingMatchId(null); // Exit editing mode
      setEditMatchData({}); // Clear edit data
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Failed to update match. Please try again.');
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (window.confirm('Are you sure you want to delete this match?')) { // Use custom modal instead of window.confirm in production
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchId));
      } catch (err) {
        console.error('Error deleting match:', err);
        alert('Failed to delete match. Please try again.');
      }
    }
  };

  const startEditing = (match) => {
    setEditingMatchId(match.id);
    setEditMatchData({ ...match }); // Copy current match data for editing
  };

  const cancelEditing = () => {
    setEditingMatchId(null);
    setEditMatchData({});
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🏆 Knockout Stage: {tournamentName}</h2>

      <button
        onClick={() => setIsAddingMatch(!isAddingMatch)}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4 hover:bg-blue-700 transition-colors"
      >
        {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
      </button>

      {isAddingMatch && (
        <div className="mb-6 bg-gray-100 dark:bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3">Add New Knockout Match</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Round Name (e.g., Quarter-Finals)"
              value={newMatch.round}
              onChange={e => setNewMatch({ ...newMatch, round: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Team A Name"
              value={newMatch.teamA}
              onChange={e => setNewMatch({ ...newMatch, teamA: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Team B Name"
              value={newMatch.teamB}
              onChange={e => setNewMatch({ ...newMatch, teamB: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={handleAddMatch}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Create Match
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading knockout matches...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : rounds.length === 0 ? (
        <p className="text-gray-500">No knockout matches configured for this tournament yet.</p>
      ) : (
        <div className="space-y-6">
          {rounds.map((round) => (
            <div key={round.name} className="bg-white dark:bg-gray-800 p-4 rounded shadow-md">
              <h3 className="text-xl font-bold mb-4 border-b pb-2 dark:border-gray-700">{round.name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {round.matches.map((match) => (
                  <div
                    key={match.id}
                    className={`border p-4 rounded-lg shadow-sm transition-all duration-200
                      ${match.status === 'completed' ? 'bg-green-50 dark:bg-green-950 border-green-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-300'}
                      ${editingMatchId === match.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                    `}
                  >
                    {editingMatchId === match.id ? (
                      // Edit form for a match
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{editMatchData.teamA}</p>
                          <input
                            type="number"
                            value={editMatchData.scoreA}
                            onChange={e => setEditMatchData({ ...editMatchData, scoreA: e.target.value })}
                            className="w-16 px-2 py-1 border rounded text-center dark:bg-gray-600 dark:text-white"
                            min="0"
                          />
                          <span> - </span>
                          <input
                            type="number"
                            value={editMatchData.scoreB}
                            onChange={e => setEditMatchData({ ...editMatchData, scoreB: e.target.value })}
                            className="w-16 px-2 py-1 border rounded text-center dark:bg-gray-600 dark:text-white"
                            min="0"
                          />
                          <p className="font-semibold">{editMatchData.teamB}</p>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleUpdateMatch(match.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display mode for a match
                      <div className="flex flex-col">
                        <p className="text-lg font-semibold mb-2">
                          {match.teamA} vs {match.teamB}
                        </p>
                        {match.status === 'completed' ? (
                          <p className="text-md text-green-700 dark:text-green-300">
                            Final Score: <strong>{match.scoreA} - {match.scoreB}</strong>
                            {match.winner && <span className="ml-2">Winner: {match.winner}</span>}
                          </p>
                        ) : (
                          <p className="text-md text-gray-600 dark:text-gray-300">Scheduled</p>
                        )}
                        <div className="flex gap-2 mt-3 justify-end">
                          {!match.status === 'completed' && ( // Only show edit if not completed
                            <button
                              onClick={() => startEditing(match)}
                              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                            >
                              Edit Scores
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMatch(match.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
