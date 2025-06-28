import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournaments } from '../hooks/useTournaments'; // Import useTournaments from the hook
import { db } from '../firebase'; // Import db
import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore'; // Import necessary Firestore functions
// Assuming you have a Modal component in components/Modal.jsx
// If you don't use the shared Modal component here, it's okay, but consistency is good practice.
// import Modal from '../components/Modal'; // Uncomment if you want to use the shared Modal

export default function Dashboard() {
  const { tournaments, loading, error, createTournament } = useTournaments(); // Get createTournament from hook
  const [showForm, setShowForm] = useState(false);
  // States for new tournament form details
  const [name, setName] = useState('');
  const [leagueType, setLeagueType] = useState('League'); // 'League' or 'Groups'
  const [teamsPerGroup, setTeamsPerGroup] = useState('');
  const [numGroups, setNumGroups] = useState('');
  const [fixtureOption, setFixtureOption] = useState('Home and Away Matches'); // 'Home and Away Matches' or 'Single Matches'
  const [pointsPerWin, setPointsPerWin] = useState(3);
  const [pointsPerDraw, setPointsPerDraw] = useState(1);

  const [createError, setCreateError] = useState(null); // State for create tournament errors
  const navigate = useNavigate();

  // Custom Modal Component states (inline, for this Dashboard component only)
  // These states and logic are for the modal defined directly within this file,
  // not the reusable Modal component imported from '../components/Modal'.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState(''); // Stores comma-separated values for multiple inputs
  const [modalCustomContent, setModalCustomContent] = useState(null);

  const openModal = (message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '', customContent = null) => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction); // Wrap in arrow function to prevent immediate execution
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalCustomContent(customContent);
    setModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (modalConfirmAction) {
      modalConfirmAction(modalInputValue); // Pass input value if required
    }
    setModalOpen(false);
    setModalInputValue('');
    setModalCustomContent(null);
    setModalConfirmAction(null); // Clear action after execution
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setModalInputValue('');
    setModalCustomContent(null);
    setModalConfirmAction(null); // Clear action
  };

  const handleDeleteTournament = async (tournamentToDeleteId, tournamentNameToDelete) => {
    openModal(
      `Are you sure you want to delete the league "${tournamentNameToDelete}"? This action cannot be undone and will delete all associated data (teams, fixtures, etc.).`,
      async () => {
        try {
          const tournamentDocRef = doc(db, 'tournaments', tournamentToDeleteId);

          // Delete subcollections first (teams, fixtures, leaderboard, players, match_stats)
          const subcollections = ['teams', 'fixtures', 'leaderboard', 'players', 'match_stats'];
          for (const subcollectionName of subcollections) {
            const subcollectionRef = collection(tournamentDocRef, subcollectionName);
            const subcollectionSnapshot = await getDocs(subcollectionRef);
            const deletePromises = subcollectionSnapshot.docs.map(subDoc => deleteDoc(subDoc.ref));
            await Promise.all(deletePromises);
            console.log(`Deleted all documents in subcollection: tournaments/${tournamentToDeleteId}/${subcollectionName}`);
          }

          // Finally, delete the main tournament document
          await deleteDoc(tournamentDocRef);
          openModal(`League "${tournamentNameToDelete}" deleted successfully.`, null);
        } catch (err) {
          console.error('Error deleting tournament and its subcollections:', err);
          openModal(`Failed to delete league "${tournamentNameToDelete}". Please try again.`, null);
        }
      }
    );
  };


  const handleCreate = async () => {
    // Basic validation for required fields
    if (!name.trim()) {
      setCreateError('League name cannot be empty.');
      return;
    }
    if (leagueType === 'Groups' && (!teamsPerGroup || !numGroups)) {
      setCreateError('Please specify teams per group and number of groups.');
      return;
    }

    setCreateError(null); // Clear previous errors
    try {
      const tournamentData = {
        name,
        type: leagueType, // Use leagueType for the tournament type
        fixtureOption,
        pointsPerWin,
        pointsPerDraw,
      };

      if (leagueType === 'Groups') {
        tournamentData.teamsPerGroup = parseInt(teamsPerGroup);
        tournamentData.numGroups = parseInt(numGroups);
      }

      const id = await createTournament(tournamentData); // Use createTournament from useTournaments hook
      if (id) {
        navigate(`/tournament/${id}`); // Navigate to the newly created tournament
        // Reset form fields
        setName('');
        setLeagueType('League');
        setTeamsPerGroup('');
        setNumGroups('');
        setFixtureOption('Home and Away Matches');
        setPointsPerWin(3);
        setPointsPerDraw(1);
        setShowForm(false); // Hide form
      } else {
        setCreateError('Failed to create tournament. Please try again.');
      }
    } catch (err) {
      console.error('Dashboard: Error creating tournament:', err);
      setCreateError(err.message || 'An unexpected error occurred during tournament creation.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Trophy Image (SVG for better scalability) */}
      <div className="mb-8">
        <svg
          width="150"
          height="150"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-yellow-500" // Gold-like color for the trophy
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M17 2H7C6.44772 2 6 2.44772 6 3V17C6 17.5523 6.44772 18 7 18H17C17.5523 18 18 17.5523 18 17V3C18 2.44772 17.5523 2 17 2ZM7 4H17V16H7V4ZM12 18C12.5523 18 13 18.4477 13 19C13 19.5523 12.5523 20 12 20C11.4477 20 11 19.5523 11 19C11 18.4477 11.4477 18 12 18ZM20 13H22V15H20V13ZM4 13H2V15H4V13ZM12 22C12.5523 22 13 22.4477 13 23C13 23.5523 12.5523 24 12 24C11.4477 24 11 23.5523 11 23C11 22.4477 11.4477 22 12 22ZM12 20.5C12.2761 20.5 12.5 20.7239 12.5 21C12.5 21.2761 12.2761 21.5 12 21.5C11.7239 21.5 11.5 21.2761 11.5 21C11.5 20.7239 11.7239 20.5 12 20.5ZM12 17C12.5523 17 13 17.4477 13 18C13 18.5523 12.5523 19 12 19C11.4477 19 11 18.5523 11 18C11 17.4477 11.4477 17 12 17ZM17 4H7V16H7V4ZM10.5 2L13.5 2L13.5 4L10.5 4L10.5 2ZM19 18H5V20H19V18Z"
            fill="currentColor"
          />
          {/* Text "LTC" inside the trophy */}
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize="5"
            fontWeight="bold"
            fill="#8B4513" // Brownish color for the text
          >
            LTC
          </text>
        </svg>
      </div>

      <h2 className="text-4xl font-extrabold mb-10 text-center">Tournament Manager</h2>

      {/* Action buttons */}
      <div className="flex flex-col gap-4 mb-8 w-full max-w-xs">
        {/* CREATE LEAGUE Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
        >
          {showForm ? 'Hide Form' : 'Create League'}
        </button>

        {/* LOAD LEAGUE Button - Now hides the form if it's open, focusing on the list */}
        <button
          onClick={() => setShowForm(false)}
          className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
        >
          Load League
        </button>
      </div>

      {/* New Tournament Creation Form */}
      {showForm && (
        <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-center">Create New League</h3>
          <div className="flex flex-col gap-4">
            {/* League Name Input */}
            <input
              type="text"
              placeholder="Enter a name for your League"
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* League Type Radio Buttons */}
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="League"
                  checked={leagueType === 'League'}
                  onChange={() => setLeagueType('League')}
                  className="mr-2"
                />
                League
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Groups"
                  checked={leagueType === 'Groups'}
                  onChange={() => setLeagueType('Groups')}
                  className="mr-2"
                />
                Groups
              </label>
            </div>

            {/* Conditional Group Fields */}
            {leagueType === 'Groups' && (
              <div className="flex flex-col gap-3 mt-2">
                <input
                  type="number"
                  placeholder="Teams Per Group"
                  value={teamsPerGroup}
                  onChange={e => setTeamsPerGroup(e.target.value)}
                  className="px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
                <input
                  type="number"
                  placeholder="Number of Groups"
                  value={numGroups}
                  onChange={e => setNumGroups(e.target.value)}
                  className="px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
            )}

            {/* Fixture Options Radio Buttons */}
            <h4 className="font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-300">Fixture Options:</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Home and Away Matches"
                  checked={fixtureOption === 'Home and Away Matches'}
                  onChange={() => setFixtureOption('Home and Away Matches')}
                  className="mr-2"
                />
                Home and Away Matches
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Single Matches"
                  checked={fixtureOption === 'Single Matches'}
                  onChange={() => setFixtureOption('Single Matches')}
                  className="mr-2"
                />
                Single Matches
              </label>
            </div>

            {/* Points Inputs */}
            <h4 className="font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-300">Points:</h4>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="w-28">Points per Win:</label>
                <input
                  type="number"
                  value={pointsPerWin}
                  onChange={e => setPointsPerWin(parseInt(e.target.value) || 0)} // Added || 0 for safer parsing
                  className="px-4 py-2 border rounded-md w-20 text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-28">Points per Draw:</label>
                <input
                  type="number"
                  value={pointsPerDraw}
                  onChange={e => setPointsPerDraw(parseInt(e.target.value) || 0)} // Added || 0 for safer parsing
                  className="px-4 py-2 border rounded-md w-20 text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            {/* CONTINUE Button */}
            <button
              onClick={handleCreate}
              className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105 mt-4"
            >
              Continue
            </button>
          </div>
          {createError && <p className="text-red-500 text-sm mt-3 text-center">{createError}</p>}
        </div>
      )}

      {/* Displaying Tournaments Section (Now always visible below action buttons/form) */}
      <div className="w-full max-w-4xl">
        <h3 className="text-xl font-bold mb-4 text-center mt-8">My Tournaments</h3>
        {loading ? (
          <p className="text-gray-500 text-center">Loading tournaments...</p>
        ) : error ? (
          <p className="text-red-500 text-center">Error loading tournaments: {error}</p>
        ) : tournaments.length === 0 ? (
          <p className="text-gray-500 text-center">No tournaments found yet. Create one!</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map(t => (
              <li
                key={t.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col justify-between items-center text-center transition-transform transform hover:scale-[1.02]"
              >
                <h4 className="font-semibold text-lg mb-1">{t.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t.type}</p>
                {t.createdAt && t.createdAt.seconds && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                    Created on: {new Date(t.createdAt.seconds * 1000).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-2 mt-2"> {/* Container for buttons */}
                    <Link
                      to={`/tournament/${t.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm"
                    >
                      Open Tournament
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent Link from triggering
                        handleDeleteTournament(t.id, t.name);
                      }}
                      className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-200 text-sm"
                    >
                      Delete
                    </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Custom Modal Component (Inline implementation for Dashboard's specific needs) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
            {/* Conditional rendering for custom content or default message/input */}
            {modalCustomContent || (
              <>
                <p className="text-lg font-semibold mb-4">{modalMessage}</p>
                {modalInputRequired && (
                  <div className="flex flex-col gap-2 mb-4">
                    {/* Maps over labels to create multiple inputs if needed.
                        The value and onChange logic handles them as a comma-separated string. */}
                    {modalInputLabel.split(',').map((label, index) => (
                      <input
                        key={index} // Important for React list rendering
                        type="text" // Can be changed to "number" if input is strictly numeric
                        placeholder={label.trim()}
                        // This value logic is for handling multiple inputs with a single state string
                        value={modalInputValue.split(',')[index] || ''}
                        onChange={(e) => {
                          const newValues = modalInputValue.split(',');
                          newValues[index] = e.target.value;
                          setModalInputValue(newValues.join(','));
                        }}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ))}
                  </div>
                )}
              </>
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
