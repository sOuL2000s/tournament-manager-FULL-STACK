// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useTournaments } from '../hooks/useTournaments'; // Import the custom hook

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { tournaments, loading, error, createTournament } = useTournaments(); // Use the custom hook
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const shareId = queryParams.get('shareId'); // Get shareId from URL

  const [isCreating, setIsCreating] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentType, setNewTournamentType] = useState('League');
  const [createError, setCreateError] = useState(null);

  // Modal State for custom actions like delete confirmation or info messages
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalCustomContent, setModalCustomContent] = useState(null); // For rendering custom JSX in modal

  // State to manage shared view access
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [tournamentOwnerId, setTournamentOwnerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (shareId) {
      setIsViewOnly(true);
      // Fetch tournament owner ID if in shared view
      const fetchOwner = async () => {
        try {
          const tournamentRef = doc(db, 'tournaments', shareId);
          const tournamentSnap = await getDoc(tournamentRef);
          if (tournamentSnap.exists()) {
            setTournamentOwnerId(tournamentSnap.data().userId);
          } else {
            console.error('Tournament not found for shareId:', shareId);
            // Optionally, redirect to a not-found page or show an error
          }
        } catch (err) {
          console.error('Error fetching tournament owner:', err);
        }
      };
      fetchOwner();
    } else {
      setIsViewOnly(false);
      setTournamentOwnerId(null);
    }
  }, [shareId]);

  useEffect(() => {
    // Determine if the current user is the owner of the tournament (if in shared view)
    if (isViewOnly && user && tournamentOwnerId) {
      setIsOwner(user.uid === tournamentOwnerId);
    } else if (!isViewOnly && user) {
      // If not in view-only mode, the user is always the owner of their own dashboard
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  }, [isViewOnly, user, tournamentOwnerId]);

  // Handler for opening the custom modal
  const openCustomModal = (title, message, onConfirm, inputRequired = false, inputLabel = '', customContent = null) => {
    setModalMessage(message);
    setModalConfirmAction(() => onConfirm);
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(''); // Clear previous input
    setModalCustomContent(customContent);
    setModalOpen(true);
  };

  // Handler for closing the custom modal
  const closeCustomModal = () => {
    setModalOpen(false);
    setModalMessage('');
    setModalConfirmAction(null);
    setModalInputRequired(false);
    setModalInputLabel('');
    setModalInputValue('');
    setModalCustomContent(null);
  };

  const handleModalConfirm = () => {
    if (modalConfirmAction) {
      modalConfirmAction(modalInputValue); // Pass the input value to the confirm action
    }
    closeCustomModal();
  };

  const handleModalCancel = () => {
    closeCustomModal();
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!newTournamentName.trim()) {
      setCreateError("Tournament name cannot be empty.");
      return;
    }
    try {
      await createTournament({
        name: newTournamentName,
        type: newTournamentType,
      });
      setNewTournamentName('');
      setNewTournamentType('League');
      setIsCreating(false);
    } catch (err) {
      setCreateError(err.message || "Failed to create tournament.");
    }
  };

  const handleDeleteTournament = (tournamentId, tournamentName) => {
    // Only allow deletion if not in view-only mode AND the user is the owner
    if (isViewOnly || !isOwner) {
      openCustomModal('Access Denied', 'You do not have permission to delete tournaments in view-only mode.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Deletion',
      `Are you sure you want to delete the tournament "${tournamentName}"? This action cannot be undone.`,
      async () => {
        try {
          const tournamentRef = doc(db, 'tournaments', tournamentId);
          await deleteDoc(tournamentRef);
          // Also delete all subcollections (fixtures, teams, leaderboard entries, players, knockout matches, match stats)
          // This requires fetching all documents in each subcollection and deleting them in a batch.
          // Due to Firestore limitations on batch writes (max 500 operations), this might need to be paginated for very large tournaments.
          // For simplicity, we'll demonstrate a basic deletion for common subcollections.
          // In a production app, consider Cloud Functions for recursive deletes.

          const subcollections = ['fixtures', 'teams', 'leaderboard', 'players', 'knockoutMatches', 'match_stats'];
          for (const subcollectionName of subcollections) {
            const subcollectionRef = collection(db, `tournaments/${tournamentId}/${subcollectionName}`);
            const q = query(subcollectionRef);
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
              batch.delete(doc.ref);
            });
            if (snapshot.docs.length > 0) {
              await batch.commit();
              console.log(`Deleted ${snapshot.docs.length} documents from ${subcollectionName}`);
            }
          }

          openCustomModal('Success', `Tournament "${tournamentName}" and all its data deleted successfully!`, null, false);
        } catch (err) {
          console.error('Error deleting tournament:', err);
          openCustomModal('Error', 'Failed to delete tournament. Please try again.', null, false);
        }
      }
    );
  };

  const copyShareLink = () => {
    const shareLink = `${window.location.origin}/?shareId=${user.uid}`;
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        openCustomModal('Link Copied!', 'The shareable link to your dashboard has been copied to your clipboard.', null, false);
      })
      .catch((err) => {
        console.error('Failed to copy link:', err);
        openCustomModal('Error', 'Failed to copy link. Please try manually.', null, false);
      });
  };

  // Conditional rendering for loading and error states
  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl font-semibold">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-100 dark:bg-gray-900 text-red-500">
        <p className="text-xl font-semibold">Error: {error.message || "Failed to load tournaments."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-6"> {/* Responsive padding and background */}
      <div className="max-w-6xl mx-auto"> {/* Max width and auto margins for centering on large screens */}
        <h2 className="text-3xl font-bold mb-6 text-center">Your Tournaments</h2>

        {/* Share Dashboard Section - only visible if user is logged in and not in view-only mode */}
        {user && !isViewOnly && (
          <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg shadow-md mb-6 text-center">
            <p className="text-blue-800 dark:text-blue-200 mb-3">
              Share your dashboard with others! They will be able to view your tournaments.
            </p>
            <button
              onClick={copyShareLink}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              Copy Shareable Link
            </button>
          </div>
        )}

        {/* Create Tournament Section - only show if not view-only AND owner */}
        {!isViewOnly && isOwner && (
          <div className="mb-6 text-center">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
            >
              {isCreating ? 'Cancel Creation' : 'Create New Tournament'}
            </button>
          </div>
        )}

        {isCreating && (
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8"> {/* Responsive form container */}
            <h3 className="text-xl font-bold mb-4 text-center">➕ New Tournament Details</h3>
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div>
                <label htmlFor="tournamentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tournament Name
                </label>
                <input
                  type="text"
                  id="tournamentName"
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white" // w-full for responsive input width
                  placeholder="e.g., Summer League 2024"
                  required
                />
              </div>
              <div>
                <label htmlFor="tournamentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tournament Type
                </label>
                <select
                  id="tournamentType"
                  value={newTournamentType}
                  onChange={(e) => setNewTournamentType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white" // w-full for responsive select width
                >
                  <option value="League">League</option>
                  <option value="Knockout">Knockout</option>
                  <option value="Multi-Phase">Multi-Phase Tournament</option>
                </select>
              </div>
              {createError && <p className="text-red-500 text-sm text-center">{createError}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-semibold"
              >
                Create Tournament
              </button>
            </form>
          </div>
        )}

        {/* Displaying Tournaments Section (Now always visible below action buttons/form) */}
        <div className="w-full max-w-4xl mx-auto"> {/* Max width and auto margins for centering */}
          <h3 className="text-xl font-bold mb-4 text-center mt-8">My Tournaments</h3>
          {tournaments.length === 0 ? (
            <p className="text-gray-500 text-center">
              {isViewOnly ? "This user has no tournaments yet." : "No tournaments found yet. Create one!"}
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Responsive grid for tournament cards */}
              {tournaments.map(t => (
                <li key={t.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col justify-between items-center text-center transition-transform transform hover:scale-[1.02]">
                  <h4 className="font-semibold text-lg mb-1">{t.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t.type}</p>
                  {t.createdAt && t.createdAt.seconds && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Created on: {new Date(t.createdAt.seconds * 1000).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2"> {/* Container for buttons */}
                    <Link
                      to={`/tournament/${t.id}${shareId ? `?shareId=${shareId}` : ''}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm"
                    >
                      Open Tournament
                    </Link>
                    {!isViewOnly && isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent Link from triggering
                          handleDeleteTournament(t.id, t.name);
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-200 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Custom Modal Component (Inline implementation for Dashboard's specific needs) */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"> {/* Responsive modal overlay */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center"> {/* Responsive modal content container */}
              {/* Conditional rendering for custom content or default message/input */}
              {modalCustomContent || (
                <>
                  <p className="text-lg font-semibold mb-4">{modalMessage}</p>
                  {modalInputRequired && (
                    <div className="flex flex-col gap-2 mb-4">
                      {/* Maps over labels to create multiple inputs if needed. The value and onChange logic handles them as a comma-separated string. */}
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
                          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" // w-full for responsive input width
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
    </div>
  );
}
