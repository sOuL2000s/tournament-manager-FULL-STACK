import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournaments, createTournament } from '../hooks/useTournaments';

export default function Dashboard() {
  const { tournaments, loading, error } = useTournaments(); // Get error state from hook
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('League');
  const [createError, setCreateError] = useState(null); // State for create tournament errors
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) {
      setCreateError('Tournament name cannot be empty.');
      return;
    }
    setCreateError(null); // Clear previous errors
    try {
      const id = await createTournament({ name, type });
      if (id) {
        navigate(`/tournament/${id}`); // Navigate to the newly created tournament
        setName(''); // Clear form
        setShowForm(false); // Hide form
      } else {
        // This case might be hit if createTournament returns null, but it now throws an error.
        // It's good to keep defensive checks.
        setCreateError('Failed to create tournament. Please try again.');
      }
    } catch (err) {
      console.error('Dashboard: Error creating tournament:', err);
      setCreateError(err.message || 'An unexpected error occurred during tournament creation.');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🏠 Dashboard</h2>

      {/* Button to toggle new tournament form */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4 hover:bg-blue-700 transition-colors"
      >
        ➕ {showForm ? 'Hide Form' : 'New Tournament'}
      </button>

      {/* New Tournament Creation Form */}
      {showForm && (
        <div className="mb-4 bg-gray-100 dark:bg-gray-800 p-4 rounded shadow-md">
          <h3 className="text-lg font-semibold mb-3">Create New Tournament</h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Tournament Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white flex-grow min-w-[150px]"
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
            >
              <option value="League">League</option>
              <option value="Knockout">Knockout</option>
            </select>
            <button
              onClick={handleCreate}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
            >
              Create
            </button>
          </div>
          {createError && <p className="text-red-500 mt-2">{createError}</p>} {/* Display creation error */}
        </div>
      )}

      {/* Displaying Tournaments */}
      <h3 className="text-lg font-semibold mb-2">My Tournaments</h3>
      {loading ? (
        <p className="text-gray-500">Loading tournaments...</p>
      ) : error ? (
        <p className="text-red-500">Error loading tournaments: {error}</p> // Display loading error
      ) : tournaments.length === 0 ? (
        <p className="text-gray-500">No tournaments found yet. Create one!</p>
      ) : (
        <ul className="space-y-3">
          {tournaments.map(t => (
            <li key={t.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded shadow-sm flex justify-between items-center transition-transform transform hover:scale-[1.01]">
              <div>
                <p className="font-semibold text-lg">{t.name}</p>
                <p className="text-sm text-gray-500">{t.type}</p>
                {/* Display creation date if available and valid */}
                {t.createdAt && t.createdAt.seconds && (
                   <p className="text-xs text-gray-400 mt-1">
                     Created on: {new Date(t.createdAt.seconds * 1000).toLocaleDateString()}
                   </p>
                )}
              </div>
              <Link
                to={`/tournament/${t.id}`}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
