// 📁 src/pages/TournamentPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore'; // Added doc, deleteDoc, updateDoc, query, orderBy
import { Link, useNavigate, useParams } from 'react-router-dom'; // Import useParams

export default function TournamentPage() {
  const { id: tournamentId } = useParams(); // Get tournament ID from URL
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [tournaments, setTournaments] = useState([]); // This will now be a list of ALL tournaments for listing
  const [name, setName] = useState(''); // State for new tournament name
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTournamentForm, setShowTournamentForm] = useState(false); // State to toggle create tournament form

  // States for sub-features within a specific tournament
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');

  const [fixtures, setFixtures] = useState([]);
  const [newFixture, setNewFixture] = useState({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
  const [fixtureError, setFixtureError] = useState('');

  const navigate = useNavigate();

  // Effect to fetch the specific tournament's name (for the heading)
  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament ID provided.");
      setLoading(false);
      return;
    }
    const fetchTournamentName = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);
        if (tournamentSnap.exists()) {
          setTournamentName(tournamentSnap.data().name);
        } else {
          setTournamentName('Tournament Not Found');
          setError('Tournament not found.');
        }
      } catch (err) {
        console.error('Error fetching tournament name:', err);
        setError('Failed to load tournament details.');
      }
    };
    fetchTournamentName();
  }, [tournamentId]);


  // Real-time listener for ALL tournaments (for the sidebar/main listing)
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTournaments(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching all tournaments:', err);
      setError('Failed to load tournaments list.');
      setLoading(false);
    });
    return () => unsub();
  }, []);


  // Real-time listener for teams within the specific tournament
  useEffect(() => {
    if (!tournamentId) return;
    const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
    const unsubscribeTeams = onSnapshot(query(teamsCollectionRef, orderBy('name', 'asc')), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time teams:', err);
      setTeamError('Failed to load teams.');
    });
    return () => unsubscribeTeams();
  }, [tournamentId]);


  // Real-time listener for fixtures within the specific tournament
  useEffect(() => {
    if (!tournamentId) return;
    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const unsubscribeFixtures = onSnapshot(query(fixturesCollectionRef, orderBy('timestamp', 'asc')), (snapshot) => {
      setFixtures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time fixtures:', err);
      setFixtureError('Failed to load fixtures.');
    });
    return () => unsubscribeFixtures();
  }, [tournamentId]);


  // Handler for creating a new tournament (from the general tournaments list)
  const handleCreateTournament = async () => {
    if (!name.trim()) {
      setError('Tournament name cannot be empty.'); // Use general error for this form
      return;
    }
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        name,
        createdAt: new Date().toISOString(),
      });
      // Navigate to the newly created tournament's page
      navigate(`/tournament/${docRef.id}`);
      setName('');
      setShowTournamentForm(false); // Hide the form after creation
    } catch (err) {
      console.error('Error creating tournament:', err);
      setError('Failed to create tournament.');
    }
  };


  // Team Management Handlers
  const handleAddTeam = async () => {
    setTeamError('');
    if (!newTeamName.trim()) {
      setTeamError('Team name cannot be empty.');
      return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/teams`), { name: newTeamName });
      setNewTeamName('');
    } catch (err) {
      console.error('Error adding team:', err);
      setTeamError('Failed to add team.');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (window.confirm('Are you sure you want to delete this team?')) { // Consider custom modal
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/teams`, teamId));
      } catch (err) {
        console.error('Error deleting team:', err);
        alert('Failed to delete team.'); // Using alert, but custom modal is preferred
      }
    }
  };

  // Fixture Management Handlers
  const handleAddFixture = async () => {
    setFixtureError('');
    if (!newFixture.teamA || !newFixture.teamB || !newFixture.date) {
      setFixtureError('Please select both teams and a date for the fixture.');
      return;
    }
    if (newFixture.teamA === newFixture.teamB) {
      setFixtureError('Teams cannot be the same.');
      return;
    }
    try {
      // Convert date string to Firestore Timestamp for better querying
      const fixtureDate = new Date(newFixture.date);
      if (isNaN(fixtureDate)) {
        setFixtureError('Invalid date format.');
        return;
      }

      await addDoc(collection(db, `tournaments/${tournamentId}/fixtures`), {
        ...newFixture,
        timestamp: fixtureDate, // Store as Date object, Firestore will convert to Timestamp
        scoreA: 0, // Initialize scores to 0
        scoreB: 0,
        status: 'scheduled' // Initialize status
      });
      setNewFixture({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
    } catch (err) {
      console.error('Error adding fixture:', err);
      setFixtureError('Failed to add fixture.');
    }
  };

  const handleDeleteFixture = async (fixtureId) => {
    if (window.confirm('Are you sure you want to delete this fixture?')) { // Consider custom modal
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId));
      } catch (err) {
        console.error('Error deleting fixture:', err);
        alert('Failed to delete fixture.'); // Using alert, but custom modal is preferred
      }
    }
  };

  const handleUpdateScores = async (fixtureId, currentScoreA, currentScoreB) => {
    const scoreA = prompt(`Enter score for ${fixtures.find(f => f.id === fixtureId)?.teamA || 'Team A'}:`, currentScoreA);
    const scoreB = prompt(`Enter score for ${fixtures.find(f => f.id === fixtureId)?.teamB || 'Team B'}:`, currentScoreB);

    if (scoreA !== null && scoreB !== null) {
      const parsedScoreA = parseInt(scoreA);
      const parsedScoreB = parseInt(scoreB);

      if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
        alert('Invalid score entered. Please enter numbers.');
        return;
      }

      try {
        const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);
        await updateDoc(fixtureRef, {
          scoreA: parsedScoreA,
          scoreB: parsedScoreB,
          status: 'completed'
        });
        // Optionally update leaderboard here, or trigger a cloud function
      } catch (err) {
        console.error('Error updating scores:', err);
        alert('Failed to update scores. Please try again.');
      }
    }
  };


  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">✨ {tournamentName} Details</h2>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-fit">
          <h3 className="text-xl font-bold mb-4">Navigation</h3>
          <ul className="space-y-2">
            <li>
              <Link to={`/tournament/${tournamentId}`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Overview
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/fixtures`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Fixtures
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/leaderboard`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Leaderboard
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/knockout`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Knockout Stage
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/predict`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                AI Prediction
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/stats`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Stats
              </Link>
            </li>
            <li>
              <Link to={`/tournament/${tournamentId}/players`} className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Players
              </Link>
            </li>
          </ul>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-8">
          {/* Tournament Creation Section (can be hidden/shown via button) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">➕ All Tournaments (for quick navigation / create new)</h3>
            <button
              onClick={() => setShowTournamentForm(!showTournamentForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md mb-4 hover:bg-blue-700 transition-colors"
            >
              {showTournamentForm ? 'Hide Create Form' : 'Create New Tournament'}
            </button>
            {showTournamentForm && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4 mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New Tournament name"
                  className="border p-2 rounded-md w-full sm:w-64 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCreateTournament}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  ➕ Create Tournament
                </button>
              </div>
            )}

            {loading ? (
              <p className="text-gray-500">Loading tournaments...</p>
            ) : tournaments.length === 0 ? (
              <p className="text-gray-500">No tournaments found yet. Create one above!</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {tournaments.map(t => (
                  <li
                    key={t.id}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline block"
                    >
                      <h4 className="font-medium text-lg">{t.name}</h4>
                      {t.createdAt && t.createdAt.seconds && ( // Ensure createdAt exists and is a timestamp
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Created on {new Date(t.createdAt.seconds * 1000).toLocaleDateString()}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Team Management Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">⚽ Team Management</h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New Team Name"
                className="border p-2 rounded-md w-full sm:flex-grow dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTeam}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Team
              </button>
            </div>
            {teamError && <p className="text-red-500 text-sm mb-4">{teamError}</p>}
            {teams.length === 0 ? (
              <p className="text-gray-500">No teams added yet.</p>
            ) : (
              <ul className="space-y-2 mt-4">
                {teams.map(team => (
                  <li key={team.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md border border-gray-200 dark:border-gray-600">
                    <span className="font-medium">{team.name}</span>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fixture Management Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">📅 Fixture Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <select
                value={newFixture.teamA}
                onChange={(e) => setNewFixture({ ...newFixture, teamA: e.target.value })}
                className="border p-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Team A</option>
                {teams.map(team => (
                  <option key={team.id} value={team.name}>{team.name}</option>
                ))}
              </select>
              <select
                value={newFixture.teamB}
                onChange={(e) => setNewFixture({ ...newFixture, teamB: e.target.value })}
                className="border p-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Team B</option>
                {teams.map(team => (
                  <option key={team.id} value={team.name}>{team.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={newFixture.date}
                onChange={(e) => setNewFixture({ ...newFixture, date: e.target.value })}
                className="border p-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {fixtureError && <p className="text-red-500 text-sm mb-4">{fixtureError}</p>}
            <button
              onClick={handleAddFixture}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Add Fixture
            </button>

            {fixtures.length === 0 ? (
              <p className="text-gray-500 mt-4">No fixtures added yet.</p>
            ) : (
              <ul className="space-y-2 mt-4">
                {fixtures.map(fixture => (
                  <li key={fixture.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md border border-gray-200 dark:border-gray-600">
                    <div>
                      <p className="font-medium">
                        {fixture.teamA} vs {fixture.teamB}
                      </p>
                      {fixture.timestamp && fixture.timestamp.seconds ? (
                         <p className="text-sm text-gray-500 dark:text-gray-400">
                           {new Date(fixture.timestamp.seconds * 1000).toLocaleDateString()}
                         </p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{fixture.date}</p>
                      )}
                      {fixture.status === 'completed' && (
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Final Score: {fixture.scoreA} - {fixture.scoreB}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      {!fixture.status === 'completed' && (
                        <button
                          onClick={() => handleUpdateScores(fixture.id, fixture.scoreA, fixture.scoreB)}
                          className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600 transition-colors"
                        >
                          Update Scores
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteFixture(fixture.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
