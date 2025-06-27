import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';

// Function to get week number (placed clearly at the top of the module to ensure availability)
const getWeekNumber = (d) => {
  let dateObj;
  // Try to parse input into a Date object from various possible formats
  if (d && typeof d.toDate === 'function') { // Firestore Timestamp
    dateObj = d.toDate();
  } else if (d && d.seconds !== undefined) { // Raw timestamp seconds
    dateObj = new Date(d.seconds * 1000);
  } else if (d instanceof Date) { // Already a Date object
    dateObj = d;
  } else { // Attempt to parse as a string
    dateObj = new Date(d);
  }

  // If dateObj is still invalid, return null to indicate an issue
  if (isNaN(dateObj.getTime())) {
    console.warn("Invalid date passed to getWeekNumber:", d);
    return null;
  }

  // ISO week date week numbering calculation
  dateObj.setUTCDate(dateObj.getUTCDate() + 4 - (dateObj.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dateObj - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

export default function FixturesPage() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');

  // Custom Modal Component states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalCustomContent, setModalCustomContent] = useState(null);

  const openModal = (message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '', customContent = null) => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction);
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalCustomContent(customContent);
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
    setModalCustomContent(null);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setModalInputValue('');
    setModalConfirmAction(null);
    setModalCustomContent(null);
  };

  // Effect to fetch the specific tournament's name
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setError("You must be logged in to view tournament details.");
      setLoading(false);
      return;
    }

    if (!tournamentId) {
      setError("No tournament ID provided in the URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
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
        setLoading(false);
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setTournamentName('Error');
        setError('Failed to load tournament details.');
        setLoading(false);
      }
    };
    fetchTournamentName();
  }, [tournamentId, user, authLoading]);


  useEffect(() => {
    if (authLoading || !user || !tournamentId) {
      setFixtures([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
      const q = query(fixturesCollectionRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          scoreA: doc.data().scoreA || 0,
          scoreB: doc.data().scoreB || 0,
        }));
        setFixtures(data);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching real-time fixtures:', err);
        setError('Failed to load fixtures. Please try again.');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up fixture listener:", err);
      setError("Failed to set up fixture listener.");
      setLoading(false);
    }
  }, [tournamentId, user, authLoading]);

  const handleEditScores = (match) => {
    setEditingMatchId(match.id);
    setEditScoreA(match.scoreA);
    setEditScoreB(match.scoreB);
  };

  const handleSaveScores = async (matchId) => {
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/fixtures`, matchId);
      await updateDoc(matchRef, {
        scoreA: parseInt(editScoreA),
        scoreB: parseInt(editScoreB),
        status: 'completed',
      });
      setEditingMatchId(null);
    } catch (err) {
      console.error('Error updating match scores:', err);
      openModal('Failed to update scores. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMatchId(null);
    setEditScoreA('');
    setEditScoreB('');
  };

  // Group fixtures by week
  const groupedFixtures = fixtures.reduce((acc, fixture) => {
    const weekNumber = getWeekNumber(fixture.timestamp || fixture.date);

    if (weekNumber === null) {
      console.warn('Skipping fixture due to invalid week number calculation:', fixture);
      return acc;
    }
    
    const weekName = `Week ${weekNumber}`;
    if (!acc[weekName]) {
      acc[weekName] = [];
    }
    acc[weekName].push(fixture);
    return acc;
  }, {});

  const sortedWeekNames = Object.keys(groupedFixtures).sort((a, b) => {
    const weekNumA = parseInt(a.replace('Week ', ''));
    const weekNumB = parseInt(b.replace('Week ', ''));
    return weekNumA - weekNumB;
  });


  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">📅 Tournament Fixtures ({tournamentName})</h2>

        {authLoading ? (
          <p className="text-center text-gray-500 py-8">Authenticating user...</p>
        ) : loading ? (
          <p className="text-gray-500 text-center">Loading fixtures...</p>
        ) : error ? (
          <p className="text-red-500 text-center">Error: {error}</p>
        ) : fixtures.length === 0 ? (
          <p className="text-gray-500 text-center">No fixtures available yet for this tournament.</p>
        ) : (
          <div className="space-y-6">
            {sortedWeekNames.map(weekName => (
              <div key={weekName}>
                <h3 className="bg-red-600 text-white font-bold text-xl py-2 px-4 mb-4 rounded-md text-center">{weekName}</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                  <table className="min-w-full table-fixed">
                    <thead>
                      <tr className="bg-gray-200 dark:bg-gray-700 text-left">
                        <th className="w-2/5 px-4 py-2 border-b dark:border-gray-600">Home Team</th>
                        <th className="w-1/5 px-4 py-2 border-b dark:border-gray-600 text-center">Score</th>
                        <th className="w-2/5 px-4 py-2 border-b dark:border-gray-600 text-right">Away Team</th>
                        {/* No extra th for actions to maintain 3 main columns like image */}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedFixtures[weekName].map((match) => {
                        const isCompleted = match.status === 'completed';
                        const isEditing = editingMatchId === match.id;

                        return (
                          <tr key={match.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-2 font-semibold">{match.teamA}</td>
                            <td className="px-4 py-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    value={editScoreA}
                                    onChange={(e) => setEditScoreA(e.target.value)}
                                    className="w-12 px-1 py-1 border rounded dark:bg-gray-700 dark:text-white text-center"
                                    min="0"
                                  />
                                  <span className="font-bold text-lg">X</span>
                                  <input
                                    type="number"
                                    value={editScoreB}
                                    onChange={(e) => setEditScoreB(e.target.value)}
                                    className="w-12 px-1 py-1 border rounded dark:bg-gray-700 dark:text-white text-center"
                                    min="0"
                                  />
                                </div>
                              ) : (
                                <span className={`font-bold ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {match.scoreA} - {match.scoreB}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-semibold text-right">{match.teamB}</td>
                            {/* Actions column moved to be conditional within the row to control its display */}
                            <td className="px-4 py-2 flex justify-end items-center">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveScores(match.id)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {match.status !== 'completed' && (
                                    <button
                                      onClick={() => handleEditScores(match)}
                                      className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Modal Component */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
            {modalCustomContent || (
              <>
                <p className="text-lg font-semibold mb-4">{modalMessage}</p>
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