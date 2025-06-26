// 📁 src/pages/AIPredictionPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

export default function AIPredictionPage() {
  const { id } = useParams(); // tournament ID
  const [fixtures, setFixtures] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchFixtures = async () => {
      const snapshot = await getDocs(collection(db, `tournaments/${id}/fixtures`));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFixtures(data);
    };
    fetchFixtures();
  }, [id]);

  const handlePredict = () => {
    if (!selectedMatch) return;
    const outcome = Math.random();
    const winner = outcome > 0.5 ? selectedMatch.team1 : selectedMatch.team2;
    setResult(`${winner} has a higher chance of winning (AI Mocked)`);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🤖 AI Match Prediction</h2>
      {fixtures.length === 0 ? (
        <p className="text-gray-500">Loading matches...</p>
      ) : (
        <div className="space-y-4">
          <select
            onChange={(e) => {
              const match = fixtures.find(f => f.id === e.target.value);
              setSelectedMatch(match);
              setResult(null);
            }}
            className="px-3 py-2 rounded w-full"
          >
            <option value="">Select a match</option>
            {fixtures.map(f => (
              <option key={f.id} value={f.id}>
                {f.team1} vs {f.team2}
              </option>
            ))}
          </select>
          <button
            onClick={handlePredict}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Predict Winner
          </button>
          {result && <p className="mt-2 text-green-500">{result}</p>}
        </div>
      )}
    </div>
  );
}
