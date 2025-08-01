// src/pages/KnockoutPage.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth'; // Assuming useAuth is in this path

// --- Helper Components (Defined within the same file for simplicity) ---

// Modal Component
const Modal = ({ isOpen, onClose, onConfirm, title, message, children, showConfirmButton }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-11/12 max-w-lg mx-auto transform transition-all duration-300 scale-100 opacity-100">
                <div className="flex justify-between items-center border-b pb-3 mb-4 border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-semibold">&times;</button>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mb-6">
                    {message && <p className="mb-4">{message}</p>}
                    {children}
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    {showConfirmButton && onConfirm && (
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Score Input Modal Content Component
const ScoreInputModalContent = React.forwardRef(({ fixture, initialScoreA, initialScoreB }, ref) => {
    const [scoreA, setScoreA] = useState(initialScoreA ?? '');
    const [scoreB, setScoreB] = useState(initialScoreB ?? '');

    // Expose methods to parent component via ref
    React.useImperativeHandle(ref, () => ({
        getScoreA: () => scoreA,
        getScoreB: () => scoreB,
    }));

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-lg text-gray-900 dark:text-white">{fixture.teamA}</span>
                <input
                    type="number"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="w-20 p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    min="0"
                />
            </div>
            <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-lg text-gray-900 dark:text-white">{fixture.teamB}</span>
                <input
                    type="number"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="w-20 p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    min="0"
                />
            </div>
        </div>
    );
});


// --- KnockoutPage Component ---
const KnockoutPage = () => { // Corrected syntax for component definition
    const { id: tournamentId } = useParams();
    const [searchParams] = useSearchParams();
    const shareId = searchParams.get('shareId'); // Get the shareId from the URL
    const { user, loading: authLoading } = useAuth(); // Corrected useAuth import
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
    const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true); // Default to true
    const [modalContent, setModalContent] = useState(null);
    const [modalConfirmAction, setModalConfirmAction] = useState(null);
    const scoreInputRef = useRef(null);

    const [teams, setTeams] = useState([]); // New state to fetch all teams for selection

    // Refs for SVG drawing
    const matchRefs = useRef(new Map()); // Stores refs for each match box (key: match.id, value: DOM element)
    const svgContainerRef = useRef(null); // Ref for the div that wraps all round columns, for relative positioning
    const [svgLines, setSvgLines] = useState([]); // State to store SVG path data

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
    const isViewOnly = useMemo(() => {
        // If shareId is present, OR if user is not logged in AND tournament is public
        return (!!shareId) || (!user && (tournamentDetails?.isPublic || false));
    }, [shareId, user, tournamentDetails]);


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
                    // The isViewOnly state will be re-calculated by its useMemo based on tournamentDetails
                } else {
                    setError("Tournament not found.");
                    setLoading(false);
                    return;
                }

                // Set up real-time listener for knockout matches
                const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);
                // Order by round (e.g., "Quarter-Finals", "Semi-Finals") and then by teamA name for consistent display
                // Ensure 'roundOrder' is properly set in your matches, e.g., 0 for R32, 1 for R16, 2 for QF, 3 for SF, 4 for Final
                const q = query(matchesCollectionRef, orderBy('roundOrder', 'asc'), orderBy('teamA', 'asc')); 

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
    }, [tournamentId, user, authLoading, shareId, tournamentDetails?.isPublic]);


    // Utility to get round name and order based on the number of teams *in that round*
    // For example, 2 teams for Final, 4 for Semi-Finals (i.e., 2 matches), etc.
    const getRoundDetails = useCallback((numTeamsInRound) => {
        if (numTeamsInRound <= 0) return { name: 'Unknown', order: 99 };
        // The numTeamsInRound refers to the number of *teams* competing in that specific round.
        // e.g., for 8 teams total, it's Round of 8 (Quarter-Finals).
        // For 4 teams total, it's Round of 4 (Semi-Finals).
        // This makes it simpler for calculating the next round based on winners.
        switch (numTeamsInRound) {
            case 2: return { name: 'Final', order: 4 };
            case 4: return { name: 'Semi-Finals', order: 3 };
            case 8: return { name: 'Quarter-Finals', order: 2 };
            case 16: return { name: 'Round of 16', order: 1 };
            case 32: return { name: 'Round of 32', order: 0 };
            default: return { name: `Round of ${numTeamsInRound}`, order: 99 };
        }
    }, []);

    // Group matches by round for display
    const groupedRounds = useMemo(() => {
        return matches.reduce((acc, match) => {
            const roundName = match.round || 'Unnamed Round';
            if (!acc[roundName]) {
                acc[roundName] = [];
            }
            acc[roundName].push(match);
            return acc;
        }, {});
    }, [matches]);

    // Sort round names for consistent display order
    const sortedRoundNames = useMemo(() => {
        return Object.keys(groupedRounds).sort((a, b) => {
            // Find the order of the *current round* based on how many matches are in it.
            // The length of the array `groupedRounds[a]` gives the number of matches in that round.
            // Each match involves 2 teams, so `length * 2` gives the total teams that started that round.
            const orderA = getRoundDetails(groupedRounds[a].length * 2).order;
            const orderB = getRoundDetails(groupedRounds[b].length * 2).order;
            return orderA - orderB;
        });
    }, [groupedRounds, getRoundDetails]);

    // New function to automatically determine qualifying teams and generate the initial bracket
    const generateAutomaticInitialBracket = async () => {
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to generate brackets.', false);
            return;
        }

        if (tournamentDetails.type !== 'Multi-Phase') {
            openModal('Not a Multi-Phase Tournament', 'Automatic bracket generation is only available for Multi-Phase tournaments.', false);
            return;
        }
        
        const numQualifiersPerGroup = tournamentDetails.qualifiersPerGroup || 0;
        const definedGroups = tournamentDetails.groups || [];

        if (numQualifiersPerGroup <= 0) {
            openModal('Invalid Qualifiers Setting', 'Please set the "Teams to Qualify Per Group" in Tournament Settings to a number greater than 0.', false);
            return;
        }

        if (definedGroups.length === 0) {
            openModal('Missing Groups', 'No groups defined for this Multi-Phase tournament. Please define groups (e.g., Group A, Group B) in Tournament Settings first.', false);
            return;
        }

        const qualifiedTeamsFromGroups = [];
        let hasUncompletedGroupFixtures = false;

        for (const groupName of definedGroups) {
            // Fetch leaderboard data for this specific group
            const leaderboardQuery = query(
                collection(db, `tournaments/${tournamentId}/leaderboard`),
                where('group', '==', groupName), // Assuming leaderboard docs have a 'group' field
                orderBy('points', 'desc'),
                orderBy('goalDifference', 'desc'),
                orderBy('goalsFor', 'desc')
            );
            const leaderboardSnap = await getDocs(leaderboardQuery);
            const groupStandings = leaderboardSnap.docs.map(doc => doc.data());

            // Check if all fixtures for this group are completed
            const groupFixturesQuery = query(
                collection(db, `tournaments/${tournamentId}/fixtures`),
                where('groupId', '==', groupName)
            );
            const groupFixturesSnap = await getDocs(groupFixturesQuery);
            const allGroupFixtures = groupFixturesSnap.docs.map(doc => doc.data());
            const completedGroupFixtures = allGroupFixtures.filter(f => f.status === 'completed');

            if (completedGroupFixtures.length < allGroupFixtures.length) {
                hasUncompletedGroupFixtures = true;
                break; // Exit early if any group has uncompleted fixtures
            }


            // Take top N from each group
            const topTeamsInGroup = groupStandings.slice(0, numQualifiersPerGroup);
            if (topTeamsInGroup.length < numQualifiersPerGroup) {
                 openModal('Not Enough Qualified Teams', `Group "${groupName}" does not have enough teams or completed matches to qualify ${numQualifiersPerGroup} teams. Ensure all group matches are played and enough teams are present.`, false);
                 return;
            }
            qualifiedTeamsFromGroups.push(...topTeamsInGroup.map(team => ({ id: team.id, name: team.name })));
        }

        if (hasUncompletedGroupFixtures) {
            openModal('Uncompleted Group Fixtures', 'Some group stage matches are not yet completed. Please complete all group stage fixtures before generating the knockout bracket.', false);
            return;
        }


        if (qualifiedTeamsFromGroups.length < 2) {
            openModal('Not Enough Qualifiers', 'Not enough teams qualified from the group stage to generate a bracket. Ensure teams have completed matches in groups and your qualification settings are correct.', false);
            return;
        }

        const bracketSize = qualifiedTeamsFromGroups.length;
        if (![2, 4, 8, 16, 32].includes(bracketSize)) {
            openModal('Invalid Qualification Count', `The total number of qualified teams (${bracketSize}) is not a valid bracket size (2, 4, 8, 16, 32). Please adjust your "Teams to Qualify Per Group" setting or the number of groups to form a valid bracket.`, false);
            return;
        }

        const initialRoundDetails = getRoundDetails(bracketSize);
        // Check if knockout matches already exist (to prevent re-generating if not needed)
        const existingKnockoutMatchesQuery = query(collection(db, `tournaments/${tournamentId}/knockoutMatches`));
        const existingKnockoutMatchesSnap = await getDocs(existingKnockoutMatchesQuery);
        if (!existingKnockoutMatchesSnap.empty) {
            openModal('Bracket Already Exists', 'A knockout bracket already exists. If you wish to re-generate, please delete existing knockout matches manually first.', false);
            return;
        }


        openModal(
            'Confirm Automatic Bracket Generation',
            `This will generate a new ${bracketSize}-team knockout bracket starting with ${initialRoundDetails.name} based on the top ${numQualifiersPerGroup} teams from each group. Are you sure?`,
            true,
            null,
            async () => {
                try {
                    const batch = writeBatch(db);
                    const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);

                    // Shuffle teams to randomize initial pairings
                    const shuffledTeams = [...qualifiedTeamsFromGroups].sort(() => Math.random() - 0.5);

                    // Create initial round matches
                    for (let i = 0; i < shuffledTeams.length; i += 2) {
                        const newMatchRef = doc(matchesCollectionRef); // Let Firestore auto-generate ID
                        batch.set(newMatchRef, {
                            round: initialRoundDetails.name,
                            roundOrder: initialRoundDetails.order,
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
                    openModal('Success', `Successfully generated ${bracketSize}-team knockout bracket automatically!`, false);
                } catch (err) {
                    console.error('Error generating automatic knockout bracket:', err);
                    openModal('Error', 'Failed to generate automatic knockout bracket. Please try again.', false);
                }
            }
        );
    };


    // Handle adding a new knockout match (for manual entry)
    const handleAddMatch = async () => {
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to add matches.', false);
            return;
        }
        if (!newMatch.round.trim() || !newMatch.teamA.trim() || !newMatch.teamB.trim()) {
            openModal('Validation Error', 'Please fill in all match details.', false);
            return;
        }
        // Assign a dummy round order for manual matches, or ask user for it
        // For simplicity, let's assign a very high order so they appear last or outside the main flow
        const manualRoundOrder = 100; 
        try {
            await addDoc(collection(db, `tournaments/${tournamentId}/knockoutMatches`), {
                ...newMatch,
                roundOrder: manualRoundOrder, 
                scoreA: null, 
                scoreB: null,
                status: 'scheduled'
            });
            setNewMatch({ round: '', teamA: '', teamB: '', winner: null, scoreA: null, scoreB: null, status: 'scheduled' });
            setIsAddingMatch(false); // Hide the form after successful addition
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
                openModal('Draw in Knockout', 'A draw is not typically allowed in knockout matches. Please ensure one team is declared a winner (e.g., via penalty shootout).', false);
                return;
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

    // New: Seed Next Round Functionality
    const handleSeedNextRound = async () => {
        if (!tournamentDetails || isViewOnly || user?.uid !== tournamentOwnerId) {
            openModal('Access Denied', 'You do not have permission to seed the next round.', false);
            return;
        }

        // Find the latest completed round
        const completedMatches = matches.filter(m => m.status === 'completed' && m.winner !== null && m.winner !== 'Draw');
        if (completedMatches.length === 0) {
            openModal('No Completed Matches', 'No matches have been completed to seed the next round. Complete matches in the current round first.', false);
            return;
        }

        // Group completed matches by round to find the latest round
        const completedMatchesByRound = completedMatches.reduce((acc, match) => {
            if (!acc[match.roundOrder]) {
                acc[match.roundOrder] = [];
            }
            acc[match.roundOrder].push(match);
            return acc;
        }, {});

        const sortedCompletedRoundOrders = Object.keys(completedMatchesByRound).map(Number).sort((a, b) => a - b);
        const latestCompletedRoundOrder = sortedCompletedRoundOrders[sortedCompletedRoundOrders.length - 1];
        const matchesInLatestRound = completedMatchesByRound[latestCompletedRoundOrder];

        if (matchesInLatestRound.length % 2 !== 0) {
            openModal('Invalid Round State', 'The number of winners in the last round is odd. Cannot seed next round. Ensure all matches in the current round have a winner and there is an even number of winners.', false);
            return;
        }

        const winners = matchesInLatestRound.map(m => m.winner).filter(Boolean);
        if (winners.length === 0) {
            openModal('No Winners', 'No winners found in the latest completed round to seed the next round.', false);
            return;
        }
        
        // Check if the next round already has matches for these winners.
        // This is important to prevent duplicate seeding.
        // Get details of the next round.
        const nextRoundOrder = latestCompletedRoundOrder + 1;
        const nextRoundDetails = getRoundDetails(winners.length); // Calculate based on winners count
        const nextRoundName = nextRoundDetails.name;

        // Check if matches for the next round (with current winners) already exist.
        const existingNextRoundMatchesQuery = query(
            collection(db, `tournaments/${tournamentId}/knockoutMatches`),
            where('roundOrder', '==', nextRoundOrder)
        );
        const existingNextRoundMatchesSnap = await getDocs(existingNextRoundMatchesQuery);
        if (!existingNextRoundMatchesSnap.empty) {
             openModal('Next Round Already Seeded', `Matches for the "${nextRoundName}" round already exist.`, false);
             return;
        }


        openModal(
            'Confirm Seed Next Round',
            `This will create new matches for the "${nextRoundName}" round based on winners from the previous round. Are you sure?`,
            true,
            null,
            async () => {
                try {
                    const batch = writeBatch(db);
                    const matchesCollectionRef = collection(db, `tournaments/${tournamentId}/knockoutMatches`);

                    const shuffledWinners = [...winners].sort(() => Math.random() - 0.5); // Randomize pairings for next round

                    for (let i = 0; i < shuffledWinners.length; i += 2) {
                        const newMatchRef = doc(matchesCollectionRef);
                        batch.set(newMatchRef, {
                            round: nextRoundName,
                            roundOrder: nextRoundOrder,
                            teamA: shuffledWinners[i],
                            teamB: shuffledWinners[i + 1],
                            winner: null,
                            scoreA: null,
                            scoreB: null,
                            status: 'scheduled'
                        });
                    }

                    await batch.commit();
                    closeModal();
                    openModal('Success', `Successfully seeded ${shuffledWinners.length / 2} matches for the ${nextRoundName} round!`, false);
                } catch (err) {
                    console.error('Error seeding next round:', err);
                    openModal('Error', 'Failed to seed next round. Please try again.', false);
                }
            }
        );
    };

    // Function to draw SVG lines that connect the bracket
    const drawBracketLines = useCallback(() => {
        const lines = [];
        if (!svgContainerRef.current) {
            setSvgLines([]); // Clear lines if container not ready
            return;
        }

        const containerRect = svgContainerRef.current.getBoundingClientRect();
        // Use container's position to make coordinates relative to the SVG.
        // The SVG is positioned absolutely inside svgContainerRef, so its top-left is (0,0) within that container.
        const offsetX = containerRect.left;
        const offsetY = containerRect.top;

        const getMatchRect = (id) => {
            const el = matchRefs.current.get(id);
            if (el) {
                const rect = el.getBoundingClientRect();
                return {
                    x: rect.left - offsetX,
                    y: rect.top - offsetY,
                    width: rect.width,
                    height: rect.height,
                    center_y: (rect.top - offsetY) + (rect.height / 2)
                };
            }
            return null;
        };

        // Constants for line drawing geometry
        // These values are tuned for the visual appearance in your screenshot
        const horizontalSegment1 = 20; // Length of the first horizontal line segment from match box
        // const horizontalSegment2 = 40; // Length of the horizontal line segment from vertical connector to next box (not directly used for fixed spacing in current drawing logic for next match)

        sortedRoundNames.forEach((roundName, roundIndex) => {
            const currentRoundMatches = groupedRounds[roundName];
            
            // Iterate over pairs of matches in the current round
            for (let i = 0; i < currentRoundMatches.length; i += 2) {
                const match1 = currentRoundMatches[i];
                const match2 = currentRoundMatches[i + 1]; // Can be undefined if odd number of matches

                const rect1 = getMatchRect(match1.id);
                const rect2 = match2 ? getMatchRect(match2.id) : null;

                // Only draw if at least the first match box is available
                if (!rect1) continue; 

                // Determine line color based on match status
                const areBothMatchesCompleted = match1.status === 'completed' && (!match2 || match2.status === 'completed');
                const lineStrokeColor = areBothMatchesCompleted
                                        ? '#22C55E' // Green-500 for completed bracket part
                                        : (document.documentElement.classList.contains('dark') ? '#4B5563' : '#9CA3AF'); // Gray-600 dark / Gray-400 light

                const startX = rect1.x + rect1.width; // Right edge of match1 (and match2 if it exists)
                const midY1 = rect1.center_y;          // Center Y of match1

                // X-coordinate where the vertical connector will be
                // It's usually halfway between the end of current box and start of next box's column,
                // but since the columns are dynamically positioned with flexbox, we can just use a fixed offset.
                const x_vertical_junction = startX + horizontalSegment1; 

                if (rect2) { // Standard pair of matches (like A vs B, C vs D in your image)
                    const midY2 = rect2.center_y;          // Center Y of match2

                    const winnerLineY = (midY1 + midY2) / 2; // Center Y for the line representing the winner

                    // Path 1: Horizontal line from match1 to vertical junction
                    lines.push({ 
                        d: `M ${startX} ${midY1} H ${x_vertical_junction}`, 
                        stroke: lineStrokeColor,
                    });

                    // Path 2: Horizontal line from match2 to vertical junction
                    lines.push({ 
                        d: `M ${startX} ${midY2} H ${x_vertical_junction}`, 
                        stroke: lineStrokeColor,
                    });
                    
                    // Path 3: Vertical line connecting the two horizontal lines
                    lines.push({ 
                        d: `M ${x_vertical_junction} ${midY1} V ${midY2}`, 
                        stroke: lineStrokeColor,
                    });

                    // Path 4: Line from the midpoint of the vertical connector, extending to the next round's match
                    // Only draw this if it's not the final round
                    if (roundIndex < sortedRoundNames.length - 1) {
                        const nextRoundName = sortedRoundNames[roundIndex + 1];
                        const nextRoundMatches = groupedRounds[nextRoundName];
                        const targetMatch = nextRoundMatches ? nextRoundMatches[Math.floor(i / 2)] : null; // The winner of this pair proceeds to this match

                        if (targetMatch) {
                            const targetRect = getMatchRect(targetMatch.id);
                            if (targetRect) {
                                const targetX = targetRect.x; // Left edge of the next match box
                                lines.push({ 
                                    d: `M ${x_vertical_junction} ${winnerLineY} H ${targetX}`, 
                                    stroke: lineStrokeColor,
                                });
                            }
                        } else {
                            // Fallback: if no target match (e.g., incomplete bracket or uneven matches), extend horizontally
                            // This scenario might happen if the bracket generation is incomplete or irregular.
                            lines.push({ 
                                d: `M ${x_vertical_junction} ${winnerLineY} H ${x_vertical_junction + horizontalSegment1}`, // extend a bit more
                                stroke: lineStrokeColor,
                            });
                        }
                    } else { // This is the final round, extend winner line
                        lines.push({ 
                            d: `M ${x_vertical_junction} ${winnerLineY} H ${x_vertical_junction + horizontalSegment1}`, 
                            stroke: lineStrokeColor,
                        });
                    }

                } else { // This case handles an unpaired match or the single final winner
                    // If it's the very last match in the whole bracket (the winner of the final)
                    if (roundIndex === sortedRoundNames.length - 1 && currentRoundMatches.length === 1) {
                         lines.push({ 
                            d: `M ${startX} ${midY1} H ${startX + horizontalSegment1}`, // Extend slightly to the right of the last box
                            stroke: lineStrokeColor,
                        });
                    } else {
                        // For any other unpaired match (shouldn't typically happen in a balanced bracket, but for robustness)
                        // Or if a match is standalone but not the final winner (e.g., 3rd place playoff)
                        lines.push({ 
                            d: `M ${startX} ${midY1} H ${x_vertical_junction + horizontalSegment1}`, 
                            stroke: lineStrokeColor,
                        });
                    }
                }
            }
        });
        setSvgLines(lines);
    }, [sortedRoundNames, groupedRounds]);

    // Effect to redraw lines on data change, window resize, or component updates
    useEffect(() => {
        // Debounce resize events for performance
        let resizeTimer;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(drawBracketLines, 100); // 100ms debounce
        };
        
        window.addEventListener('resize', handleResize);

        // Also run once on mount and when relevant data changes
        // Use a small delay to ensure DOM elements (match boxes) have rendered and refs are populated
        // This is crucial for getBoundingClientRect to be accurate.
        const initialDrawTimer = setTimeout(drawBracketLines, 50); 

        return () => {
            clearTimeout(resizeTimer); // Clear any pending debounced calls on unmount
            clearTimeout(initialDrawTimer); // Clear initial draw timer too
            window.removeEventListener('resize', handleResize);
        };
    }, [matches, sortedRoundNames, groupedRounds, drawBracketLines]); // Depend on matches and memoized data for redraws


    const commonNavLinks = (
        <div className="bg-red-600 text-white p-4 font-bold text-lg flex flex-wrap justify-around sm:flex-nowrap">
            <Link to={isViewOnly ? `/tournament/${tournamentId}?shareId=${shareId}` : `/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">LEAGUE</Link>
            <Link to={isViewOnly ? `/tournament/${tournamentId}/fixtures?shareId=${shareId}` : `/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">FIXTURES</Link>
            <Link to={isViewOnly ? `/tournament/${tournamentId}/players?shareId=${shareId}` : `/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">TOP SCORERS</Link>
            <Link to={isViewOnly ? `/tournament/${tournamentId}/stats?shareId=${shareId}` : `/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">STATS</Link>
            <Link to={isViewOnly ? `/tournament/${tournamentId}/knockout?shareId=${shareId}` : `/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">KNOCKOUT</Link>
            <Link to={isViewOnly ? `/tournament/${tournamentId}/ai-prediction?shareId=${shareId}` : `/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors text-sm sm:text-base">AI PREDICTION</Link>
        </div>
    );

    // Group teams by their assigned group for display in the modal (though not used in this specific KnockoutPage UI)
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

    // Determine if the current user is the owner
    const isOwner = user && user.uid === tournamentOwnerId;

    return (
        <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
            {commonNavLinks}

            <div className="flex-grow p-4 sm:p-6 lg:p-8 w-full overflow-x-auto">
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
                    🏆 Knockout Bracket ({tournamentName})
                </h2>

                {/* Tournament Controls - only show if owner and not view only */}
                {!isViewOnly && isOwner && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
                        {tournamentDetails && tournamentDetails.type === 'Multi-Phase' && (
                            <button
                                onClick={generateAutomaticInitialBracket} // Changed to new automatic function
                                className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-purple-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                            >
                                Generate Initial Bracket
                            </button>
                        )}
                        <button
                            onClick={handleSeedNextRound}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            Seed Next Round
                        </button>
                        <button
                            onClick={() => setIsAddingMatch(!isAddingMatch)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
                        >
                            {isAddingMatch ? 'Hide Add Match Form' : '➕ Add New Match'}
                        </button>
                    </div>
                )}


                {isAddingMatch && !isViewOnly && isOwner && (
                    <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-white">Add New Knockout Match</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="roundName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Round Name</label>
                                <input
                                    type="text"
                                    id="roundName"
                                    placeholder="e.g., Quarter-Finals"
                                    value={newMatch.round}
                                    onChange={e => setNewMatch({ ...newMatch, round: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        {!isViewOnly && isOwner && " Use the 'Generate Initial Bracket' or 'Add New Match' button to create them."}
                    </p>
                ) : (
                    <div ref={svgContainerRef} className="relative flex justify-center flex-wrap md:flex-nowrap items-start w-full min-h-[400px]">
                        {/* SVG Overlay for drawing lines */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            {svgLines.map((line, index) => (
                                <path 
                                    key={index} 
                                    d={line.d} 
                                    stroke={line.stroke} 
                                    strokeWidth="2" 
                                    fill="none" 
                                    strokeLinejoin="round" 
                                    strokeLinecap="round" 
                                />
                            ))}
                        </svg>

                        {sortedRoundNames.map((roundName, roundIndex) => (
                            <div key={roundName}
                                className={`
                                    round-column flex flex-col items-center flex-shrink-0
                                    min-w-[250px] md:min-w-[280px] lg:min-w-[320px]
                                    mx-2 md:mx-4
                                    py-4
                                `}
                            >
                                <h3 className="text-lg sm:text-xl font-semibold mb-6 text-gray-800 dark:text-gray-200 text-center sticky top-0 bg-inherit z-10 w-full py-2">
                                    {roundName}
                                </h3>
                                {/* Matches for this round */}
                                <div className="flex flex-col w-full">
                                    {groupedRounds[roundName].map((match, matchIndex) => (
                                        <div key={match.id} className="relative w-full mb-6"> {/* Increased mb for spacing between matches */}
                                            {/* Match Box */}
                                            <div
                                                ref={el => matchRefs.current.set(match.id, el)} // Store ref for SVG drawing
                                                className={`
                                                    match-box flex flex-col items-center text-center p-4 rounded-lg shadow-lg border-2
                                                    ${match.status === 'completed'
                                                        ? (match.winner && match.winner !== 'Draw' ? 'border-green-500 dark:border-green-500' : 'border-orange-500 dark:border-orange-500')
                                                        : 'border-gray-400 dark:border-gray-600'
                                                    }
                                                    bg-white dark:bg-gray-700 transition-colors duration-200 w-full relative z-10
                                                `}
                                            >
                                                <p className="font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-1">{match.teamA}</p>
                                                <div className="w-full border-t border-gray-200 dark:border-gray-500 my-1"></div>
                                                <p className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">{match.teamB}</p>
                                                
                                                {match.status === 'completed' && match.scoreA !== null && match.scoreB !== null ? (
                                                    <p className="mt-2 text-xl font-extrabold text-green-700 dark:text-green-300">
                                                        {match.scoreA} - {match.scoreB}
                                                    </p>
                                                ) : (
                                                    <p className="mt-2 text-base text-yellow-600 dark:text-yellow-400 font-medium">Scheduled</p>
                                                )}
                                                {match.winner && match.winner !== 'Draw' && (
                                                    <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                        Winner: {match.winner}
                                                        {roundIndex === sortedRoundNames.length -1 && (
                                                            <span className="ml-2 text-yellow-500 text-xl inline-block align-middle">🏆</span> // Trophy for the final winner
                                                        )}
                                                    </p>
                                                )}

                                                {!isViewOnly && isOwner && (
                                                    <div className="flex flex-col sm:flex-row gap-2 mt-3 w-full text-sm">
                                                        <button
                                                            onClick={() => handleUpdateScores(match)}
                                                            className="flex-1 bg-yellow-500 text-white px-2 py-1.5 rounded-md hover:bg-yellow-600 transition-colors"
                                                        >
                                                            Update
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMatch(match.id)}
                                                            className="flex-1 bg-red-500 text-white px-2 py-1.5 rounded-md hover:bg-red-600 transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
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

export default KnockoutPage; // Ensure the main component is exported