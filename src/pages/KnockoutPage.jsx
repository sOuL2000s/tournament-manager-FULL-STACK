import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'; // Import necessary Firestore functions
import { useAuth } from '../hooks/useAuth'; // Import useAuth for authentication state
// Note: This component implements its own inline modal.
// The import 'Modal from '../components/Modal';' is present but not used for rendering.

// --- MODIFICATION: Accept readOnly prop ---
export default function KnockoutPage({ readOnly = false }) { // Default to false
    const { id: tournamentId } = useParams();
    const { user, loading: authLoading } = useAuth(); // Get user and authLoading from useAuth hook
    const [tournamentName, setTournamentName] = useState('Loading...');
    const [rounds, setRounds] = useState([]);
    const [loading, setLoading] = useState(true); // General loading state for the page content
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
    // --- MODIFICATION: Hide add match form by default in readOnly mode ---
    const [isAddingMatch, setIsAddingMatch] = useState(readOnly ? false : false); // Start false, or if readOnly, always false
    const [editingMatchId, setEditingMatchId] = useState(null); // State for editing match
    const [editMatchData, setEditMatchData] = useState({}); // State for edited match data

    // Custom Modal Component states (inline implementation within this component)
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalConfirmAction, setModalConfirmAction] = useState(null);
    const [modalInputRequired, setModalInputRequired] = useState(false);
    const [modalInputLabel, setModalInputLabel] = useState(''); // Used for generic input labels
    const [modalInputValue, setModalInputValue] = useState(''); // Used for generic input value
    const [modalCustomContent, setModalCustomContent] = useState(null); // For rendering custom JSX inside modal
    // --- MODIFICATION: Added modalShowConfirmButton for granular control ---
    const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);

    // Function to open the custom inline modal
    const openModal = useCallback((message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '', customContent = null, showConfirm = true) => {
        setModalMessage(message);
        setModalConfirmAction(() => confirmAction); // Wrap in arrow function to prevent immediate execution
        setModalInputRequired(inputRequired);
        setModalInputLabel(inputLabel);
        setModalInputValue(initialValue);
        setModalCustomContent(customContent);
        setModalShowConfirmButton(showConfirm); // Set the new state
        setModalOpen(true);
    }, []); // useCallback for memoization

    // Function to handle modal confirmation
    const handleModalConfirm = useCallback(() => {
        // --- MODIFICATION: Prevent confirm if in readOnly mode (client-side safety) ---
        if (readOnly) {
            openModal('This action is not allowed in view-only mode.', null, false, '', '', null, false); // No confirm button
            return;
        }

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
        setModalCustomContent(null); // Clear custom content
        setModalShowConfirmButton(true); // Reset
    }, [modalConfirmAction, modalInputRequired, modalInputValue, readOnly, openModal]); // Depend on values that might change

    // Function to handle modal cancellation/closing
    const handleModalCancel = useCallback(() => {
        setModalOpen(false);
        setModalInputValue('');
        setModalConfirmAction(null); // Clear action
        setModalCustomContent(null); // Clear custom content
        setModalShowConfirmButton(true); // Reset
    }, []); // useCallback for memoization


    useEffect(() => {
        // --- MODIFICATION: Wait for authentication to load only if not in readOnly mode ---
        if (!readOnly && authLoading) {
            setLoading(true); // Keep loading state true while auth is pending
            return;
        }

        // --- MODIFICATION: If no user is logged in after auth loads AND not in readOnly mode, show error ---
        if (!readOnly && !user) {
            setError("You must be logged in to view knockout stage details.");
            setLoading(false);
            return;
        }

        if (!tournamentId) {
            setError("No tournament ID provided.");
            setLoading(false);
            return;
        }

        setLoading(true); // Start loading page content
        setError(null); // Clear any previous errors

        const fetchTournamentDetails = async () => {
            try {
                const docRef = doc(db, 'tournaments', tournamentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // --- MODIFICATION: Verify ownership only if not in readOnly mode, otherwise allow access ---
                    if (readOnly || (user?.uid && data.userId === user.uid)) { // Use user?.uid for safe access
                        setTournamentName(data.name);
                    } else {
                        setTournamentName('Access Denied');
                        setError('You do not have permission to access this tournament.');
                    }
                } else {
                    setTournamentName('Tournament Not Found');
                    setError('Tournament details could not be loaded.');
                }
            } catch (err) {
                console.error('Error fetching tournament details:', err);
                setTournamentName('Error'); // Set a generic name on error
                setError('Failed to fetch tournament details.');
            } finally {
                setLoading(false); // Ensure loading state is false after attempt
            }
        };
        fetchTournamentDetails();

        // --- MODIFICATION: Do not set up real-time listener if there's an error already, or not authenticated in non-readOnly mode ---
        // The previous error state could be from the ownership check.
        if ((!readOnly && (!user || !user.uid)) || error) {
            return;
        }

        // Set up a real-time listener for knockout matches
        const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);
        const q = query(matchesCollectionRef, orderBy('round', 'asc'), orderBy('teamA', 'asc'));

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
                        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
                    })
                    .map(name => ({ name, matches: groupedRounds[name] }));

                setRounds(sortedRounds);
                setLoading(false); // Finished loading matches
                setError(null);
            } catch (err) {
                console.error('Error processing real-time knockout matches data:', err);
                setError('Failed to load knockout matches.');
                setLoading(false);
            }
        }, (err) => {
            console.error('Real-time listener error for knockout matches:', err);
            setError('Real-time updates failed for knockout matches.');
            setLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [tournamentId, user, authLoading, error, readOnly]); // Add user, authLoading, error, and readOnly to dependencies

    const handleAddMatch = async () => {
        // --- MODIFICATION: Prevent action if in readOnly mode ---
        if (readOnly) {
            openModal('This action is not allowed in view-only mode.', null, false, '', '', null, false);
            return;
        }

        if (!newMatch.round.trim() || !newMatch.teamA.trim() || !newMatch.teamB.trim()) {
            openModal('Please fill in all match details.', null, false, '', '', null, false);
            return;
        }
        try {
            await addDoc(collection(db, `tournaments/${tournamentId}/knockoutMatches`), newMatch);
            setNewMatch({ round: '', teamA: '', teamB: '', winner: null, scoreA: 0, scoreB: 0, status: 'scheduled' });
            setIsAddingMatch(false);
            openModal('Match added successfully!', null, false, '', '', null, false);
        } catch (err) {
            console.error('Error adding match:', err);
            openModal('Failed to add match. Please try again.', null, false, '', '', null, false);
        }
    };

    const handleUpdateMatch = async (matchId) => {
        // --- MODIFICATION: Prevent action if in readOnly mode ---
        if (readOnly) {
            openModal('This action is not allowed in view-only mode.', null, false, '', '', null, false);
            return;
        }

        // Basic validation for score inputs before update
        const parsedScoreA = parseInt(editMatchData.scoreA);
        const parsedScoreB = parseInt(editMatchData.scoreB);

        if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
            openModal('Invalid Input', null, false, '', '', null, false); // Simplified call for error
            return;
        }

        try {
            const matchRef = doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchId);
            const updatedData = {
                scoreA: parsedScoreA,
                scoreB: parsedScoreB,
                status: 'completed',
                winner: parsedScoreA > parsedScoreB ? editMatchData.teamA : parsedScoreA < parsedScoreB ? editMatchData.teamB : 'Draw' // Determine winner
            };
            await updateDoc(matchRef, updatedData);
            setEditingMatchId(null); // Exit editing mode
            setEditMatchData({}); // Clear edit data
            openModal('Match updated successfully!', null, false, '', '', null, false);
        } catch (err) {
            console.error('Error updating match:', err);
            openModal('Failed to update match. Please try again.', null, false, '', '', null, false);
        }
    };

    const handleDeleteMatch = async (matchId) => {
        // --- MODIFICATION: Prevent action if in readOnly mode ---
        if (readOnly) {
            openModal('This action is not allowed in view-only mode.', null, false, '', '', null, false);
            return;
        }

        openModal('Are you sure you want to delete this match?', async () => { // Use custom modal
            try {
                await deleteDoc(doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchId));
                openModal('Match deleted successfully!', null, false, '', '', null, false);
            } catch (err) {
                console.error('Error deleting match:', err);
                openModal('Failed to delete match. Please try again.', null, false, '', '', null, false);
            }
        });
    };

    const startEditing = (match) => {
        // --- MODIFICATION: Prevent editing if in readOnly mode ---
        if (readOnly) {
            openModal('Editing is not allowed in view-only mode.', null, false, '', '', null, false);
            return;
        }
        setEditingMatchId(match.id);
        // Ensure scores are treated as strings for input value, convert null/undefined to empty string
        setEditMatchData({
            ...match,
            scoreA: match.scoreA !== undefined && match.scoreA !== null ? String(match.scoreA) : '',
            scoreB: match.scoreB !== undefined && match.scoreB !== null ? String(match.scoreB) : ''
        });
    };

    const cancelEditing = () => {
        setEditingMatchId(null);
        setEditMatchData({});
    };

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            {/* Top Navigation Bar */}
            {/* --- MODIFICATION: Conditionally render/adjust nav links based on readOnly --- */}
            {!readOnly ? (
                <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                    <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                    <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                    <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
                </div>
            ) : (
                <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                    <Link to={`/share/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                    <Link to={`/share/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                    <Link to={`/share/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    <Link to={`/share/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
                </div>
            )}

            <div className="p-6 max-w-5xl mx-auto w-full">
                <h2 className="text-2xl font-bold mb-4 text-center">🏆 Knockout Stage: {tournamentName}</h2>

                {/* --- MODIFICATION: Conditionally render Add New Match button and form --- */}
                {!readOnly && (
                    <button
                        onClick={() => setIsAddingMatch(!isAddingMatch)}
                        className="bg-blue-600 text-white px-4 py-2 rounded mb-4 hover:bg-blue-700 transition-colors"
                    >
                        {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
                    </button>
                )}

                {isAddingMatch && !readOnly && ( // Ensure form is only shown if not readOnly
                    <div className="mb-6 bg-gray-100 dark:bg-gray-800 p-4 rounded shadow-md">
                        <h3 className="text-lg font-semibold mb-3">Add New Knockout Match</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <input
                                type="text"
                                placeholder="Round Name (e.g., Quarter-Finals)"
                                value={newMatch.round}
                                onChange={e => setNewMatch({ ...newMatch, round: e.target.value })}
                                className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="Team A Name"
                                value={newMatch.teamA}
                                onChange={e => setNewMatch({ ...newMatch, teamA: e.target.value })}
                                className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="Team B Name"
                                value={newMatch.teamB}
                                onChange={e => setNewMatch({ ...newMatch, teamB: e.target.value })}
                                className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                {authLoading && !readOnly ? ( // Only show auth loading if not in readOnly mode
                    <p className="text-center text-gray-500 py-8">Authenticating user...</p>
                ) : loading ? (
                    <p className="text-gray-500">Loading knockout matches...</p>
                ) : error ? (
                    <p className="text-red-500">Error: {error}</p>
                ) : rounds.length === 0 ? (
                    <p className="text-gray-500">
                        No knockout matches configured for this tournament yet.
                        {!readOnly && " Use the 'Add New Match' button to create them."}
                    </p>
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
                                            {/* --- MODIFICATION: Conditionally render edit form or display mode --- */}
                                            {editingMatchId === match.id && !readOnly ? ( // Only allow editing if not readOnly
                                                // Edit form for a match
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{editMatchData.teamA}</p>
                                                        <input
                                                            type="number"
                                                            value={editMatchData.scoreA}
                                                            onChange={e => setEditMatchData({ ...editMatchData, scoreA: e.target.value })}
                                                            className="w-16 px-2 py-1 border rounded text-center dark:bg-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                        <span> - </span>
                                                        <input
                                                            type="number"
                                                            value={editMatchData.scoreB}
                                                            onChange={e => setEditMatchData({ ...editMatchData, scoreB: e.target.value })}
                                                            className="w-16 px-2 py-1 border rounded text-center dark:bg-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="0"
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
                                                    {/* --- MODIFICATION: Conditionally render action buttons --- */}
                                                    {!readOnly && (
                                                        <div className="flex gap-2 mt-3 justify-end">
                                                            {match.status !== 'completed' && ( // Only show edit if not completed
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
                                                    )}
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

            {/* Custom Modal Component (Inline) for this page's alerts/confirms */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
                        {/* Renders custom content if provided, otherwise default message/input */}
                        {modalCustomContent || (
                            <>
                                <p className="text-lg font-semibold mb-4">{modalMessage}</p>
                                {modalInputRequired && !readOnly && ( // Conditional rendering for generic input field(s), only if not readOnly
                                    <div className="flex flex-col gap-2 mb-4">
                                        {modalInputLabel.split(',').map((label, index) => (
                                            <input
                                                key={index}
                                                type="text" // Using type="text" for generic string input here
                                                placeholder={label.trim()}
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
                            {/* --- MODIFICATION: Only show confirm button if a confirm action is provided AND not in readOnly mode --- */}
                            {modalConfirmAction && modalShowConfirmButton && !readOnly && (
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
                                {modalConfirmAction && modalShowConfirmButton && !readOnly ? 'Cancel' : 'Close'} {/* Text changes based on confirm action presence and readOnly state */}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}