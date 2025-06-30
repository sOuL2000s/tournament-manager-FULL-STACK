import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal'; // Assuming you have this Modal component
import ScoreInputModalContent from '../components/ScoreInputModalContent'; // Import the new component

// --- MODIFICATION: Accept readOnly prop ---
export default function FixturesPage({ readOnly = false }) { // Default to false
    const { id: tournamentId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const [fixtures, setFixtures] = useState([]);
    const [loadingFixtures, setLoadingFixtures] = useState(true);
    const [error, setError] = useState(null);
    const [tournamentName, setTournamentName] = useState('Loading...');

    // Modal State for the shared Modal component
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalContent, setModalContent] = useState(null); // For custom content (e.g., input fields)
    const [modalConfirmAction, setModalConfirmAction] = useState(null);
    const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);

    // REF to access the ScoreInputModalContent component's methods (like getScoreA/B)
    const scoreInputRef = useRef(null);

    // Helper function to open the custom modal
    const openCustomModal = useCallback((title, message, confirmAction = null, showConfirm = true, content = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalConfirmAction(() => confirmAction); // Store the function directly
        setModalShowConfirmButton(showConfirm);
        setModalContent(content);
        setIsModalOpen(true);
    }, []);

    const closeCustomModal = useCallback(() => {
        setIsModalOpen(false);
        setModalTitle('');
        setModalMessage('');
        setModalContent(null);
        setModalConfirmAction(null);
        setModalShowConfirmButton(true);
    }, []);

    useEffect(() => {
        // --- MODIFICATION: Skip auth check if in readOnly mode ---
        if (!readOnly && authLoading) {
            setLoadingFixtures(true);
            return;
        }

        // --- MODIFICATION: Skip auth check if in readOnly mode ---
        if (!readOnly && (!user || !user.uid)) {
            setError("You must be logged in to view fixtures.");
            setLoadingFixtures(false);
            return;
        }

        if (!tournamentId) {
            setError("No tournament ID provided in the URL.");
            setLoadingFixtures(false);
            return;
        }

        const fetchTournamentDetails = async () => {
            try {
                const tournamentDocRef = doc(db, 'tournaments', tournamentId);
                const tournamentSnap = await getDoc(tournamentDocRef);
                if (tournamentSnap.exists()) {
                    const data = tournamentSnap.data();
                    // --- MODIFICATION: Only check userId if not in readOnly mode ---
                    // Allow read if readOnly is true, OR if user is authenticated and is the owner
                    if (readOnly || (user?.uid && data.userId === user.uid)) {
                        setTournamentName(data.name);
                    } else {
                        setTournamentName('Access Denied');
                        setError('You do not have permission to access this tournament.');
                    }
                } else {
                    setTournamentName('Tournament Not Found');
                    setError('The requested tournament does not exist.');
                }
            } catch (err) {
                console.error('Error fetching tournament details:', err);
                setTournamentName('Error');
                setError('Failed to load tournament details. Please try again.');
            } finally {
                setLoadingFixtures(false); // Ensure loading state is false after attempt
            }
        };
        fetchTournamentDetails();

        // --- MODIFICATION: Skip auth check for real-time fixtures if in readOnly mode ---
        if ((!readOnly && (!user || !user.uid)) || error) {
            // If already an error or not authenticated in non-readOnly mode, don't subscribe
            return;
        }

        const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
        const q = query(fixturesCollectionRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setFixtures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingFixtures(false);
        }, (err) => {
            console.error('Error fetching real-time fixtures:', err);
            setError('Failed to load fixtures. Please try again.');
            setLoadingFixtures(false);
        });

        return () => unsubscribe();
    }, [tournamentId, user, authLoading, error, readOnly]); // Add readOnly to dependencies

    // handleUpdateScores now uses the ScoreInputModalContent component
    const handleUpdateScores = useCallback(async (fixtureId, currentScoreA, currentScoreB) => {
        // --- MODIFICATION: Prevent action if in readOnly mode ---
        if (readOnly) {
            openCustomModal('This action is not allowed in view-only mode.', null, null, false); // No confirm button
            return;
        }

        const fixtureToUpdate = fixtures.find(f => f.id === fixtureId);
        if (!fixtureToUpdate) {
            console.warn(`Fixture with ID ${fixtureId} not found.`);
            return;
        }

        // Define the confirmation logic that will run when the modal's Confirm button is clicked
        const confirmAction = async () => {
            // Ensure scoreInputRef.current exists before attempting to read
            if (!scoreInputRef.current) {
                console.error("scoreInputRef.current is null. ScoreInputModalContent might not be mounted or ref not attached.");
                openCustomModal('Error', 'Internal error: Cannot read scores. Please try again.', null, false);
                return;
            }

            const parsedScoreA = parseInt(scoreInputRef.current.getScoreA());
            const parsedScoreB = parseInt(scoreInputRef.current.getScoreB());

            if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
                // Re-open modal with error message, don't close it, and retain input values
                openCustomModal('Invalid Input', 'Please enter valid numbers for scores.', null, true, ( // showConfirm = true for re-try
                    // Pass the current fixture and the *last known input values* from the ref
                    <ScoreInputModalContent
                        ref={scoreInputRef} // Re-attach ref for the new render of ScoreInputModalContent
                        fixture={fixtureToUpdate}
                        initialScoreA={scoreInputRef.current.getScoreA()}
                        initialScoreB={scoreInputRef.current.getScoreB()}
                    />
                ));
                return; // Important: Stop execution here if validation fails
            }

            try {
                const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);
                await updateDoc(fixtureRef, {
                    scoreA: parsedScoreA,
                    scoreB: parsedScoreB,
                    status: 'completed'
                });
                closeCustomModal(); // Close the score update modal on success
            } catch (err) {
                console.error('Error updating scores:', err);
                // Re-open modal with error, retain input values
                openCustomModal('Error', 'Failed to update scores. Please try again.', null, true, ( // showConfirm = true for re-try
                    // Pass the current fixture and the *last known input values* from the ref
                    <ScoreInputModalContent
                        ref={scoreInputRef} // Re-attach ref for the new render of ScoreInputModalContent
                        fixture={fixtureToUpdate}
                        initialScoreA={scoreInputRef.current.getScoreA()}
                        initialScoreB={scoreInputRef.current.getScoreB()}
                    />
                ));
            }
        };

        // Open the modal, passing ScoreInputModalContent as the 'content' prop
        openCustomModal(
            'Update Match Scores',
            `Enter scores for ${fixtureToUpdate.teamA} vs ${fixtureToUpdate.teamB}:`,
            confirmAction, // This is the logic to run on confirm
            true, // showConfirmButton
            // Pass the actual ScoreInputModalContent component as content, with a ref and initial scores
            <ScoreInputModalContent
                ref={scoreInputRef} // Attach ref here so parent can access its methods
                fixture={fixtureToUpdate} // Pass the full fixture object
                initialScoreA={currentScoreA}
                initialScoreB={currentScoreB}
            />
        );
    }, [fixtures, tournamentId, openCustomModal, closeCustomModal, readOnly]); // Add readOnly to dependencies

    // Group fixtures by week
    const groupedFixtures = fixtures.reduce((acc, fixture) => {
        let dateStr = '';
        // Ensure timestamp exists and is a Firestore Timestamp object
        if (fixture.timestamp && typeof fixture.timestamp.toDate === 'function') {
            dateStr = fixture.timestamp.toDate().toISOString().split('T')[0];
        } else if (fixture.date) {
            dateStr = new Date(fixture.date).toISOString().split('T')[0]; // Ensure date is parsed consistently
        }

        if (!acc[dateStr]) {
            acc[dateStr] = [];
        }
        acc[dateStr].push(fixture);
        return acc;
    }, {});

    // Sort dates to ensure weeks appear in order
    const sortedDates = Object.keys(groupedFixtures).sort((a, b) => new Date(a) - new Date(b));

    if (loadingFixtures || authLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                {/* --- MODIFICATION: Conditionally render/adjust nav links based on readOnly --- */}
                {!readOnly ? (
                    <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
                        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
                        <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    </div>
                ) : (
                    <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                        <Link to={`/share/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                        <Link to={`/share/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                        <Link to={`/share/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                        {/* You might also have a public stats page, or remove this if not needed for public */}
                        {/* <Link to={`/share/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link> */}
                    </div>
                )}
                <div className="p-6 max-w-4xl mx-auto w-full">
                    <h2 className="text-2xl font-bold mb-4 text-center">📅 Tournament Fixtures ({tournamentName})</h2>
                    <p className="text-center text-gray-500 py-8">Loading fixtures...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                {/* --- MODIFICATION: Conditionally render/adjust nav links based on readOnly --- */}
                {!readOnly ? (
                    <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
                        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
                        <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    </div>
                ) : (
                    <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                        <Link to={`/share/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                        <Link to={`/share/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                        <Link to={`/share/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    </div>
                )}
                <div className="p-6 max-w-4xl mx-auto w-full">
                    <h2 className="text-2xl font-bold mb-4 text-center">📅 Tournament Fixtures ({tournamentName})</h2>
                    <p className="text-red-500 text-center py-8">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
            {/* Top Navigation Bar */}
            {/* --- MODIFICATION: Conditionally render/adjust nav links based on readOnly --- */}
            {!readOnly ? (
                <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                    <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                    <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                    <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
                    <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
                    <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                </div>
            ) : (
                <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
                    <Link to={`/share/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
                    <Link to={`/share/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
                    <Link to={`/share/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
                    {/* Again, consider if you need a public stats page */}
                    {/* <Link to={`/share/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link> */}
                </div>
            )}

            <div className="p-6 max-w-4xl mx-auto">
                <h2 className="text-3xl font-extrabold mb-8 text-center">📅 Tournament Fixtures ({tournamentName})</h2>

                {fixtures.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 text-lg py-10">
                        No fixtures generated yet. {!readOnly && <>Go to the <Link to={`/tournament/${tournamentId}`} className="text-blue-500 hover:underline">Tournament Admin</Link> page to generate them.</>}
                    </p>
                ) : (
                    sortedDates.map((dateKey, index) => (
                        <div key={dateKey} className="mb-8">
                            <h3 className="bg-red-600 text-white text-xl font-bold py-3 px-4 rounded-t-lg shadow-md text-center">
                                Week {index + 1}
                            </h3>
                            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-b-lg shadow-lg">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Home Team
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Score
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Away Team
                                            </th>
                                            {/* --- MODIFICATION: Conditionally render Actions header --- */}
                                            {!readOnly && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Actions
                                            </th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {groupedFixtures[dateKey].map(fixture => (
                                            <tr key={fixture.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {fixture.teamA}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                    {fixture.status === 'completed' ? (
                                                        <span className="font-bold text-lg">
                                                            {fixture.scoreA} - {fixture.scoreB}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 dark:text-gray-400">0 - 0</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {fixture.teamB}
                                                </td>
                                                {/* --- MODIFICATION: Conditionally render Actions button --- */}
                                                {!readOnly && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleUpdateScores(fixture.id, fixture.scoreA, fixture.scoreB)}
                                                            className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors font-semibold text-xs uppercase"
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Reusable Modal Component */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeCustomModal}
                // --- MODIFICATION: Only allow onConfirm if not readOnly ---
                onConfirm={modalConfirmAction && !readOnly ? modalConfirmAction : null}
                title={modalTitle}
                message={modalMessage}
                // --- MODIFICATION: Only show confirm button if not readOnly AND modalShowConfirmButton is true ---
                showConfirmButton={modalShowConfirmButton && !readOnly}
            >
                {/* Render custom content (e.g., score input fields) inside the modal */}
                {modalContent}
            </Modal>
        </div>
    );
}