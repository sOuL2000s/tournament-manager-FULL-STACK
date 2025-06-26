// 📁 src/pages/AIPredictionPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; // Added doc and getDoc
import { useParams } from 'react-router-dom';

export default function AIPredictionPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL params
  const [fixtures, setFixtures] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state for fixtures
  const [error, setError] = useState(null); // Error state for fixtures
  const [isPredicting, setIsPredicting] = useState(false); // State for prediction loading

  useEffect(() => {
    const fetchFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        // Construct the path to the fixtures subcollection for the specific tournament
        const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
        const snapshot = await getDocs(fixturesCollectionRef);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFixtures(data);
      } catch (err) {
        console.error('Error fetching fixtures:', err);
        setError('Failed to load fixtures. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchFixtures();
  }, [tournamentId]); // Re-fetch fixtures if tournamentId changes

  const handlePredict = async () => {
    if (!selectedMatch) {
      // Display a message to the user if no match is selected
      setResult('Please select a match before predicting.');
      return;
    }

    setIsPredicting(true); // Set prediction loading state
    setResult(null); // Clear previous results

    // Simulate an API call with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Call the LLM to generate a prediction (mocked for now)
    try {
        let chatHistory = [];
        const prompt = `Predict the winner of the match between ${selectedMatch.team1} and ${selectedMatch.team2}. Provide a brief reason.`;
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resultData = await response.json();

        if (resultData.candidates && resultData.candidates.length > 0 &&
            resultData.candidates[0].content && resultData.candidates[0].content.parts &&
            resultData.candidates[0].content.parts.length > 0) {
            const text = resultData.candidates[0].content.parts[0].text;
            setResult(text);
        } else {
            setResult('Could not get a prediction at this time. Please try again.');
        }
    } catch (apiError) {
        console.error('Error calling generative AI API:', apiError);
        setResult('Error getting prediction from AI. Please try again later.');
    } finally {
        setIsPredicting(false); // Reset prediction loading state
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🤖 AI Match Prediction (Tournament: {tournamentId})</h2> {/* Show tournament ID */}
      {loading ? (
        <p className="text-gray-500">Loading matches...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : fixtures.length === 0 ? (
        <p className="text-gray-500">No matches available for this tournament yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Match selection dropdown */}
          <select
            onChange={(e) => {
              const match = fixtures.find(f => f.id === e.target.value);
              setSelectedMatch(match);
              setResult(null); // Clear result when a new match is selected
            }}
            value={selectedMatch?.id || ''} // Control the select input
            className="px-3 py-2 rounded w-full border dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a match</option>
            {fixtures.map(f => (
              <option key={f.id} value={f.id}>
                {f.teamA} vs {f.teamB}
              </option>
            ))}
          </select>

          {/* Predict button */}
          <button
            onClick={handlePredict}
            className={`bg-blue-600 text-white px-4 py-2 rounded transition-colors ${
              !selectedMatch || isPredicting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
            disabled={!selectedMatch || isPredicting} // Disable if no match is selected or prediction is in progress
          >
            {isPredicting ? 'Predicting...' : 'Predict Winner'}
          </button>

          {/* Prediction result display */}
          {result && (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded">
              <p className="font-semibold">Prediction:</p>
              <p>{result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
