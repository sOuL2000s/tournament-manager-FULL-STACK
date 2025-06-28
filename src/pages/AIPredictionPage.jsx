// 📁 src/pages/AIPredictionPage.jsx
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
  const [isPredicting, setIsPredicting] = useState(false); // State for prediction loading

  useEffect(() => {
    const fetchFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!tournamentId) {
          setError("Tournament ID is missing.");
          setLoading(false);
          return;
        }
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
      // (e.g., Firebase Cloud Functions, a Node.js/Express server, etc.)
      // where your API_KEY can be securely stored and used server-side.
      //
      // For Canvas environment, __api_key is automatically provided if you use gemini-2.0-flash or imagen-3.0-generate-002
      // For other models or if running outside Canvas, uncomment the line below and ensure you have an API key.
      const apiKey = "" // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.

      // Validate API Key presence only if not running in Canvas or for other models
      // In Canvas, __api_key is automatically injected, so this check might be overly strict for that environment.
      // If you are running locally and not setting REACT_APP_GEMINI_API_KEY, you might need to manually put your key here.
      if (!apiKey && typeof __api_key === 'undefined') { // Check if apiKey is empty AND not in Canvas environment
        setResult("API Key is not configured. For local development, set REACT_APP_GEMINI_API_KEY in your .env file or hardcode it (temporarily). In Canvas, it's auto-provided for allowed models.");
        setIsPredicting(false);
        return;
      }

      const prompt = `Predict the winner of the match between ${selectedMatch.teamA} and ${selectedMatch.teamB} for a football/soccer tournament. Consider general team strengths and provide a brief, concise reason for the prediction. Do not include probabilities or scores.`;
      const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      
      // Use gemini-2.0-flash as the default for text generation unless specified by the user
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`; 

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('API call failed:', response.status, response.statusText, errorBody);
        setResult(`Failed to get prediction: ${errorBody.error?.message || 'Unknown error'}. Check API key and quota.`);
        return;
      }

      const resultData = await response.json();

      if (resultData.candidates && resultData.candidates.length > 0 &&
          resultData.candidates[0].content && resultData.candidates[0].content.parts &&
          resultData.candidates[0].content.parts.length > 0) {
        const text = resultData.candidates[0].content.parts[0].text;
        setResult(text);
      } else {
        setResult('Could not get a prediction at this time. The AI returned an unexpected response structure.');
      }
    } catch (apiError) {
      console.error('Error calling generative AI API:', apiError);
      setResult(`Error getting prediction from AI: ${apiError.message}. Please try again later.`);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <h2 className="text-3xl font-extrabold mb-6 text-center">🤖 AI Match Prediction</h2>
      <p className="text-lg text-center mb-8">Select a match to get an AI-powered prediction for the winner.</p>

      {loading ? (
        <p className="text-gray-500 text-center py-4">Loading matches...</p>
      ) : error ? (
        <p className="text-red-500 text-center py-4">{error}</p>
      ) : fixtures.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No matches available for this tournament yet.</p>
      ) : (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
          {/* Match selection dropdown */}
          <div className="flex flex-col">
            <label htmlFor="match-select" className="mb-2 font-medium text-gray-700 dark:text-gray-300">Choose a Match:</label>
            <select
              id="match-select"
              onChange={(e) => {
                const match = fixtures.find(f => f.id === e.target.value);
                setSelectedMatch(match);
                setResult(null); // Clear result when a new match is selected
              }}
              value={selectedMatch?.id || ''}
              className="px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPredicting} // Disable dropdown during prediction
            >
              <option value="">-- Select a match --</option>
              {fixtures.map(f => (
                <option key={f.id} value={f.id}>
                  {f.teamA} vs {f.teamB} {f.status === 'completed' && ` (Final: ${f.scoreA}-${f.scoreB})`}
                </option>
              ))}
            </select>
          </div>

          {/* Predict button */}
          <button
            onClick={handlePredict}
            className={`w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md transition-colors text-lg
                        ${!selectedMatch || isPredicting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'
                      }`}
            disabled={!selectedMatch || isPredicting}
          >
            {isPredicting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Predicting...
              </div>
            ) : (
              'Predict Winner'
            )}
          </button>

          {/* Prediction result display */}
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.includes('Error') || result.includes('invalid') || result.includes('not configured') ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200'}`}>
              <p className="font-semibold text-xl mb-2">Prediction:</p>
              <p className="text-lg">{result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
