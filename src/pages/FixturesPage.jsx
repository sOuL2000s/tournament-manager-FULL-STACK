// 📁 src/pages/FixturesPage.jsx
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setFixtures(data);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📅 Tournament Fixtures</h2>

      {fixtures.length === 0 ? (
        <p className="text-gray-500">No fixtures available yet.</p>
      ) : (
        <div className="space-y-4">
          {fixtures.map((match) => {
            const matchDate = new Date(match.timestamp?.seconds * 1000);
            const isCompleted = match.status === 'completed';

            return (
              <div
                key={match.id}
                className={`border p-4 rounded shadow-sm ${
                  isCompleted ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="text-lg font-semibold">
                    {match.teamA} vs {match.teamB}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {matchDate.toLocaleString()}
                  </div>
                </div>
                {isCompleted ? (
                  <div className="mt-2 text-green-700 dark:text-green-300">
                    ✅ Final Score: {match.scoreA} - {match.scoreB}
                  </div>
                ) : (
                  <div className="mt-2 text-blue-700 dark:text-blue-300">
                    ⏳ Scheduled
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
