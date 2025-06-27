import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom'; // Import Link
import { useAuth } from '../hooks/useAuth'; // Import useAuth to get userId


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

  // Custom Modal Component (from TournamentPage)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');

  const openModal = (message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '') => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction);
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (modalConfirmAction) {
      if (modalInputRequired) {
        modalConfirmAction(modalInputValue);
      } else {
        modalConfirmAction();
      }
    }
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null);
  };

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
    if (authLoading || !user || !tournamentId) return;

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
    });

    return () => unsubscribePlayers();
  }, [tournamentId, user, authLoading]);

  // Real-time listener for match stats (scoped to user's tournament) - essential for goal/assist aggregation
  useEffect(() => {
    if (authLoading || !user || !tournamentId) return;

    const matchStatsCollectionRef = collection(db, `tournaments/${tournamentId}/match_stats`);
    const unsubscribeStats = onSnapshot(matchStatsCollectionRef, (snapshot) => {
      setMatchStats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time match stats:', err);
    });

    return () => unsubscribeStats();
  }, [tournamentId, user, authLoading]);


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
    openModal('Are you sure you want to delete this player?', async () => {
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/players`, playerId));
        // Optionally, delete related match stats for this player too for cleanup
        const playerMatchStatsQuery = query(collection(db, `tournaments/${tournamentId}/match_stats`), orderBy('playerId'), orderBy('matchId')); // orderBy here is just for query, Firestore will need an index if combining with where
        const statsToDeleteSnapshot = await getDocs(playerMatchStatsQuery.where('playerId', '==', playerId)); // Needs query.where to filter
        const batch = writeBatch(db);
        statsToDeleteSnapshot.docs.forEach(statDoc => {
          batch.delete(statDoc.ref);
        });
        await batch.commit();
      } catch (err) {
        console.error('Error deleting player and associated stats:', err);
        openModal('Failed to delete player. Please try again.');
      }
    });
  };

  const handleAdjustPlayerStat = async (playerId, statType, changeAmount) => {
    try {
      if (statType === 'goals' || statType === 'assists') {
        // Create a new match_stats entry for manual adjustments
        await addDoc(collection(db, `tournaments/${tournamentId}/match_stats`), {
          playerId: playerId,
          matchId: 'manual_adjustment', // Special ID for manual entries
          goals: statType === 'goals' ? changeAmount : 0,
          assists: statType === 'assists' ? changeAmount : 0,
          timestamp: new Date(), // Timestamp for the adjustment
          type: 'manual_adjustment' // Indicate this is a manual adjustment
        });
      } else if (statType === 'manOfTheMatchCount') {
        const playerRef = doc(db, `tournaments/${tournamentId}/players`, playerId);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const currentCount = playerSnap.data().manOfTheMatchCount || 0;
          await updateDoc(playerRef, {
            manOfTheMatchCount: Math.max(0, currentCount + changeAmount) // Ensure count doesn't go below 0
          });
        }
      }
      openModal(`Stat updated successfully!`, null);
    } catch (err) {
      console.error(`Error adjusting ${statType}:`, err);
      openModal(`Failed to adjust ${statType}. Please try again.`);
    }
  };


  // Calculate total goals and assists for each player based on matchStats
  const playerAggregatedStats = players.map(player => {
    const playerGoals = matchStats.filter(stat => stat.playerId === player.id)
                                  .reduce((sum, stat) => sum + (stat.goals || 0), 0);
    const playerAssists = matchStats.filter(stat => stat.playerId === player.id)
                                    .reduce((sum, stat) => sum + (stat.assists || 0), 0);
    // Use player.manOfTheMatchCount directly from player document
    const manOfTheMatchCount = player.manOfTheMatchCount || 0;

    return { ...player, totalGoals: playerGoals, totalAssists: playerAssists, manOfTheMatchCount: manOfTheMatchCount };
  }).sort((a, b) => b.totalGoals - a.totalGoals || b.totalAssists - a.totalAssists); // Sort by goals, then assists

  // Calculate top assisters (separate list, sorted by assists)
  const topAssisters = players.map(player => {
    const playerAssists = matchStats.filter(stat => stat.playerId === player.id)
                                    .reduce((sum, stat) => sum + (stat.assists || 0), 0);
    const playerGoals = matchStats.filter(stat => stat.playerId === player.id)
                                  .reduce((sum, stat) => sum + (stat.goals || 0), 0);
    // Use player.manOfTheMatchCount directly from player document
    const manOfTheMatchCount = player.manOfTheMatchCount || 0;

    return { ...player, totalAssists: playerAssists, totalGoals: playerGoals, manOfTheMatchCount: manOfTheMatchCount };
  }).sort((a, b) => b.totalAssists - a.totalAssists || b.totalGoals - a.totalGoals); // Sort by assists, then goals


  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">👤 Player Management ({tournamentName})</h2>
        
        {authLoading ? (
          <p className="text-center text-gray-500 py-8">Authenticating user...</p>
        ) : loadingTournamentData ? (
          <p className="text-center text-gray-500 py-8">Loading tournament details...</p>
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
            )}

            {/* Top Scorers Table (Player List modified to show aggregated stats) */}
            <h3 className="text-2xl font-bold mt-8 mb-4">👑 Top Scorers</h3>
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
                      <th className="px-4 py-2 border-b dark:border-gray-600">Goals</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Assists</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">MOTM</th> {/* New MOTM Column */}
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
                        <td className="px-4 py-2">{player.manOfTheMatchCount}</td> {/* Display MOTM Count */}
                        <td className="px-4 py-2 flex gap-2 items-center">
                            {/* Buttons for adjusting goals */}
                            <button
                                onClick={() => openModal(`Add Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', parseInt(val)), true, 'Goals to Add', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                            <button
                                onClick={() => openModal(`Subtract Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', -parseInt(val)), true, 'Goals to Subtract', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                </svg>
                            </button>
                             {/* Buttons for adjusting assists */}
                            <button
                                onClick={() => openModal(`Add Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', parseInt(val)), true, 'Assists to Add', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                            <button
                                onClick={() => openModal(`Subtract Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', -parseInt(val)), true, 'Assists to Subtract', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                </svg>
                            </button>
                            {/* Buttons for adjusting MOTM */}
                            <button
                                onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', 1)}
                                className="bg-purple-500 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-600 transition-colors"
                            >
                                MOTM +
                            </button>
                            <button
                                onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', -1)}
                                className="bg-purple-500 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-600 transition-colors"
                            >
                                MOTM -
                            </button>
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

            {/* Top Assisters Table */}
            <h3 className="text-2xl font-bold mt-8 mb-4">🅰️ Top Assisters</h3>
            {topAssisters.length === 0 ? (
              <p className="text-gray-500">No assisters or stats found yet. Add some!</p>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-200 dark:bg-gray-700 text-left">
                      <th className="px-4 py-2 border-b dark:border-gray-600">P</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Player</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Team</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Assists</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">Goals</th>
                      <th className="px-4 py-2 border-b dark:border-gray-600">MOTM</th> {/* New MOTM Column */}
                      <th className="px-4 py-2 border-b dark:border-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAssisters.map((player, index) => (
                      <tr key={player.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2 font-bold">{index + 1}</td>
                        <td className="px-4 py-2">{player.name}</td>
                        <td className="px-4 py-2">{player.team}</td>
                        <td className="px-4 py-2">{player.totalAssists}</td>
                        <td className="px-4 py-2">{player.totalGoals}</td>
                        <td className="px-4 py-2">{player.manOfTheMatchCount}</td> {/* Display MOTM Count */}
                        <td className="px-4 py-2 flex gap-2 items-center">
                            {/* Buttons for adjusting assists */}
                            <button
                                onClick={() => openModal(`Add Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', parseInt(val)), true, 'Assists to Add', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                            <button
                                onClick={() => openModal(`Subtract Assists for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'assists', -parseInt(val)), true, 'Assists to Subtract', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                </svg>
                            </button>
                             {/* Buttons for adjusting goals */}
                            <button
                                onClick={() => openModal(`Add Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', parseInt(val)), true, 'Goals to Add', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                            <button
                                onClick={() => openModal(`Subtract Goals for ${player.name}:`, (val) => handleAdjustPlayerStat(player.id, 'goals', -parseInt(val)), true, 'Goals to Subtract', '1')}
                                className="bg-gray-500 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                </svg>
                            </button>
                            {/* Buttons for adjusting MOTM */}
                            <button
                                onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', 1)}
                                className="bg-purple-500 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-600 transition-colors"
                            >
                                MOTM +
                            </button>
                            <button
                                onClick={() => handleAdjustPlayerStat(player.id, 'manOfTheMatchCount', -1)}
                                className="bg-purple-500 text-white px-2 py-1 rounded-md text-sm hover:bg-purple-600 transition-colors"
                            >
                                MOTM -
                            </button>
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
          </>
        )}
      </div>

      {/* Custom Modal Component (from TournamentPage) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
            {modalMessage && <p className="text-lg font-semibold mb-4">{modalMessage}</p>}
            {modalInputRequired && (
              <div className="flex flex-col gap-2 mb-4">
                {modalInputLabel.split(',').map((label, index) => (
                  <input
                    key={index}
                    type="number"
                    placeholder={label.trim()}
                    value={modalInputValue.split(',')[index] || ''}
                    onChange={(e) => {
                      const newValues = modalInputValue.split(',');
                      newValues[index] = e.target.value;
                      setModalInputValue(newValues.join(','));
                    }}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white"
                  />
                ))}
              </div>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {modalConfirmAction && (
                <button
                  onClick={handleModalConfirm}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Confirm
                </button>
              )}
              <button
                onClick={handleModalCancel}
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors"
              >
                {modalConfirmAction ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
