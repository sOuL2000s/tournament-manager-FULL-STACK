// 📁 src/pages/TournamentPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function TournamentPage() {
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTournaments(list);
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addDoc(collection(db, 'tournaments'), {
      name,
      createdAt: new Date().toISOString(),
    });
    setName('');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🏆 Manage Tournaments</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tournament name"
          className="border p-2 rounded w-full sm:w-64 dark:bg-gray-800"
        />
        <button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          ➕ Create Tournament
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">🎯 Your Tournaments</h3>
        {tournaments.length === 0 ? (
          <p className="text-gray-500">No tournaments found yet. Create one!</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {tournaments.map(t => (
              <li
                key={t.id}
                onClick={() => navigate(`/tournament/${t.id}`)}
                className="cursor-pointer border border-gray-300 dark:border-gray-600 rounded p-3 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <h4 className="font-medium">{t.name}</h4>
                <p className="text-sm text-gray-500">
                  Created on {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
