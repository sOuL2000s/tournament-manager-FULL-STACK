// 📁 src/pages/FixturesPage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  serverTimestamp,
  getDoc, // Added getDoc
  where, // Added where for filtering by group
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import ScoreInputModalContent from '../components/ScoreInputModalContent';

export default function FixturesPage() {
  const { id: tournamentId } = useParams();

  // All hooks must be declared at the top level, unconditionally
  const [fixtures, setFixtures] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingFixture, setIsAddingFixture] = useState(false);
  const [newFixture, setNewFixture] = useState({
    teamA: '',
    teamB: '',
    date: '', // Storing as YYYY-MM-DD string
    timestamp: null, // Firestore Timestamp object for ordering
    status: 'scheduled',
    scoreA: 0,
    scoreB: 0,
    weekNumber: 0, // Default to 0 for manually added fixtures
    groupId: '', // New field for group ID
  });
  const [fixtureError, setFixtureError] = useState('');
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const { user } = useAuth();
  const [isViewOnly, setIsViewOnly] = useState(false); // State to check if it's a shared view
  const [tournamentOwnerId, setTournamentOwnerId] = useState(null);

  // State for Custom Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalTitle, setCustomModalTitle] = useState('');
  const [customModalMessage, setCustomModalMessage] = useState('');
  const [customModalOnConfirm, setCustomModalOnConfirm] = useState(null);
  const [customModalShowConfirm, setCustomModalShowConfirm] = useState(true);

  // State for Score Input Modal
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState(null);
  const scoreInputRef = useRef(null); // Ref for ScoreInputModalContent

  // Helper to open the custom modal
  const openCustomModal = useCallback((title, message, onConfirm = null, showConfirm = true) => {
    setCustomModalTitle(title);
    setCustomModalMessage(message);
    setCustomModalOnConfirm(() => onConfirm); // Use a function to set state with a function
    setCustomModalShowConfirm(showConfirm);
    setCustomModalOpen(true);
  }, []);

  // Helper to close the custom modal
  const closeCustomModal = useCallback(() => {
    setCustomModalOpen(false);
    setCustomModalTitle('');
    setCustomModalMessage('');
    setCustomModalOnConfirm(null);
    setCustomModalShowConfirm(true);
  }, []);

  // Helper function to shuffle an array (Fisher-Yates)
  const shuffleArray = useCallback((array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }, []);

  // Fetch tournament details and set view-only mode
  useEffect(() => {
    if (!tournamentId) return;

    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const unsubscribe = onSnapshot(
      tournamentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTournamentDetails(data);
          setTournamentOwnerId(data.userId);
          // Determine if it's a view-only link (assuming shareId is in URL)
          const urlParams = new URLSearchParams(window.location.search);
          const shareIdParam = urlParams.get('shareId');
          // If shareId is present, OR if user is not logged in AND tournament is public
          const currentIsViewOnly = (!!shareIdParam) || (!user && (data.isPublic || false));
          setIsViewOnly(currentIsViewOnly);
        } else {
          setError('Tournament not found.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching tournament details:', err);
        setError('Failed to load tournament details.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tournamentId, user]); // Added user to dependencies

  // Listen to Teams and Fixtures collections
  useEffect(() => {
    if (!tournamentId) return;

    // Teams subscription
    const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
    const unsubscribeTeams = onSnapshot(
      query(teamsCollectionRef, orderBy('name', 'asc')),
      (snapshot) => {
        setTeams(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('Error fetching real-time teams:', err);
        if (!isViewOnly) { // Only show error to owner/editor
          setError('Failed to load teams.');
        }
      }
    );

    // Fixtures subscription
    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const unsubscribeFixtures = onSnapshot(
      query(fixturesCollectionRef, orderBy('timestamp', 'asc')), // Order by timestamp
      (snapshot) => {
        const fetchedFixtures = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore Timestamp to Date string for input[type="date"]
          date: doc.data().timestamp ? new Date(doc.data().timestamp.toDate()).toISOString().split('T')[0] : '',
        }));
        setFixtures(fetchedFixtures);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time fixtures:', err);
        if (!isViewOnly) { // Only show error to owner/editor
          setError('Failed to load fixtures.');
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTeams();
      unsubscribeFixtures();
    };
  }, [tournamentId, isViewOnly]);

  // Generate Round Robin Fixtures (Modified to accept team objects and group ID)
  const generateRoundRobinFixtures = useCallback((teamsToSchedule, isHomeAndAway, groupId = '') => {
    const numTeams = teamsToSchedule.length;
    if (numTeams < 2) return [];

    let teamsForScheduling = [...teamsToSchedule];
    // If odd number of teams, add a 'BYE' team
    if (numTeams % 2 !== 0) {
      teamsForScheduling.push({ name: 'BYE', id: 'BYE' }); // Use object for BYE for consistency
    }

    const n = teamsForScheduling.length;
    const roundsNeeded = n - 1; // Number of rounds in a single round-robin

    let allLogicalRounds = [];

    for (let roundNum = 0; roundNum < roundsNeeded; roundNum++) {
      let currentRoundFixtures = [];
      // Pair the first team with the last rotating team
      const fixedTeam = teamsForScheduling[0];
      const rotatingTeamOppositeFixed = teamsForScheduling[(roundNum + (n - 1)) % (n - 1) + 1] || teamsForScheduling[n - 1]; // Robust indexing

      if (fixedTeam.name !== 'BYE' && rotatingTeamOppositeFixed.name !== 'BYE') {
        if (roundNum % 2 === 0) {
          currentRoundFixtures.push({ teamA: fixedTeam.name, teamB: rotatingTeamOppositeFixed.name });
        } else {
          currentRoundFixtures.push({ teamA: rotatingTeamOppositeFixed.name, teamB: fixedTeam.name });
        }
      }

      // Pair the remaining teams
      for (let i = 1; i < n / 2; i++) {
        const team1 = teamsForScheduling[(roundNum + i) % (n - 1) + 1];
        const team2 = teamsForScheduling[(roundNum + n - 1 - i) % (n - 1) + 1];

        if (team1.name !== 'BYE' && team2.name !== 'BYE') {
          if (i % 2 === 0) {
            currentRoundFixtures.push({ teamA: team1.name, teamB: team2.name });
          } else {
            currentRoundFixtures.push({ teamA: team2.name, teamB: team1.name });
          }
        }
      }
      shuffleArray(currentRoundFixtures); // Shuffle fixtures within each round
      allLogicalRounds.push(currentRoundFixtures);
    }

    let finalFixturesForDb = [];
    if (isHomeAndAway) {
      let returnRounds = [];
      allLogicalRounds.forEach(round => {
        let returnRound = [];
        round.forEach(fixture => {
          returnRound.push({ teamA: fixture.teamB, teamB: fixture.teamA });
        });
        returnRounds.push(returnRound);
      });
      allLogicalRounds = [...allLogicalRounds, ...returnRounds];
    }

    allLogicalRounds.forEach((roundFixtures, index) => {
      const weekNumber = index + 1; // Start week numbers from 1
      roundFixtures.forEach(fixture => {
        finalFixturesForDb.push({
          ...fixture,
          weekNumber: weekNumber,
          groupId: groupId, // Assign fixture to its group
        });
      });
    });

    return finalFixturesForDb;
  }, [shuffleArray]);

  const handleGenerateFixtures = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to generate fixtures in view-only mode.', null, false);
      return;
    }

    if (teams.length < 2) {
      openCustomModal('Info', 'You need at least two teams to generate fixtures!', null, false);
      return;
    }

    if (!tournamentDetails) {
      openCustomModal('Error', 'Tournament details not loaded. Cannot generate fixtures.', null, false);
      return;
    }

    const currentFixtureOption = tournamentDetails.fixtureOption || 'Single Matches';
    const isHomeAndAway = currentFixtureOption === 'Home and Away Matches';

    let allGeneratedFixtures = [];
    let currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0); // Normalize to midday to avoid timezone issues

    if (tournamentDetails.type === 'Multi-Phase' && tournamentDetails.groups && tournamentDetails.groups.length > 0) {
      // Generate fixtures for each group
      for (const groupName of tournamentDetails.groups) {
        const teamsInGroup = teams.filter(team => team.group === groupName);
        if (teamsInGroup.length < 2) {
          console.warn(`Skipping fixture generation for group "${groupName}": Not enough teams.`);
          continue;
        }
        const groupFixtures = generateRoundRobinFixtures(teamsInGroup, isHomeAndAway, groupName);

        allGeneratedFixtures.push(...groupFixtures);
      }
    } else {
      // Existing logic for League type, or Multi-Phase without groups defined
      const teamObjects = teams.map(t => ({ name: t.name, id: t.id })); // Pass full team objects
      const generatedFixturesWithWeekNumbers = generateRoundRobinFixtures(teamObjects, isHomeAndAway, ''); // No group ID for non-grouped
      allGeneratedFixtures.push(...generatedFixturesWithWeekNumbers);
    }

    // Sort all fixtures by week number for consistent date assignment
    allGeneratedFixtures.sort((a, b) => a.weekNumber - b.weekNumber);

    const finalFixturesToSave = [];
    let currentWeek = 0;
    allGeneratedFixtures.forEach(fixture => {
      // Advance date only when moving to a new week
      if (fixture.weekNumber > currentWeek) {
        if (currentWeek > 0) { // Don't advance for the first week
          currentDate.setDate(currentDate.getDate() + 7); // Advance by a week for the next set of fixtures
        }
        currentWeek = fixture.weekNumber;
      }

      finalFixturesToSave.push({
        teamA: fixture.teamA,
        teamB: fixture.teamB,
        date: currentDate.toISOString().split('T')[0],
        timestamp: new Date(currentDate), // Store as Date object for Firestore
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        weekNumber: fixture.weekNumber,
        groupId: fixture.groupId || '', // Include groupId
      });
    });


    if (finalFixturesToSave.length === 0) {
      openCustomModal('Info', 'No fixtures could be generated. Check your team list, groups, and fixture options.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Fixture Generation',
      `This will delete ALL existing fixtures and generate ${finalFixturesToSave.length} new ones. Are you sure?`,
      async () => {
        const batch = writeBatch(db);
        const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);

        // Delete existing fixtures
        const existingFixturesSnapshot = await getDocs(fixturesCollectionRef);
        existingFixturesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Add new fixtures
        finalFixturesToSave.forEach(fixture => {
          const newFixtureRef = doc(fixturesCollectionRef); // Let Firestore auto-generate ID
          batch.set(newFixtureRef, fixture);
        });

        try {
          await batch.commit();
          closeCustomModal();
          openCustomModal('Success', `Successfully generated ${finalFixturesToSave.length} fixtures!`, null, false);
          // Optionally, trigger a leaderboard update here if it depends on fixtures
          // For now, assume leaderboard update is handled elsewhere or is reactive to fixture changes
        } catch (err) {
          console.error('Error generating fixtures:', err);
          openCustomModal('Error', 'Failed to generate fixtures. Please try again.');
        }
      }
    );
  };

  const handleAddFixture = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to add fixtures in view-only mode.', null, false);
      return;
    }

    setFixtureError('');
    if (!newFixture.teamA || !newFixture.teamB || !newFixture.date) {
      setFixtureError('Please select both teams and a date for the fixture.');
      return;
    }
    if (newFixture.teamA === newFixture.teamB) {
      setFixtureError('Teams cannot be the same.');
      return;
    }
    let fixtureGroup = '';
    // For multi-phase, ensure teams selected are from the same group if groups exist
    if (tournamentDetails?.type === 'Multi-Phase' && tournamentDetails.groups && tournamentDetails.groups.length > 0) {
        const teamAObj = teams.find(t => t.name === newFixture.teamA);
        const teamBObj = teams.find(t => t.name === newFixture.teamB);

        if (!teamAObj || !teamBObj || teamAObj.group !== teamBObj.group) {
            setFixtureError('For Multi-Phase tournaments, teams must be from the same group for custom fixtures.');
            return;
        }
        fixtureGroup = teamAObj.group; // Assign group ID to the fixture
    }


    try {
      const fixtureDate = new Date(newFixture.date);
      // Validate date object
      if (isNaN(fixtureDate.getTime())) {
        setFixtureError('Invalid date format.');
        return;
      }
      fixtureDate.setHours(12, 0, 0, 0); // Normalize date to midday UTC

      await addDoc(collection(db, `tournaments/${tournamentId}/fixtures`), {
        ...newFixture,
        timestamp: fixtureDate, // Store as Date object for Firestore
        scoreA: 0, // Default scores
        scoreB: 0,
        status: 'scheduled', // Default status
        weekNumber: 0, // Manually added fixtures default to week 0, can be updated later if needed
        groupId: fixtureGroup, // Store the group ID
      });
      setNewFixture({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0, groupId: '' }); // Reset form
      setFixtureError(''); // Clear any previous errors
      setIsAddingFixture(false); // Hide the form after adding
    } catch (err) {
      console.error('Error adding fixture:', err);
      setFixtureError('Failed to add fixture.');
    }
  };

  const handleDeleteFixture = async (fixtureId) => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to delete fixtures in view-only mode.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Delete',
      'Are you sure you want to delete this fixture? This action cannot be undone.',
      async () => {
        try {
          await deleteDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId));
          closeCustomModal();
          // Assume leaderboard updates reactively or a separate function triggers it
        } catch (err) {
          console.error('Error deleting fixture:', err);
          openCustomModal('Error', 'Failed to delete fixture. Please try again.');
        }
      }
    );
  };

  const handleClearAllFixtures = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to clear all fixtures in view-only mode.', null, false);
      return;
    }

    if (fixtures.length === 0) {
      openCustomModal('Info', 'No fixtures to clear.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Clear All Fixtures',
      'Are you sure you want to delete ALL fixtures? This will reset match data for the leaderboard.',
      async () => {
        const batch = writeBatch(db);
        fixtures.forEach(fixture => {
          const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixture.id);
          batch.delete(fixtureRef);
        });

        try {
          await batch.commit();
          closeCustomModal();
          openCustomModal('Success', 'All fixtures cleared successfully!', null, false);
          // Assuming leaderboard updates reactively
        } catch (err) {
          console.error('Error clearing all fixtures:', err);
          openCustomModal('Error', 'Failed to clear all fixtures. Please try again.');
        }
      }
    );
  };

  const handleOpenScoreModal = (fixture) => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to edit scores in view-only mode.', null, false);
      return;
    }
    setEditingFixture(fixture);
    setScoreModalOpen(true);
  };

  const handleCloseScoreModal = () => {
    setScoreModalOpen(false);
    setEditingFixture(null);
  };

  const handleUpdateScore = async () => {
    if (!editingFixture || !scoreInputRef.current) return;

    const scoreA = scoreInputRef.current.getScoreA();
    const scoreB = scoreInputRef.current.getScoreB();

    const parsedScoreA = parseInt(scoreA);
    const parsedScoreB = parseInt(scoreB);

    if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
      openCustomModal('Invalid Input', 'Please enter valid numbers for scores.', null, false);
      return;
    }

    try {
      const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, editingFixture.id);
      await updateDoc(fixtureRef, {
        scoreA: parsedScoreA,
        scoreB: parsedScoreB,
        status: 'completed', // Mark as completed once score is updated
      });
      handleCloseScoreModal();
      openCustomModal('Success', 'Score updated successfully!', null, false);
      // Assuming leaderboard updates reactively
    } catch (err) {
      console.error('Error updating score:', err);
      openCustomModal('Error', 'Failed to update score. Please try again.', null, false);
    }
  };

  const groupedFixtures = useMemo(() => {
    const groupedByGroup = fixtures.reduce((acc, fixture) => {
      const group = fixture.groupId || 'Ungrouped'; // Use 'Ungrouped' for fixtures without a group
      if (!acc[group]) {
        acc[group] = {};
      }
      const week = fixture.weekNumber > 0 ? `Week ${fixture.weekNumber}` : 'Manual Fixtures';
      if (!acc[group][week]) {
        acc[group][week] = [];
      }
      acc[group][week].push(fixture);
      return acc;
    }, {});

    // Sort groups alphabetically, with 'Ungrouped' last
    const sortedGroupNames = Object.keys(groupedByGroup).sort((a, b) => {
      if (a === 'Ungrouped') return 1;
      if (b === 'Ungrouped') return -1;
      return a.localeCompare(b);
    });

    const finalGrouped = {};
    sortedGroupNames.forEach(groupName => {
      finalGrouped[groupName] = groupedByGroup[groupName];
      // Sort weeks within each group
      const sortedWeekNumbers = Object.keys(finalGrouped[groupName]).sort((a, b) => {
        if (a === 'Manual Fixtures') return 1;
        if (b === 'Manual Fixtures') return -1;
        return parseInt(a.replace('Week ', '')) - parseInt(b.replace('Week ', ''));
      });
      const sortedWeeksObj = {};
      sortedWeekNumbers.forEach(week => {
        sortedWeeksObj[week] = finalGrouped[groupName][week];
      });
      finalGrouped[groupName] = sortedWeeksObj;
    });

    return finalGrouped;
  }, [fixtures]);


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        Loading fixtures...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className={`bg-red-600 text-white p-4 font-bold text-lg flex flex-wrap justify-around sm:flex-nowrap`}>
        <Link to={`/tournament/${tournamentId}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors hidden md:block">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors hidden md:block">KNOCKOUT</Link>
        {/* Add responsive navigation for other pages if needed for small screens */}
      </div>

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          📅 Fixtures: {tournamentDetails?.name || 'Loading...'}
        </h2>

        {!isViewOnly && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
            <button
              onClick={handleGenerateFixtures}
              className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
            >
              Generate Fixtures
            </button>
            <button
              onClick={() => setIsAddingFixture(!isAddingFixture)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
            >
              {isAddingFixture ? 'Hide Add Fixture Form' : '➕ Add New Fixture'}
            </button>
            <button
              onClick={handleClearAllFixtures}
              className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-red-700 transition-colors duration-200 font-semibold text-base whitespace-nowrap"
            >
              Clear All Fixtures
            </button>
          </div>
        )}

        {isAddingFixture && !isViewOnly && (
          <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-center">Add New Fixture</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="teamA" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team A</label>
                <select
                  id="teamA"
                  value={newFixture.teamA}
                  onChange={(e) => setNewFixture({ ...newFixture, teamA: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select Team A</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="teamB" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team B</label>
                <select
                  id="teamB"
                  value={newFixture.teamB}
                  onChange={(e) => setNewFixture({ ...newFixture, teamB: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select Team B</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  id="date"
                  value={newFixture.date}
                  onChange={(e) => setNewFixture({ ...newFixture, date: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {fixtureError && <p className="text-red-500 text-center mb-4">{fixtureError}</p>}
            <button
              onClick={handleAddFixture}
              className="w-full bg-green-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-600 transition-colors duration-200 font-semibold text-base"
            >
              Add Fixture
            </button>
          </div>
        )}

        {fixtures.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">No fixtures found. Generate or add some!</p>
        ) : (
          <div className="space-y-8 mt-8">
            {Object.keys(groupedFixtures).map(groupName => (
              <div key={groupName} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl sm:text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
                  {groupName !== 'Ungrouped' ? `Group ${groupName}` : 'Ungrouped Fixtures'}
                </h3>
                {Object.keys(groupedFixtures[groupName]).map(week => (
                  <div key={`${groupName}-${week}`} className="mb-8">
                    <h4 className="text-lg sm:text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center">{week}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {groupedFixtures[groupName][week].map((fixture) => (
                        <div
                          key={fixture.id}
                          className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md flex flex-col justify-between transition-transform transform hover:scale-[1.02] border border-gray-200 dark:border-gray-600"
                        >
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-300 mb-2">{fixture.date}</p>
                            <div className="flex justify-between items-center text-lg font-semibold mb-4">
                              <span>{fixture.teamA}</span>
                              <span className="mx-2">vs</span>
                              <span>{fixture.teamB}</span>
                            </div>
                            <div className="text-center text-2xl font-bold mb-4">
                              {fixture.status === 'completed' ? (
                                <span className="text-green-600 dark:text-green-400">
                                  {fixture.scoreA} - {fixture.scoreB}
                                </span>
                              ) : (
                                <span className="text-yellow-600 dark:text-yellow-400">
                                  Scheduled
                                </span>
                              )}
                            </div>
                          </div>
                          {!isViewOnly && (
                            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                              <button
                                onClick={() => handleOpenScoreModal(fixture)}
                                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-semibold"
                              >
                                Update Score
                              </button>
                              <button
                                onClick={() => handleDeleteFixture(fixture.id)}
                                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors font-semibold"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Modal */}
      <Modal
        isOpen={customModalOpen}
        onClose={closeCustomModal}
        onConfirm={customModalOnConfirm}
        title={customModalTitle}
        message={customModalMessage}
        showConfirmButton={customModalOnConfirm !== null && customModalShowConfirm}
        confirmText="Confirm"
        cancelText="Close"
      />

      {/* Score Input Modal */}
      {editingFixture && (
        <Modal
          isOpen={scoreModalOpen}
          onClose={handleCloseScoreModal}
          onConfirm={handleUpdateScore}
          title={`Update Score for ${editingFixture.teamA} vs ${editingFixture.teamB}`}
          confirmText="Save Score"
        >
          <ScoreInputModalContent
            ref={scoreInputRef}
            fixture={editingFixture}
            initialScoreA={editingFixture.scoreA}
            initialScoreB={editingFixture.scoreB}
          />
        </Modal>
      )}
    </div>
  );
}
