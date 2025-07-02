// src/pages/StatsPage.jsx

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function StatsPage() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournamentName, setTournamentName] = useState('Loading...');
  const [loadingTournamentData, setLoadingTournamentData] = useState(true);
  const [error, setError] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]); // State to hold unique team names

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const shareId = queryParams.get('shareId');

  // Determine if the page is in read-only mode
  const isViewOnly = useMemo(() => {
    if (shareId) return true;
    return false; // Not read-only if no shareId
  }, [shareId]);

  const [tournamentOwnerId, setTournamentOwnerId] = useState(null);

  useEffect(() => {
    if (authLoading) {
      setLoadingTournamentData(true);
      return;
    }

    if (!user && !shareId) {
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

    const fetchTournamentData = async () => {
      try {
        const tournamentDocRef = doc(db, 'tournaments', tournamentId);
        const tournamentSnap = await getDoc(tournamentDocRef);

        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          setTournamentName(data.name);
          setTournamentOwnerId(data.userId);

          // If shareId is present, allow access
          if (shareId && data.shareId === shareId) {
            // Public view, no further permission check needed
          } else if (user && data.userId === user.uid) {
            // Owner access
          } else {
            // Neither shareId matches, nor is the user the owner
            setTournamentName('Access Denied');
            setError('You do not have permission to access this tournament.');
          }
        } else {
          setTournamentName('Tournament Not Found');
          setError('The requested tournament does not exist.');
        }
        setLoadingTournamentData(false);
      } catch (err) {
        console.error('Error fetching tournament data:', err);
        setTournamentName('Error');
        setError('Failed to load tournament details.');
        setLoadingTournamentData(false);
      }
    };
    fetchTournamentData();
  }, [tournamentId, user, authLoading, shareId]);


  useEffect(() => {
    if (loadingTournamentData || error || (!user && !shareId)) return;

    const fixturesCollectionRef = collection(db, `tournaments/${tournamentId}/fixtures`);
    const unsubscribeFixtures = onSnapshot(fixturesCollectionRef, (snapshot) => {
      const fetchedFixtures = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFixtures(fetchedFixtures);
    }, (err) => {
      console.error('Error fetching real-time fixtures:', err);
      setError('Failed to load fixtures. Please try again.');
    });

    const playersCollectionRef = collection(db, `tournaments/${tournamentId}/players`);
    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      const fetchedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlayers(fetchedPlayers);
      const uniqueTeams = [...new Set(fetchedPlayers.map(player => player.team))];
      setTeams(uniqueTeams);
    }, (err) => {
      console.error('Error fetching real-time players:', err);
      setError('Failed to load players. Please try again.');
    });

    return () => {
      unsubscribeFixtures();
      unsubscribePlayers();
    };
  }, [tournamentId, loadingTournamentData, error, user, shareId]);


  // Derived state for stats
  const {
    totalMatches,
    completedMatches,
    pendingMatches,
    goalsPerMatch,
    winsByTeam,
    teamGoals,
    matchOutcomes,
    playerGoals,
    manOfTheMatchCounts
  } = useMemo(() => {
    let total = 0;
    let completed = 0;
    let teamWins = {};
    let teamGoalsFor = {};
    let outcomes = { 'Win': 0, 'Draw': 0, 'Loss': 0 }; // Relative to team A in a fixture
    let pGoals = {};
    let motmCounts = {};

    fixtures.forEach(fixture => {
      total++;
      if (fixture.status === 'completed') {
        completed++;

        const scoreA = fixture.scoreA || 0;
        const scoreB = fixture.scoreB || 0;

        // Wins by Team
        if (scoreA > scoreB) {
          teamWins[fixture.teamA] = (teamWins[fixture.teamA] || 0) + 1;
          outcomes['Win']++;
        } else if (scoreB > scoreA) {
          teamWins[fixture.teamB] = (teamWins[fixture.teamB] || 0) + 1;
          outcomes['Loss']++;
        } else {
          outcomes['Draw']++;
        }

        // Team Goals
        teamGoalsFor[fixture.teamA] = (teamGoalsFor[fixture.teamA] || 0) + scoreA;
        teamGoalsFor[fixture.teamB] = (teamGoalsFor[fixture.teamB] || 0) + scoreB;

        // Player Goals (assuming goals structure is {playerId: count})
        if (fixture.goals) {
          for (const playerId in fixture.goals) {
            pGoals[players.find(p => p.id === playerId)?.name || playerId] = (pGoals[players.find(p => p.id === playerId)?.name || playerId] || 0) + fixture.goals[playerId];
          }
        }

        // Man of the Match
        if (fixture.manOfTheMatch) {
          motmCounts[players.find(p => p.id === fixture.manOfTheMatch)?.name || fixture.manOfTheMatch] = (motmCounts[players.find(p => p.id === fixture.manOfTheMatch)?.name || fixture.manOfTheMatch] || 0) + 1;
        }
      }
    });

    const pending = total - completed;
    const totalGoals = Object.values(teamGoalsFor).reduce((sum, current) => sum + current, 0);
    const avgGoalsPerMatch = completed > 0 ? (totalGoals / (completed * 2)) : 0; // Each fixture has 2 teams scoring

    return {
      totalMatches: total,
      completedMatches: completed,
      pendingMatches: pending,
      goalsPerMatch: avgGoalsPerMatch.toFixed(2),
      winsByTeam: teamWins,
      teamGoals: teamGoalsFor,
      matchOutcomes: outcomes,
      playerGoals: pGoals,
      manOfTheMatchCounts: motmCounts
    };
  }, [fixtures, players]); // Re-calculate if fixtures or players change

  // Chart data configurations
  const goalsPerTeamChartData = {
    labels: Object.keys(teamGoals),
    datasets: [{
      label: 'Goals Scored',
      data: Object.values(teamGoals),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }]
  };

  const matchOutcomesChartData = {
    labels: Object.keys(matchOutcomes),
    datasets: [{
      label: 'Match Outcomes',
      data: Object.values(matchOutcomes),
      backgroundColor: [
        'rgba(54, 162, 235, 0.6)', // Win
        'rgba(255, 206, 86, 0.6)', // Draw
        'rgba(255, 99, 132, 0.6)', // Loss
      ],
      borderColor: [
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)',
      ],
      borderWidth: 1,
    }]
  };

  const topScorersChartData = {
    labels: Object.keys(playerGoals).sort((a, b) => playerGoals[b] - playerGoals[a]).slice(0, 5), // Top 5
    datasets: [{
      label: 'Goals',
      data: Object.values(playerGoals).sort((a, b) => b - a).slice(0, 5),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1,
    }]
  };

  const manOfTheMatchChartData = {
    labels: Object.keys(manOfTheMatchCounts).sort((a, b) => manOfTheMatchCounts[b] - manOfTheMatchCounts[a]).slice(0, 5), // Top 5
    datasets: [{
      label: 'Man of the Match Awards',
      data: Object.values(manOfTheMatchCounts).sort((a, b) => b - a).slice(0, 5),
      backgroundColor: 'rgba(255, 159, 64, 0.6)',
      borderColor: 'rgba(255, 159, 64, 1)',
      borderWidth: 1,
    }]
  };

  // Common Loading/Error/No Access UI
  const renderLoadingOrError = () => (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top Navigation Bar - Always render for consistent layout */}
      <div className="bg-red-600 text-white p-4 flex justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">TOP SCORERS</Link>
        <Link to={`/tournament/${tournamentId}/stats${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors">AI PREDICTION</Link>
      </div>
      <div className="flex-grow flex items-center justify-center p-4">
        {loadingTournamentData ? (
          <p className="text-lg font-semibold animate-pulse">Loading tournament data...</p>
        ) : error ? (
          <p className="text-red-500 text-lg font-semibold">{error}</p>
        ) : (
          <p className="text-gray-500 text-lg font-semibold">No data available or access denied.</p>
        )}
      </div>
    </div>
  );

  if (loadingTournamentData || error || (!user && !shareId)) {
    return renderLoadingOrError();
  }

  // Check if there are any completed fixtures to display stats for
  const hasCompletedFixtures = fixtures.some(f => f.status === 'completed');

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* Top Navigation Bar */}
      <div className="bg-red-600 text-white p-4 flex flex-wrap justify-around font-bold text-lg">
        <Link to={`/tournament/${tournamentId}/leaderboard${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">LEAGUE</Link>
        <Link to={`/tournament/${tournamentId}/fixtures${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">FIXTURES</Link>
        <Link to={`/tournament/${tournamentId}/players${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">PLAYERS</Link> {/* Changed from TOP SCORERS to PLAYERS */}
        <Link to={`/tournament/${tournamentId}/stats${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">STATS</Link>
        <Link to={`/tournament/${tournamentId}/knockout${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">KNOCKOUT</Link>
        <Link to={`/tournament/${tournamentId}/ai-prediction${shareId ? `?shareId=${shareId}` : ''}`} className="flex-1 text-center py-2 px-1 hover:bg-red-700 transition-colors whitespace-nowrap min-w-max">AI PREDICTION</Link>
      </div>

      <div className="flex-grow p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">📊 Tournament Stats ({tournamentName})</h2>

        {!hasCompletedFixtures ? (
          <p className="text-gray-500 text-center text-lg mt-8">No matches have been completed yet for this tournament. Complete some fixtures to see statistics!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* General Stats Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col items-center justify-center">
              <h3 className="text-xl font-semibold mb-3">Overview</h3>
              <p className="text-lg">Total Matches: <span className="font-bold">{totalMatches}</span></p>
              <p className="text-lg">Completed Matches: <span className="font-bold text-green-600 dark:text-green-400">{completedMatches}</span></p>
              <p className="text-lg">Pending Matches: <span className="font-bold text-yellow-600 dark:text-yellow-400">{pendingMatches}</span></p>
              <p className="text-lg">Avg. Goals per Match: <span className="font-bold">{goalsPerMatch}</span></p>
            </div>

            {/* Goals Per Team Chart */}
            {Object.keys(teamGoals).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-center">Goals Scored Per Team</h3>
                <Bar data={goalsPerTeamChartData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>
            )}

            {/* Match Outcomes Chart */}
            {Object.values(matchOutcomes).some(count => count > 0) && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col items-center justify-center">
                <h3 className="text-xl font-semibold mb-4 text-center">Match Outcomes</h3>
                <div className="relative w-full max-w-xs aspect-square">
                  <Pie data={matchOutcomesChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
            )}

            {/* Top 5 Scorers Chart */}
            {Object.keys(playerGoals).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-center">Top 5 Scorers</h3>
                <Bar data={topScorersChartData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true }} />
              </div>
            )}

            {/* Top 5 Man of the Match Awards Chart */}
            {Object.keys(manOfTheMatchCounts).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-center">Top Man of the Match Awards</h3>
                <Doughnut data={manOfTheMatchChartData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>
            )}

            {/* Wins By Team List (if more than charts needed) */}
            {Object.keys(winsByTeam).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md col-span-1 md:col-span-2 lg:col-span-1">
                <h3 className="text-xl font-semibold mb-4 text-center">Wins by Team</h3>
                <ul className="space-y-2">
                  {Object.entries(winsByTeam)
                    .sort(([, winsA], [, winsB]) => winsB - winsA)
                    .map(([teamName, wins]) => (
                      <li key={teamName} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                        <span className="font-medium">{teamName}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{wins} Wins</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}