import React, { useEffect, useState, useMemo, useCallback } from 'react'; // Added useCallback
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Custom Modal Component defined directly within this file for its specific use cases.
// Note: This is *not* the same as the shared Modal component in ../components/Modal.jsx.
const Modal = ({ isOpen, message, confirmAction, cancelAction, inputRequired, inputLabel, inputValue, setInputValue }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center text-gray-900 dark:text-white">
        {message && <p className="text-lg font-semibold mb-4">{message}</p>}
        {inputRequired && (
          <div className="flex flex-col gap-2 mb-4">
            {/* This is the input field within this specific Modal.
                Ensuring type="number" as intended for score adjustments. */}
            <input
              type="number" // Remains type="number" as it's used for stat adjustments
              placeholder={inputLabel.trim()}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              // Explicitly ensuring pointer-events and z-index are not an issue
              style={{ pointerEvents: 'auto', zIndex: 'auto' }}
            />
          </div>
        )}
        <div className="flex justify-center gap-4 mt-4">
          {confirmAction && (
            <button
              onClick={confirmAction}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Confirm
            </button>
          )}
          <button
            onClick={cancelAction}
            className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors"
          >
            {confirmAction ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PlayerPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const { user, loading: authLoading } = useAuth(); // Get the current user from useAuth, and auth loading state
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [loadingTournamentData, setLoadingTournamentData] = useState(true); // Specific loading for tournament data
  const [error, setError] = useState(null);

  const [players, setPlayers] = useState([]);
  const [matchStats, setMatchStats] = useState([]); // Still used for aggregation of goals/assists

  const [newPlayerName, setNewPlayerName] = useState(''); // State for new player name
  const [newPlayerTeam, setNewPlayerTeam] = useState(''); // State for new player team
  const [addPlayerError, setAddPlayerError] = useState(''); // State for add player errors

  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false); // State to toggle 'Add New Player Details' form visibility

  // Custom Modal Component states (for this inline modal)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState(''); // Value for the generic modal input

  // Sorting state for the player table
  const [sortConfig, setSortConfig] = useState({ key: 'totalGoals', direction: 'descending' });

  // Memoized openModal function
  const openModal = useCallback((message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '') => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction); // Wrap in arrow function to prevent immediate execution
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalOpen(true);
  }, []); // Empty dependency array means this function is stable

  // Memoized handleModalConfirm function
  const handleModalConfirm = useCallback(() => {
    if (modalConfirmAction) {
      if (modalInputRequired) {
        modalConfirmAction(modalInputValue);
      } else {
        modalConfirmAction();
      }
    }
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null); // Clear action after execution
  }, [modalConfirmAction, modalInputRequired, modalInputValue]); // Dependencies for this callback

  // Memoized handleModalCancel function
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null);
  }, []); // Empty dependency array means this function is stable

  // Effect to fetch the specific tournament's name and verify ownership
  useEffect(() => {
    if (authLoading) {
      setLoadingTournamentData(true);
      return;
    }

    if (!user) {
      setError("You must be logged in to view tournament details.");
      setLoadingTournamentData(false);
      return;
    }

    if (!tournamentId) {
      setError("No tournament ID provided in the URL.");
      setLoadingTournamentData(false);
      return;
    }

    setLoadingTournamentData(true);
    setError(null);

    const fetchTournamentName = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);
        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          if (data.userId === user.uid) { // Verify ownership
            setTournamentName(data.name);
          } else {
            setTournamentName('Access Denied');
            setError('You do not have permission to access this tournament.');
          }
        } else {
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
        setLoadingTournamentData(false);
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setTournamentName('Error');
        setError('Failed to load tournament details.');
        setLoadingTournamentData(false);
      }
    };
    fetchTournamentName();
  }, [tournamentId, user, authLoading]);


  // Real-time listener for players (scoped to user's tournament)
  useEffect(() => {
    if (authLoading || !user || !tournamentId || error) return; // Add error check to prevent listener if no access

    const playersCollectionRef = collection(db, `tournaments/${tournamentId}/players`);
    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({
        id: doc.id,
        // Ensure manOfTheMatchCount exists and defaults to 0
        manOfTheMatchCount: doc.data().manOfTheMatchCount || 0,
        ...doc.data()
      })));
    }, (err) => {
      console.error('Error fetching real-time players:', err);
      setError('Failed to load players. Please try again.');
    });

    return () => unsubscribePlayers();
  }, [tournamentId, user, authLoading, error]); // Add error to dependency array

  // Real-time listener for match stats (scoped to user's tournament) - essential for goal/assist aggregation
  useEffect(() => {
    if (authLoading || !user || !tournamentId || error) return; // Add error check

    const matchStatsCollectionRef = collection(db, `tournaments/${tournamentId}/match_stats`);
    // orderBy is needed for getDocs for composite indexes. Without a specific field,
    // Firestore might require an index for a collection group query which is not ideal here.
    // Given the current logic, fetching all and filtering in client is assumed for smaller datasets.
    const q = query(matchStatsCollectionRef, orderBy('timestamp', 'desc')); // Order by timestamp for consistent fetching

    const unsubscribeStats = onSnapshot(q, (snapshot) => {
      setMatchStats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time match stats:', err);
      setError('Failed to load match statistics. Please try again.');
    });

    return () => unsubscribeStats();
  }, [tournamentId, user, authLoading, error]); // Add error to dependency array


  const handleAddPlayer = async () => {
    setAddPlayerError('');
    if (!newPlayerName.trim() || !newPlayerTeam.trim()) {
      setAddPlayerError('Player name and team cannot be empty.');
      return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/players`), {
        name: newPlayerName,
        team: newPlayerTeam,
        manOfTheMatchCount: 0 // Initialize MOTM count for new players
      });
      setNewPlayerName('');
      setNewPlayerTeam('');
      setShowAddPlayerForm(false); // Hide form after adding
    } catch (err) {
      console.error('Error adding player:', err);
      setAddPlayerError('Failed to add player.');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    openModal('Are you sure you want to delete this player? This will also delete associated match stats.', async () => {
      try {
        const batch = writeBatch(db);

        // Delete the player document
        const playerDocRef = doc(db, `tournaments/${tournamentId}/players`, playerId);
        batch.delete(playerDocRef);

        // Query and delete associated match stats for this player
        // NOTE: For very large 'match_stats' collections, fetching all and filtering client-side
        // for deletion might be inefficient. A Cloud Function triggered by player deletion
        // that cleans up associated stats would be more scalable.
        const matchStatsCollectionRef = collection(db, `tournaments/${tournamentId}/match_stats`);
        // Using a query with 'where' directly to filter stats by playerId requires an index.
        // If this query fails due to missing index, Firebase console will provide a link to create it.
        const statsToDeleteQuery = query(matchStatsCollectionRef, where('playerId', '==', playerId));
        const statsToDeleteSnapshot = await getDocs(statsToDeleteQuery);

        statsToDeleteSnapshot.docs.forEach(statDoc => {
          batch.delete(statDoc.ref);
        });

        await batch.commit();
        openModal('Player and associated stats deleted successfully!', null);
      } catch (err) {
        console.error('Error deleting player and associated stats:', err);
        openModal('Failed to delete player. Please try again.', null);
      }
    });
  };

  const handleAdjustPlayerStat = async (playerId, statType, changeAmount) => {
    const amount = parseInt(changeAmount, 10);
    if (isNaN(amount)) {
      openModal('Invalid input. Please enter a valid number.', null); // Clearer error message
      return;
    }

    try {
      if (statType === 'goals' || statType === 'assists') {
        // Adding an 'increment' field could be more robust for future aggregation
        await addDoc(collection(db, `tournaments/${tournamentId}/match_stats`), {
          playerId: playerId,
          matchId: 'manual_adjustment', // Special ID for manual entries
          goals: statType === 'goals' ? amount : 0,
          assists: statType === 'assists' ? amount : 0,
          timestamp: new Date(), // Timestamp for the adjustment
          type: 'manual_adjustment' // Indicate this is a manual adjustment
        });
      } else if (statType === 'manOfTheMatchCount') {
        const playerRef = doc(db, `tournaments/${tournamentId}/players`, playerId);
        // Using `updateDoc` with a functional update for `manOfTheMatchCount`
        // if you want to avoid reading current value, but for simplicity
        // reading and then updating is fine given the current structure.
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const currentCount = playerSnap.data().manOfTheMatchCount || 0;
          await updateDoc(playerRef, {
            manOfTheMatchCount: Math.max(0, currentCount + amount) // Ensure count doesn't go below 0
          });
        }
      }
      openModal(`Stat updated successfully!`, null);
    } catch (err) {
      console.error(`Error adjusting ${statType}:`, err);
      openModal(`Failed to adjust ${statType}. Please try again.`, null);
    }
  };


  // Calculate total goals, assists, and MOTM for each player based on matchStats
  const playerAggregatedStats = useMemo(() => {
    return players.map(player => {
      const playerGoals = matchStats.filter(stat => stat.playerId === player.id)
        .reduce((sum, stat) => sum + (stat.goals || 0), 0);
      const playerAssists = matchStats.filter(stat => stat.playerId === player.id)
        .reduce((sum, stat) => sum + (stat.assists || 0), 0);
      const manOfTheMatchCount = player.manOfTheMatchCount || 0;

      return { ...player, totalGoals: playerGoals, totalAssists: playerAssists, manOfTheMatchCount: manOfTheMatchCount };
    }).sort((a, b) => {
      // Primary sort
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }

      // Secondary sort for ties (e.g., if goals are tied, sort by assists, then name)
      if (sortConfig.key === 'totalGoals') {
        if (a.totalAssists < b.totalAssists) return 1;
        if (a.totalAssists > b.totalAssists) return -1;
      } else if (sortConfig.key === 'totalAssists') {
        if (a.totalGoals < b.totalGoals) return 1;
        if (a.totalGoals > b.totalGoals) return -1;
      } else if (sortConfig.key === 'manOfTheMatchCount') {
        if (a.totalGoals < b.totalGoals) return 1;
        if (a.totalGoals > b.totalGoals) return -1;
      }
      return a.name.localeCompare(b.name); // Tertiary sort by name
    });
  }, [players, matchStats, sortConfig]);

  const requestSort = (key) => {
    let direction = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? '▲' : '▼';
    }
    return '';
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">👤 Player Management ({tournamentName})</h2>

        {authLoading || loadingTournamentData ? (
          <p className="text-center text-gray-500 py-8">Loading data...</p>
        ) : error ? (
          <p className="text-red-500 text-center mb-4">{error}</p>
        ) : (
          <>
            {/* ADD NEW PLAYER Button */}
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
                className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
              >
                {showAddPlayerForm ? 'Hide Add Player Form' : 'Add New Player'}
              </button>
            </div>

            {/* Add New Player Section - Toggled Visibility */}
            {showAddPlayerForm && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-3">➕ Add New Player Details</h3>
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Player Name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white flex-grow min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Team Name"
                    value={newPlayerTeam}
                    onChange={(e) => setNewPlayerTeam(e.target.value)}
                    className="border px-3 py-2 rounded-md dark:bg-gray-700 dark:text-white flex-grow min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            )}

            {/* Player Stats Table (Combined Top Scorers & Assisters, sortable) */}
            <h3 className="text-2xl font-bold mt-8 mb-4">📊 Player Statistics</h3>
            {playerAggregatedStats.length === 0 ? (
              <p className="text-gray-500">No players or stats found yet. Add some!</p>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-8">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-200 dark:bg-gray-700 text-left">
                      <th className="px-4 py-2 border-b dark:border-gray-600">P</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Player</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Team</th>
                      <th
                        className="px-4 py-2 border-b dark:border-gray-600 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600"
                        onClick={() => requestSort('totalGoals')}
                      >
                        Goals {getSortIcon('totalGoals')}
                      </th>
                      <th
                        className="px-4 py-2 border-b dark:border-gray-600 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600"
                        onClick={() => requestSort('totalAssists')}
                      >
                        Assists {getSortIcon('totalAssists')}
                      </th>
                      <th
                        className="px-4 py-2 border-b dark:border-gray-600 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600"
                        onClick={() => requestSort('manOfTheMatchCount')}
                      >
                        MOTM {getSortIcon('manOfTheMatchCount')}
                      </th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerAggregatedStats.map((player, index) => (
                      <tr key={player.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2 font-bold">{index + 1}</td>
                        <td className="px-4 py-2">{player.name}</td>
                        <td className="px-4 py-2">{player.team}</td>
                        <td className="px-4 py-2">{player.totalGoals}</td>
                        <td className="px-4 py-2">{player.totalAssists}</td>
                        <td className="px-4 py-2">{player.manOfTheMatchCount}</td>
                        <td className="px-4 py-2 flex flex-wrap gap-2 items-center">
                          {/* Goals Adjustment */}
                          <button
                            onClick={() => openModal(`Add Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', val), true, 'Goals to Add', '1')}
                            className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors flex items-center justify-center"
                            title="Add Goals"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal(`Subtract Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', -val), true, 'Goals to Subtract', '1')}
                            className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors flex items-center justify-center"
                            title="Subtract Goals"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                            </svg>
                          </button>

                          {/* Assists Adjustment */}
                          <button
                            onClick={() => openModal(`Add Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', val), true, 'Assists to Add', '1')}
                            className="bg-blue-500 text-white px-2 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors flex items-center justify-center"
                            title="Add Assists"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal(`Subtract Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', -val), true, 'Assists to Subtract', '1')}
                            className="bg-blue-500 text-white px-2 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors flex items-center justify-center"
                            title="Subtract Assists"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                            </svg>
                          </button>

                          {/* MOTM Adjustment */}
                          <button
                            onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', 1)}
                            className="bg-purple-600 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-700 transition-colors"
                            title="Add MOTM"
                          >
                            MOTM +
                          </button>
                          <button
                            onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', -1)}
                            className="bg-purple-600 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-700 transition-colors"
                            title="Subtract MOTM"
                          >
                            MOTM -
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors"
                            title="Delete Player"
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
          </>
        )}
      </div>

      {/* Custom Modal Component (Inline for this page) */}
      <Modal
        isOpen={modalOpen}
        message={modalMessage}
        confirmAction={modalConfirmAction ? handleModalConfirm : null} // Pass null if no confirm action
        cancelAction={handleModalCancel}
        inputRequired={modalInputRequired}
        inputLabel={modalInputLabel}
        inputValue={modalInputValue}
        setInputValue={setModalInputValue}
      />
    </div>
  );
}
