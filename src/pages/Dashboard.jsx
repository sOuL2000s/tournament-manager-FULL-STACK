import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournaments, createTournament } from '../hooks/useTournaments';

export default function Dashboard() {
  const { tournaments, loading } = useTournaments();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('League');
  const navigate = useNavigate();

  const handleCreate = async () => {
    const id = await createTournament({ name, type });
    if (id) navigate(`/tournament/${id}`);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🏠 Dashboard</h2>

      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        ➕ New Tournament
      </button>

      {showForm && (
        <div className="mb-4 bg-gray-100 dark:bg-gray-800 p-4 rounded">
          <input
            type="text"
            placeholder="Tournament Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="px-2 py-1 mr-2 rounded"
          />
          <select value={type} onChange={e => setType(e.target.value)} className="px-2 py-1 mr-2 rounded">
            <option value="League">League</option>
            <option value="Knockout">Knockout</option>
          </select>
          <button onClick={handleCreate} className="bg-green-600 text-white px-4 py-1 rounded">Create</button>
        </div>
      )}

      {loading ? (
        <p>Loading tournaments...</p>
      ) : (
        <ul className="space-y-2">
          {tournaments.map(t => (
            <li key={t.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded flex justify-between items-center">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-gray-500">{t.type}</p>
              </div>
              <Link to={`/tournament/${t.id}`} className="text-blue-500 underline">Open</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
