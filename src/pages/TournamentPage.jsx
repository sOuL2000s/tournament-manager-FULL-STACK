// src/pages/TournamentPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  setDoc // Added setDoc for potential future use or consistency
} from 'firebase/firestore';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'; // Added useSearchParams
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import ScoreInputModalContent from '../components/ScoreInputModalContent';

export default function TournamentPage() {
  const { id: tournamentId } = useParams();
  const [searchParams] = useSearchParams(); // Hook to read URL query parameters
  const shareId = searchParams.get('shareId'); // Get the shareId from the URL
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // State to determine if the page is in view-only mode
  // This will be true if shareId is present, or if user is null AND the tournament is public.
  const [isViewOnly, setIsViewOnly] = useState(false);
  // State to hold the actual owner ID for permission checks
  const [tournamentOwnerId, setTournamentOwnerId] = useState(null);

  // Tournament Details State
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loadingTournamentData, setLoadingTournamentData] = useState(true);
  const [generalError, setGeneralError] = useState(null);

  // Team Management State
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: '', group: '' }); // Modified to include group
  const [teamError, setTeamError] = useState('');

  // Group Management State
  const [groups, setGroups] = useState([]); // New state for groups
  const [newGroupName, setNewGroupName] = useState(''); // New state for adding new group
  const [groupError, setGroupError] = useState(''); // New state for group errors

  // Fixture Management State
  const [fixtures, setFixtures] = useState([]);
  const [newFixture, setNewFixture] = useState({ teamA: '', teamB: '', date: '', timestamp: null, status: 'scheduled', scoreA: 0, scoreB: 0 });
  const [fixtureError, setFixtureError] = useState('');

  // Modal State (for the shared Modal component)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalContent, setModalContent] = useState(null);
  const [modalConfirmAction, setModalConfirmAction] = useState(null);
  const [modalShowConfirmButton, setModalShowConfirmButton] = useState(true);

  // REF to access the ScoreInputModalContent component's methods (like getScoreA/B)
  const scoreInputRef = useRef(null);
  // State to hold the specific fixture being updated when the modal is open
  const [currentFixtureToUpdate, setCurrentFixtureToUpdate] = useState(null);

  // Tournament Configuration State
  const [enableColors, setEnableColors] = useState(false);
  const [promotionSpots, setPromotionSpots] = useState('');
  const [europeLeagueSpots, setEuropeLeagueSpots] = useState('');
  const [relegationSpots, setRelegationSpots] = useState('');
  const [fixtureOption, setFixtureOption] = useState('Single Matches');
  const [pointsPerWin, setPointsPerWin] = useState(3);
  const [pointsPerDraw, setPointsPerDraw] = useState(1);
  const [shareableLink, setShareableLink] = useState(''); // New state for the share link
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(''); // NEW STATE FOR QUALIFIERS PER GROUP

  // Helper function to open the custom modal (uses the shared Modal component)
  const openCustomModal = useCallback((title, message, confirmAction = null, showConfirm = true, content = null) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmAction(() => confirmAction); // Use a function to set state with a function
    setModalShowConfirmButton(showConfirm);
    setModalContent(content);
    setIsModalOpen(true);
  }, []);
  const closeCustomModal = useCallback(() => {
    setIsModalOpen(false);
    setModalTitle('');
    setModalMessage('');
    setModalContent(null);
    setModalConfirmAction(null);
    setModalShowConfirmButton(true);
  }, []);

  // --- Effect to fetch Tournament Details ---
  useEffect(() => {
    // If auth is still loading, wait.
    if (authLoading) {
      setLoadingTournamentData(true);
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
          const ownerId = data.userId;
          const isPublicTournament = data.isPublic || false; // Check for isPublic flag

          setTournamentOwnerId(ownerId); // Store owner ID for later checks

          // Determine if it's view-only mode
          // It's view-only if a shareId is present, OR if the user is NOT logged in AND the tournament is public.
          const currentIsViewOnly = (!!shareId) || (!user && isPublicTournament);
          setIsViewOnly(currentIsViewOnly);


          // Permission Check:
          // If a user is logged in, they must be the owner to get full access.
          // If NO user is logged in, but a shareId is present AND the tournament is public, allow read-only.
          if (user && user.uid && ownerId === user.uid) {
            // Full access for the owner
            setTournamentName(data.name);
            setTournamentDetails(data);
            setEnableColors(data.enableColors || false);
            setPromotionSpots(data.promotionSpots !== undefined ? String(data.promotionSpots) : '');
            setEuropeLeagueSpots(data.europeLeagueSpots !== undefined ? String(data.europeLeagueSpots) : '');
            setRelegationSpots(data.relegationSpots !== undefined ? String(data.relegationSpots) : '');
            setFixtureOption(data.fixtureOption || 'Single Matches');
            setPointsPerWin(data.pointsPerWin !== undefined ? data.pointsPerWin : 3);
            setPointsPerDraw(data.pointsPerDraw !== undefined ? data.pointsPerDraw : 1);
            setGroups(data.groups || []); // Load groups
            setQualifiersPerGroup(data.qualifiersPerGroup !== undefined ? String(data.qualifiersPerGroup) : ''); // LOAD NEW STATE
            setShareableLink(`${window.location.origin}/tournament/${tournamentId}?shareId=${tournamentId}`); // Re-generate for owner to copy
          } else if (currentIsViewOnly) {
            // Read-only access for public viewers (via share link or unauthenticated to public tourney)
            setTournamentName(data.name);
            setTournamentDetails(data);
            setEnableColors(data.enableColors || false);
            setPromotionSpots(data.promotionSpots !== undefined ? String(data.promotionSpots) : '');
            setEuropeLeagueSpots(data.europeLeagueSpots !== undefined ? String(data.europeLeagueSpots) : '');
            setRelegationSpots(data.relegationSpots !== undefined ? String(data.relegationSpots) : '');
            setFixtureOption(data.fixtureOption || 'Single Matches');
            setPointsPerWin(data.pointsPerWin !== undefined ? data.pointsPerWin : 3);
            setPointsPerDraw(data.pointsPerDraw !== undefined ? data.pointsPerDraw : 1);
            setGroups(data.groups || []); // Load groups for view
            setQualifiersPerGroup(data.qualifiersPerGroup !== undefined ? String(data.qualifiersPerGroup) : ''); // LOAD NEW STATE
            setShareableLink(''); // No share link to show for viewers
            // No error, as this is expected behavior for view-only.
          } else {
            // User is logged in but not the owner, OR user is not logged in and tournament is not public.
            setTournamentName('Access Denied');
            setGeneralError('You do not have permission to access this tournament. Please log in with the correct account or use a valid share link.');
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
  }, [tournamentId, user, authLoading, shareId]); // Added shareId to dependencies

  // --- Effect to listen to Teams and Fixtures ---
  // These effects now listen regardless of `user` status, but the security rules will filter access.
  useEffect(() => {
    if (loadingTournamentData || generalError) {
      setTeams([]); // Clear teams if still loading or error
      return;
    }

    // Teams subscription
    const teamsCollectionRef = collection(db, `tournaments/${tournamentId}/teams`);
    const unsubscribeTeams = onSnapshot(query(teamsCollectionRef, orderBy('name', 'asc')), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time teams:', err);
      // For view-only, just log the error, don't necessarily show it to the user.
      // For owner, you might want to show it.
      if (!isViewOnly) {
        setTeamError('Failed to load teams.');
      }
    });

    // Fixtures subscription
    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const unsubscribeFixtures = onSnapshot(query(fixturesCollectionRef, orderBy('timestamp', 'asc')), (snapshot) => {
      setFixtures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error('Error fetching real-time fixtures:', err);
      if (!isViewOnly) {
        setFixtureError('Failed to load fixtures.');
      }
    });
    return () => {
      unsubscribeTeams();
      unsubscribeFixtures();
    };
  }, [tournamentId, loadingTournamentData, generalError, isViewOnly]); // Added isViewOnly to dependencies

  // --- Leaderboard Update Logic ---
  // This should ideally only be called by the owner or a backend function.
  // However, for simplicity, we'll keep it client-side but guard against view-only calls.
  const updateLeaderboard = useCallback(async () => {
    if (isViewOnly || !tournamentId || !tournamentDetails) {
      console.log('Skipping leaderboard update: View-only mode or tournament data missing.');
      return;
    }
    // Ensure the current user is the owner before attempting to write to the leaderboard
    if (user?.uid !== tournamentOwnerId) {
      console.warn('Attempted leaderboard update by non-owner in non-view-only mode. Aborting.');
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
          group: teamDoc.data().group || 'Ungrouped', // Include group here
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
  }, [tournamentId, tournamentDetails, isViewOnly, user, tournamentOwnerId]); // Added user, tournamentOwnerId to dependencies

  // Effect to trigger leaderboard update when fixtures or tournamentDetails change
  useEffect(() => {
    // Only update leaderboard if not in view-only mode and is the owner
    if (!isViewOnly && user?.uid === tournamentOwnerId) {
      if (fixtures.length > 0 || (fixtures.length === 0 && !loadingTournamentData)) {
        updateLeaderboard();
      }
    }
  }, [fixtures, tournamentDetails, authLoading, user, updateLeaderboard, loadingTournamentData, isViewOnly, tournamentOwnerId]);

  // --- Group Management Handlers ---
  const handleAddGroup = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to add groups.', null, false);
      return;
    }
    setGroupError('');
    if (!newGroupName.trim()) {
      setGroupError('Group name cannot be empty.');
      return;
    }
    // Generate group names as A, B, C... based on the number of groups
    const numGroups = parseInt(newGroupName.trim());
    if (isNaN(numGroups) || numGroups <= 0) {
        setGroupError('Please enter a valid number of groups (e.g., 2, 4).');
        return;
    }
    
    let generatedGroupNames = [];
    for (let i = 0; i < numGroups; i++) {
        generatedGroupNames.push(`Group ${String.fromCharCode(65 + i)}`); // A, B, C, ...
    }

    if (generatedGroupNames.some(g => groups.includes(g))) {
        setGroupError('Some generated group names already exist. Clear existing groups first or reduce the number.');
        return;
    }

    try {
      const updatedGroups = [...groups, ...generatedGroupNames]; // Append newly generated groups
      const tournamentRef = doc(db, 'tournaments', tournamentId);
      await updateDoc(tournamentRef, { groups: updatedGroups });
      setGroups(updatedGroups);
      setNewGroupName('');
    } catch (err) {
      console.error('Error adding group:', err);
      setGroupError('Failed to add group. Please try again.');
    }
  };

  const handleDeleteGroup = async (groupToDelete) => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to delete groups.', null, false);
      return;
    }
    openCustomModal(
      'Confirm Delete Group',
      `Are you sure you want to delete group "${groupToDelete}"? Teams assigned to this group will no longer have a group.`,
      async () => {
        try {
          const updatedGroups = groups.filter(group => group !== groupToDelete);
          const tournamentRef = doc(db, 'tournaments', tournamentId);
          await updateDoc(tournamentRef, { groups: updatedGroups });
          setGroups(updatedGroups);

          // Optionally, update teams that were in this group to have no group
          const teamsInGroupQuery = query(collection(db, `tournaments/${tournamentId}/teams`), where('group', '==', groupToDelete));
          const teamsInGroupSnapshot = await getDocs(teamsInGroupQuery);
          const batch = writeBatch(db);
          teamsInGroupSnapshot.docs.forEach(teamDoc => {
            batch.update(teamDoc.ref, { group: '' });
          });
          await batch.commit();

          closeCustomModal();
        } catch (err) {
          console.error('Error deleting group:', err);
          openCustomModal('Error', 'Failed to delete group. Please try again.');
        }
      }
    );
  };

  // --- Team Management Handlers ---
  const handleAddTeam = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to add teams in view-only mode.', null, false);
      return;
    }
    setTeamError('');
    if (!newTeam.name.trim()) {
      setTeamError('Team name cannot be empty.');
      return;
    }
    if (teams.some(team => team.name.toLowerCase() === newTeam.name.trim().toLowerCase())) {
      setTeamError('A team with this name already exists.');
      return;
    }
    if (tournamentDetails?.type === 'Multi-Phase' && !newTeam.group && groups.length > 0) {
        // Only enforce group selection if it's multi-phase AND groups have been defined
        setTeamError('For Multi-Phase tournaments with defined groups, a team must be assigned to a group.');
        return;
    }
    try {
      await addDoc(collection(db, `tournaments/${tournamentId}/teams`), { name: newTeam.name.trim(), group: newTeam.group });
      setNewTeam({ name: '', group: newTeam.group }); // Keep selected group for next add
    } catch (err) {
      console.error('Error adding team:', err);
      setTeamError('Failed to add team. Make sure the tournament ID is valid and you have permission.');
    }
  };
  const handleDeleteTeam = async (teamId) => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to delete teams in view-only mode.', null, false);
      return;
    }
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
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to clear all teams in view-only mode.', null, false);
      return;
    }
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

  // --- Randomly Assign Teams to Groups Handler ---
  const handleRandomlyAssignTeamsToGroups = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to assign teams to groups.', null, false);
      return;
    }
    if (tournamentDetails?.type !== 'Multi-Phase') {
      openCustomModal('Info', 'This feature is only available for Multi-Phase Tournaments.', null, false);
      return;
    }
    if (groups.length === 0) {
      openCustomModal('Info', 'Please define some groups first (e.g., Group A, Group B).', null, false);
      return;
    }
    if (teams.length === 0) {
      openCustomModal('Info', 'Please add some teams first.', null, false);
      return;
    }

    openCustomModal(
      'Confirm Random Group Assignment',
      'This will randomly assign all existing teams to your defined groups. Existing group assignments will be overwritten. Are you sure?',
      async () => {
        try {
          const shuffledTeams = [...teams].sort(() => Math.random() - 0.5); // Shuffle teams
          const batch = writeBatch(db);
          let groupIndex = 0;

          shuffledTeams.forEach(team => {
            const assignedGroup = groups[groupIndex % groups.length];
            const teamRef = doc(db, `tournaments/${tournamentId}/teams`, team.id);
            batch.update(teamRef, { group: assignedGroup });
            groupIndex++;
          });

          await batch.commit();
          closeCustomModal();
          openCustomModal('Success', 'Teams randomly assigned to groups successfully!', null, false);
        } catch (err) {
          console.error('Error assigning teams to groups:', err);
          openCustomModal('Error', 'Failed to assign teams to groups. Please try again.', null, false);
        }
      }
    );
  };


  // --- Tournament Settings Handlers ---
  const handleSaveTournamentSettings = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to save settings in view-only mode.', null, false);
      return;
    }
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
        groups: groups, // Save groups to tournament document
        qualifiersPerGroup: parseInt(qualifiersPerGroup) || 0, // SAVE NEW SETTING
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
        groups: groups, // Update local state for consistency
        qualifiersPerGroup: parseInt(qualifiersPerGroup) || 0, // Update local state for consistency
      }));
    } catch (err) {
      console.error('Error saving tournament configuration:', err);
      openCustomModal('Error', 'Failed to save tournament configuration. Please try again.');
    }
  };

  // New handler to toggle tournament public status and generate link
  const handleTogglePublicStatus = async () => {
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to change public status.', null, false);
      return;
    }

    const currentPublicStatus = tournamentDetails?.isPublic || false;
    const newPublicStatus = !currentPublicStatus;
    openCustomModal(
      'Confirm Public Status Change',
      `Are you sure you want to ${newPublicStatus ? 'make this tournament PUBLIC' : 'make this tournament PRIVATE'}?`,
      async () => {
        try {
          const tournamentRef = doc(db, 'tournaments', tournamentId);
          await updateDoc(tournamentRef, { isPublic: newPublicStatus });
          setTournamentDetails(prev => ({ ...prev, isPublic: newPublicStatus }));

          if (newPublicStatus) {
            const link = `${window.location.origin}/tournament/${tournamentId}?shareId=${tournamentId}`;
            setShareableLink(link);
            openCustomModal('Success', `Tournament is now public! Share this link: ${link}`, null, false);
          } else {
            setShareableLink('');
            openCustomModal('Success', 'Tournament is now private.', null, false);
          }
          closeCustomModal();
        } catch (err) {
          console.error('Error updating public status:', err);
          openCustomModal('Error', 'Failed to update public status. Please try again.');
        }
      }
    );
  };

  // Helper to copy share link to clipboard
  const copyShareLink = useCallback(() => {
    if (shareableLink) {
      navigator.clipboard.writeText(shareableLink)
        .then(() => openCustomModal('Link Copied!', 'The shareable link has been copied to your clipboard.', null, false))
        .catch(err => openCustomModal('Error', 'Failed to copy link. Please copy it manually.', null, false));
    }
  }, [shareableLink, openCustomModal]);

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
          updateLeaderboard();
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
    if (isViewOnly || user?.uid !== tournamentOwnerId) {
      openCustomModal('Access Denied', 'You do not have permission to update scores in view-only mode.', null, false);
      return;
    }
    const fixtureToUpdate = fixtures.find(f => f.id === fixtureId);
    if (!fixtureToUpdate) {
      console.warn(`Fixture with ID ${fixtureId} not found.`);
      return;
    }
    setCurrentFixtureToUpdate(fixtureToUpdate);
    const confirmAction = async () => {
      if (!scoreInputRef.current) {
        console.error("scoreInputRef.current is null. ScoreInputModalContent might not be mounted or ref not attached.");
        openCustomModal('Error', 'Internal error: Cannot read scores. Please try again.', null, false);
        return;
      }
      const parsedScoreA = parseInt(scoreInputRef.current.getScoreA());
      const parsedScoreB = parseInt(scoreInputRef.current.getScoreB());

      if (isNaN(parsedScoreA) || isNaN(parsedScoreB)) {
        openCustomModal('Invalid Input', 'Please enter valid numbers for scores.', null, false, (
          <ScoreInputModalContent
            ref={scoreInputRef}
            fixture={fixtureToUpdate}
            initialScoreA={scoreInputRef.current.getScoreA()}
            initialScoreB={scoreInputRef.current.getScoreB()}
          />
        ));
        return;
      }

      try {
        const fixtureRef = doc(db, `tournaments/${tournamentId}/fixtures`, fixtureId);
        await updateDoc(fixtureRef, {
          scoreA: parsedScoreA,
          scoreB: parsedScoreB,
          status: 'completed'
        });
        closeCustomModal();
        updateLeaderboard();
      } catch (err) {
        console.error('Error updating scores:', err);
        openCustomModal('Error', 'Failed to update scores. Please try again.', null, false, (
          <ScoreInputModalContent
            ref={scoreInputRef}
            fixture={fixtureToUpdate}
            initialScoreA={scoreInputRef.current.getScoreA()}
            initialScoreB={scoreInputRef.current.getScoreB()}
          />
        ));
      }
    };

    openCustomModal(
      'Update Match Scores',
      `Enter scores for ${fixtureToUpdate.teamA} vs ${fixtureToUpdate.teamB}:`,
      confirmAction,
      true,
      <ScoreInputModalContent
        ref={scoreInputRef}
        fixture={fixtureToUpdate}
        initialScoreA={currentScoreA}
        initialScoreB={currentScoreB}
      />
    );
  }, [fixtures, tournamentId, openCustomModal, closeCustomModal, updateLeaderboard, isViewOnly, user, tournamentOwnerId]);


  // Common Loading/Error/No Access UI
  const renderLoadingOrError = () => (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar - Always render for consistent layout */}
      <div className="bg-red-600 text-white p-4 flex flex-wrap justify-center sm:justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">AI PREDICTION</Link>
      </div>

      <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-center">✨ {tournamentName} Details</h2>
        {generalError ?
          (
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

  // Determine if the current user is the owner
  const isOwner = user && user.uid === tournamentOwnerId;

  // Render content based on view-only mode
  console.log('TournamentPage rendering. isViewOnly:', isViewOnly, 'isOwner:', isOwner); // Debugging line


  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex flex-wrap justify-center sm:justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors min-w-[100px] md:min-w-0">AI PREDICTION</Link>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6 sm:mb-8 text-red-600 dark:text-red-400">
          {tournamentName}
        </h1>

        {isViewOnly && (
          <p className="text-center text-sm sm:text-base text-blue-500 mb-6 font-semibold bg-blue-100 dark:bg-blue-900 p-3 rounded-md">
            You are in view-only mode for this tournament. Some features are disabled.
          </p>
        )}

        {/* Tournament Owner Controls (Conditionally Rendered) */}
        {(!isViewOnly && isOwner) && (
          <div className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">Tournament Controls</h2>

            {/* Public/Private Toggle */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="publicToggle" className="block text-gray-700 dark:text-gray-300 font-semibold mb-2 sm:mb-0">
                Tournament Status:
              </label>
              <div className="flex items-center">
                <span className={`mr-2 font-medium ${tournamentDetails?.isPublic ? 'text-green-600' : 'text-gray-500'}`}>
                  {tournamentDetails?.isPublic ? 'PUBLIC' : 'PRIVATE'}
                </span>
                <button
                  onClick={handleTogglePublicStatus}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200
                  ${tournamentDetails?.isPublic
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                    } w-full sm:w-auto`}
                >
                  {tournamentDetails?.isPublic ? 'Make Private' : 'Make Public'}
                </button>
              </div>
            </div>

            {/* Shareable Link */}
            {shareableLink && (
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Shareable Link:</label>
                <div className="flex flex-col sm:flex-row items-center">
                  <input
                    type="text"
                    readOnly
                    value={shareableLink}
                    className="flex-grow p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2 sm:mb-0 sm:mr-2 w-full"
                    onClick={(e) => e.target.select()} // Select all text on click
                  />
                  <button
                    onClick={copyShareLink}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 transition-colors font-semibold w-full sm:w-auto"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}

            {/* Tournament Configuration */}
            <h3 className="text-lg sm:text-xl font-bold mt-6 mb-3 text-gray-700 dark:text-gray-200">Configuration Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="fixtureOption" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fixture Type:</label>
                <select
                  id="fixtureOption"
                  value={fixtureOption}
                  onChange={(e) => setFixtureOption(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="Single Matches">Single Matches</option>
                  <option value="Home and Away Matches">Home and Away Matches</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableColors"
                  checked={enableColors}
                  onChange={(e) => setEnableColors(e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="enableColors" className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Leaderboard Colors</label>
              </div>
              <div>
                <label htmlFor="promotionSpots" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Promotion Spots (Top N):</label>
                <input
                  type="number"
                  id="promotionSpots"
                  value={promotionSpots}
                  onChange={(e) => setPromotionSpots(e.target.value)}
                  min="0"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="europeLeagueSpots" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Europe League Spots (Next N):</label>
                <input
                  type="number"
                  id="europeLeagueSpots"
                  value={europeLeagueSpots}
                  onChange={(e) => setEuropeLeagueSpots(e.target.value)}
                  min="0"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="relegationSpots" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Relegation Spots (Bottom N):</label>
                <input
                  type="number"
                  id="relegationSpots"
                  value={relegationSpots}
                  onChange={(e) => setRelegationSpots(e.target.value)}
                  min="0"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="pointsPerWin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Points per Win:</label>
                <input
                  type="number"
                  id="pointsPerWin"
                  value={pointsPerWin}
                  onChange={(e) => setPointsPerWin(e.target.value)}
                  min="0"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="pointsPerDraw" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Points per Draw:</label>
                <input
                  type="number"
                  id="pointsPerDraw"
                  value={pointsPerDraw}
                  onChange={(e) => setPointsPerDraw(e.target.value)}
                  min="0"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              {/* NEW INPUT: Teams to Qualify Per Group */}
              {tournamentDetails?.type === 'Multi-Phase' && (
                <div>
                    <label htmlFor="qualifiersPerGroup" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teams to Qualify Per Group:</label>
                    <input
                        type="number"
                        id="qualifiersPerGroup"
                        value={qualifiersPerGroup}
                        onChange={(e) => setQualifiersPerGroup(e.target.value)}
                        min="0"
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        For Multi-Phase tournaments: Number of teams advancing from each group to the knockout stage.
                    </p>
                </div>
              )}
            </div>
            <button
              onClick={handleSaveTournamentSettings}
              className="bg-green-500 text-white font-bold py-2 px-6 rounded-md hover:bg-green-600 transition-colors duration-200 uppercase tracking-wide w-full md:w-auto"
            >
              Save Settings
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams Section */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">Teams ({teams.length})</h2>
            {teamError && <p className="text-red-500 mb-4">{teamError}</p>}
            {(!isViewOnly && isOwner) && (
              <div className="mb-6">
                {tournamentDetails?.type === 'Multi-Phase' && (
                    <div className="mb-4">
                        <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">Group Management</h3>
                        <div className="flex mb-2">
                            <input
                                type="text"
                                placeholder="Number of groups (e.g., 2, 4)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="flex-grow p-2 border border-gray-300 rounded-l-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button
                                onClick={handleAddGroup}
                                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 transition-colors"
                            >
                                Add Groups
                            </button>
                        </div>
                        {groupError && <p className="text-red-500 text-sm mb-2">{groupError}</p>}
                        {groups.length > 0 && (
                            <div className="border border-gray-300 dark:border-gray-600 rounded-md p-2 max-h-32 overflow-y-auto mb-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Existing Groups:</p>
                                {groups.map((group, index) => (
                                    <div key={index} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md mb-1">
                                        <span className="text-gray-900 dark:text-white">{group}</span>
                                        <button
                                            onClick={() => handleDeleteGroup(group)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={handleRandomlyAssignTeamsToGroups}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 transition-colors font-semibold w-full"
                        >
                            Randomly Assign Teams to Groups
                        </button>
                    </div>
                )}

                <input
                  type="text"
                  placeholder="New team name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                {tournamentDetails?.type === 'Multi-Phase' && groups.length > 0 && (
                    <select
                        value={newTeam.group}
                        onChange={(e) => setNewTeam({ ...newTeam, group: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Select Group</option>
                        {groups.map((group, index) => (
                            <option key={index} value={group}>{group}</option>
                        ))}
                    </select>
                )}
                <button
                  onClick={handleAddTeam}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 transition-colors font-semibold w-full"
                >
                  Add Team
                </button>
              </div>
            )}
            {teams.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No teams added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {teams.map((team) => (
                    <li key={team.id} className="py-3 flex flex-col sm:flex-row justify-between items-center">
                      <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg mb-2 sm:mb-0">
                        {team.name}
                        {team.group && <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">({team.group})</span>}
                      </span>
                      {(!isViewOnly && isOwner) && (
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors font-semibold w-full sm:w-auto"
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(!isViewOnly && isOwner) && (
              <button
                onClick={handleClearAllTeams}
                className="bg-red-500 text-white font-bold py-2 px-6 rounded-md hover:bg-red-600 transition-colors duration-200 uppercase tracking-wide mt-6 w-full"
              >
                Clear All Teams
              </button>
            )}
          </div>

          {/* Fixtures Section */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-white">Fixtures ({fixtures.length})</h2>
            {fixtureError && <p className="text-red-500 mb-4">{fixtureError}</p>}

            {(!isViewOnly && isOwner) && (
              <>
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={newFixture.teamA}
                    onChange={(e) => setNewFixture({ ...newFixture, teamA: e.target.value })}
                    className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                  >
                    <option value="">Select Team A</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.name}>{team.name}</option>
                    ))}
                  </select>
                  <select
                    value={newFixture.teamB}
                    onChange={(e) => setNewFixture({ ...newFixture, teamB: e.target.value })}
                    className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
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
                    className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={handleAddFixture}
                    className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 transition-colors font-semibold w-full sm:flex-1"
                  >
                    Add Custom Fixture
                  </button>
                  <button
                    onClick={handleGenerateFixtures}
                    className="bg-purple-500 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-600 transition-colors font-semibold w-full sm:flex-1"
                  >
                    Generate Round-Robin Fixtures
                  </button>
                </div>
              </>
            )}

            {fixtures.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No fixtures scheduled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {fixtures.map((fixture) => (
                    <li key={fixture.id} className="py-3 flex flex-col sm:flex-row justify-between items-center">
                      <div className="flex-1 mb-2 sm:mb-0 sm:mr-4">
                        <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg">
                          {fixture.teamA} vs {fixture.teamB}
                        </span>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {fixture.date} - Status:
                          <span className={`ml-1 font-medium ${fixture.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}`}>
                            {fixture.status.toUpperCase()}
                          </span>
                          {fixture.status === 'completed' && (
                            <span className="ml-2 text-gray-700 dark:text-gray-300">
                              ({fixture.scoreA} - {fixture.scoreB})
                            </span>
                          )}
                        </p>
                      </div>
                      {(!isViewOnly && isOwner) && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleUpdateScores(fixture.id, fixture.scoreA, fixture.scoreB)}
                            className="bg-indigo-500 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-600 transition-colors font-semibold"
                          >
                            Update Score
                          </button>
                          <button
                            onClick={() => handleDeleteFixture(fixture.id)}
                            className="bg-red-500 text-white px-4 py-2 rounded-md text-sm hover:bg-red-600 transition-colors font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(!isViewOnly && isOwner) && ( // Only show this button if not view-only AND owner
              <button
                onClick={handleClearAllFixtures}
                className="bg-red-500 text-white font-bold py-2 px-6 rounded-md hover:bg-red-600 transition-colors duration-200 uppercase tracking-wide mt-6 w-full"
              >
                Clear All Fixtures
              </button>
            )}
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
        {/* Render custom content (e.e., score input fields) inside the modal */}
        {modalContent}
      </Modal>
    </div>
  );
}
