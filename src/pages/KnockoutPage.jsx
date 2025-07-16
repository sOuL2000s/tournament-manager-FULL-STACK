import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal'; // Assuming you have a Modal component
import ScoreInputModalContent from '../components/ScoreInputModalContent'; // Import the new component

export default function KnockoutPage({ readOnly = false }) {
    const { id: tournamentId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const [tournamentName, setTournamentName] = useState('Loading...');
    const [matches, setMatches] = useState([]); // Renamed from 'rounds' to 'matches' for clarity
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tournamentOwnerId, setTournamentOwnerId] = useState(null);

    const [isAddingMatch, setIsAddingMatch] = useState(false);
    const [newMatch, setNewMatch] = useState({
        round: '',
        teamA: '',
        teamB: '',
        winner: null,
        scoreA: null, // Use null initially for scores
        scoreB: null,
        status: 'scheduled'
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);
    const [modalContent, setModalContent] = useState(null);
    const [modalConfirmAction, setModalConfirmAction] = useState(null); // <--- Added this line
    const scoreInputRef = useRef(null);

    const openModal = useCallback((title, message, showConfirm, content = null, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalShowConfirmButton(showConfirm);
        setModalContent(content);
        setModalConfirmAction(() => confirmAction); // <--- Set the confirm action here
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setModalTitle('');
        setModalMessage('');
        setModalShowConfirmButton(true);
        setModalContent(null);
        setModalConfirmAction(null); // Clear confirm action on close
    }, []);

    // Determine if the current user has view-only access
    const isViewOnly = readOnly || (user && tournamentOwnerId && user.uid !== tournamentOwnerId);

    useEffect(() => {
        const fetchData = async () => {
            if (authLoading) return; // Wait for Firebase auth to load

            if (!tournamentId) {
                setError("No tournament ID provided.");
                setLoading(false);
                return;
            }

            try {
                // Fetch tournament details to get name and owner ID
                const tournamentDocRef = doc(db, 'tournaments', tournamentId);
                const tournamentSnap = await getDoc(tournamentDocRef);

                if (tournamentSnap.exists()) {
                    const data = tournamentSnap.data();
                    setTournamentName(data.name);
                    setTournamentOwnerId(data.userId);

                    // If not readOnly and current user is not the owner, set an error
                    if (!readOnly && user && data.userId !== user.uid) {
                        setError("You do not have permission to modify this tournament.");
                    }
                } else {
                    setError("Tournament not found.");
                    setLoading(false);
                    return;
                }

                // Set up real-time listener for knockout matches
                const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);
                // Order by round (e.g., "Quarter-Finals", "Semi-Finals") and then by teamA name for consistent display
                const q = query(matchesCollectionRef, orderBy('round', 'asc'), orderBy('teamA', 'asc'));

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedMatches = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        scoreA: doc.data().scoreA ?? null, // Ensure scores are null if not set
                        scoreB: doc.data().scoreB ?? null,
                    }));
                    setMatches(fetchedMatches);
                    setLoading(false);
                    setError(null); // Clear any previous errors if data loads successfully
                }, (err) => {
                    console.error('Real-time listener error for knockout matches:', err);
                    setError('Failed to load knockout matches. Please try again.');
                    setLoading(false);
                });

                return () => unsubscribe(); // Cleanup listener on unmount

            } catch (err) {
                console.error("Error fetching tournament data:", err);
                setError("Failed to load tournament data.");
                setLoading(false);
            }
        };

        fetchData();
    }, [tournamentId, user, authLoading, readOnly]);


    // Group matches by round for display
    const groupedRounds = matches.reduce((acc, match) => {
        const roundName = match.round || 'Unnamed Round';
        if (!acc[roundName]) {
            acc[roundName] = [];
        }
        acc[roundName].push(match);
        return acc;
    }, {});

    // Sort round names for consistent display order (e.g., Quarter-Finals, Semi-Finals, Final)
    const sortedRoundNames = Object.keys(groupedRounds).sort((a, b) => {
        const order = {
            'Round of 16': 1, 'Quarter-Finals': 2, 'Semi-Finals': 3, 'Final': 4, 'Winner': 5
        };
        return (order[a] || 99) - (order[b] || 99);
    });

    // Handle adding a new knockout match
    const handleAddMatch = async () => {
        if (isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to add matches.', false);
            return;
        }
        if (!newMatch.round.trim() || !newMatch.teamA.trim() || !newMatch.teamB.trim()) {
            openModal('Validation Error', 'Please fill in all match details.', false);
            return;
        }
        try {
            await addDoc(collection(db, `tournaments/${tournamentId}/knockoutMatches`), {
                ...newMatch,
                scoreA: null, // Ensure scores are saved as null initially
                scoreB: null,
                status: 'scheduled'
            });
            setNewMatch({ round: '', teamA: '', teamB: '', winner: null, scoreA: null, scoreB: null, status: 'scheduled' });
            setIsAddingMatch(false);
            openModal('Success', 'Match added successfully!', false);
        } catch (err) {
            console.error('Error adding match:', err);
            openModal('Error', 'Failed to add match. Please try again.', false);
        }
    };

    // Handle updating scores for an existing knockout match
    const handleUpdateScores = useCallback(async (matchToEdit) => {
        if (isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to update scores.', false);
            return;
        }

        const confirmAction = async () => {
            if (!scoreInputRef.current) {
                openModal('Error', 'Internal error: Cannot read scores. Please try again.', false);
                return;
            }
            const scoreA = scoreInputRef.current.getScoreA();
            const scoreB = scoreInputRef.current.getScoreB();

            const parsedScoreA = parseInt(scoreA);
            const parsedScoreB = parseInt(scoreB);

            if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
                openModal('Invalid Input', 'Please enter valid numbers for scores.', true,
                    <ScoreInputModalContent
                        ref={scoreInputRef}
                        fixture={matchToEdit}
                        initialScoreA={scoreA} // Pass back current input values
                        initialScoreB={scoreB}
                    />,
                    () => confirmAction() // Pass confirmAction itself for re-attempt
                );
                return;
            }

            let winner = null;
            if (parsedScoreA > parsedScoreB) {
                winner = matchToEdit.teamA;
            } else if (parsedScoreB > parsedScoreA) {
                winner = matchToEdit.teamB;
            } else {
                winner = 'Draw'; // Or handle tie-breaker for knockouts
            }

            try {
                const matchRef = doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchToEdit.id);
                await updateDoc(matchRef, {
                    scoreA: parsedScoreA,
                    scoreB: parsedScoreB,
                    status: 'completed',
                    winner: winner
                });
                closeModal();
                openModal('Success', 'Score updated successfully!', false);
            } catch (err) {
                console.error('Error updating scores:', err);
                openModal('Error', 'Failed to update scores. Please try again.', true,
                    <ScoreInputModalContent
                        ref={scoreInputRef}
                        fixture={matchToEdit}
                        initialScoreA={scoreA}
                        initialScoreB={scoreB}
                    />,
                    () => confirmAction() // Pass confirmAction itself for re-attempt
                );
            }
        };

        openModal(
            'Update Match Scores',
            `Enter scores for ${matchToEdit.teamA} vs ${matchToEdit.teamB}:`,
            true, // showConfirmButton
            <ScoreInputModalContent
                ref={scoreInputRef}
                fixture={matchToEdit}
                initialScoreA={matchToEdit.scoreA}
                initialScoreB={matchToEdit.scoreB}
            />,
            confirmAction // <--- Pass the confirm action here
        );
    }, [isViewOnly, user, tournamentOwnerId, openModal, closeModal, tournamentId]);


    // Handle deleting a knockout match
    const handleDeleteMatch = async (matchId) => {
        if (isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to delete matches.', false);
            return;
        }

        const confirmDeleteAction = async () => {
            try {
                await deleteDoc(doc(db, `tournaments/${tournamentId}/knockoutMatches`, matchId));
                closeModal();
                openModal('Success', 'Match deleted successfully!', false);
            } catch (err) {
                console.error('Error deleting match:', err);
                openModal('Error', 'Failed to delete match. Please try again.', false);
            }
        };

        openModal('Confirm Delete', 'Are you sure you want to delete this match?', true, null, confirmDeleteAction); // <--- Pass confirmDeleteAction here
    };

    const commonNavLinks = (
        <div className="bg-red-600 text-white p-4 font-bold text-lg flex flex-wrap justify-around sm:flex-nowrap">
            <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">LEAGUE</Link>
            <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">FIXTURES</Link>
            <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">TOP SCORERS</Link>
            <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">STATS</Link>
            <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">KNOCKOUT</Link>
            <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">AI PREDICTION</Link>
        </div>
    );

    if (loading || authLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                {commonNavLinks}
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                    <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">🏆 Knockout Bracket ({tournamentName})</h2>
                    <p className="text-center text-gray-500 py-8">Loading knockout bracket...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                {commonNavLinks}
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                    <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">🏆 Knockout Bracket ({tournamentName})</h2>
                    <p className="text-center text-red-500 py-8">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
            {commonNavLinks}

            <div className="flex-grow p-4 sm:p-6 lg:p-8 w-full overflow-x-auto">
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
                    🏆 Knockout Bracket ({tournamentName})
                </h2>

                {/* Add New Match Section */}
                {!isViewOnly && (
                    <div className="mb-6 text-center">
                        <button
                            onClick={() => setIsAddingMatch(!isAddingMatch)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
                        </button>
                    </div>
                )}

                {isAddingMatch && !isViewOnly && (
                    <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold mb-4 text-center">Add New Knockout Match</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="roundName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Round Name</label>
                                <input
                                    type="text"
                                    id="roundName"
                                    placeholder="e.g., Quarter-Finals"
                                    value={newMatch.round}
                                    onChange={e => setNewMatch({ ...newMatch, round: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="teamA" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team A</label>
                                <input
                                    type="text"
                                    id="teamA"
                                    placeholder="Team A Name"
                                    value={newMatch.teamA}
                                    onChange={e => setNewMatch({ ...newMatch, teamA: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="teamB" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team B</label>
                                <input
                                    type="text"
                                    id="teamB"
                                    placeholder="Team B Name"
                                    value={newMatch.teamB}
                                    onChange={e => setNewMatch({ ...newMatch, teamB: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="md:col-span-2 flex justify-center">
                                <button
                                    onClick={handleAddMatch}
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 font-semibold text-base w-full max-w-xs"
                                >
                                    Create Match
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {matches.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 text-lg py-10">
                        No knockout matches configured for this tournament yet.
                        {!isViewOnly && " Use the 'Add New Match' button to create them."}
                    </p>
                ) : (
                    <div className="flex flex-col sm:flex-row justify-center items-start gap-4 md:gap-6 lg:gap-8 p-2">
                        {sortedRoundNames.map((roundName, roundIndex) => (
                            <div key={roundName} className="flex flex-col items-center flex-shrink-0 w-full sm:w-1/2 md:w-1/3 lg:w-auto min-w-[200px] md:min-w-[250px] max-w-sm">
                                <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 text-center">{roundName}</h3>
                                <div className="space-y-4 w-full">
                                    {groupedRounds[roundName].map((match) => (
                                        <div
                                            key={match.id}
                                            className={`bg-white dark:bg-gray-700 p-4 rounded-lg shadow flex flex-col items-center text-center border
                                                ${match.status === 'completed' ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}
                                        >
                                            <div className="w-full">
                                                <p className="font-medium text-gray-900 dark:text-white break-words text-base sm:text-lg">{match.teamA}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300">vs</p>
                                                <p className="font-medium text-gray-900 dark:text-white break-words text-base sm:text-lg">{match.teamB}</p>
                                            </div>
                                            {match.status === 'completed' && match.scoreA !== null && match.scoreB !== null ? (
                                                <p className="mt-2 text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                                                    {match.scoreA} - {match.scoreB}
                                                </p>
                                            ) : (
                                                <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Scheduled</p>
                                            )}
                                            {match.winner && match.winner !== 'Draw' && (
                                                <p className="mt-2 text-sm sm:text-base font-semibold text-blue-600 dark:text-blue-400">
                                                    Winner: {match.winner}
                                                </p>
                                            )}

                                            {!isViewOnly && (
                                                <div className="flex flex-col sm:flex-row gap-2 mt-3 w-full">
                                                    <button
                                                        onClick={() => handleUpdateScores(match)}
                                                        className="flex-1 bg-yellow-500 text-white px-3 py-2 rounded-md text-sm hover:bg-yellow-600 transition-colors font-semibold"
                                                    >
                                                        Update Scores
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMatch(match.id)}
                                                        className="flex-1 bg-red-500 text-white px-3 py-2 rounded-md text-sm hover:bg-red-600 transition-colors font-semibold"
                                                    >
                                                        Delete
                                                    </button>
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

            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                onConfirm={modalConfirmAction} // This now correctly points to the state variable
                title={modalTitle}
                message={modalMessage}
                showConfirmButton={modalShowConfirmButton}
            >
                {modalContent}
            </Modal>
        </div>
    );
}