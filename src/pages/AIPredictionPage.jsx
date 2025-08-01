import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

export default function AIPredictionPage() {
  const { id: tournamentId } = useParams();
  const [fixtures, setFixtures] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [tournamentName, setTournamentName] = useState('');

  useEffect(() => {
    const fetchTournamentAndFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!tournamentId) {
          setError("Tournament ID is missing.");
          setLoading(false);
          return;
        }

        // Fetch tournament name
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentDocSnap = await getDoc(tournamentDocRef);
        if (tournamentDocSnap.exists()) {
          setTournamentName(tournamentDocSnap.data().name);
        } else {
          setError("Tournament not found.");
          setLoading(false);
          return;
        }

        // Fetch fixtures
        const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
        const snapshot = await getDocs(fixturesCollectionRef);
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(fixture => fixture.status !== 'completed'); // Only show uncompleted matches
        setFixtures(data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTournamentAndFixtures();
  }, [tournamentId]);

  const handlePredict = async () => {
    if (!selectedMatch) {
      setResult('Please select a match before predicting.');
      return;
    }
    setIsPredicting(true);
    setResult(null); // Clear previous results

    try {
      // IMPORTANT SECURITY NOTE:
      // NEVER expose your API_KEY directly in client-side code in a production application.
      // This is for demonstration purposes only.
      // In a real application, you should proxy this request through a secure backend server
      // (e.g., a Firebase Function or your own backend) to call the Generative AI API securely.
      // The API key should only be accessible on your backend.

      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      if (!API_KEY) {
        throw new Error("Gemini API Key is not configured. Please check your .env file.");
      }

      const selectedFixture = fixtures.find(f => f.id === selectedMatch);
      if (!selectedFixture) {
        throw new Error("Selected fixture not found.");
      }

      const prompt = `Predict the winner or outcome of a football match between ${selectedFixture.teamA} and ${selectedFixture.teamB}.
      Consider general team strengths, current form (if known, otherwise assume average), and head-to-head records (if available, otherwise ignore).
      Provide a concise prediction.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(`Failed to get prediction: ${errorData.error.message || response.statusText}`);
      }

      const data = await response.json();
      const predictionText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No prediction could be generated.';
      setResult(predictionText);

    } catch (err) {
      console.error("Prediction error:", err);
      setResult(`Prediction failed: ${err.message}`);
      setError(err.message);
    } finally {
      setIsPredicting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-lg font-semibold animate-pulse">Loading AI Prediction page...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <p className="text-lg font-semibold text-red-500 text-center">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto"> {/* Adjusted padding for responsiveness */}
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-center text-red-600 dark:text-red-500">
          ✨ AI Match Prediction for {tournamentName}
        </h2>

        {fixtures.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg py-10">
            No upcoming fixtures to predict.
          </p>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <p className="text-md sm:text-lg mb-4 text-gray-800 dark:text-gray-200">
              Select a match to get an AI-powered prediction:
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6"> {/* Responsive layout for controls */}
              <select
                className="w-full sm:w-2/3 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg"
                onChange={(e) => setSelectedMatch(e.target.value)}
                value={selectedMatch || ''}
              >
                <option value="">-- Select a Match --</option>
                {fixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    {fixture.teamA} vs {fixture.teamB} (
                    {new Date(fixture.timestamp?.toDate()).toLocaleDateString()})
                  </option>
                ))}
              </select>

              <button
                className={`w-full sm:w-1/3 px-4 py-2 rounded-md font-semibold text-lg transition-colors
                            ${selectedMatch && !isPredicting
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                            }`}
                onClick={handlePredict}
                disabled={!selectedMatch || isPredicting}
              >
                {isPredicting ? 'Predicting...' : 'Predict Outcome'}
              </button>
            </div>

            {result && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md shadow-inner">
                <h3 className="text-lg sm:text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">Prediction:</h3>
                <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg">{result}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}