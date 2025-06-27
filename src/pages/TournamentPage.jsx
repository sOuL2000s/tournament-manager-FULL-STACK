import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy, getDoc, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function TournamentPage() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [tournamentName, setTournamentName] = useState('Loading...');
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loadingTournamentData, setLoadingTournamentData] = useState(true);
  const [error, setError] = useState(null);

  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');

  const [fixtures, setFixtures] = useState([]);
  const [newFixture, setNewFixture] = useState({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
  const [fixtureError, setFixtureError] = useState('');

  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalInputRequired, setModalInputRequired] = useState(false);
  const [modalInputLabel, setModalInputLabel] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalCustomContent, setModalCustomContent] = useState(null);

  const [showTeamsConfigModal, setShowTeamsConfigModal] = useState(false);
  const [enableColors, setEnableColors] = useState(false);
  const [promotionSpots, setPromotionSpots] = useState('');
  const [europeLeagueSpots, setEuropeLeagueSpots] = useState('');
  const [relegationSpots, setRelegationSpots] = useState('');

  const openModal = (message, confirmAction = null, inputRequired = false, inputLabel = '', initialValue = '', customContent = null) => {
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction);
    setModalInputRequired(inputRequired);
    setModalInputLabel(inputLabel);
    setModalInputValue(initialValue);
    setModalCustomContent(customContent);
    setModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (modalConfirmAction) {
      modalConfirmAction(modalInputValue);
    }
    setModalOpen(false);
    setModalInputValue('');
    setModalCustomContent(null);
    setModalConfirmAction(null);
    setEnableColors(false);
    setPromotionSpots('');
    setEuropeLeagueSpots('');
    setRelegationSpots('');
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setModalInputValue('');
    setModalCustomContent(null);
    setModalConfirmAction(null);
    setEnableColors(false);
    setPromotionSpots('');
    setEuropeLeagueSpots('');
    setRelegationSpots('');
  };

  useEffect(() => {
    if (authLoading) {
      setLoadingTournamentData(true);
      return;
    }

    if (!user || !user.uid) {
      setError("You must be logged in to view tournament details.");
      setLoadingTournamentData(false);
      return;
    }

    if (!tournamentId) {
      setError("No tournament ID provided in the URL.");
      setLoadingTournamentData(false);
      return;
    }

    setLoadingTournamentData(true);
    setError(null);

    const fetchTournamentDetails = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);

        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          if (user.uid && data.userId === user.uid) {
            setTournamentName(data.name);
            setTournamentDetails(data);
          } else {
            setTournamentName('Access Denied');
            setError('You do not have permission to access this tournament.');
          }
        } else {
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
        setLoadingTournamentData(false);
      } catch (err) {
        console.error('Error fetching tournament details:', err);
        setTournamentName('Error');
        setError('Failed to load tournament details. Please try again.');
        setLoadingTournamentData(false);
      }
    };
    fetchTournamentDetails();
  }, [tournamentId, user, authLoading]);


  useEffect(() => {
    if (authLoading || !user || !tournamentId) {
      setTeams([]);
      return;
    }

    const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
    const unsubscribeTeams = onSnapshot(query(teamsCollectionRef, orderBy('name', 'asc')), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time teams:', err);
      setTeamError('Failed to load teams.');
    });
    return () => unsubscribeTeams();
  }, [tournamentId, user, authLoading]);


  useEffect(() => {
    if (authLoading || !user || !tournamentId) {
      setFixtures([]);
      return;
    }

    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const unsubscribeFixtures = onSnapshot(query(fixturesCollectionRef, orderBy('timestamp', 'asc')), (snapshot) => {
      setFixtures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time fixtures:', err);
      setFixtureError('Failed to load fixtures.');
    });
    return () => unsubscribeFixtures();
  }, [tournamentId, user, authLoading]);


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
    openModal('Are you sure you want to delete this team?', async () => {
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/teams`, teamId));
      } catch (err) {
        console.error('Error deleting team:', err);
        openModal('Failed to delete team. Please try again.');
      }
    });
  };

  const handleTeamsCountClick = () => {
    setShowTeamsConfigModal(true);
  };

  const handleCreateLeagueFromTeams = async () => {
    try {
      const tournamentRef = doc(db, 'tournaments', tournamentId);
      await updateDoc(tournamentRef, {
        enableColors: enableColors,
        promotionSpots: parseInt(promotionSpots) || 0,
        europeLeagueSpots: parseInt(europeLeagueSpots) || 0,
        relegationSpots: parseInt(relegationSpots) || 0
      });
      openModal('League configuration saved successfully!', null, false, '', '', null);
      setShowTeamsConfigModal(false);
    } catch (err) {
      console.error('Error saving league configuration:', err);
      openModal('Failed to save league configuration. Please try again.');
    }
  };

  const updateLeaderboard = async () => {
    if (!tournamentId) return;

    const leaderboardRef = collection(db, `tournaments/${tournamentId}/leaderboard`);
    const teamsRef = collection(db, `tournaments/${tournamentId}/teams`);
    const fixturesRef = collection(db, `tournaments/${tournamentId}/fixtures`);

    const teamsSnapshot = await getDocs(teamsRef);
    const fixturesSnapshot = await getDocs(query(fixturesRef));

    const teamStats = {};
    teamsSnapshot.docs.forEach(teamDoc => {
      const teamName = teamDoc.data().name;
      teamStats[teamName] = {
        id: teamDoc.id,
        name: teamName,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    fixturesSnapshot.docs.forEach(fixtureDoc => {
      const fixture = fixtureDoc.data();
      if (fixture.status === 'completed') {
        const teamA = fixture.teamA;
        const teamB = fixture.teamB;
        const scoreA = fixture.scoreA || 0;
        const scoreB = fixture.scoreB || 0;

        if (teamStats[teamA]) {
          teamStats[teamA].played++;
          teamStats[teamA].goalsFor += scoreA;
          teamStats[teamA].goalsAgainst += scoreB;
        }
        if (teamStats[teamB]) {
          teamStats[teamB].played++;
          teamStats[teamB].goalsFor += scoreB;
          teamStats[teamB].goalsAgainst += scoreA;
        }

        if (scoreA > scoreB) {
          if (teamStats[teamA]) teamStats[teamA].wins++;
          if (teamStats[teamB]) teamStats[teamB].losses++;
        } else if (scoreB > scoreA) {
          if (teamStats[teamB]) teamStats[teamB].wins++;
          if (teamStats[teamA]) teamStats[teamA].losses++;
        } else { // Draw
          if (teamStats[teamA]) teamStats[teamA].draws++;
          if (teamStats[teamB]) teamStats[teamB].draws++;
        }
      }
    });

    const pointsPerWin = tournamentDetails?.pointsPerWin || 3;
    const pointsPerDraw = tournamentDetails?.pointsPerDraw || 1;

    const batch = writeBatch(db);
    for (const teamName in teamStats) {
      const stats = teamStats[teamName];
      stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
      stats.points = (stats.wins * pointsPerWin) + (stats.draws * pointsPerDraw);

      const teamLeaderboardDocRef = doc(leaderboardRef, stats.id);
      batch.set(teamLeaderboardDocRef, stats, { merge: true });
    }

    try {
      await batch.commit();
      console.log('Leaderboard updated successfully!');
    } catch (err) {
      console.error('Error updating leaderboard:', err);
    }
  };

  useEffect(() => {
    if (!authLoading && user && tournamentDetails && fixtures.length > 0) {
      updateLeaderboard();
    }
  }, [fixtures, tournamentDetails, authLoading, user]);


  const handleGenerateFixtures = async () => {
    if (teams.length < 2) {
      openModal('You need at least two teams to generate fixtures!');
      return;
    }
    if (!tournamentDetails) {
        openModal('Tournament details not loaded. Cannot generate fixtures.');
        return;
    }

    const fixtureOption = tournamentDetails.fixtureOption;
    const generatedFixtures = [];
    const teamNames = teams.map(t => t.name);

    let currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0);

    if (fixtureOption === 'Single Matches') {
      for (let i = 0; i < teamNames.length; i++) {
        for (let j = i + 1; j < teamNames.length; j++) {
          generatedFixtures.push({
            teamA: teamNames[i],
            teamB: teamNames[j],
            date: currentDate.toISOString().split('T')[0],
            timestamp: new Date(currentDate),
            status: 'scheduled',
            scoreA: 0,
            scoreB: 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    } else if (fixtureOption === 'Home and Away Matches') {
      for (let i = 0; i < teamNames.length; i++) {
        for (let j = 0; j < teamNames.length; j++) {
          if (i === j) continue;

          generatedFixtures.push({
            teamA: teamNames[i],
            teamB: teamNames[j],
            date: currentDate.toISOString().split('T')[0],
            timestamp: new Date(currentDate),
            status: 'scheduled',
            scoreA: 0,
            scoreB: 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    if (generatedFixtures.length === 0) {
      openModal('No fixtures could be generated. Check your team list and fixture options.');
      return;
    }

    const batch = writeBatch(db);
    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);

    const existingFixturesSnapshot = await getDocs(fixturesCollectionRef);
    existingFixturesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    generatedFixtures.forEach(fixture => {
      const newFixtureRef = doc(fixturesCollectionRef);
      batch.set(newFixtureRef, fixture);
    });

    try {
      await batch.commit();
      openModal(`Successfully generated ${generatedFixtures.length} fixtures!`, null);
    } catch (err) {
      console.error('Error generating fixtures:', err);
      openModal('Failed to generate fixtures. Please try again.');
    }
  };

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
      const fixtureDate = new Date(newFixture.date);
      if (isNaN(fixtureDate)) {
        setFixtureError('Invalid date format.');
        return;
      }

      await addDoc(collection(db, `tournaments/${tournamentId}/fixtures`), {
        ...newFixture,
        timestamp: fixtureDate,
        scoreA: 0,
        scoreB: 0,
        status: 'scheduled'
      });
      setNewFixture({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
    } catch (err) {
      console.error('Error adding fixture:', err);
      setFixtureError('Failed to add fixture.');
    }
  };

  const handleDeleteFixture = async (fixtureId) => {
    openModal('Are you sure you want to delete this fixture?', async () => {
      try {
        await deleteDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId));
      } catch (err) {
        console.error('Error deleting fixture:', err);
        openModal('Failed to delete fixture. Please try again.');
      }
    });
  };

  const handleUpdateScores = async (fixtureId, currentScoreA, currentScoreB) => {
    const fixtureToUpdate = fixtures.find(f => f.id === fixtureId);
    if (!fixtureToUpdate) return;

    openModal(
      `Enter scores for ${fixtureToUpdate.teamA} vs ${fixtureToUpdate.teamB}:`,
      async (inputValues) => {
        const parsedScoreA = parseInt(inputValues.split(',')[0]);
        const parsedScoreB = parseInt(inputValues.split(',')[1]);

        if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
          openModal('Invalid score entered. Please enter numbers.');
          return;
        }

        try {
          const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);
          await updateDoc(fixtureRef, {
            scoreA: parsedScoreA,
            scoreB: parsedScoreB,
            status: 'completed'
          });
          await updateLeaderboard();
        } catch (err) {
          console.error('Error updating scores:', err);
          openModal('Failed to update scores. Please try again.');
        }
      },
      true,
      'Score A,Score B',
      `${currentScoreA},${currentScoreB}`
    );
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
          {/* Team Management Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">⚽ Team Management</h3>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter a team"
                className="flex-grow px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-sm"
              />
              <button
                onClick={handleAddTeam}
                className="bg-red-600 text-white font-bold py-2 px-6 rounded-md hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide"
              >
                Add
              </button>
            </div>
            {teamError && <p className="text-red-500 text-sm mb-4">{teamError}</p>}
            
            {/* Teams Count and Clear Button */}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 mb-4">
              <p className="cursor-pointer hover:underline" onClick={handleTeamsCountClick}>
                Teams: <span className="font-bold">{teams.length}</span>
                {teams.length > 0 && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block ml-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </p>
              <button className="text-red-500 hover:text-red-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600 h-64 overflow-y-auto">
              {teams.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No teams added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {teams.map(team => (
                    <li key={team.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-600">
                      <span className="font-medium text-gray-800 dark:text-white">{team.name}</span>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-between gap-4 mt-6">
              <button
                onClick={() => openModal('Saving list is handled automatically by real-time updates. You can implement export/import functionality here if needed.')}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 transition-colors duration-200 uppercase tracking-wide flex-grow"
              >
                Save List
              </button>
              <button
                onClick={() => openModal('Loading list is handled automatically by real-time updates.')}
                className="bg-yellow-500 text-white font-bold py-2 px-6 rounded-md hover:bg-yellow-600 transition-colors duration-200 uppercase tracking-wide flex-grow"
              >
                Load List
              </button>
            </div>
            
            <button
              onClick={handleGenerateFixtures}
              className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105 mt-6"
            >
              Create
            </button>
          </div>

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
                      {fixture.status !== 'completed' && (
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

      {/* Custom Modal Component */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
            {modalCustomContent || (
              <>
                <p className="text-lg font-semibold mb-4">{modalMessage}</p>
                {modalInputRequired && (
                  <div className="flex flex-col gap-2 mb-4">
                    {modalInputLabel.split(',').map((label, index) => (
                      <input
                        key={index}
                        type="number"
                        placeholder={label.trim()}
                        value={modalInputValue.split(',')[index] || ''}
                        onChange={(e) => {
                          const newValues = [...modalInputValue.split(',')];
                          newValues[index] = e.target.value;
                          setModalInputValue(newValues.join(','));
                        }}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {modalConfirmAction && (
                <button
                  onClick={handleModalConfirm}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Confirm
                </button>
              )}
              <button
                onClick={handleModalCancel}
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors"
              >
                {modalConfirmAction ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Configuration Modal - Shown when showTeamsConfigModal is true */}
      {showTeamsConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Teams: {teams.length}</h3>
            
            {/* Colors Checkbox */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <label className="text-lg font-semibold">Colours:</label>
              <input
                type="checkbox"
                checked={enableColors}
                onChange={(e) => setEnableColors(e.target.checked)}
                className="w-5 h-5"
              />
            </div>

            {/* Promotion, Europe L., Relegation Inputs */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-green-600 dark:text-green-400">Promotion</label>
                <input
                  type="number"
                  value={promotionSpots}
                  onChange={(e) => setPromotionSpots(e.target.value)}
                  className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white"
                  min="0"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="font-semibold text-yellow-600 dark:text-yellow-400">Europe L.</label>
                <input
                  type="number"
                  value={europeLeagueSpots}
                  onChange={(e) => setEuropeLeagueSpots(e.target.value)}
                  className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white"
                  min="0"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="font-semibold text-red-600 dark:text-red-400">Relegation</label>
                <input
                  type="number"
                  value={relegationSpots}
                  onChange={(e) => setRelegationSpots(e.target.value)}
                  className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white"
                  min="0"
                />
              </div>
            </div>

            {/* CREATE LEAGUE Button inside modal */}
            <button
              onClick={handleCreateLeagueFromTeams}
              className="bg-red-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
            >
              Create League
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
