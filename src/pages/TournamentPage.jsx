import React, { useEffect, useState, useCallback, useRef } from 'react'; // Added useRef
import { db } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  getDoc,
  writeBatch,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
// Import the shared Modal component. This is the preferred way to handle modals.
import Modal from '../components/Modal';
// Import the new dedicated component for score inputs
import ScoreInputModalContent from '../components/ScoreInputModalContent';

export default function TournamentPage() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Tournament Details State
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loadingTournamentData, setLoadingTournamentData] = useState(true);
  const [generalError, setGeneralError] = useState(null); // Renamed for clarity

  // Team Management State
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');

  // Fixture Management State
  const [fixtures, setFixtures] = useState([]);
  const [newFixture, setNewFixture] = useState({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
  const [fixtureError, setFixtureError] = useState('');

  // Modal State (for the shared Modal component)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalContent, setModalContent] = useState(null); // For custom content (e.g., input fields)
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);

  // Score Update Modal State (These are for the *inputs* within the modal content)
  // REMOVED tempScoreA, setTempScoreA, tempScoreB, setTempScoreB from THIS component
  // They are now managed within ScoreInputModalContent.jsx

  // REF to access the ScoreInputModalContent component's methods (like getScoreA/B)
  const scoreInputRef = useRef(null);
  // State to hold the specific fixture being updated when the modal is open
  const [currentFixtureToUpdate, setCurrentFixtureToUpdate] = useState(null);


  // Tournament Configuration State (now directly in the main settings section)
  const [enableColors, setEnableColors] = useState(false);
  const [promotionSpots, setPromotionSpots] = useState('');
  const [europeLeagueSpots, setEuropeLeagueSpots] = useState('');
  const [relegationSpots, setRelegationSpots] = useState('');
  const [fixtureOption, setFixtureOption] = useState('Single Matches');
  const [pointsPerWin, setPointsPerWin] = useState(3);
  const [pointsPerDraw, setPointsPerDraw] = useState(1);

  // Helper function to open the custom modal (uses the shared Modal component)
  const openCustomModal = useCallback((title, message, confirmAction = null, showConfirm = true, content = null) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction); // Use a functional update for state
    setModalShowConfirmButton(showConfirm);
    setModalContent(content);
    setIsModalOpen(true);
  }, []); // Memoize the function

  const closeCustomModal = useCallback(() => {
    setIsModalOpen(false);
    setModalTitle('');
    setModalMessage('');
    setModalContent(null);
    setModalConfirmAction(null);
    setModalShowConfirmButton(true);
    // No need to clear temp scores here, as they are now local to ScoreInputModalContent
  }, []); // Memoize the function

  // --- Effect to fetch Tournament Details ---
  useEffect(() => {
    if (authLoading) {
      setLoadingTournamentData(true);
      return;
    }

    if (!user || !user.uid) {
      setGeneralError("You must be logged in to view tournament details.");
      setLoadingTournamentData(false);
      return;
    }

    if (!tournamentId) {
      setGeneralError("No tournament ID provided in the URL.");
      setLoadingTournamentData(false);
      return;
    }

    setLoadingTournamentData(true);
    setGeneralError(null);

    const fetchTournamentDetails = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);

        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          if (user.uid && data.userId === user.uid) {
            setTournamentName(data.name);
            setTournamentDetails(data);
            // Initialize config states from fetched data, ensuring fallbacks.
            setEnableColors(data.enableColors || false);
            setPromotionSpots(data.promotionSpots !== undefined ? String(data.promotionSpots) : '');
            setEuropeLeagueSpots(data.europeLeagueSpots !== undefined ? String(data.europeLeagueSpots) : '');
            setRelegationSpots(data.relegationSpots !== undefined ? String(data.relegationSpots) : '');
            setFixtureOption(data.fixtureOption || 'Single Matches');
            setPointsPerWin(data.pointsPerWin !== undefined ? data.pointsPerWin : 3);
            setPointsPerDraw(data.pointsPerDraw !== undefined ? data.pointsPerDraw : 1);

          } else {
            setTournamentName('Access Denied');
            setGeneralError('You do not have permission to access this tournament.');
          }
        } else {
          setTournamentName('Tournament Not Found');
          setGeneralError('The requested tournament does not exist.');
        }
        setLoadingTournamentData(false);
      } catch (err) {
        console.error('Error fetching tournament details:', err);
        setTournamentName('Error');
        setGeneralError('Failed to load tournament details. Please try again.');
        setLoadingTournamentData(false);
      }
    };
    fetchTournamentDetails();
  }, [tournamentId, user, authLoading]);

  // --- Effect to listen to Teams ---
  useEffect(() => {
    if (authLoading || !user || !tournamentId || generalError) {
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
  }, [tournamentId, user, authLoading, generalError]);

  // --- Effect to listen to Fixtures ---
  useEffect(() => {
    if (authLoading || !user || !tournamentId || generalError) {
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
  }, [tournamentId, user, authLoading, generalError]);

  // --- Leaderboard Update Logic ---
  const updateLeaderboard = useCallback(async () => {
    if (!tournamentId || !tournamentDetails) {
      console.log('Skipping leaderboard update: tournamentId or tournamentDetails missing.');
      return;
    }

    const leaderboardRef = collection(db, `tournaments/${tournamentId}/leaderboard`);
    const teamsRef = collection(db, `tournaments/${tournamentId}/teams`);
    const fixturesRef = collection(db, `tournaments/${tournamentId}/fixtures`);

    try {
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
          const scoreA = Number(fixture.scoreA) || 0;
          const scoreB = Number(fixture.scoreB) || 0;

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

      const currentPointsPerWin = tournamentDetails?.pointsPerWin || 3;
      const currentPointsPerDraw = tournamentDetails?.pointsPerDraw || 1;

      const batch = writeBatch(db);
      for (const teamName in teamStats) {
        const stats = teamStats[teamName];
        stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
        stats.points = (stats.wins * currentPointsPerWin) + (stats.draws * currentPointsPerDraw);

        const teamLeaderboardDocRef = doc(leaderboardRef, stats.id);
        batch.set(teamLeaderboardDocRef, stats, { merge: true });
      }

      await batch.commit();
      console.log('Leaderboard updated successfully!');
    } catch (err) {
      console.error('Error updating leaderboard:', err);
    }
  }, [tournamentId, tournamentDetails]);

  // Effect to trigger leaderboard update when fixtures or tournamentDetails change
  useEffect(() => {
    if (!authLoading && user && tournamentDetails) {
      if (fixtures.length > 0 || (fixtures.length === 0 && !loadingTournamentData)) {
        updateLeaderboard();
      }
    }
  }, [fixtures, tournamentDetails, authLoading, user, updateLeaderboard, loadingTournamentData]);

  // --- Team Management Handlers ---
  const handleAddTeam = async () => {
    setTeamError('');
    if (!newTeamName.trim()) {
      setTeamError('Team name cannot be empty.');
      return;
    }
    if (teams.some(team => team.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      setTeamError('A team with this name already exists.');
      return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/teams`), { name: newTeamName });
      setNewTeamName('');
    } catch (err) {
      console.error('Error adding team:', err);
      setTeamError('Failed to add team. Make sure the tournament ID is valid and you have permission.');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    openCustomModal(
      'Confirm Delete',
      'Are you sure you want to delete this team? This action cannot be undone.',
      async () => {
        try {
          await deleteDoc(doc(db, `tournaments/${tournamentId}/teams`, teamId));
          closeCustomModal();
          updateLeaderboard();
        } catch (err) {
          console.error('Error deleting team:', err);
          openCustomModal('Error', 'Failed to delete team. Please try again.');
        }
      }
    );
  };

  const handleClearAllTeams = async () => {
    if (teams.length === 0) {
      openCustomModal('Info', 'No teams to clear.', null, false);
      return;
    }
    openCustomModal(
      'Confirm Clear All Teams',
      'Are you sure you want to delete ALL teams? This will also affect past match records.',
      async () => {
        const batch = writeBatch(db);
        teams.forEach(team => {
          const teamRef = doc(db, `tournaments/${tournamentId}/teams`, team.id);
          batch.delete(teamRef);
        });
        try {
          await batch.commit();
          closeCustomModal();
          openCustomModal('Success', 'All teams cleared successfully.', null, false);
          updateLeaderboard();
        } catch (err) {
          console.error('Error clearing teams:', err);
          openCustomModal('Error', 'Failed to clear all teams. Please try again.');
        }
      }
    );
  };

  // --- Tournament Settings Handlers ---
  const handleSaveTournamentSettings = async () => {
    try {
      const tournamentRef = doc(db, 'tournaments', tournamentId);
      await updateDoc(tournamentRef, {
        enableColors: enableColors,
        promotionSpots: parseInt(promotionSpots) || 0,
        europeLeagueSpots: parseInt(europeLeagueSpots) || 0,
        relegationSpots: parseInt(relegationSpots) || 0,
        fixtureOption: fixtureOption,
        pointsPerWin: parseInt(pointsPerWin) || 3,
        pointsPerDraw: parseInt(pointsPerDraw) || 1,
      });
      openCustomModal('Success', 'Tournament settings saved successfully!', null, false);
      setTournamentDetails(prev => ({
        ...prev,
        enableColors: enableColors,
        promotionSpots: parseInt(promotionSpots) || 0,
        europeLeagueSpots: parseInt(europeLeagueSpots) || 0,
        relegationSpots: parseInt(relegationSpots) || 0,
        fixtureOption: fixtureOption,
        pointsPerWin: parseInt(pointsPerWin) || 3,
        pointsPerDraw: parseInt(pointsPerDraw) || 1,
      }));
    } catch (err) {
      console.error('Error saving tournament configuration:', err);
      openCustomModal('Error', 'Failed to save tournament configuration. Please try again.');
    }
  };

  // New helper function to shuffle an array
  const shuffleArray = useCallback((array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }, []);

  // Modified generateRoundRobinFixtures function
  const generateRoundRobinFixtures = useCallback((teamNames, isHomeAndAway) => {
    const numTeams = teamNames.length;
    if (numTeams < 2) return [];

    let teamsForScheduling = [...teamNames];
    if (numTeams % 2 !== 0) {
      teamsForScheduling.push('BYE');
    }

    const n = teamsForScheduling.length;
    const roundsNeeded = n - 1;

    let allLogicalRounds = [];

    for (let roundNum = 0; roundNum < roundsNeeded; roundNum++) {
      let currentRoundFixtures = [];
      const fixedTeam = teamsForScheduling[0];

      const rotatingTeamOppositeFixed = teamsForScheduling[(roundNum + (n - 1)) % (n - 1) + 1] || teamsForScheduling[n - 1]; // Corrected indexing for robustness
      if (fixedTeam !== 'BYE' && rotatingTeamOppositeFixed !== 'BYE') {
        if (roundNum % 2 === 0) {
          currentRoundFixtures.push({ teamA: fixedTeam, teamB: rotatingTeamOppositeFixed });
        } else {
          currentRoundFixtures.push({ teamA: rotatingTeamOppositeFixed, teamB: fixedTeam });
        }
      }

      for (let i = 1; i < n / 2; i++) {
        const team1 = teamsForScheduling[(roundNum + i) % (n - 1) + 1];
        const team2 = teamsForScheduling[(roundNum + n - 1 - i) % (n - 1) + 1];

        if (team1 !== 'BYE' && team2 !== 'BYE') {
          if (i % 2 === 0) {
            currentRoundFixtures.push({ teamA: team1, teamB: team2 });
          } else {
            currentRoundFixtures.push({ teamA: team2, teamB: team1 });
          }
        }
      }
      shuffleArray(currentRoundFixtures);
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
      const weekNumber = index + 1;
      roundFixtures.forEach(fixture => {
        finalFixturesForDb.push({
          ...fixture,
          weekNumber: weekNumber,
        });
      });
    });

    return finalFixturesForDb;
  }, [shuffleArray]);

  const handleGenerateFixtures = async () => {
    if (teams.length < 2) {
      openCustomModal('Info', 'You need at least two teams to generate fixtures!', null, false);
      return;
    }
    if (!tournamentDetails) {
      openCustomModal('Error', 'Tournament details not loaded. Cannot generate fixtures.', null, false);
      return;
    }

    const currentFixtureOption = tournamentDetails.fixtureOption || 'Single Matches';
    const teamNames = teams.map(t => t.name);

    const generatedFixturesWithWeekNumbers = generateRoundRobinFixtures(teamNames, currentFixtureOption === 'Home and Away Matches');

    let currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0);

    const finalFixturesToSave = [];
    const groupedByWeek = generatedFixturesWithWeekNumbers.reduce((acc, fixture) => {
      const weekNum = fixture.weekNumber;
      if (!acc[weekNum]) {
        acc[weekNum] = [];
      }
      acc[weekNum].push(fixture);
      return acc;
    }, {});

    const sortedWeekNumbers = Object.keys(groupedByWeek).sort((a, b) => parseInt(a) - parseInt(b));

    sortedWeekNumbers.forEach(weekNum => {
      const fixturesInThisWeek = groupedByWeek[weekNum];
      fixturesInThisWeek.forEach(fixture => {
        finalFixturesToSave.push({
          teamA: fixture.teamA,
          teamB: fixture.teamB,
          date: currentDate.toISOString().split('T')[0],
          timestamp: new Date(currentDate),
          status: 'scheduled',
          scoreA: 0,
          scoreB: 0,
          weekNumber: parseInt(weekNum),
        });
      });
      currentDate.setDate(currentDate.getDate() + 7);
    });

    if (finalFixturesToSave.length === 0) {
      openCustomModal('Info', 'No fixtures could be generated. Check your team list and fixture options.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Fixture Generation',
      `This will delete ALL existing fixtures and generate ${finalFixturesToSave.length} new ones based on '${currentFixtureOption}'. Are you sure?`,
      async () => {
        const batch = writeBatch(db);
        const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);

        const existingFixturesSnapshot = await getDocs(fixturesCollectionRef);
        existingFixturesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        finalFixturesToSave.forEach(fixture => {
          const newFixtureRef = doc(fixturesCollectionRef);
          batch.set(newFixtureRef, fixture);
        });

        try {
          await batch.commit();
          closeCustomModal();
          openCustomModal('Success', `Successfully generated ${finalFixturesToSave.length} fixtures!`, null, false);
          updateLeaderboard();
        } catch (err) {
          console.error('Error generating fixtures:', err);
          openCustomModal('Error', 'Failed to generate fixtures. Please try again.');
        }
      }
    );
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
      if (isNaN(fixtureDate.getTime())) {
        setFixtureError('Invalid date format.');
        return;
      }
      fixtureDate.setHours(12, 0, 0, 0);

      await addDoc(collection(db, `tournaments/${tournamentId}/fixtures`), {
        ...newFixture,
        timestamp: fixtureDate,
        scoreA: 0,
        scoreB: 0,
        status: 'scheduled',
        weekNumber: 0,
      });
      setNewFixture({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
    } catch (err) {
      console.error('Error adding fixture:', err);
      setFixtureError('Failed to add fixture.');
    }
  };

  const handleDeleteFixture = async (fixtureId) => {
    openCustomModal(
      'Confirm Delete',
      'Are you sure you want to delete this fixture? This action cannot be undone.',
      async () => {
        try {
          await deleteDoc(doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId));
          closeCustomModal();
          updateLeaderboard();
        } catch (err) {
          console.error('Error deleting fixture:', err);
          openCustomModal('Error', 'Failed to delete fixture. Please try again.');
        }
      }
    );
  };

  const handleClearAllFixtures = async () => {
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
          openCustomModal('Success', 'All fixtures cleared successfully.', null, false);
          updateLeaderboard();
        } catch (err) {
          console.error('Error clearing fixtures:', err);
          openCustomModal('Error', 'Failed to clear all fixtures. Please try again.');
        }
      }
    );
  };

  // UPDATED handleUpdateScores to use ScoreInputModalContent
  const handleUpdateScores = useCallback(async (fixtureId, currentScoreA, currentScoreB) => {
    const fixtureToUpdate = fixtures.find(f => f.id === fixtureId);
    if (!fixtureToUpdate) {
      console.warn(`Fixture with ID ${fixtureId} not found.`);
      return;
    }

    // Set the specific fixture being updated in state
    setCurrentFixtureToUpdate(fixtureToUpdate);

    // Define the confirmation logic that will run when the modal's Confirm button is clicked
    const confirmAction = async () => {
      // Read the scores directly from the ScoreInputModalContent component via ref
      // Ensure scoreInputRef.current exists before attempting to read
      if (!scoreInputRef.current) {
        console.error("scoreInputRef.current is null. ScoreInputModalContent might not be mounted or ref not attached.");
        openCustomModal('Error', 'Internal error: Cannot read scores. Please try again.', null, false);
        return;
      }

      const parsedScoreA = parseInt(scoreInputRef.current.getScoreA());
      const parsedScoreB = parseInt(scoreInputRef.current.getScoreB());

      if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
        // Re-open modal with error message, don't close it, and retain input values
        openCustomModal('Invalid Input', 'Please enter valid numbers for scores.', null, false, (
          // Pass the current fixture and the *last known input values* back to ScoreInputModalContent for persistence
          // Use the values from the ref, as they are the latest user input
          <ScoreInputModalContent
            ref={scoreInputRef} // Re-attach ref for the new render of ScoreInputModalContent
            fixture={fixtureToUpdate}
            initialScoreA={scoreInputRef.current.getScoreA()}
            initialScoreB={scoreInputRef.current.getScoreB()}
          />
        ));
        return; // Important: Stop execution here if validation fails
      }

      try {
        const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);
        await updateDoc(fixtureRef, {
          scoreA: parsedScoreA,
          scoreB: parsedScoreB,
          status: 'completed'
        });
        closeCustomModal(); // Close the score update modal on success
        updateLeaderboard(); // Trigger leaderboard update after score update
      } catch (err) {
        console.error('Error updating scores:', err);
        // Re-open modal with error, retain input values
        openCustomModal('Error', 'Failed to update scores. Please try again.', null, false, (
          // Pass the current fixture and the *last known input values* back to ScoreInputModalContent for persistence
          <ScoreInputModalContent
            ref={scoreInputRef} // Re-attach ref for the new render of ScoreInputModalContent
            fixture={fixtureToUpdate}
            initialScoreA={scoreInputRef.current.getScoreA()}
            initialScoreB={scoreInputRef.current.getScoreB()}
          />
        ));
      }
    };

    // Open the modal, passing ScoreInputModalContent as the 'content' prop
    // We pass initialScoreA/B to ScoreInputModalContent via props
    openCustomModal(
      'Update Match Scores',
      `Enter scores for ${fixtureToUpdate.teamA} vs ${fixtureToUpdate.teamB}:`,
      confirmAction, // This is the logic to run on confirm
      true, // showConfirmButton
      // Pass the actual ScoreInputModalContent component as content, with a ref and initial scores
      // Note: currentFixtureToUpdate is handled by a separate state, but fixture prop is directly from the click handler
      <ScoreInputModalContent
        ref={scoreInputRef} // Attach ref here so parent can access its methods
        fixture={fixtureToUpdate} // Pass the full fixture object
        initialScoreA={currentScoreA}
        initialScoreB={currentScoreB}
      />
    );
  }, [fixtures, tournamentId, openCustomModal, closeCustomModal, updateLeaderboard]); // Added updateLeaderboard to dependencies

  // Common Loading/Error/No Access UI
  const renderLoadingOrError = () => (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar - Always render for consistent layout */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">✨ {tournamentName} Details</h2>
        {generalError ? (
          <p className="text-red-500 text-center py-8">{generalError}</p>
        ) : (
          <p className="text-center text-gray-500 py-8">Loading tournament data...</p>
        )}
      </div>
    </div>
  );

  if (loadingTournamentData || authLoading || generalError) {
    return renderLoadingOrError();
  }

  // ADD THIS LINE FOR DEBUGGING
  // This will log every time TournamentPage renders.
  // Note: tempScoreA/B are now internal to ScoreInputModalContent, so we're logging currentFixtureToUpdate instead
  console.log('TournamentPage rendering. currentFixtureToUpdate:', currentFixtureToUpdate?.id, 'isModalOpen:', isModalOpen);


  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-900 dark:text-white">✨ {tournamentName} Administration</h2>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 h-fit">
            <h3 className="text-2xl font-bold mb-5 text-gray-800 dark:text-white">Tournament Menu</h3>
            <ul className="space-y-3">
              <li>
                <Link to={`/tournament/${tournamentId}/leaderboard`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Leaderboard
                </Link>
              </li>
              <li>
                <Link to={`/tournament/${tournamentId}/fixtures`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  View Fixtures
                </Link>
              </li>
              <li>
                <Link to={`/tournament/${tournamentId}/players`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h-4v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m3-3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Player Management
                </Link>
              </li>
              <li>
                <Link to={`/tournament/${tournamentId}/stats`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  View Statistics
                </Link>
              </li>
              <li>
                <Link to={`/tournament/${tournamentId}/knockout`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Knockout Stage
                </Link>
              </li>
              <li>
                <Link to={`/tournament/${tournamentId}/ai-prediction`} className="flex items-center px-4 py-3 rounded-md hover:bg-red-100 dark:hover:bg-gray-700 transition-colors text-lg font-medium text-red-700 dark:text-red-400">
                  <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h6l-1-1v-3m-6 0l-2-2m2 2l-2 2m7-2l2-2m-2 2l2 2M3 11a6 6 0 0112 0v2l-3 3-3-3v-2A6 6 0 013 11z" />
                  </svg>
                  AI Prediction
                </Link>
              </li>
            </ul>
          </div>

          {/* Main Content Area (Tournament Settings, Team Management, Fixture Management) */}
          <div className="lg:col-span-3 space-y-8">
            {/* Tournament Settings Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">⚙️ Tournament Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Points System */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Points System:</h4>
                  <div className="flex items-center justify-between">
                    <label className="text-gray-600 dark:text-gray-400">Points for a Win:</label>
                    <input
                      type="number"
                      value={pointsPerWin}
                      onChange={(e) => setPointsPerWin(parseInt(e.target.value) || 0)}
                      className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-gray-600 dark:text-gray-400">Points for a Draw:</label>
                    <input
                      type="number"
                      value={pointsPerDraw}
                      onChange={(e) => setPointsPerDraw(parseInt(e.target.value) || 0)}
                      className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                </div>

                {/* Promotion/Relegation Spots */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">League Spots Configuration:</h4>
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-green-600 dark:text-green-400">Promotion Spots</label>
                    <input
                      type="number"
                      value={promotionSpots}
                      onChange={(e) => setPromotionSpots(e.target.value)}
                      className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-yellow-600 dark:text-yellow-400">Europe League Spots</label>
                    <input
                      type="number"
                      value={europeLeagueSpots}
                      onChange={(e) => setEuropeLeagueSpots(e.target.value)}
                      className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-red-600 dark:text-red-400">Relegation Spots</label>
                    <input
                      type="number"
                      value={relegationSpots}
                      onChange={(e) => setRelegationSpots(e.target.value)}
                      className="w-20 px-3 py-1 border rounded-md text-center dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Fixture Option & Colors */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-semibold text-gray-700 dark:text-gray-300">Fixture Type:</label>
                  <select
                    value={fixtureOption}
                    onChange={(e) => setFixtureOption(e.target.value)}
                    className="border p-2 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Single Matches">Single Matches (Each team plays once)</option>
                    <option value="Home and Away Matches">Home and Away (Each team plays twice)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-lg font-semibold text-gray-700 dark:text-gray-300">Enable Leaderboard Colors:</label>
                  <input
                    type="checkbox"
                    checked={enableColors}
                    onChange={(e) => setEnableColors(e.target.checked)}
                    className="w-5 h-5 accent-red-600"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveTournamentSettings}
                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-md shadow-lg hover:bg-blue-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105"
              >
                Save Settings
              </button>
            </div>

            {/* Team Management Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">⚽ Team Management ({teams.length} Teams)</h3>
              <div className="flex flex-wrap gap-3 mb-4 items-center">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter a new team name"
                  className="flex-grow px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 max-w-sm"
                />
                <button
                  onClick={handleAddTeam}
                  className="bg-red-600 text-white font-bold py-2 px-6 rounded-md hover:bg-red-700 transition-colors duration-200 uppercase tracking-wide"
                >
                  Add Team
                </button>
              </div>
              {teamError && <p className="text-red-500 text-sm mb-4">{teamError}</p>}

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600 h-64 overflow-y-auto custom-scrollbar">
                {teams.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No teams added yet. Add teams above!</p>
                ) : (
                  <ul className="space-y-2">
                    {teams.map(team => (
                      <li key={team.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-600">
                        <span className="font-medium text-gray-800 dark:text-white text-lg">{team.name}</span>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                          title="Delete Team"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
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
                  onClick={handleClearAllTeams}
                  className="bg-red-500 text-white font-bold py-2 px-6 rounded-md hover:bg-red-600 transition-colors duration-200 uppercase tracking-wide flex-grow"
                >
                  Clear All Teams
                </button>
                <button
                  onClick={() => openCustomModal('Info', 'List saving and loading are automatic via real-time database. For bulk operations, consider dedicated import/export features.', null, false)}
                  className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition-colors duration-200 uppercase tracking-wide flex-grow"
                >
                  Info on Lists
                </button>
              </div>

              <button
                onClick={handleGenerateFixtures}
                className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-md shadow-lg hover:bg-blue-700 transition-colors duration-200 uppercase tracking-wide transform hover:scale-105 mt-8"
              >
                Generate Fixtures
              </button>
            </div>

            {/* Fixture Management Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">📅 Fixture Management ({fixtures.length} Fixtures)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <select
                  value={newFixture.teamA}
                  onChange={(e) => setNewFixture({ ...newFixture, teamA: e.target.value })}
                  className="border p-3 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Home Team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
                <select
                  value={newFixture.teamB}
                  onChange={(e) => setNewFixture({ ...newFixture, teamB: e.target.value })}
                  className="border p-3 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Away Team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newFixture.date}
                  onChange={(e) => setNewFixture({ ...newFixture, date: e.target.value })}
                  className="border p-3 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {fixtureError && <p className="text-red-500 text-sm mb-4">{fixtureError}</p>}
              <button
                onClick={handleAddFixture}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-bold uppercase tracking-wide"
              >
                Add Custom Fixture
              </button>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600 h-96 overflow-y-auto custom-scrollbar mt-6">
                {fixtures.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No fixtures added yet. Generate or add above!</p>
                ) : (
                  <ul className="space-y-3">
                    {fixtures.map(fixture => (
                      <li key={fixture.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm border border-gray-200 dark:border-gray-600">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 dark:text-white text-lg break-words">
                            {fixture.teamA} vs {fixture.teamB}
                          </p>
                          {fixture.timestamp && fixture.timestamp.seconds ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Date: {new Date(fixture.timestamp.seconds * 1000).toLocaleDateString()}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Date: {fixture.date}</p>
                          )}
                          {/* Display Week Number if available */}
                          {fixture.weekNumber && fixture.weekNumber > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mt-1">
                              Week: {fixture.weekNumber}
                            </p>
                          )}
                          {fixture.status === 'completed' ? (
                            <p className="text-sm text-green-700 dark:text-green-300 font-bold mt-1">
                              Final Score: {fixture.scoreA} - {fixture.scoreB}
                            </p>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mt-1">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
                          {fixture.status !== 'completed' && (
                            <button
                              onClick={() => handleUpdateScores(fixture.id, fixture.scoreA, fixture.scoreB)}
                              className="bg-yellow-500 text-white px-4 py-2 rounded-md text-sm hover:bg-yellow-600 transition-colors font-semibold"
                            >
                              Update Scores
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteFixture(fixture.id)}
                            className="bg-red-500 text-white px-4 py-2 rounded-md text-sm hover:bg-red-600 transition-colors font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={handleClearAllFixtures}
                className="bg-red-500 text-white font-bold py-2 px-6 rounded-md hover:bg-red-600 transition-colors duration-200 uppercase tracking-wide mt-6 w-full"
              >
                Clear All Fixtures
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Modal Component (from ../components/Modal.jsx) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeCustomModal}
        onConfirm={modalConfirmAction}
        title={modalTitle}
        message={modalMessage}
        showConfirmButton={modalShowConfirmButton}
      >
        {/* Render custom content (e.g., score input fields) inside the modal */}
        {modalContent}
      </Modal>
    </div>
  );
}
