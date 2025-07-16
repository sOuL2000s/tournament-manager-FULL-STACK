import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, getDoc, getDocs, writeBatch, where } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Custom Modal Component defined directly within this file for its specific use cases.
const Modal = ({ isOpen, message, confirmAction, cancelAction, inputRequired, inputLabel, inputValue, setInputValue }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center text-gray-900 dark:text-white">
        {message && <p className="text-lg font-semibold mb-4">{message}</p>}
        {inputRequired && (
          <div className="flex flex-col gap-2 mb-4">
            <input
              type="number"
              placeholder={inputLabel.trim()}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [loadingTournamentData, setLoadingTournamentData] = useState(true);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  // matchStats is no longer needed as goals, assists, and MOTM are directly on player document
  // const [matchStats, setMatchStats] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [customNewTeamName, setCustomNewTeamName] = useState('');
  const [addPlayerError, setAddPlayerError] = useState('');
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);

  // Custom Modal Component states (for this inline modal)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');

  // ADDED: Sorting state for the player table
  const [sortConfig, setSortConfig] = useState({ key: 'totalGoals', direction: 'descending' });

  const openModal = useCallback((message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '') => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction);
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalOpen(true);
  }, []);

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
    setModalConfirmAction(null);
  }, [modalConfirmAction, modalInputRequired, modalInputValue]);

  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null);
  }, []);

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
          if (data.userId === user.uid) {
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

  useEffect(() => {
    if (authLoading || !user || !tournamentId || error) return;

    const playersCollectionRef = collection(db, `tournaments/${tournamentId}/players`);
    // Listen for changes to players, including their 'goals', 'assists', and 'manOfTheMatchCount' fields
    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      const fetchedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        // Ensure goals, assists, and manOfTheMatchCount are initialized to 0 if not present
        goals: doc.data().goals || 0,
        assists: doc.data().assists || 0,
        manOfTheMatchCount: doc.data().manOfTheMatchCount || 0,
        ...doc.data()
      }));
      setPlayers(fetchedPlayers);

      const uniqueTeams = [...new Set(fetchedPlayers.map(player => player.team))].sort((a, b) => a.localeCompare(b));
      setTeams(uniqueTeams);

      if (showAddPlayerForm && newPlayerTeam === '' && uniqueTeams.length > 0) {
        setNewPlayerTeam(uniqueTeams[0]);
      } else if (showAddPlayerForm && newPlayerTeam === '' && uniqueTeams.length === 0) {
        setNewPlayerTeam('_new_team_');
      }
    }, (err) => {
      console.error('Error fetching real-time players:', err);
      setError('Failed to load players. Please try again.');
    });

    // Removed fetchMatchStats as goals, assists, and manOfTheMatchCount are now directly on player document
    // and updated via direct editing on this page. If fixture-derived stats are needed elsewhere,
    // they should be fetched/calculated in a component that specifically deals with fixtures.

    return () => {
      unsubscribePlayers();
    };
  }, [tournamentId, user, authLoading, error, showAddPlayerForm, newPlayerTeam]); // Depend on showAddPlayerForm and newPlayerTeam to re-evaluate default team selection

  // Combine players with their total goals, assists, and man of the match counts
  const playersWithStats = useMemo(() => {
    return players.map(player => ({
      ...player,
      // totalGoals now directly comes from player.goals
      totalGoals: player.goals,
      // totalAssists now directly comes from player.assists
      totalAssists: player.assists,
      // manOfTheMatchCount now directly comes from player.manOfTheMatchCount
      manOfTheMatchCount: player.manOfTheMatchCount
    }));
  }, [players]); // Depend only on players as stats are now directly on player objects

  // Sort players based on sortConfig
  const sortedPlayers = useMemo(() => {
    let sortablePlayers = [...playersWithStats];
    if (sortConfig.key) {
      sortablePlayers.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ?
            aValue.localeCompare(bValue) :
            bValue.localeCompare(aValue);
        } else {
          // Handle undefined values by treating them as 0 for numerical sorting
          const numA = aValue === undefined ? 0 : aValue;
          const numB = bValue === undefined ? 0 : bValue;
          return sortConfig.direction === 'ascending' ?
            numA - numB :
            numB - numA;
        }
      });
    }
    return sortablePlayers;
  }, [playersWithStats, sortConfig]);

  const requestSort = useCallback((key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
    }
    return '';
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setAddPlayerError('');

    if (!newPlayerName.trim()) {
      setAddPlayerError('Player name cannot be empty.');
      return;
    }

    let teamToAdd = newPlayerTeam;
    if (newPlayerTeam === '_new_team_') {
      if (!customNewTeamName.trim()) {
        setAddPlayerError('New team name cannot be empty.');
        return;
      }
      teamToAdd = customNewTeamName.trim();
    }

    try {
      // Check if a player with the same name and team already exists
      const q = query(
        collection(db, `tournaments/${tournamentId}/players`),
        where('name', '==', newPlayerName.trim()),
        where('team', '==', teamToAdd)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setAddPlayerError(`Player '${newPlayerName.trim()}' already exists in team '${teamToAdd}'.`);
        return;
      }

      await addDoc(collection(db, `tournaments/${tournamentId}/players`), {
        name: newPlayerName.trim(),
        team: teamToAdd,
        goals: 0, // Initialize goals for the player
        assists: 0, // Initialize assists for the player
        manOfTheMatchCount: 0 // Initialize man of the match count
      });
      setNewPlayerName('');
      setCustomNewTeamName('');
      setNewPlayerTeam(teams.length > 0 ? teams[0] : '_new_team_');
      setShowAddPlayerForm(false); // Hide form after successful addition
    } catch (err) {
      console.error('Error adding player:', err);
      setAddPlayerError('Failed to add player. Please try again.');
    }
  };

  const handleEditGoals = useCallback((player) => {
    openModal(
      `Set goals for ${player.name}:`,
      (value) => updatePlayerStat(player.id, 'goals', parseInt(value) || 0),
      true,
      'Goals',
      String(player.totalGoals)
    );
  }, [openModal]);

  const handleEditAssists = useCallback((player) => {
    openModal(
      `Set assists for ${player.name}:`,
      (value) => updatePlayerStat(player.id, 'assists', parseInt(value) || 0),
      true,
      'Assists',
      String(player.totalAssists)
    );
  }, [openModal]);

  const handleEditMOTM = useCallback((player) => {
    openModal(
      `Set Man of the Match count for ${player.name}:`,
      (value) => updatePlayerStat(player.id, 'manOfTheMatchCount', parseInt(value) || 0),
      true,
      'MOTM Count',
      String(player.manOfTheMatchCount)
    );
  }, [openModal]);

  // Generic function to update any player stat (goals, assists, manOfTheMatchCount)
  const updatePlayerStat = async (playerId, field, value) => {
    try {
      const playerRef = doc(db, `tournaments/${tournamentId}/players`, playerId);
      await updateDoc(playerRef, { [field]: value });
    } catch (err) {
      console.error(`Error updating player ${field}:`, err);
      openModal(`Failed to update ${field}. Please try again.`);
    }
  };

  const handleDeletePlayer = useCallback((playerId, playerName) => {
    openModal(
      `Are you sure you want to delete ${playerName}? This action cannot be undone.`,
      async () => {
        try {
          const playerRef = doc(db, `tournaments/${tournamentId}/players`, playerId);
          await deleteDoc(playerRef);

          // No longer need to update fixtures for goals/assists as they are on player doc.
          // Still need to clear manOfTheMatchPlayerId from fixtures if the deleted player was MOTM.
          const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
          const q = query(fixturesCollectionRef,
            where('manOfTheMatchPlayerId', '==', playerId)
          );
          const fixturesSnap = await getDocs(q);
          const batch = writeBatch(db);

          fixturesSnap.forEach(fixtureDoc => {
            batch.update(fixtureDoc.ref, {
              manOfTheMatchPlayerId: null // Clear MOTM if the deleted player was it
            });
          });
          await batch.commit();

          openModal('Player deleted successfully!');
        } catch (err) {
          console.error('Error deleting player:', err);
          openModal('Failed to delete player. Please try again.');
        }
      }
    );
  }, [tournamentId, openModal]);

  if (loadingTournamentData || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-lg font-semibold animate-pulse">Loading player data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-red-500 p-4">
        <p className="text-xl font-bold mb-4">Error:</p>
        <p className="text-lg text-center">{error}</p>
        <Link to="/" className="mt-6 bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors font-semibold">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex flex-wrap justify-around font-bold text-base md:text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">PLAYERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-fit">AI PREDICTION</Link>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-center">
          ⚽ Players in {tournamentName}
        </h2>

        {/* Add New Player Section */}
        <div className="mb-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 mb-4"
          >
            {showAddPlayerForm ? 'Hide Add Player Form' : 'Add New Player'}
          </button>

          {showAddPlayerForm && (
            <form onSubmit={handleAddPlayer} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Player Name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={newPlayerTeam}
                onChange={(e) => setNewPlayerTeam(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Team</option>
                {teams.map((team, index) => (
                  <option key={index} value={team}>{team}</option>
                ))}
                <option value="_new_team_">Add New Team</option>
              </select>

              {newPlayerTeam === '_new_team_' && (
                <input
                  type="text"
                  placeholder="New Team Name"
                  value={customNewTeamName}
                  onChange={(e) => setCustomNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {addPlayerError && (
                <p className="text-red-500 text-sm mt-1">{addPlayerError}</p>
              )}

              <button
                type="submit"
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                Add Player
              </button>
            </form>
          )}
        </div>

        {/* Players List Table */}
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No players added yet. Add some players!</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-lg border border-gray-300 dark:border-gray-600">
            <table className="min-w-full table-auto text-sm md:text-base">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                  <th className="px-3 py-2 border-b dark:border-gray-700 cursor-pointer" onClick={() => requestSort('name')}>
                    Player Name {getSortIndicator('name')}
                  </th>
                  <th className="px-3 py-2 border-b dark:border-gray-700 cursor-pointer" onClick={() => requestSort('team')}>
                    Team {getSortIndicator('team')}
                  </th>
                  <th className="px-3 py-2 border-b dark:border-gray-700 text-center cursor-pointer" onClick={() => requestSort('totalGoals')}>
                    Goals {getSortIndicator('totalGoals')}
                  </th>
                  <th className="px-3 py-2 border-b dark:border-gray-700 text-center cursor-pointer" onClick={() => requestSort('totalAssists')}>
                    Assists {getSortIndicator('totalAssists')}
                  </th>
                  <th className="px-3 py-2 border-b dark:border-gray-700 text-center cursor-pointer" onClick={() => requestSort('manOfTheMatchCount')}>
                    MOTM {getSortIndicator('manOfTheMatchCount')}
                  </th>
                  <th className="px-3 py-2 border-b dark:border-gray-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map(player => (
                  <tr key={player.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-2">{player.name}</td>
                    <td className="px-3 py-2">{player.team}</td>
                    <td className="px-3 py-2 text-center">{player.totalGoals}</td>
                    <td className="px-3 py-2 text-center">{player.totalAssists}</td>
                    <td className="px-3 py-2 text-center">{player.manOfTheMatchCount}</td>
                    <td className="px-3 py-2 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => handleEditGoals(player)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition-colors text-xs sm:text-sm"
                        title="Edit Goals"
                      >
                        Edit Goals
                      </button>
                      <button
                        onClick={() => handleEditAssists(player)}
                        className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition-colors text-xs sm:text-sm"
                        title="Edit Assists"
                      >
                        Edit Assists
                      </button>
                      <button
                        onClick={() => handleEditMOTM(player)}
                        className="bg-purple-500 text-white px-3 py-1 rounded-md hover:bg-purple-600 transition-colors text-xs sm:text-sm"
                        title="Edit Man of the Match Count"
                      >
                        Edit MOTM
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(player.id, player.name)}
                        className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition-colors text-xs sm:text-sm"
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
      </div>

      {/* Custom Modal */}
      <Modal
        isOpen={modalOpen}
        message={modalMessage}
        confirmAction={modalConfirmAction ? handleModalConfirm : null}
        cancelAction={handleModalCancel}
        inputRequired={modalInputRequired}
        inputLabel={modalInputLabel}
        inputValue={modalInputValue}
        setInputValue={setModalInputValue}
      />
    </div>
  );
}