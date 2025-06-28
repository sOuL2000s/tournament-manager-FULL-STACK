import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal'; // Assuming you have this Modal component

export default function FixturesPage() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [fixtures, setFixtures] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [error, setError] = useState(null);
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalContent, setModalContent] = useState(null);
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);

  // State for the score input within the modal
  const [tempScoreA, setTempScoreA] = useState('');
  const [tempScoreB, setTempScoreB] = useState('');

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
    // Reset temp scores when modal closes
    setTempScoreA('');
    setTempScoreB('');
  }, []);

  useEffect(() => {
    if (authLoading) {
      setLoadingFixtures(true);
      return;
    }

    if (!user || !user.uid) {
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
          if (user.uid && data.userId === user.uid) {
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
      }
    };
    fetchTournamentDetails();

    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    // Order by timestamp to ensure consistent week grouping
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
  }, [tournamentId, user, authLoading]);

  // IMPORTANT: The dependency array below for useCallback is crucial.
  // It ensures that 'handleUpdateScores' (and the 'modalConfirmAction' it creates)
  // gets re-created whenever 'tempScoreA' or 'tempScoreB' changes.
  // This allows the confirm action to access the most up-to-date values typed by the user.
  const handleUpdateScores = useCallback(async (fixtureId, currentScoreA, currentScoreB) => {
    const fixtureToUpdate = fixtures.find(f => f.id === fixtureId);
    if (!fixtureToUpdate) return;

    // Set initial values for the modal inputs
    setTempScoreA(currentScoreA !== undefined && currentScoreA !== null ? String(currentScoreA) : '');
    setTempScoreB(currentScoreB !== undefined && currentScoreB !== null ? String(currentScoreB) : '');

    openCustomModal(
      'Update Match Scores',
      `Enter scores for ${fixtureToUpdate.teamA} vs ${fixtureToUpdate.teamB}:`,
      async () => {
        // These values (tempScoreA, tempScoreB) are now correctly updated
        // because the useCallback ensures this function is fresh.
        const parsedScoreA = parseInt(tempScoreA);
        const parsedScoreB = parseInt(tempScoreB);

        if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
          // Re-open modal with error message, keeping input fields
          openCustomModal('Invalid Input', 'Please enter valid numbers for scores.', null, false, (
            <div className="flex flex-col gap-3 mb-4">
              <input
                type="number"
                placeholder="Score for Team A"
                value={tempScoreA}
                onChange={(e) => setTempScoreA(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Score for Team B"
                value={tempScoreB}
                onChange={(e) => setTempScoreB(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ));
          return;
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
          openCustomModal('Error', 'Failed to update scores. Please try again.', null, false, ( // Keep input fields on error
            <div className="flex flex-col gap-3 mb-4">
              <input
                type="number"
                placeholder="Score for Team A"
                value={tempScoreA}
                onChange={(e) => setTempScoreA(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Score for Team B"
                value={tempScoreB}
                onChange={(e) => setTempScoreB(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ));
        }
      },
      true, // showConfirmButton
      ( // Custom content for modal
        <div className="flex flex-col gap-3 mb-4">
          <input
            type="number"
            placeholder="Score for Team A"
            value={tempScoreA} // Bind value to state
            onChange={(e) => setTempScoreA(e.target.value)} // Update state on change
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Score for Team B"
            value={tempScoreB} // Bind value to state
            onChange={(e) => setTempScoreB(e.target.value)} // Update state on change
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
    );
  }, [fixtures, tournamentId, openCustomModal, closeCustomModal, tempScoreA, tempScoreB]); // This dependency array is KEY

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
        <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
          <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
          <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
          <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
          <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
          {/* Added TOP SCORERS link as per images */}
          <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        </div>
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
        <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
          <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
          <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
          <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
          <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
          {/* Added TOP SCORERS link as per images */}
          <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        </div>
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
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">PLAYERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
        {/* Added TOP SCORERS link as per images */}
        <Link to={`/tournament/${tournamentId}/top-scorers`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-8 text-center">📅 Tournament Fixtures ({tournamentName})</h2>

        {fixtures.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg py-10">
            No fixtures generated yet. Go to the <Link to={`/tournament/${tournamentId}`} className="text-blue-500 hover:underline">Tournament Admin</Link> page to generate them.
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
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleUpdateScores(fixture.id, fixture.scoreA, fixture.scoreB)}
                            className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors font-semibold text-xs uppercase"
                          >
                            Edit
                          </button>
                        </td>
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
