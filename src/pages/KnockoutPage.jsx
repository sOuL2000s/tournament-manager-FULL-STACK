// src/pages/KnockoutPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal'; // Assuming you have a Modal component
import ScoreInputModalContent from '../components/ScoreInputModalContent'; // Import the new component

export default function KnockoutPage({ readOnly = false }) {
    const { id: tournamentId } = useParams();
    const [searchParams] = useSearchParams();
    const shareId = searchParams.get('shareId');
    const { user, loading: authLoading } = useAuth();
    const [tournamentName, setTournamentName] = useState('Loading...');
    const [matches, setMatches] = useState([]); // Renamed from 'rounds' to 'matches' for clarity
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tournamentOwnerId, setTournamentOwnerId] = useState(null);
    const [tournamentDetails, setTournamentDetails] = useState(null); // New state for tournament details

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
    const [modalConfirmAction, setModalConfirmAction] = useState(null);
    const scoreInputRef = useRef(null);

    const [teams, setTeams] = useState([]); // New state to fetch all teams for selection
    const [qualifyingTeams, setQualifyingTeams] = useState([]); // State for selected qualifying teams
    const [showQualifyingTeamsModal, setShowQualifyingTeamsModal] = useState(false);
    const [numQualifiers, setNumQualifiers] = useState(8); // Default for Quarter-Finals


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
    const isViewOnly = readOnly || (!!shareId) || (user && tournamentOwnerId && user.uid !== tournamentOwnerId);

    useEffect(() => {
        const fetchData = async () => {
            if (authLoading) return; // Wait for Firebase auth to load

            if (!tournamentId) {
                setError("No tournament ID provided.");
                setLoading(false);
                return;
            }

            try {
                // Fetch tournament details to get name, owner ID, and type
                const tournamentDocRef = doc(db, 'tournaments', tournamentId);
                const tournamentSnap = await getDoc(tournamentDocRef);

                if (tournamentSnap.exists()) {
                    const data = tournamentSnap.data();
                    setTournamentName(data.name);
                    setTournamentOwnerId(data.userId);
                    setTournamentDetails(data); // Store full tournament details
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

                // Set up real-time listener for teams to populate dropdowns
                const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
                const unsubscribeTeams = onSnapshot(query(teamsCollectionRef, orderBy('name', 'asc')), (snapshot) => {
                    setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }, (err) => {
                    console.error('Real-time listener error for teams:', err);
                });

                return () => {
                    unsubscribe(); // Cleanup knockout matches listener
                    unsubscribeTeams(); // Cleanup teams listener
                };

            } catch (err) {
                console.error("Error fetching tournament data:", err);
                setError("Failed to load tournament data.");
                setLoading(false);
            }
        };

        fetchData();
    }, [tournamentId, user, authLoading, readOnly, shareId]);


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

    // Function to generate initial knockout bracket based on selected teams
    const generateKnockoutBracket = async () => {
        // Check if tournamentDetails is loaded and if the user is the owner
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to generate brackets.', false);
            return;
        }

        if (qualifyingTeams.length < 2) {
            openModal('Validation Error', 'Please select at least two qualifying teams.', false);
            return;
        }

        const bracketSize = qualifyingTeams.length;
        if (![2, 4, 8, 16, 32].includes(bracketSize)) {
            openModal('Validation Error', `Number of qualifying teams must be a power of 2 (e.g., 2, 4, 8, 16, 32). You have ${bracketSize} teams.`, false);
            return;
        }

        const rounds = [];
        if (bracketSize === 2) rounds.push('Final');
        if (bracketSize === 4) rounds.push('Semi-Finals', 'Final');
        if (bracketSize === 8) rounds.push('Quarter-Finals', 'Semi-Finals', 'Final');
        if (bracketSize === 16) rounds.push('Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Final');
        // Add more rounds as needed for larger brackets

        openModal(
            'Confirm Bracket Generation',
            `This will delete ALL existing knockout matches and generate a new ${bracketSize}-team bracket. Are you sure?`,
            true,
            null,
            async () => {
                try {
                    const batch = writeBatch(db);
                    const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);

                    // Delete existing knockout matches
                    const existingMatchesSnapshot = await getDocs(matchesCollectionRef);
                    existingMatchesSnapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                    });

                    // Shuffle teams to randomize initial pairings
                    const shuffledTeams = [...qualifyingTeams].sort(() => Math.random() - 0.5);

                    // Create initial round matches (e.g., Quarter-Finals if 8 teams)
                    const initialRoundName = rounds[0];
                    for (let i = 0; i < shuffledTeams.length; i += 2) {
                        const newMatchRef = doc(matchesCollectionRef); // Let Firestore auto-generate ID
                        batch.set(newMatchRef, {
                            round: initialRoundName,
                            teamA: shuffledTeams[i].name,
                            teamB: shuffledTeams[i + 1].name,
                            winner: null,
                            scoreA: null,
                            scoreB: null,
                            status: 'scheduled'
                        });
                    }

                    await batch.commit();
                    closeModal();
                    openModal('Success', `Successfully generated ${bracketSize}-team knockout bracket!`, false);
                } catch (err) {
                    console.error('Error generating knockout bracket:', err);
                    openModal('Error', 'Failed to generate knockout bracket. Please try again.', false);
                }
            }
        );
    };

    // Handle adding a new knockout match
    const handleAddMatch = async () => {
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
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
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
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
    }, [isViewOnly, user, tournamentOwnerId, openModal, closeModal, tournamentId, tournamentDetails]);


    // Handle deleting a knockout match
    const handleDeleteMatch = async (matchId) => {
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
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

        openModal('Confirm Delete', 'Are you sure you want to delete this match?', true, null, confirmDeleteAction);
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

    // Group teams by their assigned group for display in the modal
    const groupedTeams = teams.reduce((acc, team) => {
        const group = team.group || 'Ungrouped';
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(team);
        return acc;
    }, {});

    const sortedGroupNames = Object.keys(groupedTeams).sort((a, b) => {
        if (a === 'Ungrouped') return 1;
        if (b === 'Ungrouped') return -1;
        return a.localeCompare(b);
    });

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

                {/* Tournament Controls */}
                {tournamentDetails && tournamentDetails.type === 'Multi-Phase' && !isViewOnly && user?.uid === tournamentOwnerId && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
                        <button
                            onClick={() => setShowQualifyingTeamsModal(true)}
                            className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-purple-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            Generate Knockout Bracket
                        </button>
                        <button
                            onClick={() => setIsAddingMatch(!isAddingMatch)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
                        </button>
                    </div>
                )}
                {tournamentDetails && tournamentDetails.type !== 'Multi-Phase' && !isViewOnly && user?.uid === tournamentOwnerId && (
                    <div className="mb-6 text-center">
                        <button
                            onClick={() => setIsAddingMatch(!isAddingMatch)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
                        </button>
                    </div>
                )}


                {isAddingMatch && !isViewOnly && user?.uid === tournamentOwnerId && (
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
                        {!isViewOnly && user?.uid === tournamentOwnerId && " Use the 'Add New Match' button to create them."}
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

                                            {!isViewOnly && user?.uid === tournamentOwnerId && (
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

            {/* Qualifying Teams Selection Modal */}
            {showQualifyingTeamsModal && (
                <Modal
                    isOpen={showQualifyingTeamsModal}
                    onClose={() => setShowQualifyingTeamsModal(false)}
                    onConfirm={generateKnockoutBracket}
                    title="Select Qualifying Teams"
                    message={`Select ${numQualifiers} teams to form the initial knockout bracket. (Must be a power of 2: 2, 4, 8, 16, 32)`}
                    confirmText="Generate Bracket"
                    showConfirmButton={qualifyingTeams.length === numQualifiers}
                >
                    <div className="p-4">
                        <div className="mb-4">
                            <label htmlFor="numQualifiers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Number of Qualifiers (e.g., 8 for Quarter-Finals)
                            </label>
                            <select
                                id="numQualifiers"
                                value={numQualifiers}
                                onChange={(e) => {
                                    setNumQualifiers(parseInt(e.target.value));
                                    setQualifyingTeams([]); // Reset selection when number of qualifiers changes
                                }}
                                className="w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={2}>2 (Final)</option>
                                <option value={4}>4 (Semi-Finals)</option>
                                <option value={8}>8 (Quarter-Finals)</option>
                                <option value={16}>16 (Round of 16)</option>
                                <option value={32}>32 (Round of 32)</option>
                            </select>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Selected ({qualifyingTeams.length}/{numQualifiers}):
                        </p>
                        <div className="max-h-80 overflow-y-auto border p-2 rounded-md bg-gray-50 dark:bg-gray-700">
                            {sortedGroupNames.map(groupName => (
                                <div key={groupName} className="mb-4">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">
                                        {groupName !== 'Ungrouped' ? `Group ${groupName}` : 'Ungrouped Teams'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {groupedTeams[groupName].map((team) => (
                                            <label key={team.id} className="flex items-center space-x-2 text-gray-800 dark:text-gray-200">
                                                <input
                                                    type="checkbox"
                                                    checked={qualifyingTeams.some(qt => qt.id === team.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            if (qualifyingTeams.length < numQualifiers) {
                                                                setQualifyingTeams(prev => [...prev, team]);
                                                            } else {
                                                                openModal('Selection Limit', `You can only select ${numQualifiers} teams.`, false);
                                                            }
                                                        } else {
                                                            setQualifyingTeams(prev => prev.filter(qt => qt.id !== team.id));
                                                        }
                                                    }}
                                                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                                />
                                                <span>{team.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {qualifyingTeams.length !== numQualifiers && (
                            <p className="text-red-500 text-sm mt-2">Please select exactly {numQualifiers} teams.</p>
                        )}
                    </div>
                </Modal>
            )}

            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                onConfirm={modalConfirmAction}
                title={modalTitle}
                message={modalMessage}
                showConfirmButton={modalShowConfirmButton}
            >
                {modalContent}
            </Modal>
        </div>
    );
}