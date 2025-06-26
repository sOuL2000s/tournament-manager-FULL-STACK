// 📁 src/pages/FixturesPage.jsx
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore'; // Added getDocs, doc, updateDoc
import { db } from '../firebase';
import { useParams } from 'react-router-dom'; // Import useParams to get tournament ID

export default function FixturesPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState(null); // State to track which match is being edited
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');

  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a query to the fixtures subcollection of the specific tournament, ordered by timestamp
      const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
      const q = query(fixturesCollectionRef, orderBy('timestamp', 'asc')); // Order by timestamp ascending

      // Set up a real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          // Ensure scores are numbers for calculations/display, default to 0 if undefined
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

      // Clean up the listener when the component unmounts or tournamentId changes
      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up fixture listener:", err);
      setError("Failed to set up fixture listener.");
      setLoading(false);
    }
  }, [tournamentId]); // Re-run effect if tournamentId changes

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
        status: 'completed', // Mark as completed after scores are saved
      });
      setEditingMatchId(null); // Exit editing mode
    } catch (err) {
      console.error('Error updating match scores:', err);
      alert('Failed to update scores. Please try again.'); // Using alert for simplicity, consider a custom modal
    }
  };

  const handleCancelEdit = () => {
    setEditingMatchId(null);
    setEditScoreA('');
    setEditScoreB('');
  };


  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">📅 Tournament Fixtures (Tournament: {tournamentId})</h2>

      {loading ? (
        <p className="text-gray-500">Loading fixtures...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : fixtures.length === 0 ? (
        <p className="text-gray-500">No fixtures available yet for this tournament.</p>
      ) : (
        <div className="space-y-4">
          {fixtures.map((match) => {
            // Convert Firestore Timestamp to JavaScript Date object
            const matchDate = match.timestamp && match.timestamp.seconds
              ? new Date(match.timestamp.seconds * 1000)
              : null;
            const isCompleted = match.status === 'completed';
            const isEditing = editingMatchId === match.id;

            return (
              <div
                key={match.id}
                className={`border p-4 rounded shadow-sm transition-all duration-200
                  ${isCompleted ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'}
                  ${isEditing ? 'border-blue-500 ring-2 ring-blue-300' : ''}
                `}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-lg font-semibold">
                    {match.teamA} vs {match.teamB}
                  </div>
                  {matchDate && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {matchDate.toLocaleString()}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  // Edit mode UI
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={editScoreA}
                      onChange={(e) => setEditScoreA(e.target.value)}
                      className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      placeholder="Score A"
                      min="0"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={editScoreB}
                      onChange={(e) => setEditScoreB(e.target.value)}
                      className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      placeholder="Score B"
                      min="0"
                    />
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
                  // Display mode UI
                  <div className="flex justify-between items-center mt-2">
                    {isCompleted ? (
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        ✅ Final Score: {match.scoreA} - {match.scoreB}
                      </div>
                    ) : (
                      <div className="text-blue-700 dark:text-blue-300 font-medium">
                        ⏳ Scheduled
                      </div>
                    )}
                    {!isCompleted && ( // Only show edit button if not completed
                      <button
                        onClick={() => handleEditScores(match)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors"
                      >
                        Edit Scores
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
